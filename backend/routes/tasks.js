const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['TASK', 'RECALL']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  assignedUserId: z.string().optional(),
  patientId: z.string().optional(),
  dueAt: z.string().optional(),
});

// List tasks
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { type, status, assignedUserId, patientId } = req.query;

    const where = { organizationId: user.organizationId };
    if (type) where.type = type;
    if (status) where.status = status;
    if (assignedUserId) where.assignedUserId = assignedUserId;
    if (patientId) where.patientId = patientId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        createdByUser: { select: { id: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    });

    const now = new Date();
    const enriched = tasks.map((t) => ({
      ...t,
      isOverdue: t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueAt && new Date(t.dueAt) < now,
    }));

    res.json({ tasks: enriched });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = taskSchema.parse(req.body);
    const task = await prisma.task.create({
      data: {
        ...validated,
        organizationId: user.organizationId,
        createdBy: user.id,
        dueAt: validated.dueAt ? new Date(validated.dueAt) : null,
        type: validated.type || 'TASK',
        status: validated.status || 'PENDING',
      },
      include: {
        assignedUser: { select: { id: true, name: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json({ task });
  } catch (error) {
    console.error('Error creating task:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', getCurrentUser, async (req, res) => {
  try {
    const validated = taskSchema.partial().parse(req.body);
    const data = {
      ...validated,
      ...(validated.dueAt && { dueAt: new Date(validated.dueAt) }),
      ...(validated.status === 'COMPLETED' && { completedAt: new Date() }),
    };
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
      include: {
        assignedUser: { select: { id: true, name: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json({ task });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', getCurrentUser, async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
