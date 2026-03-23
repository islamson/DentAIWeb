/**
 * Data Aggregators - Fetch verified business data BEFORE LLM.
 * Each aggregator returns clean JSON. No tool discovery by LLM.
 */

const { prisma } = require('../prisma');
const { getPatientFinanceLedger } = require('../patient-finance-ledger');
const {
  getClinicRevenueSnapshot,
  getClinicRevenueComparison,
  getClinicCollectionSnapshot,
  getPendingCollectionsSnapshot,
  getOutstandingReceivablesSnapshot,
  getOverdueReceivablesSnapshot,
  getPendingCollectionComparison,
} = require('../finance/receivables');

function formatCurrency(amount) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function normalizeDoctorName(name) {
  if (!name) return null;
  return String(name)
    .replace(/^dr\.?\s*/i, '')
    .trim();
}

function isInstallmentOverdue(installment, now = new Date()) {
  if (!installment) return false;
  const dueDate = installment.dueDate ? new Date(installment.dueDate) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime())) return false;

  const status = String(installment.status || '').toUpperCase();
  return dueDate < now && !['PAID', 'CANCELLED'].includes(status);
}

function getPatientFullName(patient) {
  if (!patient) return 'Bilinmeyen Hasta';
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || 'Bilinmeyen Hasta';
}

function computeOverdueInstallmentSnapshot(paymentPlans = [], options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const doctorId = options.doctorId || null;

  const rows = [];
  let overdueInstallmentCount = 0;
  let overdueInstallmentAmount = 0;
  const overduePatientIds = new Set();
  const populationPatientIds = new Set();

  for (const plan of paymentPlans) {
    const patient = plan.patient || null;
    const patientId = plan.patientId || patient?.id || null;
    if (!patientId) continue;

    if (doctorId) {
      const matchedDoctor = (plan.patient?.appointments || []).some(
        (appt) => appt?.doctorUserId === doctorId
      );
      if (!matchedDoctor) continue;
    }

    populationPatientIds.add(patientId);

    const installments = Array.isArray(plan.installments) ? plan.installments : [];
    const overdueInstallments = installments.filter((inst) => isInstallmentOverdue(inst, now));

    if (overdueInstallments.length > 0) {
      overduePatientIds.add(patientId);
    }

    const overdueAmountForPatient = overdueInstallments.reduce(
      (sum, inst) => sum + Number(inst.amount || 0),
      0
    );

    overdueInstallmentCount += overdueInstallments.length;
    overdueInstallmentAmount += overdueAmountForPatient;

    rows.push({
      patientId,
      patientName: getPatientFullName(patient),
      overdueInstallmentCount: overdueInstallments.length,
      overdueInstallmentAmount: overdueAmountForPatient,
      overdueInstallments: overdueInstallments.map((inst) => ({
        id: inst.id,
        amount: Number(inst.amount || 0),
        dueDate: inst.dueDate,
        status: inst.status,
      })),
    });
  }

  rows.sort((a, b) => {
    if (b.overdueInstallmentAmount !== a.overdueInstallmentAmount) {
      return b.overdueInstallmentAmount - a.overdueInstallmentAmount;
    }
    return b.overdueInstallmentCount - a.overdueInstallmentCount;
  });

  return {
    rows,
    overdueInstallmentCount,
    overdueInstallmentAmount,
    overduePatientCount: overduePatientIds.size,
    totalPatientCount: populationPatientIds.size,
    overduePatientIds,
    populationPatientIds,
  };
}

async function fetchPaymentPlansForOverdueAnalysis(filter = {}) {
  const { prisma } = require('../prisma');

  const organizationId = filter.organizationId;
  const branchId = filter.branchId || null;
  const doctorId = filter.doctorId || null;

  if (!organizationId) {
    return { error: 'organizationId gerekli.' };
  }

  const plans = await prisma.paymentPlan.findMany({
    where: {
      organizationId,
      ...(branchId
        ? {
            patient: {
              branchId,
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
          appointments: doctorId
            ? {
                where: {
                  doctorUserId: doctorId,
                },
                select: {
                  id: true,
                  doctorUserId: true,
                  startAt: true,
                },
              }
            : {
                select: {
                  id: true,
                  doctorUserId: true,
                  startAt: true,
                },
              },
        },
      },
      installments: {
        select: {
          id: true,
          amount: true,
          dueDate: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          dueDate: 'asc',
        },
      },
    },
  });

  return { plans };
}

async function buildPatientBalanceContext(patientId, organizationId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) return { error: 'Hasta bulunamadı.', type: 'patient_balance' };

  const ledger = await getPatientFinanceLedger({ organizationId, patientId });
  const { totalTreatmentCost, totalPaid, remaining } = ledger.summary;
  const fullName = `${patient.firstName} ${patient.lastName}`.trim();

  return {
    type: 'patient_balance',
    patient: { id: patient.id, fullName },
    totals: {
      totalTreatmentCost,
      totalPaid,
      remainingBalance: remaining,
      currency: 'TRY',
    },
    source: 'financial_movements',
  };
}

async function buildPatientLastPaymentContext(patientId, organizationId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) return { error: 'Hasta bulunamadı.', type: 'patient_last_payment' };

  const payment = await prisma.payment.findFirst({
    where: {
      patientId,
      organizationId,
      deletedAt: null,
      isRefund: false,
    },
    orderBy: { paidAt: 'desc' },
    select: { id: true, amount: true, method: true, paidAt: true, reference: true },
  });

  const fullName = `${patient.firstName} ${patient.lastName}`.trim();
  return {
    type: 'patient_last_payment',
    patient: { id: patient.id, fullName },
    payment: payment
      ? {
          amount: payment.amount,
          method: payment.method,
          paidAt: payment.paidAt,
          reference: payment.reference,
        }
      : null,
    source: 'payments',
  };
}

async function buildPatientSummaryContext(patientId, organizationId, branchId = null) {
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      organizationId,
      ...(branchId && { branchId }),
    },
    include: {
      primaryDoctor: { include: { user: { select: { name: true } } } },
      appointments: {
        orderBy: { startAt: 'desc' },
        take: 1,
        select: { startAt: true, status: true, reason: true },
      },
      treatmentPlans: {
        where: { isActive: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { title: true, status: true, totalPrice: true, completedTotal: true },
      },
    },
  });
  if (!patient) return { error: 'Hasta bulunamadı.', type: 'patient_summary' };

  const fullName = `${patient.firstName} ${patient.lastName}`.trim();
  const lastApp = patient.appointments[0];
  const activePlan = patient.treatmentPlans[0];

  return {
    type: 'patient_summary',
    patient: {
      id: patient.id,
      fullName,
      phone: patient.phone,
      email: patient.email,
      primaryDoctor: patient.primaryDoctor?.user?.name,
      lastAppointment: lastApp
        ? { startAt: lastApp.startAt, status: lastApp.status, reason: lastApp.reason }
        : null,
      activePlan: activePlan
        ? { title: activePlan.title, status: activePlan.status, totalPrice: activePlan.totalPrice, completedTotal: activePlan.completedTotal }
        : null,
    },
    source: 'patient_record',
  };
}

