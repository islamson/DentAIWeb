/**
 * Patient appointment context pack - scoped to single patient.
 */

const { prisma } = require('../../prisma');

async function buildPatientAppointmentContext(ctx, params) {
  const { patientId } = params;
  if (!patientId) return { error: 'patientId required' };

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) return { error: 'Hasta bulunamadı' };

  const [lastAppt, upcoming] = await Promise.all([
    prisma.appointment.findFirst({
      where: { patientId, organizationId: ctx.organizationId },
      orderBy: { startAt: 'desc' },
      select: { startAt: true, status: true, reason: true },
    }),
    prisma.appointment.findMany({
      where: {
        patientId,
        organizationId: ctx.organizationId,
        startAt: { gte: new Date() },
        status: { not: 'CANCELLED' },
      },
      orderBy: { startAt: 'asc' },
      take: 5,
      select: { startAt: true, status: true, reason: true },
    }),
  ]);

  return {
    entityType: 'patient',
    entityId: patientId,
    entityName: `${patient.firstName} ${patient.lastName}`.trim(),
    lastAppointment: lastAppt,
    upcomingAppointments: upcoming,
  };
}

module.exports = { buildPatientAppointmentContext };
