const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const LAB_SUPPLIER_ACCOUNT_TYPES = ['SUPPLIER', 'LAB', 'MEDICAL'];

// ============================================================
// LAB SUPPLIERS — sourced from Finance > Current Accounts
// ============================================================

router.get('/suppliers', getCurrentUser, async (req, res) => {
  try {
    const { search } = req.query;
    const where = {
      organizationId: req.user.organizationId,
      type: { in: LAB_SUPPLIER_ACCOUNT_TYPES },
    };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const items = await prisma.currentAccount.findMany({
      where,
      select: { id: true, name: true, type: true, phone: true, contactName: true },
      orderBy: { name: 'asc' },
    });
    res.json({ items });
  } catch (error) {
    console.error('Error fetching lab suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch lab suppliers' });
  }
});

// ============================================================
// LAB MATERIALS (Catalog-level CRUD)
// ============================================================

const materialSchema = z.object({
  labSupplierId: z.string().min(1),
  name: z.string().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().optional(),
  currency: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.get('/materials', getCurrentUser, async (req, res) => {
  try {
    const { search, supplierId, activeOnly } = req.query;
    const where = { organizationId: req.user.organizationId };
    if (activeOnly === 'true') where.isActive = true;
    if (supplierId) where.labSupplierId = supplierId;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const items = await prisma.labMaterial.findMany({
      where,
      include: { supplier: { select: { id: true, name: true, type: true } } },
      orderBy: [{ supplier: { name: 'asc' } }, { name: 'asc' }],
    });
    res.json({ items });
  } catch (error) {
    console.error('Error fetching lab materials:', error);
    res.status(500).json({ error: 'Failed to fetch lab materials' });
  }
});

router.post('/materials', getCurrentUser, async (req, res) => {
  try {
    const validated = materialSchema.parse(req.body);
    const item = await prisma.labMaterial.create({
      data: { ...validated, organizationId: req.user.organizationId },
      include: { supplier: { select: { id: true, name: true, type: true } } },
    });
    res.json({ item });
  } catch (error) {
    console.error('Error creating lab material:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create lab material' });
  }
});

router.put('/materials/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.labMaterial.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const validated = materialSchema.partial().parse(req.body);
    const item = await prisma.labMaterial.update({
      where: { id: req.params.id },
      data: validated,
      include: { supplier: { select: { id: true, name: true, type: true } } },
    });
    res.json({ item });
  } catch (error) {
    console.error('Error updating lab material:', error);
    res.status(500).json({ error: 'Failed to update lab material' });
  }
});

router.delete('/materials/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.labMaterial.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.labMaterial.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting lab material:', error);
    res.status(500).json({ error: 'Failed to delete lab material' });
  }
});

// ============================================================
// TREATMENT LAB RELATIONS (Read-only from this module + update)
// ============================================================