async function buildPatientAppointmentsContext(patientId, organizationId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) return { error: 'Hasta bulunamadı.', type: 'patient_appointments' };

  const appointments = await prisma.appointment.findMany({
    where: { patientId, organizationId },
    orderBy: { startAt: 'desc' },
    take: 10,
    include: {
      doctor: { select: { name: true } },
    },
  });

  const fullName = `${patient.firstName} ${patient.lastName}`.trim();
  return {
    type: 'patient_appointments',
    patient: { id: patient.id, fullName },
    appointments: appointments.map((a) => ({
      startAt: a.startAt,
      status: a.status,
      reason: a.reason,
      doctorName: a.doctor?.name,
    })),
    lastAppointment: appointments[0] || null,
    source: 'appointments',
  };
}

async function buildPatientTreatmentPlansContext(patientId, organizationId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) return { error: 'Hasta bulunamadı.', type: 'patient_treatment_plans' };

  const plans = await prisma.treatmentPlan.findMany({
    where: { patientId, organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      totalPrice: true,
      completedTotal: true,
      doctor: { select: { name: true } },
    },
  });

  const fullName = `${patient.firstName} ${patient.lastName}`.trim();
  return {
    type: 'patient_treatment_plans',
    patient: { id: patient.id, fullName },
    plans: plans.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      totalPrice: p.totalPrice,
      completedTotal: p.completedTotal,
      doctorName: p.doctor?.name,
    })),
    source: 'treatment_plans',
  };
}

async function buildTreatmentPlanDetailsContext(treatmentPlanId, patientId, organizationId) {
  const plan = await prisma.treatmentPlan.findFirst({
    where: { id: treatmentPlanId, patientId, organizationId },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { name: true } },
      items: {
        select: {
          id: true,
          name: true,
          price: true,
          quantity: true,
          progress: true,
          status: true,
          completedAt: true,
          assignedDoctor: { select: { name: true } },
        },
      },
    },
  });
  if (!plan) return { error: 'Tedavi planı bulunamadı.', type: 'patient_treatment_plan_details' };

  const items = plan.items.map((i) => ({
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    progress: i.progress,
    status: i.status,
    completedAt: i.completedAt,
    responsibleDoctor: i.assignedDoctor?.name,
    plannedAmount: i.price * i.quantity,
  }));

  const fullName = `${plan.patient.firstName} ${plan.patient.lastName}`.trim();
  return {
    type: 'patient_treatment_plan_details',
    treatmentPlan: { id: plan.id, title: plan.title, status: plan.status },
    patient: { id: plan.patientId, fullName },
    doctorName: plan.doctor?.name,
    totals: {
      totalPrice: plan.totalPrice,
      plannedTotal: plan.plannedTotal,
      completedTotal: plan.completedTotal,
      currency: 'TRY',
    },
    items,
    source: 'treatment_plan_items',
  };
}

async function buildDoctorScheduleContext(doctorId, date, organizationId, branchId = null) {
  const doctor = await prisma.user.findFirst({
    where: {
      id: doctorId,
      orgs: { some: { organizationId, role: 'DOCTOR' } },
    },
    select: { id: true, name: true },
  });
  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'doctor_schedule' };

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const where = {
    organizationId,
    doctorUserId: doctorId,
    startAt: { gte: targetDate, lt: nextDay },
  };
  if (branchId) where.branchId = branchId;

  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { startAt: 'asc' },
    }),
    prisma.scheduleBlock.findMany({
      where: {
        organizationId,
        doctorUserId: doctorId,
        startAt: { gte: targetDate, lt: nextDay },
      },
      orderBy: { startAt: 'asc' },
    }),
  ]);

  return {
    type: 'doctor_schedule',
    doctor: { id: doctor.id, name: doctor.name },
    date: targetDate.toISOString().slice(0, 10),
    appointments: appointments.map((a) => ({
      startAt: a.startAt,
      patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.trim() : null,
      status: a.status,
    })),
    blocks: blocks.map((b) => ({ startAt: b.startAt, type: b.type, title: b.title })),
    source: 'appointments_schedule',
  };
}

async function buildMonthlyFinanceSummaryContext(month, year, organizationId, branchId = null) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const where = {
    organizationId,
    status: 'ACTIVE',
    occurredAt: { gte: startOfMonth, lte: endOfMonth },
  };

  const paymentsAgg = await prisma.financialMovement.aggregate({
    where: { ...where, type: 'PAYMENT', amount: { gt: 0 } },
    _sum: { amount: true },
    _count: true,
  });

  const collectionAmount = paymentsAgg._sum.amount || 0;
  const paymentCount = paymentsAgg._count || 0;
  const monthLabel = startOfMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'monthly_collection',
    period: { month, year, label: monthLabel },
    metric: 'collection_amount',
    collectionAmount,
    paymentCount,
    currency: 'TRY',
    source: 'financial_movements',
  };
}

async function buildMonthlyAppointmentCountContext(month, year, organizationId, branchId = null) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const where = {
    organizationId,
    startAt: { gte: startOfMonth, lte: endOfMonth },
  };
  if (branchId) where.branchId = branchId;

  const count = await prisma.appointment.count({ where });
  const monthLabel = startOfMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'monthly_appointment_count',
    period: { month, year, label: monthLabel },
    metric: 'appointment_count',
    count,
    source: 'appointments',
  };
}

/**
 * Clinic monthly appointment list - returns rows with patientName, doctorName, startAt, status.
 * Used when user asks to list appointments (listele, isimleriyle, etc.).
 */
async function buildClinicMonthlyAppointmentListContext(month, year, organizationId, branchId = null) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const where = {
    organizationId,
    startAt: { gte: startOfMonth, lte: endOfMonth },
  };
  if (branchId) where.branchId = branchId;

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { name: true } },
    },
    orderBy: { startAt: 'asc' },
    take: 100,
  });

  const monthLabel = startOfMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'monthly_appointment_list',
    period: { month, year, label: monthLabel },
    metric: 'appointment_list',
    count: appointments.length,
    appointments: appointments.map((a) => ({
      startAt: a.startAt,
      patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.trim() : null,
      doctorName: a.doctor?.name,
      status: a.status,
      reason: a.reason,
    })),
    source: 'appointments',
  };
}

/**
 * Doctor-scoped monthly appointment count. Filter MUST include doctorId.
 */
async function buildMonthlyAppointmentCountForDoctorContext(filter) {
  const { organizationId, branchId, doctorId, timeRange } = filter;
  if (!doctorId) {
    return { error: 'Doktor kapsamı gerekiyor. Hangi doktoru kastediyorsunuz?', type: 'monthly_appointment_count_for_doctor' };
  }

  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    doctorUserId: doctorId,
    startAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const [count, doctor] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.user.findFirst({
      where: { id: doctorId, orgs: { some: { organizationId, role: 'DOCTOR' } } },
      select: { id: true, name: true },
    }),
  ]);

  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'monthly_appointment_count_for_doctor' };

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'monthly_appointment_count_for_doctor',
    doctor: { id: doctor.id, name: doctor.name },
    period: { month, year, label: monthLabel },
    metric: 'appointment_count',
    count,
    source: 'appointments',
  };
}

/**
 * Doctor-scoped today appointment count. Filter MUST include doctorId.
 */
