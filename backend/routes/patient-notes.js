const express = require('express');
const router = express.Router({ mergeParams: true });
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const noteSchema = z.object({
  content: z.string().min(1),
});

router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const notes = await prisma.patientNote.findMany({
      where: { patientId: req.params.patientId, organizationId: user.organizationId },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.post('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { content } = noteSchema.parse(req.body);
    const note = await prisma.patientNote.create({
      data: {
        organizationId: user.organizationId,
        patientId: req.params.patientId,
        authorId: user.id,
        content,
      },
      include: { author: { select: { id: true, name: true } } },
    });
    res.json({ note });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create note' });
  }
});

router.put('/:noteId', getCurrentUser, async (req, res) => {
  try {
    const { content } = noteSchema.parse(req.body);
    const note = await prisma.patientNote.update({
      where: { id: req.params.noteId },
      data: { content },
      include: { author: { select: { id: true, name: true } } },
    });
    res.json({ note });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:noteId', getCurrentUser, async (req, res) => {
  try {
    await prisma.patientNote.delete({ where: { id: req.params.noteId } });
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
