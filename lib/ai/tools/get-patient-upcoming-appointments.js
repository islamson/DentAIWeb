/**
 * get_patient_upcoming_appointments - Get patient's upcoming appointments.
 * Read-only. Uses Appointment model.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_patient_upcoming_appointments',
  description: 'Get patient upcoming appointments (startAt >= today).',
  requiredPermission: 'APPOINTMENT_READ',
  async execute(ctx, params) {
    const { patientId, limit = 10 } = params;
    if (!patientId) return { error: 'patientId required' };

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId: ctx.organizationId },
      select: { firstName: true, lastName: true },
    });
    if (!patient) return { error: 'Hasta bulunamadı.' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        organizationId: ctx.organizationId,
        patientId,
        startAt: { gte: today },
        status: { notIn: ['CANCELLED'] },
      },
      include: {
        doctor: { select: { name: true } },
      },
      orderBy: { startAt: 'asc' },
      take: Math.min(limit, 20),
    });

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      appointments: appointments.map((a) => ({
        startAt: a.startAt,
        status: a.status,
        reason: a.reason,
        doctor: a.doctor?.name,
      })),
      count: appointments.length,
    };
  },
});
