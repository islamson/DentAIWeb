/**
 * get_last_stock_entry - Get last stock IN movement.
 * Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_last_stock_entry',
  description: 'Get last stock entry (IN movement). Optionally by product name.',
  requiredPermission: 'INVENTORY_READ',
  async execute(ctx, params) {
    const { productQuery } = params;

    const where = { type: 'IN', item: { organizationId: ctx.organizationId } };
    if (productQuery && productQuery.trim()) {
      where.item = {
        ...where.item,
        name: { contains: productQuery.trim(), mode: 'insensitive' },
      };
    }

    const movement = await prisma.stockMovement.findFirst({
      where,
      include: { item: { select: { name: true, currentStock: true, unit: true } } },
      orderBy: { occurredAt: 'desc' },
    });

    if (!movement) {
      return { lastEntry: null, message: productQuery ? 'Bu ürün için stok girişi bulunamadı.' : 'Stok girişi bulunamadı.' };
    }

    return {
      lastEntry: {
        itemName: movement.item?.name,
        qty: movement.qty,
        occurredAt: movement.occurredAt,
        reference: movement.reference,
      },
    };
  },
});
