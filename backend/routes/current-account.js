const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { createAuditLog, getClientInfo } = require('../lib/audit');
const { getCurrentUser } = require('../middleware/auth');

// Validation schemas
const currentAccountCreateSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['SUPPLIER', 'LAB', 'EXTERNAL_INSTITUTION', 'VENDOR', 'DOCTOR', 'PERSONNEL', 'HEALTH_AGENCY', 'OPERATING_EXPENSE', 'MEDICAL', 'BANK', 'CASH', 'OTHER']).default('SUPPLIER'),
    phone: z.string().optional(),
    contactName: z.string().optional(),
    taxOffice: z.string().optional(),
    taxNumber: z.string().optional(),
    address: z.string().optional(),
    note: z.string().optional(),
});

const transactionCreateSchema = z.object({
    transactionType: z.enum(['DEBIT', 'CREDIT']),
    amount: z.number().min(1),
    description: z.string().optional(),
    occurredAt: z.string().optional(),
    reference: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'OTHER']).optional(),
    vatRate: z.number().min(0).max(100).default(0),
    bankAccountId: z.string().optional(),
});

// GET /api/current-accounts
router.get('/', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const { search, type, page = '1', limit = '20' } = req.query;

        const where = { organizationId: user.organizationId };
        if (type) where.type = type;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } }
            ];
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const [accounts, total] = await Promise.all([
            prisma.currentAccount.findMany({
                where,
                include: {
                    _count: {
                        select: { transactions: true }
                    }
                },
                orderBy: { updatedAt: 'desc' },
                take: parseInt(limit, 10),
                skip,
            }),
            prisma.currentAccount.count({ where }),
        ]);

        // Calculate balances (a more optimized way would be grouping, but for now we aggregate per account or use DB views)
        // To avoid N+1 aggressively, we fetch sum of debit/credit for these accounts
        const accountIds = accounts.map(a => a.id);
        const aggregates = await prisma.currentAccountTransaction.groupBy({
            by: ['currentAccountId'],
            where: { currentAccountId: { in: accountIds } },
            _sum: { debit: true, credit: true },
        });

        const aggMap = {};
        aggregates.forEach(agg => {
            aggMap[agg.currentAccountId] = {
                totalDebit: agg._sum.debit || 0,
                totalCredit: agg._sum.credit || 0,
                balance: (agg._sum.debit || 0) - (agg._sum.credit || 0)
            };
        });

        const enrichedAccounts = accounts.map(a => ({
            ...a,
            ...aggMap[a.id] || { totalDebit: 0, totalCredit: 0, balance: 0 }
        }));

        res.json({
            accounts: enrichedAccounts,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total,
                pages: Math.ceil(total / parseInt(limit, 10)),
            },
            stats: {
                totalDebit: enrichedAccounts.reduce((s, a) => s + (a.totalDebit || 0), 0),
                totalCredit: enrichedAccounts.reduce((s, a) => s + (a.totalCredit || 0), 0),
                totalBalance: enrichedAccounts.reduce((s, a) => s + (a.balance || 0), 0)
            }
        });
    } catch (error) {
        console.error('Error fetching current accounts:', error);
        res.status(500).json({ error: 'Failed to fetch current accounts' });
    }
});

// GET /api/current-accounts/:id
router.get('/:id', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const account = await prisma.currentAccount.findUnique({
            where: { id: req.params.id, organizationId: user.organizationId }
        });

        if (!account) return res.status(404).json({ error: 'Cari hesap bulunamadı' });

        const aggregates = await prisma.currentAccountTransaction.aggregate({
            where: { currentAccountId: account.id },
            _sum: { debit: true, credit: true }
        });

        res.json({
            account: {
                ...account,
                totalDebit: aggregates._sum.debit || 0,
                totalCredit: aggregates._sum.credit || 0,
                balance: (aggregates._sum.debit || 0) - (aggregates._sum.credit || 0)
            }
        });
    } catch (error) {
        console.error('Error fetching current account:', error);
        res.status(500).json({ error: 'Failed to fetch current account' });
    }
});

// POST /api/current-accounts
router.post('/', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const validated = currentAccountCreateSchema.parse(req.body);
        const clientInfo = getClientInfo(req);

        const account = await prisma.currentAccount.create({
            data: {
                ...validated,
                organizationId: user.organizationId,
            }
        });

        await createAuditLog({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'CREATE',
            entity: 'CurrentAccount',
            entityId: account.id,
            changes: { after: account },
            ...clientInfo,
        });

        res.status(201).json({ account });
    } catch (error) {
        console.error('Error creating current account:', error);
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
        res.status(500).json({ error: 'Failed to create current account' });
    }
});

// PUT /api/current-accounts/:id
router.put('/:id', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const validated = currentAccountCreateSchema.parse(req.body);
        const clientInfo = getClientInfo(req);

        const existing = await prisma.currentAccount.findUnique({
            where: { id: req.params.id, organizationId: user.organizationId }
        });

        if (!existing) return res.status(404).json({ error: 'Cari hesap bulunamadı' });

        const account = await prisma.currentAccount.update({
            where: { id: req.params.id },
            data: validated
        });

        await createAuditLog({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'UPDATE',
            entity: 'CurrentAccount',
            entityId: account.id,
            changes: { before: existing, after: account },
            ...clientInfo,
        });

        res.json({ account });
    } catch (error) {
        console.error('Error updating current account:', error);
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
        res.status(500).json({ error: 'Failed to update current account' });
    }
});

