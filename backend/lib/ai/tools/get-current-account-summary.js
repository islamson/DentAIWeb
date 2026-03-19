/**
 * get_current_account_summary - Get current account summary (balance + last transaction).
 * Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_current_account_summary',
  description: 'Get current account summary: balance and last transaction.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { currentAccountId } = params;
    if (!currentAccountId) return { error: 'currentAccountId required' };

    const account = await prisma.currentAccount.findFirst({
      where: { id: currentAccountId, organizationId: ctx.organizationId },
      select: { id: true, name: true, type: true },
    });
    if (!account) return { error: 'Cari hesap bulunamadı.' };

    const [agg, lastTx] = await Promise.all([
      prisma.currentAccountTransaction.aggregate({
        where: { currentAccountId, organizationId: ctx.organizationId },
        _sum: { debit: true, credit: true },
      }),
      prisma.currentAccountTransaction.findFirst({
        where: { currentAccountId, organizationId: ctx.organizationId },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        select: { debit: true, credit: true, occurredAt: true, description: true },
      }),
    ]);

    const totalDebit = agg._sum.debit || 0;
    const totalCredit = agg._sum.credit || 0;
    const balance = totalDebit - totalCredit;

    return {
      currentAccountId,
      accountName: account.name,
      type: account.type,
      balance,
      totalDebit,
      totalCredit,
      lastTransaction: lastTx
        ? {
            amount: lastTx.debit > 0 ? lastTx.debit : -lastTx.credit,
            occurredAt: lastTx.occurredAt,
            description: lastTx.description,
          }
        : null,
    };
  },
});
