const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');
const { processChat } = require('../lib/ai/orchestrator');

const jobSchema = z.object({
  type: z.string(),
  inputRef: z.string().optional(),
  inputData: z.any().optional(),
});

const historyItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(5000),
});

const chatSchema = z.object({
  message: z.string().min(1).max(10000),
  history: z.array(historyItemSchema).max(20).optional(),
});

// POST /api/ai/chat - AI assistant chat (Phase 1: server-side planner)
router.post('/chat', getCurrentUser, async (req, res) => {
  try {
    const validated = chatSchema.parse(req.body);
    const result = await processChat({
      user: req.user,
      message: validated.message,
      history: validated.history || [],
      session: req.session,
    });
    res.json(result);
  } catch (error) {
    if (error.code === 'AI_PERMISSION_DENIED' || error.code === 'TOOL_PERMISSION_DENIED') {
      return res.status(403).json({ error: error.message, code: error.code });
    }
    if (error.code === 'AI_LLM_UNAVAILABLE') {
      return res.status(503).json({
        error: 'AI servisi şu an kullanılamıyor. Lütfen Ollama\'nın çalıştığından emin olun (ollama serve) ve daha sonra tekrar deneyin.',
        code: 'AI_LLM_UNAVAILABLE',
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('AI chat error:', error);
    res.status(500).json({
      error: 'Bir şeyler ters gitti. Lütfen biraz sonra tekrar deneyin veya sorunuzu farklı bir şekilde ifade edin.',
    });
  }
});

// Get all AI jobs
router.get('/jobs', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { type } = req.query;

    const where = {
      organizationId: user.organizationId,
    };

    if (type) {
      where.type = type;
    }

    const jobs = await prisma.aiJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ jobs });
  } catch (error) {
    console.error("Error fetching AI jobs:", error);
    res.status(500).json({ error: "Failed to fetch AI jobs" });
  }
});

// Create AI job
router.post('/jobs', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = jobSchema.parse(req.body);

    const job = await prisma.aiJob.create({
      data: {
        organizationId: user.organizationId,
        branchId: user.branchId || null,
        type: validated.type,
        status: "queued",
        inputRef: validated.inputRef,
        inputData: validated.inputData,
        createdBy: user.id,
      },
    });

    // TODO: Push to BullMQ queue for processing
    // await aiQueue.add(job.type, { jobId: job.id });

    res.json({ job });
  } catch (error) {
    console.error("Error creating AI job:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    res.status(500).json({ error: "Failed to create AI job" });
  }
});

module.exports = router;

