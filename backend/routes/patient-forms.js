const express = require('express');
const router = express.Router({ mergeParams: true });
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const formSchema = z.object({
  formType: z.string().min(1),
  status: z.string().optional(),
  signedAt: z.string().optional(),
  fileRef: z.string().optional(),
});

router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const forms = await prisma.patientForm.findMany({
      where: { patientId: req.params.patientId, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ forms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

router.post('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = formSchema.parse(req.body);
    const form = await prisma.patientForm.create({
      data: {
        organizationId: user.organizationId,
        patientId: req.params.patientId,
        ...validated,
        signedAt: validated.signedAt ? new Date(validated.signedAt) : null,
        status: validated.status || 'PENDING',
      },
    });
    res.json({ form });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create form' });
  }
});

router.put('/:formId', getCurrentUser, async (req, res) => {
  try {
    const validated = formSchema.partial().parse(req.body);
    const form = await prisma.patientForm.update({
      where: { id: req.params.formId },
      data: {
        ...validated,
        ...(validated.signedAt && { signedAt: new Date(validated.signedAt) }),
      },
    });
    res.json({ form });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update form' });
  }
});

module.exports = router;
