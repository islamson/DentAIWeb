/**
 * get_current_account_balance - Get balance for a single current account.
 * Scoped to only that account's transactions. Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_current_account_balance',
  description: 'Get current account balance: total debit, total credit, net balance. Scoped to single account.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { currentAccountId } = params;
    if (!currentAccountId) return { error: 'currentAccountId required' };

    const account = await prisma.currentAccount.findFirst({
      where: { id: currentAccountId, organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    if (!account) return { error: 'Cari hesap bulunamadı.' };

    const agg = await prisma.currentAccountTransaction.aggregate({
      where: { currentAccountId, organizationId: ctx.organizationId },
      _sum: { debit: true, credit: true },
    });

    const totalDebit = agg._sum.debit || 0;
    const totalCredit = agg._sum.credit || 0;
    const netBalance = totalDebit - totalCredit;
    const balanceDirection = netBalance > 0 ? 'BORC' : netBalance < 0 ? 'ALACAK' : 'ZERO';

    return {
      currentAccountId,
      accountName: account.name,
      totalDebit,
      totalCredit,
      balance: netBalance,
      netBalance,
      balanceDirection,
      currency: 'TRY',
    };
  },
});
