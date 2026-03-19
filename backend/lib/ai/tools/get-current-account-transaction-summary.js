/**
 * get_current_account_transaction_summary - Compact summary for recent transactions.
 * Last 20 transactions or 90 days. Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_current_account_transaction_summary',
  description: 'Get compact transaction summary for a current account (last 20 tx or 90 days).',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { currentAccountId, limit = 20 } = params;
    if (!currentAccountId) return { error: 'currentAccountId required' };

    const account = await prisma.currentAccount.findFirst({
      where: { id: currentAccountId, organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    if (!account) return { error: 'Cari hesap bulunamadı.' };

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [transactions, agg] = await Promise.all([
      prisma.currentAccountTransaction.findMany({
        where: {
          currentAccountId,
          organizationId: ctx.organizationId,
          occurredAt: { gte: ninetyDaysAgo },
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(limit, 20),
        select: {
          debit: true,
          credit: true,
          occurredAt: true,
          description: true,
          transactionType: true,
        },
      }),
      prisma.currentAccountTransaction.aggregate({
        where: {
          currentAccountId,
          organizationId: ctx.organizationId,
          occurredAt: { gte: ninetyDaysAgo },
        },
        _sum: { debit: true, credit: true },
        _count: true,
      }),
    ]);

    const totalDebit = agg._sum.debit || 0;
    const totalCredit = agg._sum.credit || 0;
    const totalCount = agg._count || 0;
    const latest = transactions[0];

    const breakdownByType = { DEBIT: 0, CREDIT: 0 };
    for (const t of transactions) {
      if (t.debit > 0) breakdownByType.DEBIT += t.debit;
      if (t.credit > 0) breakdownByType.CREDIT += t.credit;
    }

    const recentTransactions = transactions.map((t) => ({
      date: t.occurredAt,
      type: t.transactionType,
      debit: t.debit,
      credit: t.credit,
      description: t.description,
    }));

    return {
      currentAccountId,
      accountName: account.name,
      totalTransactionCount: totalCount,
      totalDebit,
      totalCredit,
      latestTransactionDate: latest?.occurredAt || null,
      latestTransactionType: latest?.transactionType || null,
      breakdownByType,
      recentTransactions,
    };
  },
});