async function buildTodayAppointmentCountForDoctorContext(filter) {
  const { organizationId, branchId, doctorId, timeRange } = filter;
  if (!doctorId) {
    return { error: 'Doktor kapsamı gerekiyor. Hangi doktoru kastediyorsunuz?', type: 'today_appointment_count_for_doctor' };
  }

  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    doctorUserId: doctorId,
    startAt: { gte: from, lt: to },
  };
  if (branchId) where.branchId = branchId;

  const [count, doctor] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.user.findFirst({
      where: { id: doctorId, orgs: { some: { organizationId, role: 'DOCTOR' } } },
      select: { id: true, name: true },
    }),
  ]);

  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'today_appointment_count_for_doctor' };

  return {
    type: 'today_appointment_count_for_doctor',
    doctor: { id: doctor.id, name: doctor.name },
    date: from.toISOString().slice(0, 10),
    metric: 'appointment_count',
    count,
    source: 'appointments',
  };
}

/**
 * Patients with overdue installments (Installment.status=PENDING, dueDate < today).
 */
async function buildOverdueInstallmentPatientsContext(organizationId, branchId = null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where = {
    status: 'PENDING',
    dueDate: { lt: today },
    paymentPlan: {
      organizationId,
      ...(branchId && { patient: { branchId } }),
    },
  };

  const overdueInstallments = await prisma.installment.findMany({
    where,
    include: {
      paymentPlan: {
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 50,
  });

  const patientMap = new Map();
  for (const inst of overdueInstallments) {
    const p = inst.paymentPlan?.patient;
    if (!p) continue;
    const key = p.id;
    if (!patientMap.has(key)) {
      patientMap.set(key, {
        id: p.id,
        fullName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        phone: p.phone,
        overdueCount: 0,
        totalOverdueAmount: 0,
        oldestDueDate: null,
      });
    }
    const entry = patientMap.get(key);
    entry.overdueCount += 1;
    entry.totalOverdueAmount += inst.amount;
    if (!entry.oldestDueDate || inst.dueDate < entry.oldestDueDate) {
      entry.oldestDueDate = inst.dueDate;
    }
  }

  const patients = Array.from(patientMap.values());

  return {
    type: 'overdue_installment_patients',
    patients,
    count: patients.length,
    metric: 'list',
    source: 'installments',
  };
}

async function buildPatientTreatmentProgressContext(patientId, organizationId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) return { error: 'Hasta bulunamadı.', type: 'patient_treatment_progress' };

  const plans = await prisma.treatmentPlan.findMany({
    where: { patientId, organizationId, isActive: true },
    select: { totalPrice: true, completedTotal: true, plannedTotal: true },
  });

  const totalPrice = plans.reduce((s, p) => s + p.totalPrice, 0);
  const completedTotal = plans.reduce((s, p) => s + p.completedTotal, 0);
  const plannedTotal = plans.reduce((s, p) => s + (p.plannedTotal || p.totalPrice), 0);
  const completionPercentage = plannedTotal > 0 ? Math.round((completedTotal / plannedTotal) * 100) : 0;

  const fullName = `${patient.firstName} ${patient.lastName}`.trim();

  return {
    type: 'patient_treatment_progress',
    patient: { id: patient.id, fullName },
    metric: 'completion',
    completedTotal,
    totalPrice: plannedTotal || totalPrice,
    completionPercentage,
    currency: 'TRY',
    source: 'treatment_plans',
  };
}

async function buildDoctorTreatmentItemCountContext(doctorId, month, year, organizationId) {
  const doctor = await prisma.user.findFirst({
    where: {
      id: doctorId,
      orgs: { some: { organizationId, role: 'DOCTOR' } },
    },
    select: { id: true, name: true },
  });
  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'doctor_treatment_item_count' };

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const count = await prisma.treatmentItem.count({
    where: {
      organizationId,
      assignedDoctorId: doctorId,
      status: 'COMPLETED',
      completedAt: { gte: startOfMonth, lte: endOfMonth },
    },
  });

  const monthLabel = startOfMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'doctor_treatment_item_count',
    doctor: { id: doctor.id, name: doctor.name },
    period: { month, year, label: monthLabel },
    metric: 'completed_item_count',
    count,
    source: 'treatment_items',
  };
}

async function buildDoctorTreatmentItemCountComparisonContext(filter) {
  const { organizationId, doctorId, timeRange } = filter;
  if (!doctorId) {
    return { error: 'Doktor kapsamı gerekiyor. Hangi doktoru kastediyorsunuz?', type: 'doctor_treatment_item_count_comparison' };
  }

  const from = new Date(timeRange.from);
  const month = from.getMonth() + 1;
  const year = from.getFullYear();

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [current, previous] = await Promise.all([
    buildDoctorTreatmentItemCountContext(doctorId, month, year, organizationId),
    buildDoctorTreatmentItemCountContext(doctorId, prevMonth, prevYear, organizationId),
  ]);

  if (current?.error) return current;
  if (previous?.error) return previous;

  const currentCount = current.count || 0;
  const previousCount = previous.count || 0;
  const difference = currentCount - previousCount;
  const percentageChange =
    previousCount > 0 ? Math.round((difference / previousCount) * 10000) / 100 : (currentCount > 0 ? 100 : 0);

  return {
    type: 'doctor_treatment_item_count_comparison',
    doctor: current.doctor,
    currentCount,
    previousCount,
    difference,
    percentageChange,
    currentPeriod: current.period,
    previousPeriod: previous.period,
    source: 'treatment_items',
  };
}

async function buildCurrentAccountBalanceContext(currentAccountId, organizationId) {
  const account = await prisma.currentAccount.findFirst({
    where: { id: currentAccountId, organizationId },
    select: { id: true, name: true, type: true },
  });
  if (!account) return { error: 'Cari hesap bulunamadı.', type: 'current_account_balance' };

  const agg = await prisma.currentAccountTransaction.aggregate({
    where: { currentAccountId, organizationId },
    _sum: { debit: true, credit: true },
  });

  const totalDebit = agg._sum.debit || 0;
  const totalCredit = agg._sum.credit || 0;
  const balance = totalDebit - totalCredit;

  return {
    type: 'current_account_balance',
    currentAccount: { id: account.id, name: account.name, accountType: account.type },
    summary: {
      totalDebit,
      totalCredit,
      balance,
      currency: 'TRY',
    },
    source: 'current_account_transactions',
  };
}

async function buildCurrentAccountTransactionsContext(currentAccountId, organizationId, limit = 20) {
  const account = await prisma.currentAccount.findFirst({
    where: { id: currentAccountId, organizationId },
    select: { id: true, name: true, type: true },
  });
  if (!account) return { error: 'Cari hesap bulunamadı.', type: 'current_account_transactions' };

  const agg = await prisma.currentAccountTransaction.aggregate({
    where: { currentAccountId, organizationId },
    _sum: { debit: true, credit: true },
  });

  const totalDebit = agg._sum.debit || 0;
  const totalCredit = agg._sum.credit || 0;
  const balance = totalDebit - totalCredit;

  const transactions = await prisma.currentAccountTransaction.findMany({
    where: { currentAccountId, organizationId },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: Math.min(limit, 50),
    select: {
      id: true,
      debit: true,
      credit: true,
      occurredAt: true,
      description: true,
      reference: true,
      transactionType: true,
    },
  });

  return {
    type: 'current_account_transactions',
    currentAccount: { id: account.id, name: account.name, accountType: account.type },
    summary: {
      totalDebit,
      totalCredit,
      balance,
      currency: 'TRY',
    },
    transactions: transactions.map((t) => ({
      date: t.occurredAt,
      type: t.transactionType,
      debit: t.debit,
      credit: t.credit,
      description: t.description,
      documentNo: t.reference,
    })),
    source: 'current_account_transactions',
  };
}

