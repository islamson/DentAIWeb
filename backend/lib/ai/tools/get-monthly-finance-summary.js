/**
 * get_monthly_finance_summary - Get monthly financial summary for the organization.
 * Phase 1: Read-only. Uses FinancialMovement for current month.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_monthly_finance_summary',
  description: 'Get financial summary for current month: total payments received, total revenue.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [paymentsAgg, treatmentAgg] = await Promise.all([
      prisma.financialMovement.aggregate({
        where: {
          organizationId: ctx.organizationId,
          type: 'PAYMENT',
          status: 'ACTIVE',
          occurredAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.financialMovement.aggregate({
        where: {
          organizationId: ctx.organizationId,
          type: 'TREATMENT_COST',
          status: 'ACTIVE',
          occurredAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalPaymentsThisMonth = paymentsAgg._sum.amount || 0;
    const totalTreatmentThisMonth = Math.abs(treatmentAgg._sum.amount || 0);

    const monthLabel = now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

    return {
      month: monthLabel,
      monthStart: startOfMonth.toISOString().slice(0, 10),
      monthEnd: endOfMonth.toISOString().slice(0, 10),
      totalPaymentsThisMonth,
      totalRevenueThisMonth: totalPaymentsThisMonth,
      totalTreatmentThisMonth,
      currency: 'TRY',
    };
  },
});
