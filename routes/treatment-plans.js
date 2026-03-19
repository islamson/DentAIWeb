const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { createAuditLog } = require('../lib/audit');
const { getCurrentUser } = require('../middleware/auth');

const planSchema = z.object({
  patientId: z.string(),
  doctorUserId: z.string().optional(),
  title: z.string().min(1),
  status: z.string().optional(),
  isActive: z.boolean().optional(),
  plannedTotal: z.number().optional(),
  notes: z.string().optional(),
});

const itemSchema = z.object({
  treatmentPlanId: z.string(),
  catalogServiceId: z.string().optional(),
  assignedDoctorId: z.string().optional(),
  parentItemId: z.string().optional(),
  sessionId: z.string().optional(),
  code: z.string().optional(),
  name: z.string().min(1),
  price: z.number(),
  quantity: z.number().optional(),
  discount: z.number().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  toothCodes: z.array(z.string()).optional(),
});

const sessionSchema = z.object({
  treatmentItemId: z.string().optional(),
  treatmentPlanId: z.string().optional(),
  doctorId: z.string().optional(),
  sessionDate: z.string(),
  status: z.string().optional(),
  amount: z.number().optional(),
  notes: z.string().optional(),
});

// ─── ITEM INCLUDE HELPER ──────────────────────────────────────────────────────

