const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const catalogSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  defaultPrice: z.number().min(0),
  active: z.boolean().optional(),
  description: z.string().optional(),
});

// List catalog items for org
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { category, active, search } = req.query;

    const where = { organizationId: user.organizationId };
    if (category) where.category = category;
    if (active !== undefined) where.active = active === 'true';
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const items = await prisma.serviceCatalog.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Group by category
    const grouped = items.reduce((acc, item) => {
      const cat = item.category || 'Diğer';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    res.json({ items, grouped });
  } catch (error) {
    console.error('Error fetching service catalog:', error);
    res.status(500).json({ error: 'Failed to fetch service catalog' });
  }
});

// Get single item
router.get('/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const item = await prisma.serviceCatalog.findFirst({
      where: { id: req.params.id, organizationId: user.organizationId },
    });
    if (!item) return res.status(404).json({ error: 'Catalog item not found' });
    res.json({ item });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch catalog item' });
  }
});

// Create catalog item
router.post('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = catalogSchema.parse(req.body);
    const item = await prisma.serviceCatalog.create({
      data: { ...validated, organizationId: user.organizationId },
    });
    res.json({ item });
  } catch (error) {
    console.error('Error creating catalog item:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create catalog item' });
  }
});

// Update catalog item
router.put('/:id', getCurrentUser, async (req, res) => {
  try {
    const validated = catalogSchema.partial().parse(req.body);
    const item = await prisma.serviceCatalog.update({
      where: { id: req.params.id },
      data: validated,
    });
    res.json({ item });
  } catch (error) {
    console.error('Error updating catalog item:', error);
    res.status(500).json({ error: 'Failed to update catalog item' });
  }
});

// Delete catalog item
router.delete('/:id', getCurrentUser, async (req, res) => {
  try {
    await prisma.serviceCatalog.delete({ where: { id: req.params.id } });
    res.json({ message: 'Catalog item deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete catalog item' });
  }
});

module.exports = router;
