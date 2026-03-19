/**
 * Doctor schedule context pack - scoped to doctor + date.
 */

const { prisma } = require('../../prisma');

async function buildDoctorScheduleContext(ctx, params) {
  const { doctorId, date } = params;
  if (!doctorId) return { error: 'doctorId required' };

  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const [doctor, appointments, blocks] = await Promise.all([
    prisma.user.findFirst({
      where: { id: doctorId },
      select: { id: true, name: true },
    }),
    prisma.appointment.findMany({
      where: {
        organizationId: ctx.organizationId,
        doctorUserId: doctorId,
        startAt: { gte: targetDate, lt: nextDay },
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { startAt: 'asc' },
    }),
    prisma.scheduleBlock.findMany({
      where: {
        organizationId: ctx.organizationId,
        doctorUserId: doctorId,
        startAt: { gte: targetDate, lt: nextDay },
      },
      orderBy: { startAt: 'asc' },
    }),
  ]);

  if (!doctor) return { error: 'Doktor bulunamadı' };

  return {
    entityType: 'doctor',
    entityId: doctorId,
    entityName: doctor.name,
    date: targetDate.toISOString().slice(0, 10),
    appointments: appointments.map((a) => ({
      start: a.startAt,
      patient: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Misafir',
      status: a.status,
    })),
    blocks: blocks.map((b) => ({ start: b.startAt, type: b.type, title: b.title })),
  };
}

module.exports = { buildDoctorScheduleContext };
