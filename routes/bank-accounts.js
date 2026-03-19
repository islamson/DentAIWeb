const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const bankAccountSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['BANK', 'CASH']).default('BANK'),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    iban: z.string().optional(),
    isDefault: z.boolean().optional(),
});

// GET /api/bank-accounts
router.get('/', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const accounts = await prisma.bankAccount.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
        });

        // Get movement sums per bank account
        const accountIds = accounts.map(a => a.id);
        const movementAggs = await prisma.financialMovement.groupBy({
            by: ['bankAccountId'],
            where: { bankAccountId: { in: accountIds }, status: 'ACTIVE' },
            _sum: { amount: true },
            _count: true,
        });
        const aggMap = {};
        movementAggs.forEach(a => { aggMap[a.bankAccountId] = { totalMovement: a._sum.amount || 0, movementCount: a._count || 0 }; });

        const enriched = accounts.map(a => ({
            ...a,
            ...aggMap[a.id] || { totalMovement: 0, movementCount: 0 },
        }));

        res.json({ accounts: enriched });
    } catch (error) {
        console.error('Error fetching bank accounts:', error);
        res.status(500).json({ error: 'Failed to fetch bank accounts' });
    }
});

// POST /api/bank-accounts
router.post('/', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const validated = bankAccountSchema.parse(req.body);
        const account = await prisma.bankAccount.create({
            data: { ...validated, organizationId: user.organizationId },
        });
        res.status(201).json({ account });
    } catch (error) {
        console.error('Error creating bank account:', error);
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
        res.status(500).json({ error: 'Failed to create bank account' });
    }
});

// GET /api/bank-accounts/:id/transactions
router.get('/:id/transactions', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const { dateFrom, dateTo, type, page = '1', limit = '20' } = req.query;
        const where = {
            organizationId: user.organizationId,
            bankAccountId: req.params.id,
            status: 'ACTIVE',
        };
        if (type) where.type = type;
        if (dateFrom || dateTo) {
            where.occurredAt = {};
            if (dateFrom) where.occurredAt.gte = new Date(dateFrom);
            if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); where.occurredAt.lte = d; }
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const [movements, total, agg] = await Promise.all([
            prisma.financialMovement.findMany({
                where,
                include: {
                    patient: { select: { firstName: true, lastName: true } },
                    currentAccount: { select: { name: true } },
                },
                orderBy: { occurredAt: 'desc' },
                take: parseInt(limit, 10),
                skip,
            }),
            prisma.financialMovement.count({ where }),
            prisma.financialMovement.aggregate({ where, _sum: { amount: true } }),
        ]);
        res.json({
            movements,
            pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
            stats: { totalAmount: agg._sum.amount || 0 },
        });
    } catch (error) {
        console.error('Error fetching bank transactions:', error);
        res.status(500).json({ error: 'Failed to fetch bank transactions' });
    }
});

module.exports = router;
