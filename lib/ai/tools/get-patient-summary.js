/**
 * get_patient_summary - Get summary for a specific patient.
 * Phase 1: Read-only stub implementation.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_patient_summary',
  description: 'Get summary for a patient by ID: basic info, last appointment, treatment plan status.',
  requiredPermission: 'PATIENT_READ',
  async execute(ctx, params) {
    const { patientId } = params;
    if (!patientId) return { error: 'patientId required' };

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        organizationId: ctx.organizationId,
        ...(ctx.branchId && { branchId: ctx.branchId }),
      },
      include: {
        primaryDoctor: { include: { user: { select: { name: true } } } },
        appointments: {
          orderBy: { startAt: 'desc' },
          take: 1,
          select: { startAt: true, status: true, reason: true },
        },
        treatmentPlans: {
          where: { isActive: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { title: true, status: true, totalPrice: true, completedTotal: true },
        },
      },
    });

    if (!patient) return { error: 'Patient not found' };

    return {
      patient: {
        id: patient.id,
        name: `${patient.firstName} ${patient.lastName}`,
        phone: patient.phone,
        email: patient.email,
        primaryDoctor: patient.primaryDoctor?.user?.name,
        lastAppointment: patient.appointments[0] || null,
        activePlan: patient.treatmentPlans[0] || null,
      },
    };
  },
});
