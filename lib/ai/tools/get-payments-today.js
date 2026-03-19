/**
 * get_payments_today - Get payments received today.
 * Uses FinancialMovement type PAYMENT. Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_payments_today',
  description: 'Get payments received today. Uses financial movements.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where = {
      organizationId: ctx.organizationId,
      type: 'PAYMENT',
      status: 'ACTIVE',
      amount: { gt: 0 },
      occurredAt: { gte: today, lt: tomorrow },
    };

    const [movements, agg] = await Promise.all([
      prisma.financialMovement.findMany({
        where,
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
        orderBy: { occurredAt: 'desc' },
        take: 20,
      }),
      prisma.financialMovement.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      payments: movements.map((m) => ({
        amount: m.amount,
        occurredAt: m.occurredAt,
        patient: m.patient ? `${m.patient.firstName} ${m.patient.lastName}` : null,
        description: m.description,
      })),
      totalAmount: agg._sum.amount || 0,
      count: agg._count || 0,
      date: today.toISOString().slice(0, 10),
    };
  },
});
