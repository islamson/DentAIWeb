const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { createAuditLog } = require('../lib/audit');
const { getPatientFinanceLedger } = require('../lib/patient-finance-ledger');
const { getCurrentUser } = require('../middleware/auth');

const patientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  nationalId: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  primaryDoctorId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Get all patients with search, pagination, and finance summary
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const search = req.query.search || '';
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    const skip = (page - 1) * limit;
    const doctorId = req.query.doctorId;

    const where = { organizationId: user.organizationId };
    if (user.branchId) where.branchId = user.branchId;
    if (doctorId) where.primaryDoctorId = doctorId;

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search } },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: {
          primaryDoctor: {
            include: { user: { select: { id: true, name: true } } },
          },
          appointments: {
            orderBy: { startAt: 'desc' },
            take: 1,
            select: { startAt: true, status: true },
          },
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patient.count({ where }),
    ]);

    // Enrich with finance summary
    const patientIds = patients.map((p) => p.id);
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { patientId: { in: patientIds }, organizationId: user.organizationId },
        select: { patientId: true, netTotal: true },
      }),
      prisma.payment.findMany({
        where: { patientId: { in: patientIds }, organizationId: user.organizationId, deletedAt: null },
        select: { patientId: true, amount: true },
      }),
    ]);

    const billedByPatient = invoices.reduce((acc, inv) => {
      acc[inv.patientId] = (acc[inv.patientId] || 0) + inv.netTotal;
      return acc;
    }, {});

    const paidByPatient = payments.reduce((acc, pay) => {
      acc[pay.patientId] = (acc[pay.patientId] || 0) + pay.amount;
      return acc;
    }, {});

    const enriched = patients.map((p) => ({
      ...p,
      financeSummary: {
        totalBilled: billedByPatient[p.id] || 0,
        totalPaid: paidByPatient[p.id] || 0,
        remaining: Math.max(0, (billedByPatient[p.id] || 0) - (paidByPatient[p.id] || 0)),
      },
      lastAppointment: p.appointments[0] || null,
    }));

    res.json({ patients: enriched, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Get single patient with full relations
router.get('/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const patient = await prisma.patient.findFirst({
      where: { id, organizationId: user.organizationId, ...(user.branchId && { branchId: user.branchId }) },
      include: {
        organization: { select: { id: true, name: true, taxNo: true } },
        branch: { select: { id: true, name: true, address: true, phone: true } },
        primaryDoctor: { include: { user: { select: { id: true, name: true, email: true } } } },
        appointments: {
          include: {},
          orderBy: { startAt: 'desc' },
          take: 10,
        },
        treatmentPlans: {
          include: {
            doctor: { select: { id: true, name: true } },
            planSessions: {
              include: {
                doctor: { select: { id: true, name: true } },
                assignedItems: {
                  include: {
                    teeth: true,
                    assignedDoctor: { select: { id: true, name: true } },
                  },
                },
              },
              orderBy: { sessionDate: 'asc' },
            },
            items: {
              where: { parentItemId: null },
              include: {
                teeth: true,
                assignedDoctor: { select: { id: true, name: true } },
                planSession: { select: { id: true, sessionDate: true } },
                sessions: {
                  where: { treatmentItemId: { not: null } },
                  include: { doctor: { select: { id: true, name: true } } },
                  orderBy: { sessionDate: 'asc' },
                },
                children: {
                  include: {
                    teeth: true,
                    assignedDoctor: { select: { id: true, name: true } },
                    planSession: { select: { id: true, sessionDate: true } },
                    sessions: {
                      include: { doctor: { select: { id: true, name: true } } },
                      orderBy: { sessionDate: 'asc' },
                    },
                  },
                  orderBy: { createdAt: 'asc' },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          include: {
            payments: {
              where: { deletedAt: null },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        patientNotes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        patientCommunications: {
          include: { createdByUser: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        patientForms: { orderBy: { createdAt: 'desc' } },
        perioChartEntries: { orderBy: [{ recordedAt: 'desc' }, { toothNumber: 'asc' }] },
      },
    });

    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Finance summary — fetch ALL patient payments (including non-invoice-linked ones)
    const allPayments = await prisma.payment.findMany({
      where: { patientId: id, organizationId: user.organizationId, deletedAt: null },
      include: { invoice: { select: { id: true, number: true, status: true } } },
      orderBy: { paidAt: 'desc' },
    });

    const financeLedger = await getPatientFinanceLedger({
      organizationId: user.organizationId,
      patientId: id,
    });

    res.json({
      patient: {
        ...patient,
        payments: allPayments,
        financeLedger: financeLedger.movements,
        financeSummary: {
          totalTreatmentCost: financeLedger.summary.totalTreatmentCost,
          totalBilled: financeLedger.summary.totalTreatmentCost,
          totalPaid: financeLedger.summary.totalPaid,
          remaining: financeLedger.summary.remaining,
          treatmentMovementCount: financeLedger.summary.treatmentMovementCount,
          paymentCount: financeLedger.summary.paymentCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// Create patient
router.post('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = patientSchema.parse(req.body);

    const patient = await prisma.patient.create({
      data: {
        ...validated,
        organizationId: user.organizationId,
        branchId: user.branchId || null,
        birthDate: validated.birthDate ? new Date(validated.birthDate) : null,
        email: validated.email || null,
        tags: validated.tags || [],
      },
    });

    await createAuditLog({ organizationId: user.organizationId, userId: user.id, action: 'CREATE', entity: 'Patient', entityId: patient.id });

    await prisma.activityLog.create({
      data: {
        organizationId: user.organizationId,
        eventType: 'patient_created',
        actorUserId: user.id,
        patientId: patient.id,
        entityType: 'Patient',
        entityId: patient.id,
        summary: `Yeni hasta kaydı oluşturuldu: ${patient.firstName} ${patient.lastName}`,
      },
    });

    res.json({ patient });
  } catch (error) {
    console.error('Error creating patient:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// Update patient
router.put('/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const validated = patientSchema.partial().parse(req.body);

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        ...validated,
        ...(validated.birthDate !== undefined && { birthDate: validated.birthDate ? new Date(validated.birthDate) : null }),
        ...(validated.email !== undefined && { email: validated.email || null }),
      },
    });

    await createAuditLog({ organizationId: user.organizationId, userId: user.id, action: 'UPDATE', entity: 'Patient', entityId: patient.id });

    await prisma.activityLog.create({
      data: {
        organizationId: user.organizationId,
        eventType: 'patient_updated',
        actorUserId: user.id,
        patientId: patient.id,
        entityType: 'Patient',
        entityId: patient.id,
        summary: `Hasta kaydı güncellendi: ${patient.firstName} ${patient.lastName}`,
      },
    });

    res.json({ patient });
  } catch (error) {
    console.error('Error updating patient:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: error.errors });
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// Delete patient
router.delete('/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    await prisma.patient.delete({ where: { id } });
    await createAuditLog({ organizationId: user.organizationId, userId: user.id, action: 'DELETE', entity: 'Patient', entityId: id });
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

module.exports = router;
