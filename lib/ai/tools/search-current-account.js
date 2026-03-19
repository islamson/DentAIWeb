/**
 * search_current_account - Search current accounts (suppliers, labs, firms) by name.
 * Read-only. Used to resolve currentAccountQuery to currentAccountId.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'search_current_account',
  description: 'Search current accounts (firms, suppliers, labs) by name. Returns matching accounts with basic info.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { query = '', limit = 10 } = params;
    const where = { organizationId: ctx.organizationId };

    if (query && query.trim()) {
      const q = query.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    }

    const accounts = await prisma.currentAccount.findMany({
      where,
      take: Math.min(limit, 20),
      select: {
        id: true,
        name: true,
        type: true,
        contactName: true,
        phone: true,
      },
      orderBy: { name: 'asc' },
    });

    return { accounts, count: accounts.length };
  },
});