const itemInclude = {
  teeth: true,
  assignedDoctor: { select: { id: true, name: true } },
  catalog: { select: { id: true, name: true, requiresLab: true } },
  labRelations: {
    where: { deletedAt: null },
    include: {
      labSupplier: { select: { id: true, name: true } },
      labMaterial: { select: { id: true, name: true, unitPrice: true, currency: true } },
    },
  },
  sessions: {
    where: { treatmentItemId: { not: null } },
    include: { doctor: { select: { id: true, name: true } } },
    orderBy: { sessionDate: 'asc' },
  },
  children: {
    include: {
      teeth: true,
      assignedDoctor: { select: { id: true, name: true } },
      catalog: { select: { id: true, name: true, requiresLab: true } },
      labRelations: {
        where: { deletedAt: null },
        include: {
          labSupplier: { select: { id: true, name: true } },
          labMaterial: { select: { id: true, name: true, unitPrice: true, currency: true } },
        },
      },
      planSession: { select: { id: true, sessionDate: true, doctorId: true, doctor: { select: { id: true, name: true } } } },
      sessions: {
        include: { doctor: { select: { id: true, name: true } } },
        orderBy: { sessionDate: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  planSession: { select: { id: true, sessionDate: true } },
};

// ─── TREATMENT PLANS ─────────────────────────────────────────────────────────

router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { patientId, doctorUserId, status, isActive, search, dateFrom, dateTo, page = '1', limit = '20' } = req.query;

    const where = { organizationId: user.organizationId };
    if (user.branchId) where.branchId = user.branchId;
    if (patientId) where.patientId = patientId;
    if (doctorUserId) where.doctorUserId = doctorUserId;
    if (status) where.status = status;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [plans, total] = await Promise.all([
      prisma.treatmentPlan.findMany({
        where,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
          doctor: { select: { id: true, name: true } },
          items: {
            where: { parentItemId: null },
            include: {
              children: true,
              assignedDoctor: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      prisma.treatmentPlan.count({ where }),
    ]);

    res.json({ plans, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    console.error('Error fetching treatment plans:', error);
    res.status(500).json({ error: 'Failed to fetch treatment plans' });
  }
});

router.get('/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const plan = await prisma.treatmentPlan.findFirst({
      where: { id: req.params.id, organizationId: user.organizationId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        doctor: { select: { id: true, name: true } },
        planSessions: {
          include: {
            doctor: { select: { id: true, name: true } },
            assignedItems: { include: { teeth: true, assignedDoctor: { select: { id: true, name: true } } } },
          },
          orderBy: { sessionDate: 'asc' },
        },
        items: {
          where: { parentItemId: null },
          include: itemInclude,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!plan) return res.status(404).json({ error: 'Treatment plan not found' });
    res.json({ plan });
  } catch (error) {
    console.error('Error fetching treatment plan:', error);
    res.status(500).json({ error: 'Failed to fetch treatment plan' });
  }
});

router.post('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = planSchema.parse(req.body);

    const plan = await prisma.treatmentPlan.create({
      data: {
        ...validated,
        organizationId: user.organizationId,
        branchId: user.branchId || null,
        totalPrice: validated.plannedTotal || 0,
        plannedTotal: validated.plannedTotal || 0,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await createAuditLog({ organizationId: user.organizationId, userId: user.id, action: 'CREATE', entity: 'TreatmentPlan', entityId: plan.id });
    await prisma.activityLog.create({
      data: {
        organizationId: user.organizationId,
        eventType: 'treatment_plan_created',
        actorUserId: user.id,
        patientId: plan.patientId,
        entityType: 'TreatmentPlan',
        entityId: plan.id,
        summary: `Yeni tedavi planı oluşturuldu: ${plan.patient.firstName} ${plan.patient.lastName} - ${plan.title}`,
      },
    });

    res.json({ plan });
  } catch (error) {
    console.error('Error creating treatment plan:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create treatment plan' });
  }
});

router.put('/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = planSchema.partial().parse(req.body);

    const plan = await prisma.treatmentPlan.update({
      where: { id: req.params.id },
      data: {
        ...validated,
        ...(validated.plannedTotal !== undefined && { totalPrice: validated.plannedTotal }),
      },
    });

    await createAuditLog({ organizationId: user.organizationId, userId: user.id, action: 'UPDATE', entity: 'TreatmentPlan', entityId: plan.id });
    res.json({ plan });
  } catch (error) {
    console.error('Error updating treatment plan:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to update treatment plan' });
  }
});

router.delete('/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    await prisma.treatmentPlan.delete({ where: { id: req.params.id } });
    await createAuditLog({ organizationId: user.organizationId, userId: user.id, action: 'DELETE', entity: 'TreatmentPlan', entityId: req.params.id });
    res.json({ message: 'Treatment plan deleted' });
  } catch (error) {
    console.error('Error deleting treatment plan:', error);
    res.status(500).json({ error: 'Failed to delete treatment plan' });
  }
});

// ─── TREATMENT ITEMS ─────────────────────────────────────────────────────────

router.post('/items', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = itemSchema.parse(req.body);
    const { toothCodes, ...itemData } = validated;

    const isMultiTooth = toothCodes && toothCodes.length > 1;

    if (isMultiTooth) {
      // Create parent group item (no teeth, holds metadata)
      const parent = await prisma.treatmentItem.create({
        data: {
          ...itemData,
          organizationId: user.organizationId,
          quantity: toothCodes.length,
          status: 'PLANNED',
          progress: 0,
        },
      });

      // Create one child per tooth
      const children = await Promise.all(
        toothCodes.map((tc) =>
          prisma.treatmentItem.create({
            data: {
              name: itemData.name,
              price: itemData.price,
              quantity: 1,
              discount: itemData.discount || 0,
              treatmentPlanId: itemData.treatmentPlanId,
              organizationId: user.organizationId,
              catalogServiceId: itemData.catalogServiceId,
              assignedDoctorId: itemData.assignedDoctorId,
              notes: itemData.notes,
              parentItemId: parent.id,
              teeth: { create: [{ toothCode: tc }] },
              status: 'PLANNED',
              progress: 0,
            },
            include: { teeth: true },
          })
        )
      );

      await recalcPlanTotals(itemData.treatmentPlanId);

      const fullParent = await prisma.treatmentItem.findUnique({
        where: { id: parent.id },
        include: itemInclude,
      });

      return res.json({ item: fullParent, children });
    }

    // Single tooth or non-tooth item
    const item = await prisma.treatmentItem.create({
      data: {
        ...itemData,
        organizationId: user.organizationId,
        teeth: toothCodes?.length ? { create: toothCodes.map((tc) => ({ toothCode: tc })) } : undefined,
      },
      include: itemInclude,
    });

    await recalcPlanTotals(validated.treatmentPlanId);
    res.json({ item });
  } catch (error) {
    console.error('Error creating treatment item:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create treatment item' });
  }
});

