const express = require('express');
const router = express.Router({ mergeParams: true });
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const entrySchema = z.object({
  toothNumber: z.string(),
  pocketDepth: z.number().optional(),
  bleeding: z.boolean().optional(),
  mobility: z.number().min(0).max(3).optional(),
  notes: z.string().optional(),
  recordedAt: z.string().optional(),
});

const bulkSchema = z.array(entrySchema);

// Get perio chart for patient
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const entries = await prisma.perioChartEntry.findMany({
      where: { patientId: req.params.patientId, organizationId: user.organizationId },
      include: { recordedByUser: { select: { id: true, name: true } } },
      orderBy: [{ toothNumber: 'asc' }, { recordedAt: 'desc' }],
    });
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch perio chart' });
  }
});

// Save/upsert perio entries (bulk)
router.post('/bulk', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const entries = bulkSchema.parse(req.body.entries);

    const results = await Promise.all(
      entries.map((entry) =>
        prisma.perioChartEntry.create({
          data: {
            organizationId: user.organizationId,
            patientId: req.params.patientId,
            recordedBy: user.id,
            recordedAt: entry.recordedAt ? new Date(entry.recordedAt) : new Date(),
            ...entry,
          },
        })
      )
    );

    res.json({ entries: results });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to save perio chart' });
  }
});

// Single entry
router.post('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = entrySchema.parse(req.body);
    const entry = await prisma.perioChartEntry.create({
      data: {
        organizationId: user.organizationId,
        patientId: req.params.patientId,
        recordedBy: user.id,
        recordedAt: validated.recordedAt ? new Date(validated.recordedAt) : new Date(),
        ...validated,
      },
    });
    res.json({ entry });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create perio entry' });
  }
});

module.exports = router;
