/**
 * get_current_account_monthly_summary - Monthly aggregates for a current account.
 * Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_current_account_monthly_summary',
  description: 'Get monthly transaction summary for a current account.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { currentAccountId, month, year } = params;
    if (!currentAccountId) return { error: 'currentAccountId required' };

    const account = await prisma.currentAccount.findFirst({
      where: { id: currentAccountId, organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    if (!account) return { error: 'Cari hesap bulunamadı.' };

    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth();
    const from = new Date(targetYear, targetMonth, 1);
    const to = new Date(targetYear, targetMonth + 1, 0);
    to.setHours(23, 59, 59, 999);

    const [agg, count] = await Promise.all([
      prisma.currentAccountTransaction.aggregate({
        where: {
          currentAccountId,
          organizationId: ctx.organizationId,
          occurredAt: { gte: from, lte: to },
        },
        _sum: { debit: true, credit: true },
      }),
      prisma.currentAccountTransaction.count({
        where: {
          currentAccountId,
          organizationId: ctx.organizationId,
          occurredAt: { gte: from, lte: to },
        },
      }),
    ]);

    const totalDebit = agg._sum.debit || 0;
    const totalCredit = agg._sum.credit || 0;
    const netChange = totalDebit - totalCredit;
    const period = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;

    return {
      currentAccountId,
      accountName: account.name,
      period,
      totalDebit,
      totalCredit,
      netChange,
      transactionCount: count,
    };
  },
});
