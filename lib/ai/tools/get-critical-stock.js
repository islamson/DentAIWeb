/**
 * get_critical_stock - Get inventory items at critical level (stock = 0 or very low).
 * Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_critical_stock',
  description: 'Get inventory items at critical level: currentStock = 0 or currentStock < minLevel/2.',
  requiredPermission: 'INVENTORY_READ',
  async execute(ctx, params) {
    const { limit = 20 } = params;

    const items = await prisma.inventoryItem.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(ctx.branchId && { branchId: ctx.branchId }),
      },
      select: { id: true, name: true, currentStock: true, minLevel: true, unit: true },
      take: 100,
    });

    const critical = items
      .filter((i) => i.currentStock === 0 || (i.minLevel > 0 && i.currentStock < i.minLevel / 2))
      .slice(0, Math.min(limit, 50))
      .map((i) => ({ ...i, deficit: Math.max(0, i.minLevel - i.currentStock) }));

    return { items: critical, count: critical.length };
  },
});