async function buildClinicPatientCountContext(filter) {
  const { organizationId, branchId } = filter;
  const where = { organizationId };
  if (branchId) where.branchId = branchId;

  const count = await prisma.patient.count({ where });

  return {
    type: 'clinic_patient_count',
    metric: 'patient_count',
    count,
    scope: branchId ? 'branch' : 'organization',
    source: 'patients',
  };
}

/**
 * Clinic appointment demographics by patient gender.
 * Returns counts and ratios for female/male/unknown patients who had appointments in the period.
 * Patient.gender: 'FEMALE' | 'MALE' | 'OTHER' | null (stored as string in DB)
 */
async function buildClinicAppointmentDemographicsByGenderContext(month, year, organizationId, branchId = null, genderFilter = null) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const apptWhere = {
    organizationId,
    startAt: { gte: startOfMonth, lte: endOfMonth },
  };
  if (branchId) apptWhere.branchId = branchId;

  const appointments = await prisma.appointment.findMany({
    where: apptWhere,
    select: { patientId: true },
    distinct: ['patientId'],
  });

  const patientIds = [...new Set(appointments.map((a) => a.patientId).filter(Boolean))];
  if (patientIds.length === 0) {
    const monthLabel = startOfMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    return {
      type: 'clinic_appointment_demographics_by_gender',
      period: { month, year, label: monthLabel },
      totalAppointmentPatients: 0,
      femaleCount: 0,
      maleCount: 0,
      otherCount: 0,
      unknownCount: 0,
      femalePercentage: 0,
      malePercentage: 0,
      source: 'appointments_patients',
    };
  }

  const patients = await prisma.patient.findMany({
    where: { id: { in: patientIds }, organizationId },
    select: { id: true, gender: true },
  });

  const genderMap = { female: 0, male: 0, other: 0, unknown: 0 };
  for (const p of patients) {
    const g = (p.gender || '').toLowerCase();
    if (g === 'female' || g === 'kadin' || g === 'kadın' || g === 'f') genderMap.female += 1;
    else if (g === 'male' || g === 'erkek' || g === 'e') genderMap.male += 1;
    else if (g === 'other' || g === 'diger' || g === 'diğer') genderMap.other += 1;
    else genderMap.unknown += 1;
  }

  const total = patients.length;
  const femalePct = total > 0 ? Math.round((genderMap.female / total) * 10000) / 100 : 0;
  const malePct = total > 0 ? Math.round((genderMap.male / total) * 10000) / 100 : 0;
  const monthLabel = startOfMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  const result = {
    type: 'clinic_appointment_demographics_by_gender',
    period: { month, year, label: monthLabel },
    totalAppointmentPatients: total,
    femaleCount: genderMap.female,
    maleCount: genderMap.male,
    otherCount: genderMap.other,
    unknownCount: genderMap.unknown,
    femalePercentage: femalePct,
    malePercentage: malePct,
    source: 'appointments_patients',
  };

  if (genderFilter) {
    const g = String(genderFilter).toLowerCase();
    if (g === 'female' || g === 'kadin' || g === 'kadın') {
      result.filteredCount = genderMap.female;
      result.filteredGender = 'female';
    } else if (g === 'male' || g === 'erkek') {
      result.filteredCount = genderMap.male;
      result.filteredGender = 'male';
    }
  }

  return result;
}

async function buildLowStockProductsContext(organizationId, branchId = null) {
  const where = { organizationId };
  if (branchId) where.branchId = branchId;

  const items = await prisma.inventoryItem.findMany({
    where,
    select: { id: true, name: true, currentStock: true, minLevel: true, unit: true },
    take: 100,
  });

  const lowStock = items
    .filter((i) => i.currentStock < i.minLevel)
    .slice(0, 50)
    .map((i) => ({
      id: i.id,
      name: i.name,
      currentStock: i.currentStock,
      minLevel: i.minLevel,
      deficit: i.minLevel - i.currentStock,
      unit: i.unit,
    }));

  return {
    type: 'low_stock_products',
    items: lowStock,
    count: lowStock.length,
    source: 'inventory',
  };
}

