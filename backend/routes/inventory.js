const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

// ============================================================
// STOCK CATEGORIES
// ============================================================

router.get('/categories', getCurrentUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, activeOnly } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = { organizationId: req.user.organizationId };
    if (activeOnly === 'true') where.isActive = true;

    const [items, total] = await Promise.all([
      prisma.stockCategory.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
      prisma.stockCategory.count({ where }),
    ]);
    res.json({ items, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    console.error('Error fetching stock categories:', error);
    res.status(500).json({ error: 'Failed to fetch stock categories' });
  }
});

router.post('/categories', getCurrentUser, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const item = await prisma.stockCategory.create({ data: { name: name.trim(), organizationId: req.user.organizationId } });
    res.json({ item });
  } catch (error) {
    console.error('Error creating stock category:', error);
    res.status(500).json({ error: 'Failed to create stock category' });
  }
});

router.patch('/categories/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.stockCategory.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive;
    const item = await prisma.stockCategory.update({ where: { id: req.params.id }, data });
    res.json({ item });
  } catch (error) {
    console.error('Error updating stock category:', error);
    res.status(500).json({ error: 'Failed to update stock category' });
  }
});

router.delete('/categories/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.stockCategory.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.stockCategory.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting stock category:', error);
    res.status(500).json({ error: 'Failed to delete stock category' });
  }
});

// ============================================================
// STOCK OUTPUT DIRECTIONS
// ============================================================

router.get('/output-directions', getCurrentUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, activeOnly } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = { organizationId: req.user.organizationId };
    if (activeOnly === 'true') where.isActive = true;

    const [items, total] = await Promise.all([
      prisma.stockOutputDirection.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: Number(limit) }),
      prisma.stockOutputDirection.count({ where }),
    ]);
    res.json({ items, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    console.error('Error fetching output directions:', error);
    res.status(500).json({ error: 'Failed to fetch output directions' });
  }
});

router.post('/output-directions', getCurrentUser, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const item = await prisma.stockOutputDirection.create({ data: { name: name.trim(), organizationId: req.user.organizationId } });
    res.json({ item });
  } catch (error) {
    console.error('Error creating output direction:', error);
    res.status(500).json({ error: 'Failed to create output direction' });
  }
});

router.patch('/output-directions/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.stockOutputDirection.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive;
    const item = await prisma.stockOutputDirection.update({ where: { id: req.params.id }, data });
    res.json({ item });
  } catch (error) {
    console.error('Error updating output direction:', error);
    res.status(500).json({ error: 'Failed to update output direction' });
  }
});

router.delete('/output-directions/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.stockOutputDirection.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.stockOutputDirection.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting output direction:', error);
    res.status(500).json({ error: 'Failed to delete output direction' });
  }
});

// ============================================================
// INVENTORY ITEMS (with stats)
// ============================================================

