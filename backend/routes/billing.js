const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { createAuditLog, getClientInfo } = require('../lib/audit');
const { getCurrentUser } = require('../middleware/auth');
const { getOrganizationFinanceMovements } = require('../lib/patient-finance-ledger');

const paymentCreateSchema = z.object({
  patientId: z.string(),
  invoiceId: z.string().optional(),
  treatmentPlanId: z.string().optional(),
  doctorId: z.string().optional(),
  bankAccountId: z.string().optional(),
  amount: z.number().min(1),
  vatRate: z.number().min(0).max(100).default(0),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'OTHER']).default('CASH'),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional(),
});

const paymentUpdateSchema = z.object({
  invoiceId: z.string().nullable().optional(),
  treatmentPlanId: z.string().nullable().optional(),
  doctorId: z.string().nullable().optional(),
  amount: z.number().min(1).optional(),
  vatRate: z.number().min(0).max(100).optional(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'OTHER']).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paidAt: z.string().optional(),
});

const paymentVoidSchema = z.object({
  voidReason: z.string().optional(),
});

const invoiceSchema = z.object({
  patientId: z.string(),
  number: z.string().optional(),
  total: z.number(),
  tax: z.number().optional(),
  discount: z.number().optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
});

async function recalcInvoiceStatus(invoiceId) {
  if (!invoiceId) return;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: {
        where: { deletedAt: null },
      },
    },
  });

  if (!invoice) return;

  const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const status = totalPaid >= invoice.netTotal ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'OPEN';

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status },
  });
}

function serializePaymentForAudit(payment) {
  if (!payment) return null;
  return {
    id: payment.id,
    patientId: payment.patientId,
    invoiceId: payment.invoiceId,
    treatmentPlanId: payment.treatmentPlanId,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    notes: payment.notes,
    paidAt: payment.paidAt,
    deletedAt: payment.deletedAt,
    deletedBy: payment.deletedBy,
    voidReason: payment.voidReason,
  };
}

// ======================= ORG-WIDE FINANCE =======================

// Finance summary (org-wide)
router.get('/summary', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [payments, invoices, paymentPlans] = await Promise.all([
      prisma.payment.findMany({
        where: { organizationId: user.organizationId, deletedAt: null },
        select: { amount: true, paidAt: true },
      }),
      prisma.invoice.findMany({
        where: { organizationId: user.organizationId },
        include: {
          payments: { where: { deletedAt: null }, select: { amount: true } },
        },
      }),
      prisma.paymentPlan.findMany({
        where: { organizationId: user.organizationId, status: 'ACTIVE' },
      }),
    ]);

    const totalCollections = payments.reduce((s, p) => s + p.amount, 0);
    const collectedToday = payments
      .filter((p) => p.paidAt >= todayStart && p.paidAt <= todayEnd)
      .reduce((s, p) => s + p.amount, 0);
    const collectedThisMonth = payments
      .filter((p) => p.paidAt >= monthStart)
      .reduce((s, p) => s + p.amount, 0);

    const pendingByInvoice = invoices
      .filter((i) => i.status === 'OPEN' || i.status === 'PARTIAL')
      .reduce((s, i) => {
        const paid = i.payments.reduce((a, p) => a + p.amount, 0);
        return s + Math.max(0, i.netTotal - paid);
      }, 0);

    const openInvoiceCount = invoices.filter((i) => i.status === 'OPEN' || i.status === 'PARTIAL').length;
    const activePaymentPlanCount = paymentPlans.length;

    res.json({
      totalCollections,
      pendingCollections: pendingByInvoice,
      collectedToday,
      collectedThisMonth,
      openInvoiceCount,
      activePaymentPlanCount,
    });
  } catch (error) {
    console.error('Error fetching finance summary:', error);
    res.status(500).json({ error: 'Failed to fetch finance summary' });
  }
});

