const { prisma } = require("../prisma");
const {
  buildBarChartItems,
  buildDateRange,
  isWithinDateRange,
  safePercentage,
  sumBy,
} = require("./base-filters");
const { getDoctorDimension } = require("./doctor-dimension");

const EXPENSE_ACCOUNT_TYPES = [
  "SUPPLIER",
  "LAB",
  "VENDOR",
  "OPERATING_EXPENSE",
  "MEDICAL",
  "HEALTH_AGENCY",
  "OTHER",
];

function getPatientName(patient) {
  if (!patient) return "—";
  return `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "—";
}

function matchesSearch(query, ...values) {
  if (!query?.search) return true;
  const haystack = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.search.trim().toLowerCase());
}

function treatmentLineTotal(item) {
  const discountMultiplier = 1 - (Number(item.discount || 0) / 100);
  return Math.round((item.price || 0) * (item.quantity || 0) * discountMultiplier);
}

function getLeafTreatmentItemWhere(organizationId) {
  return {
    organizationId,
    OR: [
      { parentItemId: { not: null } },
      {
        parentItemId: null,
        children: { none: {} },
      },
    ],
  };
}

async function fetchPayments(organizationId, range) {
  return prisma.payment.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(range.from || range.to
        ? {
            paidAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          branchId: true,
          primaryDoctorId: true,
        },
      },
      doctor: { select: { id: true, name: true } },
      invoice: { select: { id: true, number: true, branchId: true, netTotal: true, dueDate: true } },
      treatmentPlan: { select: { id: true, title: true, doctorUserId: true, branchId: true } },
    },
    orderBy: { paidAt: "desc" },
  });
}

async function fetchTreatmentItems(organizationId, range, statuses = []) {
  return prisma.treatmentItem.findMany({
    where: {
      ...getLeafTreatmentItemWhere(organizationId),
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(range.from || range.to
        ? {
            completedAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    include: {
      plan: {
        select: {
          id: true,
          title: true,
          branchId: true,
          patientId: true,
          doctorUserId: true,
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              branchId: true,
              primaryDoctorId: true,
            },
          },
        },
      },
      assignedDoctor: { select: { id: true, name: true } },
      teeth: true,
      labRelations: {
        where: { deletedAt: null },
        select: { id: true, status: true, price: true, quantity: true },
      },
    },
    orderBy: { completedAt: "desc" },
  });
}

async function fetchInvoices(organizationId, range) {
  return prisma.invoice.findMany({
    where: {
      organizationId,
      ...(range.from || range.to
        ? {
            createdAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          branchId: true,
        },
      },
      payments: {
        where: { deletedAt: null },
        select: { id: true, amount: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function fetchFinancialMovements(organizationId, range) {
  return prisma.financialMovement.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      ...(range.from || range.to
        ? {
            occurredAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          branchId: true,
        },
      },
      doctor: { select: { id: true, name: true } },
      currentAccount: { select: { id: true, name: true, type: true } },
      bankAccount: { select: { id: true, name: true, type: true } },
    },
    orderBy: { occurredAt: "desc" },
  });
}

async function fetchPatientsWithFinance(organizationId) {
  return prisma.patient.findMany({
    where: { organizationId },
    include: {
      primaryDoctor: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      treatmentPlans: {
        include: {
          doctor: { select: { id: true, name: true } },
          items: {
            where: {
              OR: [
                { parentItemId: { not: null } },
                {
                  parentItemId: null,
                  children: { none: {} },
                },
              ],
            },
            select: {
              id: true,
              name: true,
              status: true,
              price: true,
              quantity: true,
              discount: true,
              completedAt: true,
            },
          },
        },
      },
      payments: {
        where: { deletedAt: null, isRefund: false },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          doctorId: true,
          method: true,
        },
      },
      appointments: {
        orderBy: { startAt: "desc" },
        select: {
          id: true,
          startAt: true,
          status: true,
        },
      },
    },
  });
}

function filterBySharedDimensions(items, query, resolver) {
  return items.filter((item) => {
    const resolved = resolver(item);

    if (query.doctorId && resolved.doctorId !== query.doctorId) return false;
    if (query.patientId && resolved.patientId !== query.patientId) return false;
    if (query.branchId && resolved.branchId !== query.branchId) return false;
    if (query.institutionId && resolved.institutionId !== query.institutionId) return false;
    if (query.paymentMethod && resolved.paymentMethod !== query.paymentMethod) return false;

    return matchesSearch(query, ...resolved.searchable);
  });
}

async function getGeneralOverviewReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const [appointments, payments, treatmentItems, patients, stockMovements, doctors] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId,
        ...(range.from || range.to
          ? {
              startAt: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
              },
            }
          : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, branchId: true } },
        doctor: { select: { id: true, name: true } },
      },
    }),
    fetchPayments(organizationId, range),
    fetchTreatmentItems(organizationId, range, ["COMPLETED"]),
    prisma.patient.findMany({
      where: {
        organizationId,
        ...(range.from || range.to
          ? {
              createdAt: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
              },
            }
          : {}),
      },
      include: {
        primaryDoctor: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        item: { organizationId },
        ...(range.from || range.to
          ? {
              occurredAt: {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
              },
            }
          : {}),
      },
      include: {
        item: { select: { id: true, name: true, branchId: true } },
      },
    }),
    getDoctorDimension(organizationId),
  ]);

  const doctorRows = doctors
    .map((doctor) => {
      const doctorAppointments = appointments.filter(
        (appointment) =>
          appointment.doctorUserId === doctor.id &&
          (!query.branchId || appointment.branchId === query.branchId)
      );
      const doctorTreatments = treatmentItems.filter(
        (item) =>
          (item.assignedDoctor?.id || item.plan?.doctorUserId) === doctor.id &&
          (!query.branchId || item.plan?.branchId === query.branchId)
      );
      const doctorPayments = payments.filter(
        (payment) =>
          payment.doctorId === doctor.id &&
          (!query.branchId || payment.patient?.branchId === query.branchId)
      );
      const doctorPatients = patients.filter(
        (patient) =>
          patient.primaryDoctor?.user?.id === doctor.id &&
          (!query.branchId || patient.branchId === query.branchId)
      );
      const stockCount = stockMovements.filter(
        (movement) => movement.item?.branchId === doctor.branchId
      ).length;

      const appointmentCount = doctorAppointments.length;
      const completedAppointments = doctorAppointments.filter(
        (appointment) => appointment.status === "COMPLETED"
      ).length;
      const treatmentProduction = sumBy(doctorTreatments, treatmentLineTotal);
      const collectedAmount = sumBy(doctorPayments.filter((payment) => !payment.isRefund), (payment) => payment.amount);
      const plannedAmount = sumBy(
        doctorPatients.flatMap((patient) => patient.treatmentPlans || []),
        (plan) => plan.totalPrice || 0
      );

      return {
        id: doctor.id,
        doctorName: doctor.label,
        appointmentCount,
        completionRate: safePercentage(completedAppointments, appointmentCount),
        treatmentProduction,
        collectedAmount,
        outstandingDebt: Math.max(0, plannedAmount - collectedAmount),
        newPatients: doctorPatients.length,
        stockMovementCount: stockCount,
      };
    })
    .filter((row) => (!query.doctorId ? true : row.id === query.doctorId))
    .filter((row) => matchesSearch(query, row.doctorName));

  const totalAppointments = sumBy(doctorRows, (row) => row.appointmentCount);
  const totalProduction = sumBy(doctorRows, (row) => row.treatmentProduction);
  const totalCollected = sumBy(doctorRows, (row) => row.collectedAmount);

  return {
    stats: [
      { id: "overview-collections", label: "Tahsilat", value: totalCollected, format: "currency", tone: "success" },
      { id: "overview-production", label: "Tedavi Üretimi", value: totalProduction, format: "currency", tone: "info" },
      { id: "overview-appointments", label: "Randevu", value: totalAppointments, format: "number", tone: "warning" },
      {
        id: "overview-attendance",
        label: "Katılım Oranı",
        value: safePercentage(
          appointments.filter((appointment) => appointment.status === "COMPLETED").length,
          appointments.length
        ),
        format: "percent",
        tone: "info",
      },
    ],
    charts: [
      {
        id: "overview-payment-methods",
        title: "Ödeme Yöntemi Dağılımı",
        description: "Seçili aralıktaki tahsilatların kanal kırılımı.",
        items: buildBarChartItems(
          Object.entries(
            payments.reduce((acc, payment) => {
              if (payment.isRefund) return acc;
              const key = payment.method || "OTHER";
              acc[key] = (acc[key] || 0) + payment.amount;
              return acc;
            }, {})
          ).map(([label, value]) => ({ label, value })),
          "currency"
        ),
      },
      {
        id: "overview-top-doctors",
        title: "Hekim Performansı",
        description: "Tahsilat bazında ilk hekimler.",
        items: buildBarChartItems(
          doctorRows
            .sort((a, b) => b.collectedAmount - a.collectedAmount)
            .slice(0, 6)
            .map((row) => ({ label: row.doctorName, value: row.collectedAmount })),
          "currency"
        ),
      },
    ],
    rows: doctorRows,
  };
}

async function getEndOfDayReport({ organizationId, query }) {
  const range = buildDateRange(query, 1);
  const [appointments, payments, treatments, invoices, movements] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId,
        startAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, branchId: true } },
        doctor: { select: { id: true, name: true } },
      },
    }),
    fetchPayments(organizationId, range),
    fetchTreatmentItems(organizationId, range, ["COMPLETED"]),
    fetchInvoices(organizationId, range),
    fetchFinancialMovements(organizationId, range),
  ]);

  const filteredAppointments = filterBySharedDimensions(appointments, query, (appointment) => ({
    doctorId: appointment.doctorUserId || null,
    patientId: appointment.patientId || null,
    branchId: appointment.branchId || appointment.patient?.branchId || null,
    institutionId: null,
    paymentMethod: null,
    searchable: [
      appointment.patient ? getPatientName(appointment.patient) : `${appointment.guestFirstName || ""} ${appointment.guestLastName || ""}`,
      appointment.doctor?.name,
      appointment.reason,
      appointment.notes,
    ],
  }));

  const filteredPayments = filterBySharedDimensions(payments, query, (payment) => ({
    doctorId: payment.doctorId || payment.treatmentPlan?.doctorUserId || null,
    patientId: payment.patientId || null,
    branchId: payment.patient?.branchId || payment.invoice?.branchId || payment.treatmentPlan?.branchId || null,
    institutionId: null,
    paymentMethod: payment.method || null,
    searchable: [
      getPatientName(payment.patient),
      payment.doctor?.name,
      payment.reference,
      payment.notes,
    ],
  }));

  const filteredTreatments = filterBySharedDimensions(treatments, query, (item) => ({
    doctorId: item.assignedDoctor?.id || item.plan?.doctorUserId || null,
    patientId: item.plan?.patient?.id || null,
    branchId: item.plan?.branchId || item.plan?.patient?.branchId || null,
    institutionId: null,
    paymentMethod: null,
    searchable: [
      item.name,
      getPatientName(item.plan?.patient),
      item.assignedDoctor?.name,
      item.plan?.title,
    ],
  }));

  const filteredInvoices = filterBySharedDimensions(invoices, query, (invoice) => ({
    doctorId: null,
    patientId: invoice.patientId || null,
    branchId: invoice.branchId || invoice.patient?.branchId || null,
    institutionId: null,
    paymentMethod: null,
    searchable: [invoice.number, getPatientName(invoice.patient), invoice.notes],
  }));

  const extraMovements = filterBySharedDimensions(
    movements.filter(
      (movement) =>
        !["PAYMENT", "TREATMENT_COST", "INVOICE"].includes(movement.type)
    ),
    query,
    (movement) => ({
      doctorId: movement.doctorId || null,
      patientId: movement.patientId || null,
      branchId: movement.patient?.branchId || null,
      institutionId: movement.currentAccountId || null,
      paymentMethod: movement.paymentMethod || null,
      searchable: [
        getPatientName(movement.patient),
        movement.doctor?.name,
        movement.currentAccount?.name,
        movement.description,
        movement.reference,
      ],
    })
  );

  const rows = [
    ...filteredAppointments.map((appointment) => ({
      id: `appt-${appointment.id}`,
      occurredAt: appointment.startAt,
      activityType: "APPOINTMENT",
      patientName: appointment.patient ? getPatientName(appointment.patient) : `${appointment.guestFirstName || ""} ${appointment.guestLastName || ""}`.trim() || "—",
      doctorName: appointment.doctor?.name || "—",
      description: appointment.reason || appointment.appointmentType,
      paymentMethod: null,
      amount: 0,
      status: appointment.status,
      rowLink: appointment.patientId ? `/patients/${appointment.patientId}` : null,
    })),
    ...filteredPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      occurredAt: payment.paidAt,
      activityType: payment.isRefund ? "REFUND" : "PAYMENT",
      patientName: getPatientName(payment.patient),
      doctorName: payment.doctor?.name || "—",
      description: payment.notes || payment.reference || "Hasta ödemesi",
      paymentMethod: payment.method,
      amount: payment.isRefund ? -payment.amount : payment.amount,
      status: payment.isRefund ? "REFUND" : "COMPLETED",
      rowLink: payment.patientId ? `/patients/${payment.patientId}?tab=payments` : null,
    })),
    ...filteredTreatments.map((item) => ({
      id: `treatment-${item.id}`,
      occurredAt: item.completedAt,
      activityType: "TREATMENT",
      patientName: getPatientName(item.plan?.patient),
      doctorName: item.assignedDoctor?.name || "—",
      description: item.name,
      paymentMethod: null,
      amount: treatmentLineTotal(item),
      status: item.status,
      rowLink: item.plan?.patient?.id ? `/patients/${item.plan.patient.id}?tab=plans&plan=${item.plan.id}` : null,
    })),
    ...filteredInvoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      occurredAt: invoice.createdAt,
      activityType: "INVOICE",
      patientName: getPatientName(invoice.patient),
      doctorName: "—",
      description: invoice.number,
      paymentMethod: null,
      amount: invoice.netTotal,
      status: invoice.status,
      rowLink: invoice.patientId ? `/patients/${invoice.patientId}?tab=payments` : null,
    })),
    ...extraMovements.map((movement) => ({
      id: `movement-${movement.id}`,
      occurredAt: movement.occurredAt,
      activityType: movement.type,
      patientName: movement.patient ? getPatientName(movement.patient) : movement.currentAccount?.name || "—",
      doctorName: movement.doctor?.name || "—",
      description: movement.description || movement.reference || movement.type,
      paymentMethod: movement.paymentMethod,
      amount: movement.amount,
      status: movement.status,
      rowLink: movement.patientId
        ? `/patients/${movement.patientId}`
        : movement.currentAccountId
        ? `/finance/current-accounts/${movement.currentAccountId}`
        : null,
    })),
  ];

  const totalCollected = sumBy(filteredPayments.filter((payment) => !payment.isRefund), (payment) => payment.amount);
  const totalRefunded = sumBy(filteredPayments.filter((payment) => payment.isRefund), (payment) => payment.amount);
  const treatmentTotal = sumBy(filteredTreatments, treatmentLineTotal);

  return {
    stats: [
      { id: "eod-appointments", label: "Randevu", value: filteredAppointments.length, format: "number", tone: "info" },
      { id: "eod-collections", label: "Tahsilat", value: totalCollected, format: "currency", tone: "success" },
      { id: "eod-refunds", label: "İade", value: totalRefunded, format: "currency", tone: "danger" },
      { id: "eod-treatments", label: "Tedavi Üretimi", value: treatmentTotal, format: "currency", tone: "warning" },
    ],
    charts: [
      {
        id: "eod-payment-breakdown",
        title: "Ödeme Kanalı",
        description: "Günlük tahsilat yöntem kırılımı.",
        items: buildBarChartItems(
          Object.entries(
            filteredPayments.reduce((acc, payment) => {
              if (payment.isRefund) return acc;
              const key = payment.method || "OTHER";
              acc[key] = (acc[key] || 0) + payment.amount;
              return acc;
            }, {})
          ).map(([label, value]) => ({ label, value })),
          "currency"
        ),
      },
      {
        id: "eod-activity-mix",
        title: "Günlük Aktivite Dağılımı",
        description: "Randevu, ödeme, tedavi ve ek hareket adedi.",
        items: buildBarChartItems(
          [
            { label: "Randevu", value: filteredAppointments.length },
            { label: "Ödeme", value: filteredPayments.length },
            { label: "Tedavi", value: filteredTreatments.length },
            { label: "Diğer Hareket", value: extraMovements.length },
          ],
          "number"
        ),
      },
    ],
    rows,
  };
}

async function getCollectionAnalyticsReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const [payments, treatmentItems, invoices] = await Promise.all([
    fetchPayments(organizationId, range),
    fetchTreatmentItems(organizationId, range, ["COMPLETED"]),
    fetchInvoices(organizationId, range),
  ]);

  const rows = filterBySharedDimensions(
    payments.filter((payment) => !payment.isRefund),
    query,
    (payment) => ({
      doctorId: payment.doctorId || payment.treatmentPlan?.doctorUserId || null,
      patientId: payment.patientId || null,
      branchId: payment.patient?.branchId || payment.invoice?.branchId || payment.treatmentPlan?.branchId || null,
      institutionId: null,
      paymentMethod: payment.method || null,
      searchable: [
        getPatientName(payment.patient),
        payment.doctor?.name,
        payment.reference,
        payment.notes,
        payment.invoice?.number,
      ],
    })
  ).map((payment) => ({
    id: payment.id,
    paidAt: payment.paidAt,
    patientName: getPatientName(payment.patient),
    doctorName: payment.doctor?.name || "—",
    invoiceNumber: payment.invoice?.number || "—",
    paymentMethod: payment.method,
    amount: payment.amount,
    vatRate: payment.vatRate || 0,
    reference: payment.reference || "—",
    rowLink: payment.patientId ? `/patients/${payment.patientId}?tab=payments` : null,
  }));

  const totalCollected = sumBy(rows, (row) => row.amount);
  const productionBase = sumBy(
    filterBySharedDimensions(treatmentItems, query, (item) => ({
      doctorId: item.assignedDoctor?.id || item.plan?.doctorUserId || null,
      patientId: item.plan?.patient?.id || null,
      branchId: item.plan?.branchId || item.plan?.patient?.branchId || null,
      institutionId: null,
      paymentMethod: null,
      searchable: [item.name, getPatientName(item.plan?.patient), item.plan?.title],
    })),
    treatmentLineTotal
  );
  const openInvoiceBase = sumBy(
    filterBySharedDimensions(invoices, query, (invoice) => ({
      doctorId: null,
      patientId: invoice.patientId || null,
      branchId: invoice.branchId || invoice.patient?.branchId || null,
      institutionId: null,
      paymentMethod: null,
      searchable: [invoice.number, getPatientName(invoice.patient), invoice.notes],
    })),
    (invoice) => Math.max(0, invoice.netTotal - sumBy(invoice.payments || [], (payment) => payment.amount))
  );

  return {
    stats: [
      { id: "collections-total", label: "Toplam Tahsilat", value: totalCollected, format: "currency", tone: "success" },
      { id: "collections-count", label: "Ödeme Adedi", value: rows.length, format: "number", tone: "info" },
      {
        id: "collections-average",
        label: "Ortalama Tahsilat",
        value: rows.length ? Math.round(totalCollected / rows.length) : 0,
        format: "currency",
        tone: "warning",
      },
      {
        id: "collections-rate",
        label: "Tahsilat / Üretim",
        value: safePercentage(totalCollected, productionBase || totalCollected),
        format: "percent",
        tone: "info",
      },
    ],
    charts: [
      {
        id: "collections-methods",
        title: "Ödeme Yöntemi Dağılımı",
        description: "Tahsilatların kanal bazlı tutar dağılımı.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.paymentMethod] = (acc[row.paymentMethod] || 0) + row.amount;
              return acc;
            }, {})
          ).map(([label, value]) => ({ label, value })),
          "currency"
        ),
      },
      {
        id: "collections-receivables",
        title: "Açık Tahsilat Bağı",
        description: "Açık fatura bakiyeleri ve üretim bazına karşı durum.",
        items: buildBarChartItems(
          [
            { label: "Tahsilat", value: totalCollected },
            { label: "Açık Fatura", value: openInvoiceBase },
            { label: "Tedavi Üretimi", value: productionBase },
          ],
          "currency"
        ),
      },
    ],
    rows,
  };
}

async function getExpenseReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const movements = await fetchFinancialMovements(organizationId, range);

  const rows = filterBySharedDimensions(
    movements.filter((movement) => {
      if (movement.type === "PAYMENT" || movement.type === "TREATMENT_COST") return false;
      if (movement.amount >= 0) return false;
      if (movement.currentAccount && !EXPENSE_ACCOUNT_TYPES.includes(movement.currentAccount.type)) {
        return false;
      }
      return true;
    }),
    query,
    (movement) => ({
      doctorId: movement.doctorId || null,
      patientId: movement.patientId || null,
      branchId: movement.patient?.branchId || null,
      institutionId: movement.currentAccountId || null,
      paymentMethod: movement.paymentMethod || null,
      searchable: [
        movement.description,
        movement.reference,
        movement.currentAccount?.name,
        movement.currentAccount?.type,
        getPatientName(movement.patient),
      ],
    })
  ).map((movement) => ({
    id: movement.id,
    occurredAt: movement.occurredAt,
    currentAccountName: movement.currentAccount?.name || movement.bankAccount?.name || "Genel Gider",
    accountType: movement.currentAccount?.type || movement.type,
    movementType: movement.type,
    description: movement.description || "—",
    paymentMethod: movement.paymentMethod || "—",
    amount: movement.amount,
    reference: movement.reference || "—",
    rowLink: movement.currentAccountId ? `/finance/current-accounts/${movement.currentAccountId}` : null,
  }));

  const absoluteTotal = Math.abs(sumBy(rows, (row) => row.amount));

  return {
    stats: [
      { id: "expense-total", label: "Toplam Gider", value: absoluteTotal, format: "currency", tone: "danger" },
      { id: "expense-count", label: "Hareket", value: rows.length, format: "number", tone: "warning" },
      {
        id: "expense-average",
        label: "Ortalama Gider",
        value: rows.length ? Math.round(absoluteTotal / rows.length) : 0,
        format: "currency",
        tone: "info",
      },
      {
        id: "expense-cari",
        label: "Cari Odaklı Oran",
        value: safePercentage(
          rows.filter((row) => row.currentAccountName !== "Genel Gider").length,
          rows.length
        ),
        format: "percent",
        tone: "warning",
      },
    ],
    charts: [
      {
        id: "expense-types",
        title: "Gider Tipi",
        description: "Cari tipine göre gider yoğunluğu.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.accountType] = (acc[row.accountType] || 0) + Math.abs(row.amount);
              return acc;
            }, {})
          ).map(([label, value]) => ({ label, value })),
          "currency"
        ),
      },
      {
        id: "expense-accounts",
        title: "En Büyük Gider Noktaları",
        description: "En yüksek toplam gider çıkan cariler.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.currentAccountName] = (acc[row.currentAccountName] || 0) + Math.abs(row.amount);
              return acc;
            }, {})
          )
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6),
          "currency"
        ),
      },
    ],
    rows,
  };
}

async function getDebtPerDoctorReport({ organizationId, query }) {
  const range = buildDateRange(query);
  const [patients, doctors] = await Promise.all([
    fetchPatientsWithFinance(organizationId),
    getDoctorDimension(organizationId),
  ]);

  const rows = doctors.map((doctor) => {
    const doctorPatients = patients.filter((patient) => {
      const derivedDoctorId =
        patient.primaryDoctor?.user?.id ||
        patient.treatmentPlans.find((plan) => plan.doctorUserId)?.doctorUserId ||
        null;

      if (derivedDoctorId !== doctor.id) return false;
      if (query.branchId && patient.branchId !== query.branchId) return false;
      if (!matchesSearch(query, getPatientName(patient), patient.phone, doctor.label)) return false;

      return true;
    });

    const patientBreakdown = doctorPatients.map((patient) => {
      const plans = patient.treatmentPlans.filter((plan) => {
        if (!range.from && !range.to) return true;
        if (!plan.createdAt) return true;
        return isWithinDateRange(plan.createdAt, range);
      });
      const payments = patient.payments.filter((payment) => {
        if (!range.from && !range.to) return true;
        return isWithinDateRange(payment.paidAt, range);
      });
      const plannedAmount = sumBy(plans, (plan) => plan.totalPrice || 0);
      const completedAmount = sumBy(
        plans.flatMap((plan) => plan.items || []).filter((item) => item.status === "COMPLETED"),
        treatmentLineTotal
      );
      const collectedAmount = sumBy(payments, (payment) => payment.amount);

      return {
        plannedAmount,
        completedAmount,
        collectedAmount,
        outstandingDebt: Math.max(0, plannedAmount - collectedAmount),
      };
    });

    const plannedAmount = sumBy(patientBreakdown, (item) => item.plannedAmount);
    const completedAmount = sumBy(patientBreakdown, (item) => item.completedAmount);
    const collectedAmount = sumBy(patientBreakdown, (item) => item.collectedAmount);
    const outstandingDebt = sumBy(patientBreakdown, (item) => item.outstandingDebt);

    return {
      id: doctor.id,
      doctorName: doctor.label,
      debtorPatientCount: patientBreakdown.filter((item) => item.outstandingDebt > 0).length,
      plannedAmount,
      completedAmount,
      collectedAmount,
      outstandingDebt,
      collectionRate: safePercentage(collectedAmount, plannedAmount || collectedAmount),
    };
  });

  return {
    stats: [
      { id: "doctor-debt", label: "Toplam Borç", value: sumBy(rows, (row) => row.outstandingDebt), format: "currency", tone: "danger" },
      { id: "doctor-planned", label: "Planlanan", value: sumBy(rows, (row) => row.plannedAmount), format: "currency", tone: "warning" },
      { id: "doctor-collected", label: "Tahsilat", value: sumBy(rows, (row) => row.collectedAmount), format: "currency", tone: "success" },
      { id: "doctor-debtor-count", label: "Borçlu Hasta", value: sumBy(rows, (row) => row.debtorPatientCount), format: "number", tone: "info" },
    ],
    charts: [
      {
        id: "doctor-debt-bars",
        title: "Hekim Bazlı Açık Borç",
        description: "Borç bakiyesi en yüksek hekimler.",
        items: buildBarChartItems(
          rows
            .filter((row) => row.outstandingDebt > 0)
            .sort((a, b) => b.outstandingDebt - a.outstandingDebt)
            .slice(0, 6)
            .map((row) => ({ label: row.doctorName, value: row.outstandingDebt })),
          "currency"
        ),
      },
      {
        id: "doctor-collection-rates",
        title: "Tahsilat Oranı",
        description: "Planlanan tutara göre tahsilat yüzdesi.",
        items: buildBarChartItems(
          rows
            .filter((row) => row.plannedAmount > 0)
            .sort((a, b) => b.collectionRate - a.collectionRate)
            .slice(0, 6)
            .map((row) => ({ label: row.doctorName, value: row.collectionRate })),
          "percent"
        ),
      },
    ],
    rows,
  };
}

async function getPaymentTreatmentCommissionReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const [payments, treatments, doctors] = await Promise.all([
    fetchPayments(organizationId, range),
    fetchTreatmentItems(organizationId, range, ["COMPLETED"]),
    getDoctorDimension(organizationId),
  ]);

  const paymentRate = Number(query.paymentRate || 0);
  const treatmentRate = Number(query.treatmentRate || 0);

  const rows = doctors
    .map((doctor) => {
      const doctorPayments = filterBySharedDimensions(payments.filter((payment) => !payment.isRefund), query, (payment) => ({
        doctorId: payment.doctorId || payment.treatmentPlan?.doctorUserId || null,
        patientId: payment.patientId || null,
        branchId: payment.patient?.branchId || payment.treatmentPlan?.branchId || payment.invoice?.branchId || null,
        institutionId: null,
        paymentMethod: payment.method || null,
        searchable: [getPatientName(payment.patient), payment.reference, payment.notes, payment.doctor?.name],
      })).filter((payment) => (payment.doctorId || payment.treatmentPlan?.doctorUserId) === doctor.id);

      const doctorTreatments = filterBySharedDimensions(treatments, query, (item) => ({
        doctorId: item.assignedDoctor?.id || item.plan?.doctorUserId || null,
        patientId: item.plan?.patient?.id || null,
        branchId: item.plan?.branchId || item.plan?.patient?.branchId || null,
        institutionId: null,
        paymentMethod: null,
        searchable: [item.name, getPatientName(item.plan?.patient), item.assignedDoctor?.name, item.plan?.title],
      })).filter((item) => (item.assignedDoctor?.id || item.plan?.doctorUserId) === doctor.id);

      const paymentBase = sumBy(doctorPayments, (payment) => payment.amount);
      const treatmentBase = sumBy(doctorTreatments, treatmentLineTotal);
      const commissionAmount =
        Math.round((paymentBase * paymentRate) / 100) + Math.round((treatmentBase * treatmentRate) / 100);

      return {
        id: doctor.id,
        doctorName: doctor.label,
        paymentBase,
        treatmentBase,
        paymentRate,
        treatmentRate,
        commissionAmount,
        paymentCount: doctorPayments.length,
        completedTreatmentCount: doctorTreatments.length,
      };
    })
    .filter((row) => (!query.doctorId ? true : row.id === query.doctorId))
    .filter((row) => matchesSearch(query, row.doctorName));

  return {
    stats: [
      { id: "mixed-commission", label: "Toplam Komisyon", value: sumBy(rows, (row) => row.commissionAmount), format: "currency", tone: "success" },
      { id: "mixed-payment-base", label: "Tahsilat Bazı", value: sumBy(rows, (row) => row.paymentBase), format: "currency", tone: "info" },
      { id: "mixed-treatment-base", label: "Tedavi Bazı", value: sumBy(rows, (row) => row.treatmentBase), format: "currency", tone: "warning" },
      { id: "mixed-doctors", label: "Hekim", value: rows.length, format: "number", tone: "info" },
    ],
    charts: [
      {
        id: "mixed-commission-ranking",
        title: "Komisyon Sıralaması",
        description: "Birleşik ödeme ve tedavi komisyonu.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.commissionAmount - a.commissionAmount)
            .slice(0, 6)
            .map((row) => ({ label: row.doctorName, value: row.commissionAmount })),
          "currency"
        ),
      },
      {
        id: "mixed-base-compare",
        title: "Komisyon Baz Karşılaştırması",
        description: "Tahsilat ve tedavi üretim bazlarının toplamı.",
        items: buildBarChartItems(
          [
            { label: "Tahsilat Bazı", value: sumBy(rows, (row) => row.paymentBase) },
            { label: "Tedavi Bazı", value: sumBy(rows, (row) => row.treatmentBase) },
          ],
          "currency"
        ),
      },
    ],
    rows,
    meta:
      paymentRate === 0 && treatmentRate === 0
        ? {
            note: "Komisyon yüzdeleri 0 olarak geldi. Gerçek komisyon tutarı için filtre alanındaki oranları doldurun.",
          }
        : {},
  };
}

async function getTreatmentBasedCommissionReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const [treatments, doctors] = await Promise.all([
    fetchTreatmentItems(organizationId, range, ["COMPLETED"]),
    getDoctorDimension(organizationId),
  ]);

  const commissionRate = Number(query.commissionRate || 0);

  const rows = doctors
    .map((doctor) => {
      const doctorTreatments = filterBySharedDimensions(treatments, query, (item) => ({
        doctorId: item.assignedDoctor?.id || item.plan?.doctorUserId || null,
        patientId: item.plan?.patient?.id || null,
        branchId: item.plan?.branchId || item.plan?.patient?.branchId || null,
        institutionId: null,
        paymentMethod: null,
        searchable: [item.name, getPatientName(item.plan?.patient), item.assignedDoctor?.name, item.plan?.title],
      })).filter((item) => (item.assignedDoctor?.id || item.plan?.doctorUserId) === doctor.id);

      const completedTreatmentValue = sumBy(doctorTreatments, treatmentLineTotal);

      return {
        id: doctor.id,
        doctorName: doctor.label,
        completedTreatmentCount: doctorTreatments.length,
        completedTreatmentValue,
        commissionRate,
        commissionAmount: Math.round((completedTreatmentValue * commissionRate) / 100),
        avgTreatmentValue: doctorTreatments.length
          ? Math.round(completedTreatmentValue / doctorTreatments.length)
          : 0,
        patientCount: new Set(doctorTreatments.map((item) => item.plan?.patient?.id).filter(Boolean)).size,
      };
    })
    .filter((row) => (!query.doctorId ? true : row.id === query.doctorId))
    .filter((row) => matchesSearch(query, row.doctorName));

  return {
    stats: [
      { id: "treatment-commission-total", label: "Toplam Komisyon", value: sumBy(rows, (row) => row.commissionAmount), format: "currency", tone: "success" },
      { id: "treatment-commission-base", label: "Üretim Bazı", value: sumBy(rows, (row) => row.completedTreatmentValue), format: "currency", tone: "info" },
      { id: "treatment-commission-count", label: "Tam. İşlem", value: sumBy(rows, (row) => row.completedTreatmentCount), format: "number", tone: "warning" },
      { id: "treatment-commission-patients", label: "Hasta", value: sumBy(rows, (row) => row.patientCount), format: "number", tone: "info" },
    ],
    charts: [
      {
        id: "treatment-commission-ranking",
        title: "Üretim Bazlı Komisyon",
        description: "Hekim bazında tedavi üretimine göre komisyon.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.commissionAmount - a.commissionAmount)
            .slice(0, 6)
            .map((row) => ({ label: row.doctorName, value: row.commissionAmount })),
          "currency"
        ),
      },
      {
        id: "treatment-production-ranking",
        title: "Tedavi Üretimi",
        description: "Tamamlanan işlem değeri en yüksek hekimler.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.completedTreatmentValue - a.completedTreatmentValue)
            .slice(0, 6)
            .map((row) => ({ label: row.doctorName, value: row.completedTreatmentValue })),
          "currency"
        ),
      },
    ],
    rows,
    meta:
      commissionRate === 0
        ? {
            note: "Komisyon oranı 0 olarak geldi. Gerçek komisyon hesaplaması için oran filtresini doldurun.",
          }
        : {},
  };
}

async function getCashBasedCommissionReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const doctors = await getDoctorDimension(organizationId);
  const payments = await fetchPayments(organizationId, range);

  const effectiveMethod = query.paymentMethod || "CASH";
  const commissionRate = Number(query.commissionRate || 0);

  const basePayments = filterBySharedDimensions(
    payments.filter((payment) => !payment.isRefund && payment.method === effectiveMethod),
    { ...query, paymentMethod: effectiveMethod },
    (payment) => ({
      doctorId: payment.doctorId || payment.treatmentPlan?.doctorUserId || null,
      patientId: payment.patientId || null,
      branchId: payment.patient?.branchId || payment.invoice?.branchId || payment.treatmentPlan?.branchId || null,
      institutionId: null,
      paymentMethod: payment.method || null,
      searchable: [getPatientName(payment.patient), payment.reference, payment.notes, payment.doctor?.name],
    })
  );

  const rows = doctors
    .map((doctor) => {
      const doctorPayments = basePayments.filter(
        (payment) => (payment.doctorId || payment.treatmentPlan?.doctorUserId) === doctor.id
      );
      const collectedAmount = sumBy(doctorPayments, (payment) => payment.amount);

      return {
        id: doctor.id,
        doctorName: doctor.label,
        paymentMethod: effectiveMethod,
        paymentCount: doctorPayments.length,
        collectedAmount,
        commissionRate,
        commissionAmount: Math.round((collectedAmount * commissionRate) / 100),
        avgPaymentAmount: doctorPayments.length ? Math.round(collectedAmount / doctorPayments.length) : 0,
      };
    })
    .filter((row) => (!query.doctorId ? true : row.id === query.doctorId))
    .filter((row) => matchesSearch(query, row.doctorName));

  return {
    stats: [
      { id: "cash-commission-total", label: "Toplam Komisyon", value: sumBy(rows, (row) => row.commissionAmount), format: "currency", tone: "success" },
      { id: "cash-commission-base", label: "Tahsilat Bazı", value: sumBy(rows, (row) => row.collectedAmount), format: "currency", tone: "info" },
      { id: "cash-commission-payments", label: "Ödeme", value: sumBy(rows, (row) => row.paymentCount), format: "number", tone: "warning" },
      { id: "cash-commission-method", label: "Yöntem", value: effectiveMethod, format: "text", tone: "info" },
    ],
    charts: [
      {
        id: "cash-commission-ranking",
        title: "Tahsilat Bazlı Komisyon",
        description: "Seçili ödeme yöntemine göre en yüksek komisyon.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.commissionAmount - a.commissionAmount)
            .slice(0, 6)
            .map((row) => ({ label: row.doctorName, value: row.commissionAmount })),
          "currency"
        ),
      },
      {
        id: "cash-collections-ranking",
        title: "Nakit Baz",
        description: "Seçili yöntemde hekim bazında tahsilat toplamı.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.collectedAmount - a.collectedAmount)
            .slice(0, 6)
            .map((row) => ({ label: row.doctorName, value: row.collectedAmount })),
          "currency"
        ),
      },
    ],
    rows,
    meta:
      commissionRate === 0
        ? {
            note: "Komisyon oranı 0 olarak geldi. Hesaplanan komisyonu görmek için oran filtresini doldurun.",
          }
        : {},
  };
}

module.exports = {
  getGeneralOverviewReport,
  getEndOfDayReport,
  getCollectionAnalyticsReport,
  getExpenseReport,
  getDebtPerDoctorReport,
  getPaymentTreatmentCommissionReport,
  getTreatmentBasedCommissionReport,
  getCashBasedCommissionReport,
};