router.get('/items', getCurrentUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, categoryId, belowCritical, unit } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { organizationId: req.user.organizationId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (unit) where.unit = unit;

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: {
          category: true,
          expiryBatches: { orderBy: { expiryDate: 'asc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    const allForStats = await prisma.inventoryItem.findMany({
      where,
      select: { currentStock: true, minLevel: true, cost: true, id: true },
    });

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringCount = await prisma.stockExpiryBatch.count({
      where: {
        organizationId: req.user.organizationId,
        expiryDate: { lte: thirtyDays, gte: now },
        ...(search || categoryId ? { item: where } : {}),
      },
    });

    const stats = {
      totalItems: total,
      lowStock: allForStats.filter(i => i.currentStock > 0 && i.currentStock <= i.minLevel).length,
      outOfStock: allForStats.filter(i => i.currentStock <= 0).length,
      belowCritical: allForStats.filter(i => i.currentStock < i.minLevel).length,
      totalValue: allForStats.reduce((sum, i) => sum + (i.currentStock * (i.cost || 0)), 0),
      expiringSoon: expiringCount,
    };

    let filteredItems = items;
    if (belowCritical === 'true') {
      filteredItems = items.filter(i => i.currentStock < i.minLevel);
    }

    res.json({
      items: filteredItems,
      stats,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    res.status(500).json({ error: 'Failed to fetch inventory items' });
  }
});

router.post('/items', getCurrentUser, async (req, res) => {
  try {
    const { name, sku, barcode, description, unit, vatRate, minLevel, currentStock, cost, categoryId, branchId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const item = await prisma.inventoryItem.create({
      data: {
        name: name.trim(),
        sku: sku || null,
        barcode: barcode || null,
        description: description || null,
        unit: unit || null,
        vatRate: vatRate !== undefined ? Number(vatRate) : 0,
        minLevel: minLevel ? Number(minLevel) : 0,
        currentStock: currentStock ? Number(currentStock) : 0,
        cost: cost ? Number(cost) : null,
        categoryId: categoryId || null,
        branchId: branchId || req.user.branchId || null,
        organizationId: req.user.organizationId,
      },
      include: { category: true },
    });
    res.json({ item });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

router.put('/items/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.inventoryItem.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { name, sku, barcode, description, unit, vatRate, minLevel, currentStock, cost, categoryId } = req.body;
    const item = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(sku !== undefined && { sku: sku || null }),
        ...(barcode !== undefined && { barcode: barcode || null }),
        ...(description !== undefined && { description: description || null }),
        ...(unit !== undefined && { unit: unit || null }),
        ...(vatRate !== undefined && { vatRate: Number(vatRate) }),
        ...(minLevel !== undefined && { minLevel: Number(minLevel) }),
        ...(currentStock !== undefined && { currentStock: Number(currentStock) }),
        ...(cost !== undefined && { cost: cost ? Number(cost) : null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
      },
      include: { category: true },
    });
    res.json({ item });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

router.delete('/items/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.inventoryItem.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.inventoryItem.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

// ============================================================
// STOCK MOVEMENTS
// ============================================================

router.get('/movements', getCurrentUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, itemId, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { item: { organizationId: req.user.organizationId } };
    if (itemId) where.inventoryItemId = itemId;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { item: true, outputDirection: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.stockMovement.count({ where }),
    ]);
    res.json({ items, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

router.post('/movements', getCurrentUser, async (req, res) => {
  try {
    const { inventoryItemId, qty, type, outputDirectionId, totalPrice, reference, notes, occurredAt } = req.body;
    if (!inventoryItemId || qty === undefined || !type) {
      return res.status(400).json({ error: 'inventoryItemId, qty, and type are required' });
    }

    const inventoryItem = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, organizationId: req.user.organizationId } });
    if (!inventoryItem) return res.status(404).json({ error: 'Inventory item not found' });

    const movement = await prisma.$transaction(async (tx) => {
      const mov = await tx.stockMovement.create({
        data: {
          inventoryItemId,
          qty: Number(qty),
          type,
          outputDirectionId: outputDirectionId || null,
          totalPrice: totalPrice ? Number(totalPrice) : null,
          reference: reference || null,
          notes: notes || null,
          createdBy: req.user.id,
          occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
        },
        include: { item: true, outputDirection: true },
      });

      let stockDelta;
      if (type === 'ADJUST') {
        stockDelta = Number(qty) - inventoryItem.currentStock;
      } else {
        stockDelta = (type === 'IN' || type === 'RETURN') ? Math.abs(Number(qty)) : -Math.abs(Number(qty));
      }

      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { currentStock: type === 'ADJUST' ? Number(qty) : { increment: stockDelta } },
      });

      return mov;
    });

    res.json({ item: movement });
  } catch (error) {
    console.error('Error creating stock movement:', error);
    res.status(500).json({ error: 'Failed to create stock movement' });
  }
});

// ============================================================
// STOCK EXPIRY BATCHES
// ============================================================

router.get('/expiry-batches', getCurrentUser, async (req, res) => {
  try {
    const { itemId } = req.query;
    const where = { organizationId: req.user.organizationId };
    if (itemId) where.inventoryItemId = itemId;

    const items = await prisma.stockExpiryBatch.findMany({
      where,
      include: { item: { select: { name: true, unit: true } } },
      orderBy: { expiryDate: 'asc' },
    });
    res.json({ items });
  } catch (error) {
    console.error('Error fetching expiry batches:', error);
    res.status(500).json({ error: 'Failed to fetch expiry batches' });
  }
});

router.post('/expiry-batches', getCurrentUser, async (req, res) => {
  try {
    const { inventoryItemId, quantity, expiryDate, notes } = req.body;
    if (!inventoryItemId || !expiryDate) return res.status(400).json({ error: 'inventoryItemId and expiryDate are required' });

    const inventoryItem = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, organizationId: req.user.organizationId } });
    if (!inventoryItem) return res.status(404).json({ error: 'Inventory item not found' });

    const item = await prisma.stockExpiryBatch.create({
      data: {
        inventoryItemId,
        organizationId: req.user.organizationId,
        quantity: quantity ? Number(quantity) : 0,
        expiryDate: new Date(expiryDate),
        notes: notes || null,
      },
      include: { item: { select: { name: true, unit: true } } },
    });
    res.json({ item });
  } catch (error) {
    console.error('Error creating expiry batch:', error);
    res.status(500).json({ error: 'Failed to create expiry batch' });
  }
});

