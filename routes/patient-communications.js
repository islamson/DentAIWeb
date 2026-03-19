const express = require('express');
const router = express.Router({ mergeParams: true });
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const commSchema = z.object({
  type: z.enum(['phone', 'sms', 'whatsapp', 'email']),
  content: z.string().min(1),
  status: z.string().optional(),
});

router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const comms = await prisma.patientCommunication.findMany({
      where: { patientId: req.params.patientId, organizationId: user.organizationId },
      include: { createdByUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ communications: comms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch communications' });
  }
});

router.post('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = commSchema.parse(req.body);
    const comm = await prisma.patientCommunication.create({
      data: {
        organizationId: user.organizationId,
        patientId: req.params.patientId,
        createdBy: user.id,
        ...validated,
      },
      include: { createdByUser: { select: { id: true, name: true } } },
    });
    res.json({ communication: comm });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create communication' });
  }
});

router.delete('/:commId', getCurrentUser, async (req, res) => {
  try {
    await prisma.patientCommunication.delete({ where: { id: req.params.commId } });
    res.json({ message: 'Communication deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete communication' });
  }
});

module.exports = router;
