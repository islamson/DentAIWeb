/**
 * get_doctor_schedule - Get a doctor's schedule for a date.
 * Phase 1: Read-only stub implementation.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_doctor_schedule',
  description: 'Get a doctor\'s appointments and schedule blocks for a given date.',
  requiredPermission: 'APPOINTMENT_READ',
  async execute(ctx, params) {
    const { doctorId, date } = params;
    if (!doctorId) return { error: 'doctorId required' };

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const [appointments, blocks] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          organizationId: ctx.organizationId,
          doctorUserId: doctorId,
          startAt: { gte: targetDate, lt: nextDay },
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
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

    return { appointments, blocks, date: targetDate.toISOString().slice(0, 10) };
  },
});