router.put('/items/:id', getCurrentUser, async (req, res) => {
  try {
    const validated = itemSchema.partial().parse(req.body);
    const { toothCodes, ...itemData } = validated;

    const existing = await prisma.treatmentItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const item = await prisma.treatmentItem.update({
      where: { id: req.params.id },
      data: {
        ...itemData,
        ...(validated.status !== undefined && {
          completedAt: validated.status === 'COMPLETED' ? existing.completedAt || new Date() : null,
        }),
        ...(toothCodes !== undefined && {
          teeth: {
            deleteMany: {},
            create: toothCodes.map((tc) => ({ toothCode: tc })),
          },
        }),
      },
      include: itemInclude,
    });

    // If this is a child item, propagate status change to parent
    if (existing.parentItemId && validated.status) {
      await recalcGroupStatus(existing.parentItemId);
    }

    await recalcPlanTotals(existing.treatmentPlanId);

    // Sync financial movement if status changed
    if (validated.status && validated.status !== existing.status) {
      await syncTreatmentCostMovement(item.id, req.user);
    }

    res.json({ item });
  } catch (error) {
    console.error('Error updating treatment item:', error);
    res.status(500).json({ error: 'Failed to update treatment item' });
  }
});

router.delete('/items/:id', getCurrentUser, async (req, res) => {
  try {
    const item = await prisma.treatmentItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    // Soft-delete lab relations before deleting the treatment item
    await prisma.treatmentLabRelation.updateMany({
      where: { treatmentItemId: req.params.id, deletedAt: null },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
    await prisma.treatmentItem.delete({ where: { id: req.params.id } });
    await recalcPlanTotals(item.treatmentPlanId);
    if (item.parentItemId) await recalcGroupStatus(item.parentItemId);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Error deleting treatment item:', error);
    res.status(500).json({ error: 'Failed to delete treatment item' });
  }
});

// Bulk status update for a grouped parent item
router.put('/items/:id/bulk-status', getCurrentUser, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const item = await prisma.treatmentItem.findUnique({
      where: { id: req.params.id },
      include: { children: { select: { id: true } } },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const progressByStatus = {
      PLANNED: 0,
      IN_PROGRESS: 50,
      COMPLETED: 100,
      CANCELLED: 0,
    };
    const nextProgress = progressByStatus[status] ?? 0;

    if (item.children.length > 0) {
      await prisma.treatmentItem.updateMany({
        where: { parentItemId: item.id },
        data: {
          status,
          progress: nextProgress,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
      });
      await recalcGroupStatus(item.id);
      await recalcPlanTotals(item.treatmentPlanId);

      const updatedParent = await prisma.treatmentItem.findUnique({
        where: { id: item.id },
        include: itemInclude,
      });

      // Sync movements for all children
      for (const child of item.children) {
        await syncTreatmentCostMovement(child.id, req.user);
      }

      return res.json({ item: updatedParent });
    }

    const updated = await prisma.treatmentItem.update({
      where: { id: item.id },
      data: {
        status,
        progress: nextProgress,
        completedAt: status === 'COMPLETED' ? item.completedAt || new Date() : null,
      },
      include: itemInclude,
    });

    await recalcPlanTotals(item.treatmentPlanId);
    await syncTreatmentCostMovement(updated.id, req.user);

    res.json({ item: updated });
  } catch (error) {
    console.error('Error bulk-updating group status:', error);
    res.status(500).json({ error: 'Failed to bulk-update status' });
  }
});

// Assign a treatment item/group to a plan session
router.put('/items/:id/assign-session', getCurrentUser, async (req, res) => {
  try {
    const { sessionId } = req.body; // null to unassign
    const item = await prisma.treatmentItem.findUnique({
      where: { id: req.params.id },
      include: { children: { select: { id: true } } },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Group-level assignment: move all children together
    if (item.children.length > 0) {
      await prisma.treatmentItem.update({
        where: { id: item.id },
        data: { sessionId: sessionId || null },
      });
      await prisma.treatmentItem.updateMany({
        where: { parentItemId: item.id },
        data: { sessionId: sessionId || null },
      });
      const updated = await prisma.treatmentItem.findUnique({
        where: { id: item.id },
        include: itemInclude,
      });
      return res.json({ item: updated, movedChildren: item.children.length });
    }

    const updated = await prisma.treatmentItem.update({
      where: { id: item.id },
      data: { sessionId: sessionId || null },
      include: itemInclude,
    });
    res.json({ item: updated });
  } catch (error) {
    console.error('Error assigning session to item:', error);
    res.status(500).json({ error: 'Failed to assign session' });
  }
});

// ─── ITEM-LEVEL SESSIONS (legacy + simple single-tooth items) ─────────────────

router.post('/sessions', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = sessionSchema.parse(req.body);

    if (!validated.treatmentItemId && !validated.treatmentPlanId) {
      return res.status(400).json({ error: 'Either treatmentItemId or treatmentPlanId is required' });
    }

    const session = await prisma.treatmentSession.create({
      data: {
        ...validated,
        organizationId: user.organizationId,
        sessionDate: new Date(validated.sessionDate),
        status: validated.status || 'PLANNED',
      },
      include: {
        doctor: { select: { id: true, name: true } },
        assignedItems: { include: { teeth: true } },
      },
    });

    if (validated.treatmentItemId) {
      await recalcItemProgress(validated.treatmentItemId);
      const item = await prisma.treatmentItem.findUnique({ where: { id: validated.treatmentItemId } });
      if (item) {
        if (item.parentItemId) await recalcGroupStatus(item.parentItemId);
        await recalcPlanTotals(item.treatmentPlanId);
      }
    }

    res.json({ session });
  } catch (error) {
    console.error('Error creating session:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create session' });
  }
});

router.put('/sessions/:id', getCurrentUser, async (req, res) => {
  try {
    const validated = sessionSchema.partial().parse(req.body);
    const session = await prisma.treatmentSession.update({
      where: { id: req.params.id },
      data: {
        ...validated,
        ...(validated.sessionDate && { sessionDate: new Date(validated.sessionDate) }),
      },
      include: {
        doctor: { select: { id: true, name: true } },
        assignedItems: { include: { teeth: true } },
      },
    });

    if (session.treatmentItemId) {
      await recalcItemProgress(session.treatmentItemId);
      const item = await prisma.treatmentItem.findUnique({ where: { id: session.treatmentItemId } });
      if (item) {
        if (item.parentItemId) await recalcGroupStatus(item.parentItemId);
        await recalcPlanTotals(item.treatmentPlanId);
      }
    }

    res.json({ session });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

router.delete('/sessions/:id', getCurrentUser, async (req, res) => {
  try {
    const session = await prisma.treatmentSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await prisma.treatmentSession.delete({ where: { id: req.params.id } });

    if (session.treatmentItemId) {
      await recalcItemProgress(session.treatmentItemId);
      const item = await prisma.treatmentItem.findUnique({ where: { id: session.treatmentItemId } });
      if (item) {
        if (item.parentItemId) await recalcGroupStatus(item.parentItemId);
        await recalcPlanTotals(item.treatmentPlanId);
      }
    }

    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ─── PLAN-LEVEL SESSIONS ─────────────────────────────────────────────────────

router.post('/plan-sessions', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { treatmentPlanId, doctorId, sessionDate, notes, status } = req.body;

    if (!treatmentPlanId) return res.status(400).json({ error: 'treatmentPlanId required' });

    const session = await prisma.treatmentSession.create({
      data: {
        organizationId: user.organizationId,
        treatmentPlanId,
        doctorId: doctorId || null,
        sessionDate: new Date(sessionDate),
        status: status || 'PLANNED',
        notes: notes || null,
      },
      include: {
        doctor: { select: { id: true, name: true } },
        assignedItems: {
          include: {
            teeth: true,
            assignedDoctor: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json({ session });
  } catch (error) {
    console.error('Error creating plan session:', error);
    res.status(500).json({ error: 'Failed to create plan session' });
  }
});

router.put('/plan-sessions/:id', getCurrentUser, async (req, res) => {
  try {
    const { doctorId, sessionDate, notes, status } = req.body;
    const session = await prisma.treatmentSession.update({
      where: { id: req.params.id },
      data: {
        ...(doctorId !== undefined && { doctorId: doctorId || null }),
        ...(sessionDate && { sessionDate: new Date(sessionDate) }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
      },
      include: {
        doctor: { select: { id: true, name: true } },
        assignedItems: {
          include: {
            teeth: true,
            assignedDoctor: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.json({ session });
  } catch (error) {
    console.error('Error updating plan session:', error);
    res.status(500).json({ error: 'Failed to update plan session' });
  }
});

router.delete('/plan-sessions/:id', getCurrentUser, async (req, res) => {
  try {
    // Unassign all items from this session before deleting
    await prisma.treatmentItem.updateMany({
      where: { sessionId: req.params.id },
      data: { sessionId: null },
    });
    await prisma.treatmentSession.delete({ where: { id: req.params.id } });
    res.json({ message: 'Plan session deleted' });
  } catch (error) {
    console.error('Error deleting plan session:', error);
    res.status(500).json({ error: 'Failed to delete plan session' });
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function recalcItemProgress(itemId) {
  const sessions = await prisma.treatmentSession.findMany({
    where: { treatmentItemId: itemId },
  });
  const item = await prisma.treatmentItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  // Never override manually-cancelled items
  if (item.status === 'CANCELLED') return;

  if (!sessions.length) {
    await prisma.treatmentItem.update({ where: { id: itemId }, data: { progress: 0, status: 'PLANNED' } });
    await syncTreatmentCostMovement(itemId);
    return;
  }

  const completed = sessions.filter((s) => s.status === 'COMPLETED').length;
  const progress = Math.round((completed / sessions.length) * 100);
  const status = progress === 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'PLANNED';
  await prisma.treatmentItem.update({
    where: { id: itemId },
    data: {
      progress,
      status,
      completedAt: status === 'COMPLETED' ? item.completedAt || new Date() : null,
    },
  });

  if (item.status !== status) {
    await syncTreatmentCostMovement(itemId);
  }
}

async function recalcGroupStatus(parentId) {
  const children = await prisma.treatmentItem.findMany({
    where: { parentItemId: parentId },
  });
  if (!children.length) return;

  const statuses = children.map((c) => c.status);
  const allCancelled = statuses.every((s) => s === 'CANCELLED');
  const allCompleted = statuses.every((s) => s === 'COMPLETED');
  const allResolved = statuses.every((s) => s === 'COMPLETED' || s === 'CANCELLED');
  const anyInProgress = statuses.some((s) => s === 'IN_PROGRESS');
  const anyCompleted = statuses.some((s) => s === 'COMPLETED');

  let status = 'PLANNED';
  if (allCancelled) status = 'CANCELLED';
  else if (allCompleted || (allResolved && anyCompleted)) status = 'COMPLETED';
  else if (anyInProgress || anyCompleted) status = 'IN_PROGRESS';

  const progressByStatus = {
    PLANNED: 0,
    IN_PROGRESS: 50,
    COMPLETED: 100,
    CANCELLED: 0,
  };
  const progress = Math.round(
    statuses.reduce((sum, childStatus) => sum + (progressByStatus[childStatus] ?? 0), 0) / statuses.length
  );

  const parent = await prisma.treatmentItem.findUnique({ where: { id: parentId } });
  await prisma.treatmentItem.update({
    where: { id: parentId },
    data: {
      status,
      progress,
      completedAt: status === 'COMPLETED' ? parent?.completedAt || new Date() : null,
    },
  });
}

async function recalcPlanTotals(planId) {
  // Only count leaf items: child items (parentItemId != null) + standalone (no parent, no children)
  const leafItems = await prisma.treatmentItem.findMany({
    where: {
      treatmentPlanId: planId,
      OR: [
        { parentItemId: { not: null } },   // children of group items
        { children: { none: {} } },        // standalone items (no children)
      ],
    },
  });

  const plannedTotal = leafItems.reduce((sum, item) => {
    return sum + item.price * item.quantity * (1 - item.discount / 100);
  }, 0);

  const completedTotal = leafItems
    .filter((i) => i.status === 'COMPLETED')
    .reduce((sum, item) => {
      return sum + item.price * item.quantity * (1 - item.discount / 100);
    }, 0);

  const allCancelled = leafItems.length > 0 && leafItems.every((i) => i.status === 'CANCELLED');
  const allCompleted = leafItems.length > 0 && leafItems.every((i) => i.status === 'COMPLETED');
  const allResolved =
    leafItems.length > 0 && leafItems.every((i) => i.status === 'COMPLETED' || i.status === 'CANCELLED');
  const anyInProgress = leafItems.some((i) => i.status === 'IN_PROGRESS');
  const anyCompleted = leafItems.some((i) => i.status === 'COMPLETED');

  const currentPlan = await prisma.treatmentPlan.findUnique({ where: { id: planId } });
  let newStatus = currentPlan?.status;

  // Only auto-advance; never clobber user-set CANCELLED, COMPLETED, REJECTED
  const lockedStatuses = ['CANCELLED', 'COMPLETED', 'REJECTED'];
  if (!lockedStatuses.includes(newStatus)) {
    if (allCancelled) newStatus = 'CANCELLED';
    else if (allCompleted || (allResolved && anyCompleted)) newStatus = 'COMPLETED';
    else if ((anyInProgress || anyCompleted) && ['DRAFT', 'PROPOSED', 'APPROVED', 'IN_PROGRESS'].includes(newStatus)) newStatus = 'IN_PROGRESS';
  }

  await prisma.treatmentPlan.update({
    where: { id: planId },
    data: { plannedTotal, completedTotal, totalPrice: plannedTotal, status: newStatus },
  });
}

async function syncTreatmentCostMovement(itemId, user = null) {
  const item = await prisma.treatmentItem.findUnique({
    where: { id: itemId },
    include: {
      plan: { select: { patientId: true } },
      planSession: { select: { doctorId: true, sessionDate: true } },
      sessions: {
        where: { status: 'COMPLETED' },
        orderBy: { sessionDate: 'desc' },
        take: 1
      }
    }
  });

  if (!item || !item.plan) return;

  // Don't create movements for container parent items. Only the leaves.
  const hasChildren = await prisma.treatmentItem.count({ where: { parentItemId: item.id } });
  if (hasChildren > 0) return;

  const existingMovement = await prisma.financialMovement.findFirst({
    where: { sourceType: 'TREATMENT_ITEM', sourceId: item.id }
  });

  const amount = -(item.price * item.quantity);

  if (item.status === 'COMPLETED') {
    const occurredAt = item.completedAt || item.sessions[0]?.sessionDate || item.planSession?.sessionDate || new Date();
    const doctorId = item.sessions[0]?.doctorId || item.planSession?.doctorId || item.assignedDoctorId || null;

    if (existingMovement) {
      await prisma.financialMovement.update({
        where: { id: existingMovement.id },
        data: {
          status: 'ACTIVE',
          amount,
          occurredAt,
          doctorId,
          description: item.name
        }
      });
    } else {
      await prisma.financialMovement.create({
        data: {
          organizationId: item.organizationId,
          type: 'TREATMENT_COST',
          sourceType: 'TREATMENT_ITEM',
          sourceId: item.id,
          patientId: item.plan.patientId,
          doctorId,
          description: item.name,
          amount,
          occurredAt,
          status: 'ACTIVE'
        }
      });
    }
  } else if (item.status === 'CANCELLED' || item.status === 'PLANNED' || item.status === 'IN_PROGRESS') {
    if (existingMovement) {
      await prisma.financialMovement.update({
        where: { id: existingMovement.id },
        data: { status: item.status === 'CANCELLED' ? 'CANCELLED' : 'VOIDED' }
      });
    }
  }
}

module.exports = router;
