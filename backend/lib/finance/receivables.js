const { prisma } = require('../prisma');

function isWithinRange(dateValue, range = null) {
  if (!range?.from || !range?.to) return true;
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date >= new Date(range.from) && date <= new Date(range.to);
}

function buildPreviousMonthRange(range) {
  if (!range?.from) return null;
  const from = new Date(range.from);
  const previousMonth = new Date(from.getFullYear(), from.getMonth() - 1, 1);
  const previousMonthEnd = new Date(from.getFullYear(), from.getMonth(), 0, 23, 59, 59, 999);
  return {
    from: previousMonth.toISOString(),
    to: previousMonthEnd.toISOString(),
  };
}

function buildPreviousWeekRange(range) {
  if (!range?.from) return null;
  const from = new Date(range.from);
  const prevWeekStart = new Date(from);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  prevWeekStart.setHours(0, 0, 0, 0);
  const prevWeekEnd = new Date(prevWeekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);
  prevWeekEnd.setHours(23, 59, 59, 999);
  return {
    from: prevWeekStart.toISOString(),
    to: prevWeekEnd.toISOString(),
  };
}

function calculateInvoiceRemaining(invoice) {
  const paid = (invoice.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
  return Math.max(0, (invoice.netTotal || 0) - paid);
}

async function fetchOpenInvoices({ organizationId, branchId = null }) {
  return prisma.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['OPEN', 'PARTIAL'] },
      ...(branchId && { branchId }),
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, branchId: true } },
      payments: { where: { deletedAt: null }, select: { amount: true } },
    },
  });
}

async function fetchActivePaymentPlans({ organizationId, branchId = null }) {
  return prisma.paymentPlan.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      ...(branchId && {
        patient: { branchId },
      }),
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, branchId: true } },
      installments: {
        where: { status: 'PENDING' },
        orderBy: { dueDate: 'asc' },
      },
    },
  });
}

async function getClinicRevenueSnapshot({ organizationId, branchId = null, range }) {
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      ...(branchId && { branchId }),
      ...(range?.from && range?.to
        ? {
            createdAt: {
              gte: new Date(range.from),
              lte: new Date(range.to),
            },
          }
        : {}),
    },
    select: { id: true, netTotal: true, createdAt: true },
  });

  const revenueAmount = invoices.reduce((sum, invoice) => sum + (invoice.netTotal || 0), 0);
  return {
    invoiceCount: invoices.length,
    revenueAmount,
    invoices,
  };
}

async function getClinicCollectionSnapshot({ organizationId, branchId = null, range }) {
  const payments = await prisma.payment.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(branchId && {
        patient: { branchId },
      }),
      ...(range?.from && range?.to
        ? {
            paidAt: {
              gte: new Date(range.from),
              lte: new Date(range.to),
            },
          }
        : {}),
    },
    select: { id: true, amount: true, paidAt: true },
  });

  const collectionAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  return {
    paymentCount: payments.length,
    collectionAmount,
    payments,
  };
}

async function getPendingCollectionsSnapshot({ organizationId, branchId = null, range = null }) {
  const invoices = await fetchOpenInvoices({ organizationId, branchId });

  const patientsWithBalance = invoices
    .map((invoice) => {
      const remaining = calculateInvoiceRemaining(invoice);
      const referenceDate = invoice.dueDate || invoice.createdAt;
      return {
        patientId: invoice.patientId,
        patientName: invoice.patient ? `${invoice.patient.firstName} ${invoice.patient.lastName}`.trim() : '',
        source: `Fatura ${invoice.number}`,
        amountDue: remaining,
        remaining,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        type: 'invoice',
        invoiceId: invoice.id,
        matchesRange: isWithinRange(referenceDate, range),
      };
    })
    .filter((item) => item.amountDue > 0 && item.matchesRange);

  return {
    patientsWithBalance,
    totalPendingAmount: patientsWithBalance.reduce((sum, item) => sum + item.amountDue, 0),
    openInvoiceCount: patientsWithBalance.length,
  };
}

async function getOutstandingReceivablesSnapshot({ organizationId, branchId = null }) {
  const pending = await getPendingCollectionsSnapshot({ organizationId, branchId });
  return {
    totalOutstandingAmount: pending.totalPendingAmount,
    patientsWithBalance: pending.patientsWithBalance,
    openInvoiceCount: pending.openInvoiceCount,
  };
}

