/**
 * get_weekly_finance_summary - Get weekly financial summary.
 * Uses FinancialMovement. Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_weekly_finance_summary',
  description: 'Get weekly revenue/payment summary. Uses financial movements.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    const where = {
      organizationId: ctx.organizationId,
      status: 'ACTIVE',
      occurredAt: { gte: startOfWeek, lte: endOfWeek },
    };

    const [paymentsAgg, treatmentAgg] = await Promise.all([
      prisma.financialMovement.aggregate({
        where: { ...where, type: 'PAYMENT' },
        _sum: { amount: true },
      }),
      prisma.financialMovement.aggregate({
        where: { ...where, type: 'TREATMENT_COST' },
        _sum: { amount: true },
      }),
    ]);

    const totalPayments = paymentsAgg._sum.amount || 0;
    const totalTreatment = Math.abs(treatmentAgg._sum.amount || 0);

    return {
      period: 'Bu hafta',
      weekStart: startOfWeek.toISOString().slice(0, 10),
      weekEnd: endOfWeek.toISOString().slice(0, 10),
      totalPaymentsThisWeek: totalPayments,
      totalRevenueThisWeek: totalPayments,
      totalTreatmentThisWeek: totalTreatment,
      currency: 'TRY',
    };
  },
});
