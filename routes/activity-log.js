const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

// List activity logs (operational feed)
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { patientId, eventType, limit = '30', page = '1' } = req.query;

    const where = { organizationId: user.organizationId };
    if (patientId) where.patientId = patientId;
    if (eventType) where.eventType = eventType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

module.exports = router;
