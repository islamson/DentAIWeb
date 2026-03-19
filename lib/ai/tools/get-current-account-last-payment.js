/**
 * get_current_account_last_payment - Get last payment (credit) transaction for a current account.
 * Scoped to only that account. Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_current_account_last_payment',
  description: 'Get the most recent payment (credit) transaction for a current account.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { currentAccountId } = params;
    if (!currentAccountId) return { error: 'currentAccountId required' };

    const account = await prisma.currentAccount.findFirst({
      where: { id: currentAccountId, organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    if (!account) return { error: 'Cari hesap bulunamadı.' };

    // Last payment = most recent CREDIT transaction (we paid them)
    const transaction = await prisma.currentAccountTransaction.findFirst({
      where: {
        currentAccountId,
        organizationId: ctx.organizationId,
        credit: { gt: 0 },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        credit: true,
        occurredAt: true,
        description: true,
        reference: true,
      },
    });

    return {
      currentAccountId,
      accountName: account.name,
      transaction: transaction
        ? {
            amount: transaction.credit,
            occurredAt: transaction.occurredAt,
            description: transaction.description,
            reference: transaction.reference,
          }
        : null,
    };
  },
});
