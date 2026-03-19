const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { createAuditLog } = require('../lib/audit');
const { getCurrentUser } = require('../middleware/auth');

const appointmentSchema = z.object({
  // Either patientId (existing) or guest fields (unregistered) — at least one required
  patientId: z.string().optional(),
  guestFirstName: z.string().optional(),
  guestLastName: z.string().optional(),
  guestPhone: z.string().optional(),
  doctorUserId: z.string().optional(),
  startAt: z.string(),
  endAt: z.string(),
  appointmentType: z.string().min(1, 'İşlem seçimi zorunludur'),
  reason: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  isUrgent: z.boolean().optional(),
}).refine(
  (data) => data.patientId || data.guestFirstName,
  { message: 'Either patientId or guestFirstName is required' }
);

const appointmentUpdateSchema = z.object({
  patientId: z.string().nullable().optional(),
  guestFirstName: z.string().nullable().optional(),
  guestLastName: z.string().nullable().optional(),
  guestPhone: z.string().nullable().optional(),
  doctorUserId: z.string().nullable().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  appointmentType: z.string().optional(),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().optional(),
  isUrgent: z.boolean().optional(),
});

// Shared include for appointment queries
const appointmentInclude = {
  patient: {
    select: { id: true, firstName: true, lastName: true, phone: true },
  },
  doctor: {
    select: { id: true, name: true },
  },
};

// Get all appointments
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate, doctorUserId } = req.query;

    const where = { organizationId: user.organizationId };

    if (user.branchId) {
      where.branchId = user.branchId;
    }

    if (startDate && endDate) {
      where.startAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (doctorUserId) {
      where.doctorUserId = doctorUserId;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { startAt: 'asc' },
    });

    res.json({ appointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get single appointment
router.get('/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        ...(user.branchId && { branchId: user.branchId }),
      },
      include: appointmentInclude,
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ appointment });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Create appointment
router.post('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const validated = appointmentSchema.parse(req.body);

    const isNewPatient = !validated.patientId && (validated.guestFirstName || validated.guestLastName);

    const result = await prisma.$transaction(async (tx) => {
      let patientId = validated.patientId || null;

      // Auto-create Patient when guest fields are used (new-patient booking)
      if (isNewPatient) {
        const patient = await tx.patient.create({
          data: {
            organizationId: user.organizationId,
            branchId: user.branchId || null,
            firstName: validated.guestFirstName || 'İsimsiz',
            lastName: validated.guestLastName || '',
            phone: validated.guestPhone || null,
          },
        });
        patientId = patient.id;

        await tx.activityLog.create({
          data: {
            organizationId: user.organizationId,
            eventType: 'patient_created',
            actorUserId: user.id,
            patientId: patient.id,
            entityType: 'Patient',
            entityId: patient.id,
            summary: `Randevu ile yeni hasta kaydı oluşturuldu: ${patient.firstName} ${patient.lastName}`,
          },
        });
      }

      const appointment = await tx.appointment.create({
        data: {
          organizationId: user.organizationId,
          branchId: user.branchId || null,
          patientId,
          doctorUserId: validated.doctorUserId || null,
          startAt: new Date(validated.startAt),
          endAt: new Date(validated.endAt),
          appointmentType: validated.appointmentType || 'CONSULTATION',
          reason: validated.reason || null,
          notes: validated.notes || null,
          status: validated.status || 'SCHEDULED',
          isUrgent: validated.isUrgent ?? false,
        },
        include: appointmentInclude,
      });

      return appointment;
    });

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'CREATE',
      entity: 'Appointment',
      entityId: result.id,
    });

    res.json({ appointment: result });
  } catch (error) {
    console.error('Error creating appointment:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment (full or partial) — supports both PUT and PATCH
async function updateAppointment(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    const validated = appointmentUpdateSchema.parse(req.body);

    const existing = await prisma.appointment.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        ...(validated.patientId !== undefined && { patientId: validated.patientId }),
        ...(validated.guestFirstName !== undefined && { guestFirstName: validated.guestFirstName }),
        ...(validated.guestLastName !== undefined && { guestLastName: validated.guestLastName }),
        ...(validated.guestPhone !== undefined && { guestPhone: validated.guestPhone }),
        ...(validated.doctorUserId !== undefined && { doctorUserId: validated.doctorUserId }),
        ...(validated.startAt && { startAt: new Date(validated.startAt) }),
        ...(validated.endAt && { endAt: new Date(validated.endAt) }),
        ...(validated.appointmentType && { appointmentType: validated.appointmentType }),
        ...(validated.reason !== undefined && { reason: validated.reason }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
        ...(validated.status && { status: validated.status }),
        ...(validated.isUrgent !== undefined && { isUrgent: validated.isUrgent }),
      },
      include: appointmentInclude,
    });

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'UPDATE',
      entity: 'Appointment',
      entityId: appointment.id,
    });

    res.json({ appointment });
  } catch (error) {
    console.error('Error updating appointment:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update appointment' });
  }
}

router.put('/:id', getCurrentUser, updateAppointment);
router.patch('/:id', getCurrentUser, updateAppointment);

// Delete appointment
router.delete('/:id', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    await prisma.appointment.delete({ where: { id } });

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'DELETE',
      entity: 'Appointment',
      entityId: id,
    });

    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

module.exports = router;
