const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const blockSchema = z.object({
  doctorUserId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  type: z.enum(['WORKING', 'BREAK', 'BLOCKED']).optional(),
  title: z.string().optional(),
});

// Get doctors list for org
router.get('/doctors', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const doctors = await prisma.userOrganization.findMany({
      where: {
        organizationId: user.organizationId,
        role: { in: ['DOCTOR', 'OWNER', 'ADMIN'] },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({ doctors });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// Get schedule blocks
router.get('/blocks', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { doctorUserId, startDate, endDate } = req.query;

    const where = { organizationId: user.organizationId };
    if (doctorUserId) where.doctorUserId = doctorUserId;
    if (startDate && endDate) {
      where.startAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const blocks = await prisma.scheduleBlock.findMany({
      where,
      include: { doctor: { select: { id: true, name: true } } },
      orderBy: { startAt: 'asc' },
    });

    res.json({ blocks });
  } catch (error) {
    console.error('Error fetching schedule blocks:', error);
    res.status(500).json({ error: 'Failed to fetch schedule blocks' });
  }
});

// Create schedule block
router.post('/blocks', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = blockSchema.parse(req.body);
    const block = await prisma.scheduleBlock.create({
      data: {
        ...validated,
        organizationId: user.organizationId,
        startAt: new Date(validated.startAt),
        endAt: new Date(validated.endAt),
        type: validated.type || 'BLOCKED',
      },
      include: { doctor: { select: { id: true, name: true } } },
    });
    res.json({ block });
  } catch (error) {
    console.error('Error creating schedule block:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create schedule block' });
  }
});

// Delete schedule block
router.delete('/blocks/:id', getCurrentUser, async (req, res) => {
  try {
    await prisma.scheduleBlock.delete({ where: { id: req.params.id } });
    res.json({ message: 'Schedule block deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule block' });
  }
});

// Get available time slots for a doctor on a given date
router.get('/availability', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { doctorUserId, date, durationMinutes = '60' } = req.query;

    if (!doctorUserId || !date) {
      return res.status(400).json({ error: 'doctorUserId and date are required' });
    }

    const targetDate = new Date(date);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Get working hours from schedule blocks
    const workingBlocks = await prisma.scheduleBlock.findMany({
      where: {
        organizationId: user.organizationId,
        doctorUserId,
        type: 'WORKING',
        startAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { startAt: 'asc' },
    });

    // Get break/blocked periods
    const blockedPeriods = await prisma.scheduleBlock.findMany({
      where: {
        organizationId: user.organizationId,
        doctorUserId,
        type: { in: ['BREAK', 'BLOCKED'] },
        startAt: { gte: dayStart, lte: dayEnd },
      },
    });

    // Get existing appointments
    const appointments = await prisma.appointment.findMany({
      where: {
        organizationId: user.organizationId,
        doctorUserId,
        startAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED'] },
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { startAt: 'asc' },
    });

    // Default working hours if no blocks defined
    const defaultStart = new Date(targetDate);
    defaultStart.setHours(9, 0, 0, 0);
    const defaultEnd = new Date(targetDate);
    defaultEnd.setHours(18, 0, 0, 0);

    const workStart = workingBlocks.length > 0 ? workingBlocks[0].startAt : defaultStart;
    const workEnd = workingBlocks.length > 0 ? workingBlocks[workingBlocks.length - 1].endAt : defaultEnd;

    const duration = parseInt(durationMinutes);
    const slots = [];
    let slotTime = new Date(workStart);

    while (slotTime.getTime() + duration * 60000 <= workEnd.getTime()) {
      const slotEnd = new Date(slotTime.getTime() + duration * 60000);

      const isBlocked = blockedPeriods.some(
        (b) => slotTime < b.endAt && slotEnd > b.startAt
      );
      const hasAppointment = appointments.some(
        (a) => slotTime < a.endAt && slotEnd > a.startAt
      );

      if (!isBlocked && !hasAppointment) {
        slots.push({
          startAt: new Date(slotTime),
          endAt: slotEnd,
          available: true,
        });
      }

      slotTime = new Date(slotTime.getTime() + 30 * 60000); // 30-min increments
    }

    res.json({ slots, appointments, workStart, workEnd });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

module.exports = router;