router.get('/relations', getCurrentUser, async (req, res) => {
  try {
    const {
      page = '1', limit = '20',
      patientId, doctorId, responsibleUserId,
      treatmentType, labSupplierId, status,
      priceMin, priceMax, dateFrom, dateTo, currency,
      search
    } = req.query;

    const where = {
      organizationId: req.user.organizationId,
      deletedAt: null,
    };

    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (responsibleUserId) where.responsibleUserId = responsibleUserId;
    if (labSupplierId) where.labSupplierId = labSupplierId;
    if (status) where.status = status;
    if (currency) where.labMaterial = { currency };

    if (treatmentType) {
      where.treatmentItem = { name: { contains: treatmentType, mode: 'insensitive' } };
    }

    if (priceMin || priceMax) {
      where.price = {};
      if (priceMin) where.price.gte = parseInt(priceMin);
      if (priceMax) where.price.lte = parseInt(priceMax);
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    if (search) {
      where.OR = [
        { treatmentItem: { name: { contains: search, mode: 'insensitive' } } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { labSupplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      prisma.treatmentLabRelation.findMany({
        where,
        include: {
          treatmentItem: {
            select: { id: true, name: true, price: true, quantity: true, status: true, teeth: true },
          },
          patient: { select: { id: true, firstName: true, lastName: true } },
          labSupplier: { select: { id: true, name: true } },
          labMaterial: { select: { id: true, name: true, unitPrice: true, currency: true } },
          responsible: { select: { id: true, name: true } },
          doctor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      prisma.treatmentLabRelation.count({ where }),
    ]);

    const allForSummary = await prisma.treatmentLabRelation.findMany({
      where,
      select: {
        price: true,
        quantity: true,
        completionRate: true,
        completionPriceRate: true,
        status: true,
        labMaterial: { select: { currency: true } },
      },
    });

    const summaryByCurrency = {};
    for (const rel of allForSummary) {
      const cur = rel.labMaterial?.currency || 'TRY';
      if (!summaryByCurrency[cur]) {
        summaryByCurrency[cur] = { completed: 0, pending: 0, total: 0 };
      }
      const lineTotal = rel.price * rel.quantity;
      const completedAmount = Math.round(lineTotal * rel.completionPriceRate / 100);
      const pendingAmount = lineTotal - completedAmount;

      summaryByCurrency[cur].total += lineTotal;
      summaryByCurrency[cur].completed += completedAmount;
      summaryByCurrency[cur].pending += pendingAmount;
    }

    const generalTotal = {
      completed: Object.values(summaryByCurrency).reduce((s, v) => s + v.completed, 0),
      pending: Object.values(summaryByCurrency).reduce((s, v) => s + v.pending, 0),
      total: Object.values(summaryByCurrency).reduce((s, v) => s + v.total, 0),
      count: total,
    };

    res.json({
      items,
      summaryByCurrency,
      generalTotal,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching lab relations:', error);
    res.status(500).json({ error: 'Failed to fetch lab relations' });
  }
});

router.put('/relations/:id', getCurrentUser, async (req, res) => {
  try {
    const existing = await prisma.treatmentLabRelation.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { status, completionRate, completionPriceRate, responsibleUserId, color, description } = req.body;

    const item = await prisma.treatmentLabRelation.update({
      where: { id: req.params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(completionRate !== undefined && { completionRate: parseInt(completionRate) }),
        ...(completionPriceRate !== undefined && { completionPriceRate: parseInt(completionPriceRate) }),
        ...(responsibleUserId !== undefined && { responsibleUserId: responsibleUserId || null }),
        ...(color !== undefined && { color }),
        ...(description !== undefined && { description }),
      },
      include: {
        treatmentItem: { select: { id: true, name: true, price: true, quantity: true, status: true, teeth: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
        labSupplier: { select: { id: true, name: true } },
        labMaterial: { select: { id: true, name: true, unitPrice: true, currency: true } },
        responsible: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
      },
    });
    res.json({ item });
  } catch (error) {
    console.error('Error updating lab relation:', error);
    res.status(500).json({ error: 'Failed to update lab relation' });
  }
});

router.post('/relations', getCurrentUser, async (req, res) => {
  try {
    const { treatmentItemId, patientId, labSupplierId, labMaterialId, price, quantity, color, description, responsibleUserId, doctorId } = req.body;

    if (!treatmentItemId || !patientId || !labSupplierId || !labMaterialId) {
      return res.status(400).json({ error: 'treatmentItemId, patientId, labSupplierId, and labMaterialId are required' });
    }

    const item = await prisma.treatmentLabRelation.create({
      data: {
        organizationId: req.user.organizationId,
        treatmentItemId,
        patientId,
        labSupplierId,
        labMaterialId,
        price: price || 0,
        quantity: quantity || 1,
        color: color || null,
        description: description || null,
        responsibleUserId: responsibleUserId || null,
        doctorId: doctorId || null,
      },
      include: {
        treatmentItem: { select: { id: true, name: true } },
        labSupplier: { select: { id: true, name: true } },
        labMaterial: { select: { id: true, name: true, unitPrice: true, currency: true } },
      },
    });
    res.json({ item });
  } catch (error) {
    console.error('Error creating lab relation:', error);
    res.status(500).json({ error: 'Failed to create lab relation' });
  }
});

router.get('/users', getCurrentUser, async (req, res) => {
  try {
    const users = await prisma.userOrganization.findMany({
      where: { organizationId: req.user.organizationId },
      include: { user: { select: { id: true, name: true } } },
    });
    res.json({ users: users.map(u => u.user).filter(Boolean) });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