async function buildClinicOverviewContext(organizationId, branchId = null, date = null) {
  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const where = {
    organizationId,
    startAt: { gte: targetDate, lt: nextDay },
  };
  if (branchId) where.branchId = branchId;

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { name: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  const uniquePatientIds = [...new Set(appointments.map((a) => a.patientId).filter(Boolean))];

  return {
    type: 'clinic_overview',
    date: targetDate.toISOString().slice(0, 10),
    appointments: appointments.map((a) => ({
      startAt: a.startAt,
      patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.trim() : null,
      doctorName: a.doctor?.name,
      status: a.status,
    })),
    count: appointments.length,
    patientCount: uniquePatientIds.length,
    source: 'appointments',
  };
}

async function buildTodayCollectionSummaryContext(organizationId, branchId = null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const where = {
    organizationId,
    type: 'PAYMENT',
    status: 'ACTIVE',
    amount: { gt: 0 },
    occurredAt: { gte: today, lt: tomorrow },
  };

  const [movements, agg] = await Promise.all([
    prisma.financialMovement.findMany({
      where,
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 20,
    }),
    prisma.financialMovement.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const totalAmount = agg._sum.amount || 0;
  const count = agg._count || 0;
  const dateStr = today.toISOString().slice(0, 10);

  return {
    type: 'today_collection_summary',
    date: dateStr,
    summary: {
      totalPayments: totalAmount,
      totalRevenue: totalAmount,
      count,
      currency: 'TRY',
    },
    payments: movements.map((m) => ({
      amount: m.amount,
      occurredAt: m.occurredAt,
      patientName: m.patient ? `${m.patient.firstName} ${m.patient.lastName}`.trim() : null,
      description: m.description,
    })),
    source: 'financial_movements',
  };
}

async function buildClinicRevenueContext(filter) {
  const data = await getClinicRevenueSnapshot({
    organizationId: filter.organizationId,
    branchId: filter.branchId,
    range: filter.timeRange,
  });

  return {
    type: 'clinic_revenue_amount',
    revenueAmount: data.revenueAmount,
    invoiceCount: data.invoiceCount,
    period: filter.timeRange,
    currency: 'TRY',
    source: 'invoices',
  };
}

async function buildClinicRevenueComparisonContext(filter) {
  const comparison = await getClinicRevenueComparison({
    organizationId: filter.organizationId,
    branchId: filter.branchId,
    range: filter.timeRange,
  });

  return {
    type: 'clinic_revenue_comparison',
    currentAmount: comparison.currentAmount,
    previousAmount: comparison.previousAmount,
    difference: comparison.difference,
    percentageChange: comparison.percentageChange,
    currentRange: comparison.currentRange,
    previousRange: comparison.previousRange,
    currency: 'TRY',
    source: 'invoices',
  };
}

async function buildClinicCollectionContext(filter) {
  const data = await getClinicCollectionSnapshot({
    organizationId: filter.organizationId,
    branchId: filter.branchId,
    range: filter.timeRange,
  });

  return {
    type: 'clinic_collection_amount',
    collectionAmount: data.collectionAmount,
    paymentCount: data.paymentCount,
    period: filter.timeRange,
    currency: 'TRY',
    source: 'payments',
  };
}

async function buildClinicPendingCollectionContext(filter) {
  const data = await getPendingCollectionsSnapshot({
    organizationId: filter.organizationId,
    branchId: filter.branchId,
    range: filter.timeRange,
  });

  return {
    type: 'clinic_pending_collection_amount',
    pendingCollectionAmount: data.totalPendingAmount,
    openInvoiceCount: data.openInvoiceCount,
    patientsWithBalance: data.patientsWithBalance,
    period: filter.timeRange,
    currency: 'TRY',
    source: 'invoices',
  };
}

async function buildClinicPendingCollectionComparisonContext(filter) {
  const comparison = await getPendingCollectionComparison({
    organizationId: filter.organizationId,
    branchId: filter.branchId,
    range: filter.timeRange,
  });

  return {
    type: 'clinic_pending_collection_comparison',
    currentAmount: comparison.currentAmount,
    previousAmount: comparison.previousAmount,
    difference: comparison.difference,
    currentRange: comparison.currentRange,
    previousRange: comparison.previousRange,
    currency: 'TRY',
    source: 'invoices',
  };
}

async function buildClinicOutstandingReceivablesContext(filter) {
  const data = await getOutstandingReceivablesSnapshot({
    organizationId: filter.organizationId,
    branchId: filter.branchId,
  });

  return {
    type: 'clinic_outstanding_receivables',
    outstandingBalanceAmount: data.totalOutstandingAmount,
    openInvoiceCount: data.openInvoiceCount,
    patientsWithBalance: data.patientsWithBalance,
    period: filter.timeRange || null,
    currency: 'TRY',
    source: 'invoices',
  };
}

async function buildOverdueReceivablesSummaryContext(filter) {
  const data = await getOverdueReceivablesSnapshot({
    organizationId: filter.organizationId,
    branchId: filter.branchId,
    range: filter.timeRange,
  });

  return {
    type: 'overdue_receivables_summary',
    overdueReceivablesAmount: data.totalOverdueAmount,
    overduePatients: data.patients,
    overdueInvoiceCount: data.overdueInvoices.length,
    overdueInstallmentCount: data.overdueInstallments.length,
    period: filter.timeRange || null,
    currency: 'TRY',
    source: 'invoices_and_installments',
  };
}

/**
 * Doctor-scoped appointment list. Returns rows with patient name, date, status.
 * Supports monthly ranges.
 */
async function buildDoctorAppointmentListContext(filter) {
  const { organizationId, branchId, doctorId, timeRange } = filter;
  if (!doctorId) {
    return { error: 'Doktor kapsamı gerekiyor. Hangi doktoru kastediyorsunuz?', type: 'doctor_appointment_list' };
  }

  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    doctorUserId: doctorId,
    startAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const [appointments, doctor] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startAt: 'asc' },
      take: 100,
    }),
    prisma.user.findFirst({
      where: { id: doctorId, orgs: { some: { organizationId, role: 'DOCTOR' } } },
      select: { id: true, name: true },
    }),
  ]);

  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'doctor_appointment_list' };

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'doctor_appointment_list',
    doctor: { id: doctor.id, name: doctor.name },
    period: { month, year, label: monthLabel },
    metric: 'appointment_list',
    count: appointments.length,
    appointments: appointments.map((a) => ({
      startAt: a.startAt,
      patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.trim() : null,
      doctorName: doctor.name,
      status: a.status,
      reason: a.reason,
    })),
    source: 'appointments',
  };
}

/**
 * Doctor completed treatment value (total ₺ value of completed items in period).
 */
async function buildDoctorCompletedTreatmentValueContext(filter) {
  const { organizationId, doctorId, timeRange } = filter;
  if (!doctorId) {
    return { error: 'Doktor kapsamı gerekiyor. Hangi doktoru kastediyorsunuz?', type: 'doctor_completed_treatment_value' };
  }

  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const [doctor, agg] = await Promise.all([
    prisma.user.findFirst({
      where: { id: doctorId, orgs: { some: { organizationId, role: 'DOCTOR' } } },
      select: { id: true, name: true },
    }),
    prisma.treatmentItem.aggregate({
      where: {
        organizationId,
        assignedDoctorId: doctorId,
        status: 'COMPLETED',
        completedAt: { gte: from, lte: to },
      },
      _sum: { price: true },
      _count: true,
    }),
  ]);

  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'doctor_completed_treatment_value' };

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'doctor_completed_treatment_value',
    doctor: { id: doctor.id, name: doctor.name },
    period: { month, year, label: monthLabel },
    metric: 'completed_treatment_value',
    completedTreatmentValue: agg._sum.price || 0,
    completedItemCount: agg._count || 0,
    currency: 'TRY',
    source: 'treatment_items',
  };
}

/**
 * Clinic new patient count — patients created within a time range.
 */
async function buildClinicNewPatientCountContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    createdAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const count = await prisma.patient.count({ where });

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'clinic_new_patient_count',
    metric: 'new_patient_count',
    period: { month, year, label: monthLabel },
    count,
    source: 'patients',
  };
}

/**
 * Clinic no-show rate — ratio of NO_SHOW appointments to total.
 */
async function buildClinicNoShowRateContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    startAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const [total, noShow] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.count({ where: { ...where, status: 'NO_SHOW' } }),
  ]);

  const rate = total > 0 ? Math.round((noShow / total) * 10000) / 100 : 0;

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'clinic_no_show_rate',
    metric: 'no_show_rate',
    period: { month, year, label: monthLabel },
    totalAppointments: total,
    noShowCount: noShow,
    noShowRate: rate,
    source: 'appointments',
  };
}

/**
 * Clinic cancellation rate — ratio of CANCELLED appointments to total.
 */
async function buildClinicCancellationRateContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    startAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const [total, cancelled] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.count({ where: { ...where, status: 'CANCELLED' } }),
  ]);

  const rate = total > 0 ? Math.round((cancelled / total) * 10000) / 100 : 0;

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'clinic_cancellation_rate',
    metric: 'cancellation_rate',
    period: { month, year, label: monthLabel },
    totalAppointments: total,
    cancelledCount: cancelled,
    cancellationRate: rate,
    source: 'appointments',
  };
}

/**
 * Clinic completed treatment count — total completed treatment items in period.
 */
async function buildClinicCompletedTreatmentCountContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    status: 'COMPLETED',
    completedAt: { gte: from, lte: to },
  };

  const count = await prisma.treatmentItem.count({ where });

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'clinic_completed_treatment_count',
    metric: 'completed_treatment_count',
    period: { month, year, label: monthLabel },
    count,
    source: 'treatment_items',
  };
}

