/**
 * get_stock_movement_summary - Get stock movement summary (IN/OUT).
 * Uses StockMovement. Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_stock_movement_summary',
  description: 'Get stock movement summary: recent IN/OUT movements.',
  requiredPermission: 'INVENTORY_READ',
  async execute(ctx, params) {
    const { limit = 10 } = params;

    const movements = await prisma.stockMovement.findMany({
      where: { item: { organizationId: ctx.organizationId } },
      include: { item: { select: { name: true } } },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 20),
    });

    const summary = movements.map((m) => ({
      itemName: m.item?.name,
      type: m.type,
      qty: m.qty,
      occurredAt: m.occurredAt,
    }));

    return { movements: summary, count: summary.length };
  },
});
