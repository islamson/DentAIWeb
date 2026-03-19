/**
 * get_low_stock_products - Get inventory items below minimum level.
 * Phase 1: Read-only stub implementation.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_low_stock_products',
  description: 'Get inventory items where currentStock is below minLevel.',
  requiredPermission: 'INVENTORY_READ',
  async execute(ctx, params) {
    const { limit = 20 } = params;

    // Prisma doesn't support comparing two columns in where; filter in memory
    const lowStock = await prisma.inventoryItem.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(ctx.branchId && { branchId: ctx.branchId }),
      },
      select: {
        id: true,
        name: true,
        currentStock: true,
        minLevel: true,
        unit: true,
      },
      take: 100,
    });

    const filtered = lowStock
      .filter((i) => i.currentStock < i.minLevel)
      .slice(0, Math.min(limit, 50))
      .map((i) => ({
        ...i,
        deficit: i.minLevel - i.currentStock,
      }));

    return { items: filtered, count: filtered.length };
  },
});