router.delete('/expiry-batches/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.stockExpiryBatch.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.stockExpiryBatch.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting expiry batch:', error);
    res.status(500).json({ error: 'Failed to delete expiry batch' });
  }
});

// ============================================================
// STOCK REQUESTS
// ============================================================

router.get('/requests', getCurrentUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, outputDirectionId, search, dateFrom, dateTo } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { organizationId: req.user.organizationId };
    if (status) where.status = status;
    if (outputDirectionId) where.outputDirectionId = outputDirectionId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { items: { some: { item: { name: { contains: search, mode: 'insensitive' } } } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.stockRequest.findMany({
        where,
        include: {
          outputDirection: true,
          requestedBy: { select: { id: true, name: true } },
          items: { include: { item: { select: { id: true, name: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.stockRequest.count({ where }),
    ]);

    const allForStats = await prisma.stockRequest.findMany({
      where,
      select: { status: true, createdAt: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stats = {
      total,
      pending: allForStats.filter(r => r.status === 'PENDING').length,
      preparing: allForStats.filter(r => r.status === 'PREPARING').length,
      prepared: allForStats.filter(r => r.status === 'PREPARED').length,
      completed: allForStats.filter(r => r.status === 'COMPLETED').length,
      todayCreated: allForStats.filter(r => new Date(r.createdAt) >= today).length,
    };

    res.json({ items, stats, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    console.error('Error fetching stock requests:', error);
    res.status(500).json({ error: 'Failed to fetch stock requests' });
  }
});

router.post('/requests', getCurrentUser, async (req, res) => {
  try {
    const { outputDirectionId, description, items: requestItems } = req.body;
    if (!requestItems || !requestItems.length) return res.status(400).json({ error: 'At least one item is required' });

    const request = await prisma.stockRequest.create({
      data: {
        organizationId: req.user.organizationId,
        outputDirectionId: outputDirectionId || null,
        requestedById: req.user.id,
        description: description || null,
        items: {
          create: requestItems.map(ri => ({
            inventoryItemId: ri.inventoryItemId,
            requestedQty: Number(ri.requestedQty),
            neededByDate: ri.neededByDate ? new Date(ri.neededByDate) : null,
            notes: ri.notes || null,
          })),
        },
      },
      include: {
        outputDirection: true,
        requestedBy: { select: { id: true, name: true } },
        items: { include: { item: { select: { id: true, name: true, unit: true } } } },
      },
    });
    res.json({ item: request });
  } catch (error) {
    console.error('Error creating stock request:', error);
    res.status(500).json({ error: 'Failed to create stock request' });
  }
});

router.patch('/requests/:id/status', getCurrentUser, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'PREPARING', 'PREPARED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const existing = await prisma.stockRequest.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const item = await prisma.stockRequest.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        outputDirection: true,
        requestedBy: { select: { id: true, name: true } },
        items: { include: { item: { select: { id: true, name: true, unit: true } } } },
      },
    });
    res.json({ item });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ error: 'Failed to update request status' });
  }
});

router.delete('/requests/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.stockRequest.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.stockRequest.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting stock request:', error);
    res.status(500).json({ error: 'Failed to delete stock request' });
  }
});

module.exports = router;