// GET /api/current-accounts/:id/transactions
router.get('/:id/transactions', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const { page = '1', limit = '20' } = req.query;

        const account = await prisma.currentAccount.findUnique({
            where: { id: req.params.id, organizationId: user.organizationId }
        });

        if (!account) return res.status(404).json({ error: 'Cari hesap bulunamadı' });

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const [transactions, total] = await Promise.all([
            prisma.currentAccountTransaction.findMany({
                where: { currentAccountId: account.id, organizationId: user.organizationId },
                orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
                take: parseInt(limit, 10),
                skip,
            }),
            prisma.currentAccountTransaction.count({
                where: { currentAccountId: account.id, organizationId: user.organizationId }
            })
        ]);

        res.json({
            transactions,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total,
                pages: Math.ceil(total / parseInt(limit, 10))
            }
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// POST /api/current-accounts/:id/transactions
router.post('/:id/transactions', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const validated = transactionCreateSchema.parse(req.body);
        const clientInfo = getClientInfo(req);

        const account = await prisma.currentAccount.findUnique({
            where: { id: req.params.id, organizationId: user.organizationId }
        });

        if (!account) return res.status(404).json({ error: 'Cari hesap bulunamadı' });

        const debit = validated.transactionType === 'DEBIT' ? validated.amount : 0;
        const credit = validated.transactionType === 'CREDIT' ? validated.amount : 0;
        const occurredAt = validated.occurredAt ? new Date(validated.occurredAt) : new Date();

        const transaction = await prisma.$transaction(async (tx) => {
            // 1. Create the Cari transaction
            const txn = await tx.currentAccountTransaction.create({
                data: {
                    organizationId: user.organizationId,
                    currentAccountId: account.id,
                    transactionType: validated.transactionType,
                    description: validated.description,
                    debit,
                    credit,
                    reference: validated.reference,
                    occurredAt: occurredAt
                }
            });

            // 2. Add to unified ledger (FinancialMovement)
            await tx.financialMovement.create({
                data: {
                    organizationId: user.organizationId,
                    type: 'CARI_TX',
                    sourceType: 'CARI_TRANSACTION',
                    sourceId: txn.id,
                    currentAccountId: account.id,
                    bankAccountId: validated.bankAccountId || null,
                    description: validated.description || `${account.name} işlem`,
                    amount: validated.transactionType === 'CREDIT' ? validated.amount : -validated.amount,
                    vatRate: validated.vatRate || 0,
                    paymentMethod: validated.paymentMethod || null,
                    occurredAt: occurredAt,
                    reference: validated.reference
                }
            });

            return txn;
        });

        await createAuditLog({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'CREATE',
            entity: 'CurrentAccountTransaction',
            entityId: transaction.id,
            changes: { after: transaction },
            ...clientInfo,
        });

        res.status(201).json({ transaction });
    } catch (error) {
        console.error('Error creating transaction:', error);
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});

// GET /api/current-accounts/pre-accounting — grouped summary by type
router.get('/stats/pre-accounting', getCurrentUser, async (req, res) => {
    try {
        const user = req.user;
        const accounts = await prisma.currentAccount.findMany({
            where: { organizationId: user.organizationId },
            include: { _count: { select: { transactions: true } } },
        });

        const accountIds = accounts.map(a => a.id);
        const aggregates = await prisma.currentAccountTransaction.groupBy({
            by: ['currentAccountId'],
            where: { currentAccountId: { in: accountIds } },
            _sum: { debit: true, credit: true },
        });

        const aggMap = {};
        aggregates.forEach(agg => {
            aggMap[agg.currentAccountId] = {
                totalDebit: agg._sum.debit || 0,
                totalCredit: agg._sum.credit || 0,
                balance: (agg._sum.debit || 0) - (agg._sum.credit || 0),
            };
        });

        // Group by type
        const groups = {};
        accounts.forEach(a => {
            const type = a.type;
            if (!groups[type]) groups[type] = { type, accounts: [], totalDebit: 0, totalCredit: 0, balance: 0 };
            const agg = aggMap[a.id] || { totalDebit: 0, totalCredit: 0, balance: 0 };
            groups[type].accounts.push({ ...a, ...agg });
            groups[type].totalDebit += agg.totalDebit;
            groups[type].totalCredit += agg.totalCredit;
            groups[type].balance += agg.balance;
        });

        const grandTotalDebit = Object.values(groups).reduce((s, g) => s + g.totalDebit, 0);
        const grandTotalCredit = Object.values(groups).reduce((s, g) => s + g.totalCredit, 0);

        res.json({
            groups: Object.values(groups),
            stats: {
                grandTotalDebit,
                grandTotalCredit,
                grandBalance: grandTotalDebit - grandTotalCredit,
                accountCount: accounts.length,
            },
        });
    } catch (error) {
        console.error('Error fetching pre-accounting:', error);
        res.status(500).json({ error: 'Failed to fetch pre-accounting' });
    }
});

module.exports = router;
