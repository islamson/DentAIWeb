/**
 * get_lab_materials - Get lab materials (optionally by supplier).
 * Read-only. Uses LabMaterial.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_lab_materials',
  description: 'Get lab materials list. Optionally filter by supplier name.',
  requiredPermission: 'INVENTORY_READ',
  async execute(ctx, params) {
    const { supplierQuery, limit = 20 } = params;

    const where = { organizationId: ctx.organizationId, isActive: true };
    if (supplierQuery && supplierQuery.trim()) {
      where.supplier = { name: { contains: supplierQuery.trim(), mode: 'insensitive' } };
    }

    const materials = await prisma.labMaterial.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      take: Math.min(limit, 50),
    });

    return {
      materials: materials.map((m) => ({
        name: m.name,
        unitPrice: m.unitPrice,
        supplier: m.supplier?.name,
      })),
      count: materials.length,
    };
  },
});
