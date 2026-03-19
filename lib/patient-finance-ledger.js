const { prisma } = require("./prisma");

function buildSummary(movements) {
  const totalTreatmentCost = movements
    .filter((movement) => movement.type === "TREATMENT_COST")
    .reduce((sum, movement) => sum + Math.abs(movement.amount), 0);

  const totalPaid = movements
    .filter((movement) => movement.type === "PAYMENT")
    .reduce((sum, movement) => sum + movement.amount, 0);

  return {
    totalTreatmentCost,
    totalPaid,
    remaining: totalTreatmentCost - totalPaid,
    treatmentMovementCount: movements.filter((movement) => movement.type === "TREATMENT_COST").length,
    paymentCount: movements.filter((movement) => movement.type === "PAYMENT").length,
  };
}

function mapMovementToFrontendObject(m) {
  // Base properties expected by the frontend
  const result = {
    id: `fm_${m.id}`,
    originalId: m.id,
    type: m.type, // 'PAYMENT', 'TREATMENT_COST', 'INVOICE', 'CARI_TX'
    sourceType: m.sourceType,
    sourceId: m.sourceId,
    title: m.description || (m.type === 'PAYMENT' ? 'Ödeme Alındı' : m.type === 'TREATMENT_COST' ? 'Tedavi Uygulandı' : 'İşlem'),
    description: m.description || '',
    badge: m.type === 'PAYMENT' ? 'Ödeme' : m.type === 'TREATMENT_COST' ? 'İşlem' : 'Kayıt',
    amount: m.amount, // Payments are positive, costs are negative (depending on how inserted, but we standardize here)
    vatRate: m.vatRate || 0,
    occurredAt: m.occurredAt,
    doctorName: m.doctor?.name || null,
    doctorId: m.doctorId || null,
    paymentMethod: m.paymentMethod,
    reference: m.reference || null,
    editable: m.sourceType === 'PAYMENT' || m.sourceType === 'MANUAL',
    selectable: true,
    patientId: m.patientId || null,
    patientName: m.patient ? `${m.patient.firstName || ""} ${m.patient.lastName || ""}`.trim() : null,
    currentAccountId: m.currentAccountId || null,
    currentAccountName: m.currentAccount?.name || null,
    status: m.status, // ACTIVE, VOIDED, CANCELLED
  };

  // Adjust display amounts if necessary (Cari txs could be debit/credit but here we just pass the signed amount)
  return result;
}

async function getPatientFinanceLedger({ organizationId, patientId }) {
  const financialMovements = await prisma.financialMovement.findMany({
    where: {
      organizationId,
      patientId,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      doctor: { select: { id: true, name: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });

  const movements = financialMovements.map(mapMovementToFrontendObject);

  return {
    movements,
    summary: buildSummary(movements),
  };
}

async function getOrganizationFinanceMovements({
  organizationId,
  patientId,
  doctorId,
  type,
  method,
  dateFrom,
  dateTo,
  status,
  search,
  page = 1,
  limit = 50,
}) {
  const where = {
    organizationId,
  };

  if (patientId) where.patientId = patientId;
  if (doctorId) where.doctorId = doctorId;
  if (type) where.type = type; // Usually 'PAYMENT', 'TREATMENT_COST', or 'CARI_TX'
  if (method) where.paymentMethod = method;

  if (dateFrom || dateTo) {
    where.occurredAt = {};
    if (dateFrom) where.occurredAt.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      where.occurredAt.lte = d;
    }
  }

  if (status && status !== 'ALL') {
    if (status === "ACTIVE") {
      where.status = "ACTIVE";
    } else if (status === "VOIDED" || status === "CANCELLED") {
      where.status = { not: "ACTIVE" };
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { description: { contains: q, mode: 'insensitive' } },
      { reference: { contains: q, mode: 'insensitive' } },
      { patient: { firstName: { contains: q, mode: 'insensitive' } } },
      { patient: { lastName: { contains: q, mode: 'insensitive' } } },
      { currentAccount: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * limit;

  const [financialMovements, total, incomingAgg, outgoingAgg] = await Promise.all([
    prisma.financialMovement.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, name: true } },
        currentAccount: { select: { id: true, name: true } }
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip,
    }),
    prisma.financialMovement.count({ where }),
    prisma.financialMovement.aggregate({
      where: { ...where, amount: { gt: 0 } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.financialMovement.aggregate({
      where: { ...where, amount: { lt: 0 } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const movements = financialMovements.map(mapMovementToFrontendObject);

  const totalIncoming = incomingAgg._sum.amount || 0;
  const totalOutgoing = Math.abs(outgoingAgg._sum.amount || 0);

  return {
    movements,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    stats: {
      totalIncoming,
      totalOutgoing,
      net: totalIncoming - totalOutgoing,
      count: total,
    },
  };
}

module.exports = {
  getPatientFinanceLedger,
  getOrganizationFinanceMovements,
  buildSummary,
};