async function getOverdueReceivablesSnapshot({ organizationId, branchId = null, range = null, asOf = new Date() }) {
  const [invoices, paymentPlans] = await Promise.all([
    fetchOpenInvoices({ organizationId, branchId }),
    fetchActivePaymentPlans({ organizationId, branchId }),
  ]);

  const overdueInvoices = invoices
    .map((invoice) => ({
      id: invoice.id,
      patientId: invoice.patientId,
      patientName: invoice.patient ? `${invoice.patient.firstName} ${invoice.patient.lastName}`.trim() : '',
      amount: calculateInvoiceRemaining(invoice),
      dueDate: invoice.dueDate,
      source: `Fatura ${invoice.number}`,
      type: 'invoice',
    }))
    .filter(
      (invoice) =>
        invoice.amount > 0 &&
        invoice.dueDate &&
        new Date(invoice.dueDate) < asOf &&
        isWithinRange(invoice.dueDate, range)
    );

  const overdueInstallments = [];
  for (const plan of paymentPlans) {
    const patientName = plan.patient ? `${plan.patient.firstName} ${plan.patient.lastName}`.trim() : '';
    for (const installment of plan.installments || []) {
      if (!installment.dueDate) continue;
      if (new Date(installment.dueDate) >= asOf) continue;
      if (!isWithinRange(installment.dueDate, range)) continue;
      overdueInstallments.push({
        id: installment.id,
        patientId: plan.patientId,
        patientName,
        amount: installment.amount,
        dueDate: installment.dueDate,
        paymentPlanId: plan.id,
        source: 'Taksit',
        type: 'installment',
      });
    }
  }

  const patientMap = new Map();
  for (const item of [...overdueInvoices, ...overdueInstallments]) {
    const key = item.patientId || item.id;
    if (!patientMap.has(key)) {
      patientMap.set(key, {
        patientId: item.patientId,
        patientName: item.patientName,
        totalOverdueAmount: 0,
        sources: new Set(),
      });
    }
    const entry = patientMap.get(key);
    entry.totalOverdueAmount += item.amount || 0;
    entry.sources.add(item.source);
  }

  const patients = Array.from(patientMap.values()).map((entry) => ({
    patientId: entry.patientId,
    patientName: entry.patientName,
    totalOverdueAmount: entry.totalOverdueAmount,
    sources: Array.from(entry.sources),
  }));

  return {
    overdueInvoices,
    overdueInstallments,
    patients,
    totalOverdueAmount:
      overdueInvoices.reduce((sum, item) => sum + (item.amount || 0), 0) +
      overdueInstallments.reduce((sum, item) => sum + (item.amount || 0), 0),
  };
}

async function getPendingCollectionComparison({ organizationId, branchId = null, range }) {
  const current = await getPendingCollectionsSnapshot({
    organizationId,
    branchId,
    range,
  });
  const previousRange = buildPreviousMonthRange(range);
  const previous = await getPendingCollectionsSnapshot({
    organizationId,
    branchId,
    range: previousRange,
  });

  return {
    currentRange: range,
    previousRange,
    currentAmount: current.totalPendingAmount,
    previousAmount: previous.totalPendingAmount,
    difference: current.totalPendingAmount - previous.totalPendingAmount,
  };
}

async function getClinicRevenueComparison({ organizationId, branchId = null, range }) {
  const current = await getClinicRevenueSnapshot({ organizationId, branchId, range });
  const previousRange = buildPreviousMonthRange(range);
  const previous = await getClinicRevenueSnapshot({
    organizationId,
    branchId,
    range: previousRange,
  });

  const currentAmount = current.revenueAmount || 0;
  const previousAmount = previous.revenueAmount || 0;
  const difference = currentAmount - previousAmount;
  const percentageChange =
    previousAmount > 0 ? Math.round((difference / previousAmount) * 10000) / 100 : (currentAmount > 0 ? 100 : 0);

  return {
    currentRange: range,
    previousRange,
    currentAmount,
    previousAmount,
    difference,
    percentageChange,
  };
}

module.exports = {
  calculateInvoiceRemaining,
  buildPreviousMonthRange,
  buildPreviousWeekRange,
  getClinicRevenueSnapshot,
  getClinicRevenueComparison,
  getClinicCollectionSnapshot,
  getPendingCollectionsSnapshot,
  getOutstandingReceivablesSnapshot,
  getOverdueReceivablesSnapshot,
  getPendingCollectionComparison,
};
