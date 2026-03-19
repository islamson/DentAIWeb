/**
 * get_current_account_transactions - Filtered transaction list for a current account.
 * Supports date range, transaction type, limit. Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_current_account_transactions',
  description: 'Get filtered transaction list for a current account.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { currentAccountId, dateFrom, dateTo, transactionType, limit = 20 } = params;
    if (!currentAccountId) return { error: 'currentAccountId required' };

    const account = await prisma.currentAccount.findFirst({
      where: { id: currentAccountId, organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    if (!account) return { error: 'Cari hesap bulunamadı.' };

    const where = { currentAccountId, organizationId: ctx.organizationId };

    if (dateFrom || dateTo) {
      where.occurredAt = {};
      if (dateFrom) where.occurredAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.occurredAt.lte = to;
      }
    }

    if (transactionType && ['DEBIT', 'CREDIT'].includes(transactionType)) {
      where.transactionType = transactionType;
    }

    const transactions = await prisma.currentAccountTransaction.findMany({
      where,
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
      currentAccountId,
      accountName: account.name,
      transactions: transactions.map((t) => ({
        date: t.occurredAt,
        type: t.transactionType,
        debit: t.debit,
        credit: t.credit,
        description: t.description,
        reference: t.reference,
      })),
      count: transactions.length,
    };
  },
});
