/**
 * get_product_quantity - Get product/inventory item quantity by name.
 * Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_product_quantity',
  description: 'Get inventory item current stock by product name.',
  requiredPermission: 'INVENTORY_READ',
  async execute(ctx, params) {
    const { productQuery } = params;
    if (!productQuery || productQuery.trim().length < 2) {
      return { error: 'Ürün adı en az 2 karakter olmalı.' };
    }

    const items = await prisma.inventoryItem.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(ctx.branchId && { branchId: ctx.branchId }),
        name: { contains: productQuery.trim(), mode: 'insensitive' },
      },
      select: { id: true, name: true, currentStock: true, minLevel: true, unit: true },
      take: 5,
    });

    if (items.length === 0) return { items: [], message: 'Bu isimde ürün bulunamadı.' };
    if (items.length > 1) {
      return {
        items: items.map((i) => ({ name: i.name, currentStock: i.currentStock, minLevel: i.minLevel, unit: i.unit })),
        message: 'Birden fazla ürün eşleşti. Lütfen daha spesifik arayın.',
      };
    }

    const i = items[0];
    return {
      item: { name: i.name, currentStock: i.currentStock, minLevel: i.minLevel, unit: i.unit },
    };
  },
});