// ───────────────────────────────────────────────────────────────────
// PHASE 1 — New aggregators for runtime capability gap fix
// ───────────────────────────────────────────────────────────────────

/**
 * Doctor revenue — total invoiced amount for doctor's patients in period.
 * Uses Payment records with doctorId.
 */
async function buildDoctorRevenueContext(filter) {
  const { organizationId, doctorId, timeRange } = filter;
  if (!doctorId) return { error: 'Doktor kapsamı gerekiyor.', type: 'doctor_revenue' };

  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const [doctor, agg] = await Promise.all([
    prisma.user.findFirst({
      where: { id: doctorId, orgs: { some: { organizationId, role: 'DOCTOR' } } },
      select: { id: true, name: true },
    }),
    prisma.payment.aggregate({
      where: {
        organizationId,
        doctorId,
        deletedAt: null,
        isRefund: false,
        paidAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'doctor_revenue' };

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'doctor_revenue',
    doctor: { id: doctor.id, name: doctor.name },
    period: { month, year, label: monthLabel },
    revenueAmount: agg._sum.amount || 0,
    paymentCount: agg._count || 0,
    currency: 'TRY',
    source: 'payments',
  };
}

/**
 * Doctor collection — total collected payments by doctor in period.
 */
async function buildDoctorCollectionContext(filter) {
  const { organizationId, doctorId, timeRange } = filter;
  if (!doctorId) return { error: 'Doktor kapsamı gerekiyor.', type: 'doctor_collection' };

  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const [doctor, agg] = await Promise.all([
    prisma.user.findFirst({
      where: { id: doctorId, orgs: { some: { organizationId, role: 'DOCTOR' } } },
      select: { id: true, name: true },
    }),
    prisma.financialMovement.aggregate({
      where: {
        organizationId,
        type: 'PAYMENT',
        status: 'ACTIVE',
        doctorId,
        amount: { gt: 0 },
        occurredAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'doctor_collection' };

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'doctor_collection',
    doctor: { id: doctor.id, name: doctor.name },
    period: { month, year, label: monthLabel },
    collectionAmount: agg._sum.amount || 0,
    paymentCount: agg._count || 0,
    currency: 'TRY',
    source: 'financial_movements',
  };
}

/**
 * Doctor patient count — unique patients with appointments for this doctor in period.
 */
async function buildDoctorPatientCountContext(filter) {
  const { organizationId, branchId, doctorId, timeRange } = filter;
  if (!doctorId) return { error: 'Doktor kapsamı gerekiyor.', type: 'doctor_patient_count' };

  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    doctorUserId: doctorId,
    startAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const [doctor, appointments] = await Promise.all([
    prisma.user.findFirst({
      where: { id: doctorId, orgs: { some: { organizationId, role: 'DOCTOR' } } },
      select: { id: true, name: true },
    }),
    prisma.appointment.findMany({
      where,
      select: { patientId: true },
      distinct: ['patientId'],
    }),
  ]);

  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'doctor_patient_count' };

  const uniquePatients = new Set(appointments.map((a) => a.patientId).filter(Boolean));
  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'doctor_patient_count',
    doctor: { id: doctor.id, name: doctor.name },
    period: { month, year, label: monthLabel },
    count: uniquePatients.size,
    source: 'appointments',
  };
}

/**
 * Doctor completed treatment list — row-level completed treatment items by doctor.
 */
async function buildDoctorCompletedTreatmentListContext(filter) {
  const { organizationId, doctorId, timeRange } = filter;
  if (!doctorId) return { error: 'Doktor kapsamı gerekiyor.', type: 'doctor_completed_treatment_list' };

  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const [doctor, items] = await Promise.all([
    prisma.user.findFirst({
      where: { id: doctorId, orgs: { some: { organizationId, role: 'DOCTOR' } } },
      select: { id: true, name: true },
    }),
    prisma.treatmentItem.findMany({
      where: {
        organizationId,
        assignedDoctorId: doctorId,
        status: 'COMPLETED',
        completedAt: { gte: from, lte: to },
      },
      include: {
        plan: {
          include: { patient: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 100,
    }),
  ]);

  if (!doctor) return { error: 'Doktor bulunamadı.', type: 'doctor_completed_treatment_list' };

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'doctor_completed_treatment_list',
    doctor: { id: doctor.id, name: doctor.name },
    period: { month, year, label: monthLabel },
    count: items.length,
    treatmentItems: items.map((i) => ({
      name: i.name,
      price: i.price,
      completedAt: i.completedAt,
      patientName: i.plan?.patient
        ? `${i.plan.patient.firstName} ${i.plan.patient.lastName}`.trim()
        : null,
      tooth: i.tooth,
    })),
    source: 'treatment_items',
  };
}

/**
 * Clinic completed treatment list — all completed treatment items clinic-wide.
 */
async function buildClinicCompletedTreatmentListContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const items = await prisma.treatmentItem.findMany({
    where: {
      organizationId,
      status: 'COMPLETED',
      completedAt: { gte: from, lte: to },
    },
    include: {
      assignedDoctor: { select: { name: true } },
      plan: {
        include: { patient: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: { completedAt: 'desc' },
    take: 100,
  });

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'clinic_completed_treatment_list',
    period: { month, year, label: monthLabel },
    count: items.length,
    treatmentItems: items.map((i) => ({
      name: i.name,
      price: i.price,
      completedAt: i.completedAt,
      doctorName: i.assignedDoctor?.name || null,
      patientName: i.plan?.patient
        ? `${i.plan.patient.firstName} ${i.plan.patient.lastName}`.trim()
        : null,
      tooth: i.tooth,
    })),
    source: 'treatment_items',
  };
}

/**
 * Clinic treatment completion rate — completed vs total treatment items in period.
 */
async function buildClinicTreatmentCompletionRateContext(filter) {
  const { organizationId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const baseWhere = {
    organizationId,
    createdAt: { lte: to },
  };
  const [total, completed] = await Promise.all([
    prisma.treatmentItem.count({ where: baseWhere }),
    prisma.treatmentItem.count({
      where: { ...baseWhere, status: 'COMPLETED', completedAt: { gte: from, lte: to } },
    }),
  ]);

  const rate = total > 0 ? Math.round((completed / total) * 10000) / 100 : 0;
  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'clinic_treatment_completion_rate',
    period: { month, year, label: monthLabel },
    totalItems: total,
    completedItems: completed,
    completionRate: rate,
    source: 'treatment_items',
  };
}

/**
 * Cancelled appointments list — row-level cancelled appointments.
 */
async function buildCancelledAppointmentsListContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    status: 'CANCELLED',
    startAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { name: true } },
    },
    orderBy: { startAt: 'asc' },
    take: 100,
  });

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'cancelled_appointments_list',
    period: { month, year, label: monthLabel },
    count: appointments.length,
    appointments: appointments.map((a) => ({
      startAt: a.startAt,
      patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.trim() : null,
      doctorName: a.doctor?.name,
      reason: a.reason,
      status: a.status,
    })),
    source: 'appointments',
  };
}

/**
 * No-show patients list — NOSHOW appointments with patient details.
 */
async function buildNoShowPatientsListContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    status: 'NOSHOW',
    startAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true } },
      doctor: { select: { name: true } },
    },
    orderBy: { startAt: 'asc' },
    take: 100,
  });

  const month = from.getMonth() + 1;
  const year = from.getFullYear();
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'no_show_patients_list',
    period: { month, year, label: monthLabel },
    count: appointments.length,
    appointments: appointments.map((a) => ({
      startAt: a.startAt,
      patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.trim() : null,
      patientPhone: a.patient?.phone,
      doctorName: a.doctor?.name,
      status: a.status,
    })),
    source: 'appointments',
  };
}

