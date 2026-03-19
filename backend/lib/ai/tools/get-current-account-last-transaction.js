/**
 * get_current_account_last_transaction - Get last transaction (any type) for a current account.
 * Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_current_account_last_transaction',
  description: 'Get the most recent transaction (debit or credit) for a current account.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { currentAccountId } = params;
    if (!currentAccountId) return { error: 'currentAccountId required' };

    const account = await prisma.currentAccount.findFirst({
      where: { id: currentAccountId, organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    if (!account) return { error: 'Cari hesap bulunamadı.' };

    const tx = await prisma.currentAccountTransaction.findFirst({
      where: { currentAccountId, organizationId: ctx.organizationId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        debit: true,
        credit: true,
        occurredAt: true,
        description: true,
        reference: true,
        transactionType: true,
      },
    });

    if (!tx) {
      return {
        currentAccountId,
        accountName: account.name,
        transaction: null,
      };
    }

    return {
      currentAccountId,
      accountName: account.name,
      transaction: {
        date: tx.occurredAt,
        type: tx.transactionType,
        debit: tx.debit,
        credit: tx.credit,
        description: tx.description,
        reference: tx.reference,
        amount: tx.debit > 0 ? tx.debit : tx.credit,
      },
    };
  },
});