// Org-wide financial movements
router.get('/movements', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const {
      patientId,
      doctorId,
      type,
      method,
      dateFrom,
      dateTo,
      status,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const result = await getOrganizationFinanceMovements({
      organizationId: user.organizationId,
      patientId: patientId || undefined,
      doctorId: doctorId || undefined,
      type: type || undefined,
      method: method || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      status: status || undefined,
      search: search || undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching finance movements:', error);
    res.status(500).json({ error: 'Failed to fetch finance movements' });
  }
});

// Pending collections (overdue installments, open invoices, etc.)
router.get('/pending-collections', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    const nearDueEnd = new Date();
    nearDueEnd.setDate(nearDueEnd.getDate() + 7);

    const [invoices, paymentPlans] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          organizationId: user.organizationId,
          status: { in: ['OPEN', 'PARTIAL'] },
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          payments: { where: { deletedAt: null }, select: { amount: true } },
        },
      }),
      prisma.paymentPlan.findMany({
        where: { organizationId: user.organizationId, status: 'ACTIVE' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          installments: {
            where: { status: 'PENDING' },
            orderBy: { dueDate: 'asc' },
          },
        },
      }),
    ]);

    const patientsWithBalance = invoices.map((inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, inv.netTotal - paid);
      return {
        patientId: inv.patientId,
        patientName: inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}`.trim() : '',
        source: `Fatura ${inv.number}`,
        amountDue: remaining,
        remaining,
        dueDate: inv.dueDate,
        type: 'invoice',
        invoiceId: inv.id,
      };
    }).filter((p) => p.amountDue > 0);

    const overdueInstallments = [];
    const nearDueInstallments = [];

    for (const plan of paymentPlans) {
      for (const inst of plan.installments) {
        const patientName = plan.patient ? `${plan.patient.firstName} ${plan.patient.lastName}`.trim() : '';
        const item = {
          id: inst.id,
          patientId: plan.patientId,
          patientName,
          amount: inst.amount,
          dueDate: inst.dueDate,
          paymentPlanId: plan.id,
        };
        if (inst.dueDate) {
          const d = new Date(inst.dueDate);
          if (d < now) {
            overdueInstallments.push(item);
          } else if (d <= nearDueEnd) {
            nearDueInstallments.push(item);
          }
        } else {
          nearDueInstallments.push(item);
        }
      }
    }

    res.json({
      patientsWithBalance,
      overdueInstallments,
      openInvoices: invoices,
      nearDueInstallments,
    });
  } catch (error) {
    console.error('Error fetching pending collections:', error);
    res.status(500).json({ error: 'Failed to fetch pending collections' });
  }
});

// Org-wide payment plans list
router.get('/payment-plans', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { patientId, page = '1', limit = '20' } = req.query;

    const where = { organizationId: user.organizationId };
    if (patientId) where.patientId = patientId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [plans, total] = await Promise.all([
      prisma.paymentPlan.findMany({
        where,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          installments: { orderBy: { dueDate: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit, 10),
        skip,
      }),
      prisma.paymentPlan.count({ where }),
    ]);

    res.json({
      paymentPlans: plans,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error('Error fetching payment plans:', error);
    res.status(500).json({ error: 'Failed to fetch payment plans' });
  }
});

// Patient payment summary
router.get('/patients/:patientId/summary', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { patientId } = req.params;

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { patientId, organizationId: user.organizationId },
        include: {
          payments: {
            where: { deletedAt: null },
          },
        },
      }),
      prisma.payment.findMany({
        where: { patientId, organizationId: user.organizationId, deletedAt: null },
      }),
    ]);

    const totalBilled = invoices.reduce((s, i) => s + i.netTotal, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const remaining = totalBilled - totalPaid;

    res.json({ totalBilled, totalPaid, remaining, invoices, payments });
  } catch (error) {
    console.error('Error fetching patient billing summary:', error);
    res.status(500).json({ error: 'Failed to fetch billing summary' });
  }
});

// List payments for a patient
router.get('/patients/:patientId/payments', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const payments = await prisma.payment.findMany({
      where: { patientId: req.params.patientId, organizationId: user.organizationId, deletedAt: null },
      include: {
        invoice: { select: { number: true, status: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: { paidAt: 'desc' },
    });
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Record a payment
router.post('/payments', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = paymentCreateSchema.parse(req.body);
    const clientInfo = getClientInfo(req);

    const payment = await prisma.$transaction(async (tx) => {
      const pm = await tx.payment.create({
        data: {
          ...validated,
          organizationId: user.organizationId,
          paidAt: validated.paidAt ? new Date(validated.paidAt) : new Date(),
        },
        include: {
          doctor: { select: { id: true, name: true } },
        },
      });

      await tx.financialMovement.create({
        data: {
          organizationId: user.organizationId,
          type: 'PAYMENT',
          sourceType: 'PAYMENT',
          sourceId: pm.id,
          patientId: validated.patientId,
          doctorId: validated.doctorId || null,
          bankAccountId: validated.bankAccountId || null,
          description: validated.notes || 'Hasta ödemesi',
          amount: validated.amount,
          vatRate: validated.vatRate || 0,
          paymentMethod: validated.method,
          occurredAt: pm.paidAt,
          reference: validated.reference,
          status: 'ACTIVE'
        }
      });

      return pm;
    });

    // Update invoice status if linked
    await recalcInvoiceStatus(validated.invoiceId);

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'Payment',
      entityId: payment.id,
      changes: { after: serializePaymentForAudit(payment) },
      ...clientInfo,
    });

    const patient = await prisma.patient.findUnique({
      where: { id: validated.patientId },
      select: { firstName: true, lastName: true },
    });

    await prisma.activityLog.create({
      data: {
        organizationId: user.organizationId,
        eventType: 'payment_received',
        actorUserId: user.id,
        patientId: validated.patientId,
        entityType: 'Payment',
        entityId: payment.id,
        summary: `Ödeme alındı: ${patient ? `${patient.firstName} ${patient.lastName}` : ''} - ${(validated.amount / 100).toLocaleString('tr-TR')} TL`,
        metadata: { method: validated.method, amount: validated.amount },
      },
    });

    res.json({ payment });
  } catch (error) {
    console.error('Error recording payment:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Update payment
router.put('/payments/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = paymentUpdateSchema.parse(req.body);
    const clientInfo = getClientInfo(req);

    const existing = await prisma.payment.findFirst({
      where: { id: req.params.id, organizationId: user.organizationId, deletedAt: null },
    });

    if (!existing) return res.status(404).json({ error: 'Payment not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: existing.id },
        data: {
          ...(validated.invoiceId !== undefined && { invoiceId: validated.invoiceId || null }),
          ...(validated.treatmentPlanId !== undefined && { treatmentPlanId: validated.treatmentPlanId || null }),
          ...(validated.doctorId !== undefined && { doctorId: validated.doctorId || null }),
          ...(validated.amount !== undefined && { amount: validated.amount }),
          ...(validated.vatRate !== undefined && { vatRate: validated.vatRate }),
          ...(validated.method !== undefined && { method: validated.method }),
          ...(validated.reference !== undefined && { reference: validated.reference || null }),
          ...(validated.notes !== undefined && { notes: validated.notes || null }),
          ...(validated.paidAt !== undefined && { paidAt: validated.paidAt ? new Date(validated.paidAt) : existing.paidAt }),
        },
        include: {
          invoice: { select: { id: true, number: true, status: true } },
          doctor: { select: { id: true, name: true } },
        },
      });

      const existingMovement = await tx.financialMovement.findFirst({
        where: { sourceType: 'PAYMENT', sourceId: existing.id }
      });

      if (existingMovement) {
        await tx.financialMovement.update({
          where: { id: existingMovement.id },
          data: {
            doctorId: validated.doctorId !== undefined ? (validated.doctorId || null) : existingMovement.doctorId,
            description: validated.notes !== undefined ? (validated.notes || existingMovement.description) : existingMovement.description,
            amount: validated.amount !== undefined ? validated.amount : existingMovement.amount,
            vatRate: validated.vatRate !== undefined ? validated.vatRate : existingMovement.vatRate,
            paymentMethod: validated.method !== undefined ? validated.method : existingMovement.paymentMethod,
            occurredAt: p.paidAt,
            reference: validated.reference !== undefined ? (validated.reference || null) : existingMovement.reference,
          }
        });
      }

      return p;
    });

    if (existing.invoiceId !== updated.invoiceId) {
      await recalcInvoiceStatus(existing.invoiceId);
    }
    await recalcInvoiceStatus(updated.invoiceId);

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Payment',
      entityId: updated.id,
      changes: {
        before: serializePaymentForAudit(existing),
        after: serializePaymentForAudit(updated),
      },
      ...clientInfo,
    });

    await prisma.activityLog.create({
      data: {
        organizationId: user.organizationId,
        eventType: 'payment_updated',
        actorUserId: user.id,
        patientId: updated.patientId,
        entityType: 'Payment',
        entityId: updated.id,
        summary: `Ödeme güncellendi - ${(updated.amount / 100).toLocaleString('tr-TR')} TL`,
        metadata: {
          amount: updated.amount,
          method: updated.method,
          invoiceId: updated.invoiceId,
        },
      },
    });

    res.json({ payment: updated });
  } catch (error) {
    console.error('Error updating payment:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Soft-delete / void payment
router.delete('/payments/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = paymentVoidSchema.parse(req.body || {});
    const clientInfo = getClientInfo(req);

    const existing = await prisma.payment.findFirst({
      where: { id: req.params.id, organizationId: user.organizationId, deletedAt: null },
    });

    if (!existing) return res.status(404).json({ error: 'Payment not found' });

    const deleted = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
          deletedBy: user.id,
          voidReason: validated.voidReason || null,
        },
      });

      const existingMovement = await tx.financialMovement.findFirst({
        where: { sourceType: 'PAYMENT', sourceId: existing.id }
      });

      if (existingMovement) {
        await tx.financialMovement.update({
          where: { id: existingMovement.id },
          data: { status: 'VOIDED' }
        });
      }

      return p;
    });

    await recalcInvoiceStatus(existing.invoiceId);

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'Payment',
      entityId: deleted.id,
      changes: {
        before: serializePaymentForAudit(existing),
        after: serializePaymentForAudit(deleted),
      },
      ...clientInfo,
    });

    await prisma.activityLog.create({
      data: {
        organizationId: user.organizationId,
        eventType: 'payment_voided',
        actorUserId: user.id,
        patientId: deleted.patientId,
        entityType: 'Payment',
        entityId: deleted.id,
        summary: `Ödeme iptal edildi - ${(deleted.amount / 100).toLocaleString('tr-TR')} TL`,
        metadata: {
          amount: deleted.amount,
          method: deleted.method,
          voidReason: deleted.voidReason,
        },
      },
    });

    res.json({ payment: deleted });
  } catch (error) {
    console.error('Error deleting payment:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// List invoices
router.get('/invoices', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { patientId, status, page = '1', limit = '20' } = req.query;

    const where = { organizationId: user.organizationId };
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          payments: {
            where: { deletedAt: null },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      prisma.invoice.count({ where }),
    ]);
    res.json({ invoices, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// ======================= PAYMENT PLANS =======================

const paymentPlanCreateSchema = z.object({
  patientId: z.string(),
  totalAmount: z.number().min(1),
  notes: z.string().optional(),
  installments: z.array(
    z.object({
      amount: z.number().min(1),
      dueDate: z.string(),
    })
  ).min(1),
});

// Create Payment Plan
router.post('/payment-plans', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = paymentPlanCreateSchema.parse(req.body);

    const paymentPlan = await prisma.paymentPlan.create({
      data: {
        organizationId: user.organizationId,
        patientId: validated.patientId,
        totalAmount: validated.totalAmount,
        notes: validated.notes || null,
        installments: {
          create: validated.installments.map(inst => ({
            amount: inst.amount,
            dueDate: new Date(inst.dueDate),
            status: 'PENDING',
          })),
        },
      },
      include: {
        installments: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        organizationId: user.organizationId,
        eventType: 'payment_plan_created',
        actorUserId: user.id,
        patientId: validated.patientId,
        entityType: 'PaymentPlan',
        entityId: paymentPlan.id,
        summary: `Yeni ödeme planı oluşturuldu - Toplam: ${(validated.totalAmount / 100).toLocaleString('tr-TR')} TL`,
        metadata: {
          totalAmount: validated.totalAmount,
          installmentCount: validated.installments.length,
        },
      },
    });

    res.status(201).json({ paymentPlan });
  } catch (error) {
    console.error('Error creating payment plan:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create payment plan' });
  }
});

// Get Payment Plans for Patient
router.get('/payment-plans/patient/:patientId', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { patientId } = req.params;

    const paymentPlans = await prisma.paymentPlan.findMany({
      where: {
        organizationId: user.organizationId,
        patientId: patientId,
      },
      include: {
        installments: {
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ paymentPlans });
  } catch (error) {
    console.error('Error fetching payment plans:', error);
    res.status(500).json({ error: 'Failed to fetch payment plans' });
  }
});

const paymentPlanEditSchema = z.object({
  installments: z.array(
    z.object({
      id: z.string().optional(),
      amount: z.number().min(0),
      dueDate: z.string().nullable().optional(),
      status: z.enum(['PENDING', 'PAID', 'CANCELLED']),
    })
  ).min(1),
});

// Edit Payment Plan
router.put('/payment-plans/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const validated = paymentPlanEditSchema.parse(req.body);

    const existingPlan = await prisma.paymentPlan.findUnique({
      where: { id, organizationId: user.organizationId },
      include: { installments: true },
    });

    if (!existingPlan) {
      return res.status(404).json({ error: 'Payment plan not found' });
    }

    const payloadInstallmentIds = validated.installments.map(i => i.id).filter(Boolean);
    const installmentsToDelete = existingPlan.installments.filter(i => !payloadInstallmentIds.includes(i.id));

    // Calculate new total amount based on the provided active installments
    const newTotalAmount = validated.installments.reduce((sum, inst) => sum + inst.amount, 0);

    const updatedPlan = await prisma.$transaction(async (tx) => {
      // 1. Delete rows not in the payload
      for (const toDelete of installmentsToDelete) {
        await tx.installment.delete({
          where: { id: toDelete.id }
        });
      }

      // 2. Upsert the payload rows
      for (const inst of validated.installments) {
        if (inst.id) {
          await tx.installment.update({
            where: { id: inst.id },
            data: {
              amount: inst.amount,
              dueDate: inst.dueDate ? new Date(inst.dueDate) : null,
              status: inst.status
            }
          });
        } else {
          await tx.installment.create({
            data: {
              paymentPlanId: id,
              amount: inst.amount,
              dueDate: inst.dueDate ? new Date(inst.dueDate) : null,
              status: inst.status
            }
          });
        }
      }

      // 3. Update the master plan
      return await tx.paymentPlan.update({
        where: { id },
        data: {
          totalAmount: newTotalAmount,
        },
        include: {
          installments: {
            orderBy: { dueDate: 'asc' },
          }
        }
      });
    });

    res.json({ paymentPlan: updatedPlan });
  } catch (error) {
    console.error('Error updating payment plan:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to update payment plan' });
  }
});

// ======================= FINANCE REPORT ENDPOINTS =======================

// Patient Income List (Hasta Gelir Listesi) - Section 6
router.get('/patient-income', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { doctorId, method, dateFrom, dateTo, search, page = '1', limit = '20' } = req.query;
    const where = {
      organizationId: user.organizationId,
      deletedAt: null,
      isRefund: false,
    };
    if (doctorId) where.doctorId = doctorId;
    if (method) where.method = method;
    if (dateFrom || dateTo) {
      where.paidAt = {};
      if (dateFrom) where.paidAt.gte = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); where.paidAt.lte = d; }
    }
    if (search) {
      where.OR = [
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { reference: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [payments, total, agg] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { id: true, name: true } },
          invoice: { select: { id: true, number: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: parseInt(limit, 10),
        skip,
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true }),
    ]);
    res.json({
      payments,
      pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
      stats: { totalAmount: agg._sum.amount || 0, count: agg._count || 0 },
    });
  } catch (error) {
    console.error('Error fetching patient income:', error);
    res.status(500).json({ error: 'Failed to fetch patient income' });
  }
});

// Patient Refund List (Hasta İade Listesi) - Section 7
router.get('/patient-refunds', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { dateFrom, dateTo, search, page = '1', limit = '20' } = req.query;
    const where = {
      organizationId: user.organizationId,
      deletedAt: null,
      isRefund: true,
    };
    if (dateFrom || dateTo) {
      where.paidAt = {};
      if (dateFrom) where.paidAt.gte = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); where.paidAt.lte = d; }
    }
    if (search) {
      where.OR = [
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [payments, total, agg] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { id: true, name: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: parseInt(limit, 10),
        skip,
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({ where, _sum: { amount: true }, _count: true }),
    ]);
    res.json({
      refunds: payments,
      pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
      stats: { totalRefundAmount: agg._sum.amount || 0, refundCount: agg._count || 0 },
    });
  } catch (error) {
    console.error('Error fetching patient refunds:', error);
    res.status(500).json({ error: 'Failed to fetch patient refunds' });
  }
});

// Debtor Patient List (Borçlu Hasta Listesi) - Section 8
router.get('/debtor-patients', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { search, page = '1', limit = '50' } = req.query;
    const patientWhere = { organizationId: user.organizationId };
    if (search) {
      patientWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const patients = await prisma.patient.findMany({
      where: patientWhere,
      include: {
        treatmentPlans: {
          select: {
            id: true, totalPrice: true, status: true,
            items: { select: { id: true, price: true, quantity: true, status: true, assignedDoctorId: true, completedAt: true } },
          }
        },
        payments: {
          where: { deletedAt: null, isRefund: false },
          select: { id: true, amount: true, paidAt: true, doctorId: true }
        },
        appointments: {
          select: { id: true, startAt: true, status: true },
          orderBy: { startAt: 'desc' },
          take: 2,
        },
        primaryDoctor: { include: { user: { select: { name: true } } } },
      },
    });

    const debtors = patients.map(p => {
      const totalPlanned = p.treatmentPlans.reduce((s, tp) => s + tp.totalPrice, 0);
      const performedCost = p.treatmentPlans.reduce((s, tp) => s + tp.items.filter(i => i.status === 'COMPLETED').reduce((is, i) => is + (i.price * i.quantity), 0), 0);
      const totalPaid = p.payments.reduce((s, pay) => s + pay.amount, 0);
      const balance = totalPlanned - totalPaid;
      const lastPayment = p.payments.length > 0 ? p.payments.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0] : null;
      const lastAppt = p.appointments[0] || null;
      const nextAppt = p.appointments.find(a => new Date(a.startAt) > new Date() && a.status === 'SCHEDULED');
      return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        totalPlanned,
        performedCost,
        totalPaid,
        balance,
        lastPaymentDate: lastPayment?.paidAt || null,
        lastAppointmentDate: lastAppt?.startAt || null,
        nextAppointmentDate: nextAppt?.startAt || null,
        doctor: p.primaryDoctor?.user?.name || null,
        treatmentStatus: p.treatmentPlans.length > 0 ? p.treatmentPlans[0].status : null,
      };
    }).filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance);

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paged = debtors.slice(skip, skip + parseInt(limit, 10));
    const totalDebt = debtors.reduce((s, p) => s + p.balance, 0);
    const totalPaidAll = debtors.reduce((s, p) => s + p.totalPaid, 0);
    const totalPerformed = debtors.reduce((s, p) => s + p.performedCost, 0);

    res.json({
      patients: paged,
      pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: debtors.length, pages: Math.ceil(debtors.length / parseInt(limit, 10)) },
      stats: { totalDebt, totalPaid: totalPaidAll, totalPerformed, debtorCount: debtors.length },
    });
  } catch (error) {
    console.error('Error fetching debtor patients:', error);
    res.status(500).json({ error: 'Failed to fetch debtor patients' });
  }
});

// Debtor Treatment List (Borçlu Tedavi Listesi) - Section 9
router.get('/debtor-treatments', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { search, page = '1', limit = '50' } = req.query;

    const plans = await prisma.treatmentPlan.findMany({
      where: { organizationId: user.organizationId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, name: true } },
        items: { select: { id: true, name: true, price: true, quantity: true, status: true, completedAt: true } },
        payments: { where: { deletedAt: null, isRefund: false }, select: { amount: true } },
      },
    });

    let treatments = [];
    for (const plan of plans) {
      const totalCost = plan.totalPrice;
      const performedCost = plan.items.filter(i => i.status === 'COMPLETED').reduce((s, i) => s + (i.price * i.quantity), 0);
      const totalPaid = plan.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = totalCost - totalPaid;
      if (remaining <= 0) continue;

      if (search) {
        const q = search.toLowerCase();
        const name = `${plan.patient.firstName} ${plan.patient.lastName}`.toLowerCase();
        const title = plan.title.toLowerCase();
        if (!name.includes(q) && !title.includes(q)) continue;
      }

      treatments.push({
        id: plan.id,
        title: plan.title,
        status: plan.status,
        patientId: plan.patient.id,
        patientName: `${plan.patient.firstName} ${plan.patient.lastName}`,
        doctorName: plan.doctor?.name || null,
        totalCost,
        performedCost,
        totalPaid,
        remaining,
        createdAt: plan.createdAt,
        itemCount: plan.items.length,
        completedItems: plan.items.filter(i => i.status === 'COMPLETED').length,
      });
    }
    treatments.sort((a, b) => b.remaining - a.remaining);

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paged = treatments.slice(skip, skip + parseInt(limit, 10));
    const totalRemaining = treatments.reduce((s, t) => s + t.remaining, 0);

    res.json({
      treatments: paged,
      pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: treatments.length, pages: Math.ceil(treatments.length / parseInt(limit, 10)) },
      stats: { totalRemaining, treatmentCount: treatments.length, totalCost: treatments.reduce((s, t) => s + t.totalCost, 0), totalPaid: treatments.reduce((s, t) => s + t.totalPaid, 0), totalPerformed: treatments.reduce((s, t) => s + t.performedCost, 0) },
    });
  } catch (error) {
    console.error('Error fetching debtor treatments:', error);
    res.status(500).json({ error: 'Failed to fetch debtor treatments' });
  }
});

// Patient Credit List / Overpayment (Hasta Alacak Listesi) - Section 10
router.get('/credit-patients', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { search, page = '1', limit = '50' } = req.query;

    const patients = await prisma.patient.findMany({
      where: { organizationId: user.organizationId },
      include: {
        treatmentPlans: { select: { totalPrice: true, status: true } },
        payments: { where: { deletedAt: null, isRefund: false }, select: { amount: true, paidAt: true, doctorId: true } },
        appointments: { select: { startAt: true, status: true }, orderBy: { startAt: 'desc' }, take: 2 },
        primaryDoctor: { include: { user: { select: { name: true } } } },
      },
    });

    let credits = patients.map(p => {
      const totalPlanned = p.treatmentPlans.reduce((s, tp) => s + tp.totalPrice, 0);
      const totalPaid = p.payments.reduce((s, pay) => s + pay.amount, 0);
      const creditBalance = totalPaid - totalPlanned;
      const lastAppt = p.appointments[0] || null;
      const nextAppt = p.appointments.find(a => new Date(a.startAt) > new Date() && a.status === 'SCHEDULED');
      return {
        id: p.id, firstName: p.firstName, lastName: p.lastName,
        totalPlanned, totalPaid, creditBalance,
        lastAppointmentDate: lastAppt?.startAt || null,
        nextAppointmentDate: nextAppt?.startAt || null,
        doctor: p.primaryDoctor?.user?.name || null,
        treatmentStatus: p.treatmentPlans.length > 0 ? p.treatmentPlans[0].status : null,
      };
    }).filter(p => p.creditBalance > 0);

    if (search) {
      const q = search.toLowerCase();
      credits = credits.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q));
    }
    credits.sort((a, b) => b.creditBalance - a.creditBalance);

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paged = credits.slice(skip, skip + parseInt(limit, 10));
    const totalCredit = credits.reduce((s, p) => s + p.creditBalance, 0);

    res.json({
      patients: paged,
      pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: credits.length, pages: Math.ceil(credits.length / parseInt(limit, 10)) },
      stats: { totalCredit, creditCount: credits.length },
    });
  } catch (error) {
    console.error('Error fetching credit patients:', error);
    res.status(500).json({ error: 'Failed to fetch credit patients' });
  }
});

// End of Day (Gün Sonu) - Section 12
router.get('/end-of-day', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

    const [appointments, payments, treatments, invoices, movements] = await Promise.all([
      prisma.appointment.findMany({
        where: { organizationId: user.organizationId, startAt: { gte: dayStart, lte: dayEnd } },
        include: { patient: { select: { firstName: true, lastName: true } }, doctor: { select: { name: true } } },
        orderBy: { startAt: 'asc' },
      }),
      prisma.payment.findMany({
        where: { organizationId: user.organizationId, paidAt: { gte: dayStart, lte: dayEnd }, deletedAt: null },
        include: { patient: { select: { firstName: true, lastName: true } }, doctor: { select: { name: true } } },
        orderBy: { paidAt: 'asc' },
      }),
      prisma.treatmentItem.findMany({
        where: { organizationId: user.organizationId, completedAt: { gte: dayStart, lte: dayEnd }, status: 'COMPLETED' },
        include: { plan: { include: { patient: { select: { firstName: true, lastName: true } } } }, assignedDoctor: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        where: { organizationId: user.organizationId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: { patient: { select: { firstName: true, lastName: true } } },
      }),
      prisma.financialMovement.findMany({
        where: { organizationId: user.organizationId, occurredAt: { gte: dayStart, lte: dayEnd }, status: 'ACTIVE' },
        include: { patient: { select: { firstName: true, lastName: true } }, currentAccount: { select: { name: true } } },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);

    const totalCollected = payments.filter(p => !p.isRefund).reduce((s, p) => s + p.amount, 0);
    const totalRefunded = payments.filter(p => p.isRefund).reduce((s, p) => s + p.amount, 0);
    const cashPayments = payments.filter(p => p.method === 'CASH' && !p.isRefund).reduce((s, p) => s + p.amount, 0);
    const cardPayments = payments.filter(p => p.method === 'CARD' && !p.isRefund).reduce((s, p) => s + p.amount, 0);
    const bankPayments = payments.filter(p => p.method === 'BANK_TRANSFER' && !p.isRefund).reduce((s, p) => s + p.amount, 0);
    const treatmentTotal = treatments.reduce((s, t) => s + (t.price * t.quantity), 0);
    const invoiceTotal = invoices.reduce((s, i) => s + i.netTotal, 0);

    res.json({
      date: dayStart.toISOString().split('T')[0],
      appointments,
      payments,
      treatments: treatments.map(t => ({
        id: t.id, name: t.name, price: t.price, quantity: t.quantity,
        patientName: t.plan?.patient ? `${t.plan.patient.firstName} ${t.plan.patient.lastName}` : null,
        doctorName: t.assignedDoctor?.name || null,
        completedAt: t.completedAt,
      })),
      invoices,
      movements,
      stats: {
        appointmentCount: appointments.length,
        completedAppointments: appointments.filter(a => a.status === 'COMPLETED').length,
        paymentCount: payments.filter(p => !p.isRefund).length,
        totalCollected,
        totalRefunded,
        netCollected: totalCollected - totalRefunded,
        cashPayments,
        cardPayments,
        bankPayments,
        treatmentCount: treatments.length,
        treatmentTotal,
        invoiceCount: invoices.length,
        invoiceTotal,
        movementCount: movements.length,
      },
    });
  } catch (error) {
    console.error('Error fetching end of day:', error);
    res.status(500).json({ error: 'Failed to fetch end of day data' });
  }
});

module.exports = router;
