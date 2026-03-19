/**
 * Clinic revenue context pack - scoped to organization, optional time range.
 */

const { prisma } = require('../../prisma');

async function buildClinicRevenueContext(ctx, params) {
  const { timeRange = {} } = params;
  const now = new Date();
  const from = timeRange.from ? new Date(timeRange.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = timeRange.to ? new Date(timeRange.to) : new Date();
  to.setHours(23, 59, 59, 999);

  const where = {
    organizationId: ctx.organizationId,
    status: 'ACTIVE',
    occurredAt: { gte: from, lte: to },
  };

  const [paymentsAgg, treatmentAgg] = await Promise.all([
    prisma.financialMovement.aggregate({
      where: { ...where, type: 'PAYMENT' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.financialMovement.aggregate({
      where: { ...where, type: 'TREATMENT_COST' },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    entityType: 'clinic',
    timeRange: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    totalPayments: paymentsAgg._sum.amount || 0,
    paymentCount: paymentsAgg._count || 0,
    totalTreatment: Math.abs(treatmentAgg._sum.amount || 0),
    treatmentCount: treatmentAgg._count || 0,
  };
}

module.exports = { buildClinicRevenueContext };