/**
 * Clinic collection comparison — compare collection amounts between two periods.
 */
async function buildClinicCollectionComparisonContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);
  const duration = to - from;

  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - duration);

  const buildWhere = (f, t) => ({
    organizationId,
    type: 'PAYMENT',
    status: 'ACTIVE',
    amount: { gt: 0 },
    occurredAt: { gte: f, lte: t },
  });

  const [current, previous] = await Promise.all([
    prisma.financialMovement.aggregate({ where: buildWhere(from, to), _sum: { amount: true } }),
    prisma.financialMovement.aggregate({ where: buildWhere(prevFrom, prevTo), _sum: { amount: true } }),
  ]);

  const currentAmount = current._sum.amount || 0;
  const previousAmount = previous._sum.amount || 0;
  const difference = currentAmount - previousAmount;
  const percentageChange = previousAmount > 0
    ? Math.round((difference / previousAmount) * 10000) / 100
    : (currentAmount > 0 ? 100 : 0);

  return {
    type: 'clinic_collection_comparison',
    currentAmount,
    previousAmount,
    difference,
    percentageChange,
    currentRange: { from: from.toISOString(), to: to.toISOString() },
    previousRange: { from: prevFrom.toISOString(), to: prevTo.toISOString() },
    currency: 'TRY',
    source: 'financial_movements',
  };
}

/**
 * Clinic appointment count comparison — compare appointment counts between two periods.
 */
async function buildClinicAppointmentCountComparisonContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);
  const duration = to - from;

  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - duration);

  const buildWhere = (f, t) => {
    const w = { organizationId, startAt: { gte: f, lte: t } };
    if (branchId) w.branchId = branchId;
    return w;
  };

  const [currentCount, previousCount] = await Promise.all([
    prisma.appointment.count({ where: buildWhere(from, to) }),
    prisma.appointment.count({ where: buildWhere(prevFrom, prevTo) }),
  ]);

  const difference = currentCount - previousCount;
  const percentageChange = previousCount > 0
    ? Math.round((difference / previousCount) * 10000) / 100
    : (currentCount > 0 ? 100 : 0);

  return {
    type: 'clinic_appointment_count_comparison',
    currentCount,
    previousCount,
    difference,
    percentageChange,
    currentRange: { from: from.toISOString(), to: to.toISOString() },
    previousRange: { from: prevFrom.toISOString(), to: prevTo.toISOString() },
    source: 'appointments',
  };
}

/**
 * Clinic inventory item count — total inventory items.
 */
async function buildClinicInventoryItemCountContext(filter) {
  const { organizationId, branchId } = filter;
  const where = { organizationId };
  if (branchId) where.branchId = branchId;
  const count = await prisma.inventoryItem.count({ where });

  return {
    type: 'clinic_inventory_item_count',
    count,
    source: 'inventory',
  };
}

/**
 * Clinic low stock item count — items below min level.
 */
async function buildClinicLowStockItemCountContext(filter) {
  const { organizationId, branchId } = filter;
  const where = { organizationId };
  if (branchId) where.branchId = branchId;

  const items = await prisma.inventoryItem.findMany({
    where,
    select: { currentStock: true, minLevel: true },
  });

  const lowStockCount = items.filter((i) => i.currentStock < i.minLevel).length;

  return {
    type: 'clinic_low_stock_item_count',
    count: lowStockCount,
    totalItems: items.length,
    source: 'inventory',
  };
}

/**
 * Clinic expiring stock — items with expiry batches expiring within 30 days.
 */
async function buildClinicExpiringStockContext(filter) {
  const { organizationId } = filter;
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const batches = await prisma.stockExpiryBatch.findMany({
    where: {
      organizationId,
      expiryDate: { gte: now, lte: thirtyDays },
      quantity: { gt: 0 },
    },
    include: {
      item: { select: { id: true, name: true, unit: true } },
    },
    orderBy: { expiryDate: 'asc' },
    take: 50,
  });

  return {
    type: 'clinic_expiring_stock',
    count: batches.length,
    items: batches.map((b) => ({
      name: b.item.name,
      quantity: b.quantity,
      expiryDate: b.expiryDate,
      unit: b.item.unit,
    })),
    source: 'stock_expiry_batches',
  };
}

/**
 * Clinic stock value total — total value of all inventory.
 */
async function buildClinicStockValueTotalContext(filter) {
  const { organizationId, branchId } = filter;
  const where = { organizationId };
  if (branchId) where.branchId = branchId;

  const items = await prisma.inventoryItem.findMany({
    where,
    select: { currentStock: true, cost: true },
  });

  const totalValue = items.reduce((sum, i) => sum + (i.currentStock * (i.cost || 0)), 0);
  const totalItems = items.length;

  return {
    type: 'clinic_stock_value_total',
    totalValue,
    totalItems,
    currency: 'TRY',
    source: 'inventory',
  };
}

/**
 * Debtor patient list — patients with positive balance (owe money).
 */
async function buildDebtorPatientListContext(filter) {
  const { organizationId, branchId } = filter;

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'] },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });

  const patientMap = new Map();
  for (const inv of invoices) {
    if (!inv.patient) continue;
    const key = inv.patient.id;
    if (!patientMap.has(key)) {
      patientMap.set(key, {
        id: inv.patient.id,
        fullName: `${inv.patient.firstName} ${inv.patient.lastName}`.trim(),
        phone: inv.patient.phone,
        totalDebt: 0,
        invoiceCount: 0,
      });
    }
    const entry = patientMap.get(key);
    entry.totalDebt += inv.netTotal || 0;
    entry.invoiceCount += 1;
  }

  const patients = Array.from(patientMap.values())
    .filter((p) => p.totalDebt > 0)
    .sort((a, b) => b.totalDebt - a.totalDebt)
    .slice(0, 50);

  return {
    type: 'debtor_patient_list',
    count: patients.length,
    patients,
    currency: 'TRY',
    source: 'invoices',
  };
}

/**
 * Clinic cancelled appointment count.
 */
async function buildClinicCancelledAppointmentCountContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    status: 'CANCELLED',
    startAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const count = await prisma.appointment.count({ where });
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'clinic_cancelled_appointment_count',
    period: { month: from.getMonth() + 1, year: from.getFullYear(), label: monthLabel },
    count,
    source: 'appointments',
  };
}

/**
 * Clinic no-show count.
 */
