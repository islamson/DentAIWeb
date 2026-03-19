/**
 * Current account context pack - scoped to single account.
 * Compact structured object for LLM summarization.
 */

const { prisma } = require('../../prisma');

async function buildCurrentAccountContext(ctx, params) {
  const { currentAccountId, timeRange = {}, limit = 10 } = params;
  if (!currentAccountId) return { error: 'currentAccountId required' };

  const account = await prisma.currentAccount.findFirst({
    where: { id: currentAccountId, organizationId: ctx.organizationId },
    select: { id: true, name: true, type: true },
  });
  if (!account) return { error: 'Cari hesap bulunamadı' };

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const where = { currentAccountId, organizationId: ctx.organizationId };
  if (timeRange.from || timeRange.to) {
    where.occurredAt = {};
    if (timeRange.from) where.occurredAt.gte = new Date(timeRange.from);
    if (timeRange.to) {
      const to = new Date(timeRange.to);
      to.setHours(23, 59, 59, 999);
      where.occurredAt.lte = to;
    }
  } else {
    where.occurredAt = { gte: ninetyDaysAgo };
  }

  const [agg, transactions] = await Promise.all([
    prisma.currentAccountTransaction.aggregate({
      where,
      _sum: { debit: true, credit: true },
      _count: true,
    }),
    prisma.currentAccountTransaction.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(limit, 10),
      select: {
        debit: true,
        credit: true,
        occurredAt: true,
        description: true,
        reference: true,
        transactionType: true,
      },
    }),
  ]);

  const totalDebit = agg._sum.debit || 0;
  const totalCredit = agg._sum.credit || 0;
  const netBalance = totalDebit - totalCredit;
  const balanceDirection = netBalance > 0 ? 'BORC' : netBalance < 0 ? 'ALACAK' : 'ZERO';
  const latestTx = transactions[0];

  const latestTransaction = latestTx
    ? {
        date: latestTx.occurredAt,
        type: latestTx.transactionType,
        debit: latestTx.debit,
        credit: latestTx.credit,
        description: latestTx.description,
        reference: latestTx.reference,
      }
    : null;

  const recentTransactions = transactions.map((t) => ({
    date: t.occurredAt,
    type: t.transactionType,
    debit: t.debit,
    credit: t.credit,
    description: t.description,
  }));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const [monthAgg] = await Promise.all([
    prisma.currentAccountTransaction.aggregate({
      where: {
        currentAccountId,
        organizationId: ctx.organizationId,
        occurredAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { debit: true, credit: true },
      _count: true,
    }),
  ]);

  const monthlySummary = {
    period: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
    totalDebit: monthAgg._sum.debit || 0,
    totalCredit: monthAgg._sum.credit || 0,
    netChange: (monthAgg._sum.debit || 0) - (monthAgg._sum.credit || 0),
    transactionCount: monthAgg._count || 0,
  };

  return {
    entityType: 'current_account',
    entityId: currentAccountId,
    entityName: account.name,
    type: account.type,
    totalDebit,
    totalCredit,
    netBalance,
    balanceDirection,
    latestTransaction,
    recentTransactions,
    monthlySummary,
  };
}

module.exports = { buildCurrentAccountContext };