async function buildClinicNoShowCountContext(filter) {
  const { organizationId, branchId, timeRange } = filter;
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);

  const where = {
    organizationId,
    status: 'NOSHOW',
    startAt: { gte: from, lte: to },
  };
  if (branchId) where.branchId = branchId;

  const count = await prisma.appointment.count({ where });
  const monthLabel = from.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return {
    type: 'clinic_no_show_count',
    period: { month: from.getMonth() + 1, year: from.getFullYear(), label: monthLabel },
    count,
    source: 'appointments',
  };
}

async function buildOverdueInstallmentPatientsContext(filter = {}) {
  const fetched = await fetchPaymentPlansForOverdueAnalysis(filter);
  if (fetched.error) return { error: fetched.error };

  const snapshot = computeOverdueInstallmentSnapshot(fetched.plans, {
    doctorId: filter.doctorId || null,
  });

  return {
    type: 'overdue_installment_patient_list',
    count: snapshot.overduePatientCount,
    patients: snapshot.rows.filter((r) => r.overdueInstallmentCount > 0),
    totalPatientsInPopulation: snapshot.totalPatientCount,
    currency: 'TRY',
    source: 'payment_plans_installments',
  };
}

async function buildOverdueInstallmentCountContext(filter = {}) {
  const fetched = await fetchPaymentPlansForOverdueAnalysis(filter);
  if (fetched.error) return { error: fetched.error };

  const snapshot = computeOverdueInstallmentSnapshot(fetched.plans, {
    doctorId: filter.doctorId || null,
  });

  return {
    type: 'overdue_installment_count',
    count: snapshot.overdueInstallmentCount,
    overduePatientCount: snapshot.overduePatientCount,
    totalPatientsInPopulation: snapshot.totalPatientCount,
    source: 'payment_plans_installments',
  };
}

async function buildOverdueInstallmentAmountContext(filter = {}) {
  const fetched = await fetchPaymentPlansForOverdueAnalysis(filter);
  if (fetched.error) return { error: fetched.error };

  const snapshot = computeOverdueInstallmentSnapshot(fetched.plans, {
    doctorId: filter.doctorId || null,
  });

  return {
    type: 'overdue_installment_amount',
    overdueInstallmentAmount: snapshot.overdueInstallmentAmount,
    overdueInstallmentCount: snapshot.overdueInstallmentCount,
    overduePatientCount: snapshot.overduePatientCount,
    currency: 'TRY',
    source: 'payment_plans_installments',
  };
}

async function buildOverdueInstallmentRatioContext(filter = {}) {
  const fetched = await fetchPaymentPlansForOverdueAnalysis(filter);
  if (fetched.error) return { error: fetched.error };

  const snapshot = computeOverdueInstallmentSnapshot(fetched.plans, {
    doctorId: filter.doctorId || null,
  });

  const ratio =
    snapshot.totalPatientCount > 0
      ? Math.round((snapshot.overduePatientCount / snapshot.totalPatientCount) * 10000) / 100
      : 0;

  return {
    type: 'overdue_installment_ratio',
    shape: 'ratio',
    ratio,
    percentage: ratio,
    numerator: snapshot.overduePatientCount,
    denominator: snapshot.totalPatientCount,
    source: 'payment_plans_installments',
    details: {
      overduePatientCount: snapshot.overduePatientCount,
      totalPatientsInPopulation: snapshot.totalPatientCount,
      overdueInstallmentCount: snapshot.overdueInstallmentCount,
      overdueInstallmentAmount: snapshot.overdueInstallmentAmount,
    },
  };
}

async function buildDoctorOverdueInstallmentRatioContext(filter = {}) {
  const fetched = await fetchPaymentPlansForOverdueAnalysis(filter);
  if (fetched.error) return { error: fetched.error };

  const snapshot = computeOverdueInstallmentSnapshot(fetched.plans, {
    doctorId: filter.doctorId || null,
  });

  const ratio =
    snapshot.totalPatientCount > 0
      ? Math.round((snapshot.overduePatientCount / snapshot.totalPatientCount) * 10000) / 100
      : 0;

  return {
    type: 'doctor_overdue_installment_ratio',
    shape: 'ratio',
    doctorId: filter.doctorId || null,
    ratio,
    percentage: ratio,
    numerator: snapshot.overduePatientCount,
    denominator: snapshot.totalPatientCount,
    source: 'payment_plans_installments',
    details: {
      overduePatientCount: snapshot.overduePatientCount,
      totalPatientsInPopulation: snapshot.totalPatientCount,
      overdueInstallmentCount: snapshot.overdueInstallmentCount,
      overdueInstallmentAmount: snapshot.overdueInstallmentAmount,
    },
  };
}

module.exports = {
  buildPatientBalanceContext,
  buildPatientLastPaymentContext,
  buildPatientSummaryContext,
  buildPatientAppointmentsContext,
  buildPatientTreatmentPlansContext,
  buildTreatmentPlanDetailsContext,
  buildPatientTreatmentProgressContext,
  buildDoctorScheduleContext,
  buildDoctorTreatmentItemCountContext,
  buildMonthlyFinanceSummaryContext,
  buildMonthlyAppointmentCountContext,
  buildClinicMonthlyAppointmentListContext,
  buildMonthlyAppointmentCountForDoctorContext,
  buildTodayAppointmentCountForDoctorContext,
  buildOverdueInstallmentPatientsContext,
  buildTodayCollectionSummaryContext,
  buildClinicRevenueContext,
  buildClinicRevenueComparisonContext,
  buildClinicCollectionContext,
  buildClinicPendingCollectionContext,
  buildClinicPendingCollectionComparisonContext,
  buildDoctorTreatmentItemCountComparisonContext,
  buildClinicOutstandingReceivablesContext,
  buildOverdueReceivablesSummaryContext,
  buildCurrentAccountBalanceContext,
  buildCurrentAccountTransactionsContext,
  buildLowStockProductsContext,
  buildClinicOverviewContext,
  buildClinicPatientCountContext,
  buildClinicAppointmentDemographicsByGenderContext,
  buildDoctorAppointmentListContext,
  buildDoctorCompletedTreatmentValueContext,
  buildClinicNewPatientCountContext,
  buildClinicNoShowRateContext,
  buildClinicCancellationRateContext,
  buildClinicCompletedTreatmentCountContext,
  formatCurrency,
  // Phase 1 — new aggregators
  buildDoctorRevenueContext,
  buildDoctorCollectionContext,
  buildDoctorPatientCountContext,
  buildDoctorCompletedTreatmentListContext,
  buildClinicCompletedTreatmentListContext,
  buildClinicTreatmentCompletionRateContext,
  buildCancelledAppointmentsListContext,
  buildNoShowPatientsListContext,
  buildClinicCollectionComparisonContext,
  buildClinicAppointmentCountComparisonContext,
  buildClinicInventoryItemCountContext,
  buildClinicLowStockItemCountContext,
  buildClinicExpiringStockContext,
  buildClinicStockValueTotalContext,
  buildDebtorPatientListContext,
  buildClinicCancelledAppointmentCountContext,
  buildClinicNoShowCountContext,
  buildOverdueInstallmentPatientsContext,
  buildOverdueInstallmentCountContext,
  buildOverdueInstallmentAmountContext,
  buildOverdueInstallmentRatioContext,
  buildDoctorOverdueInstallmentRatioContext,
};
