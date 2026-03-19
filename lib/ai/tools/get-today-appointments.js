/**
 * get_today_appointments - Get today's appointments.
 * Phase 1: Read-only stub implementation.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_today_appointments',
  description: 'Get appointments for today. Optionally filter by branch or doctor.',
  requiredPermission: 'APPOINTMENT_READ',
  async execute(ctx, params) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where = {
      organizationId: ctx.organizationId,
      startAt: { gte: today, lt: tomorrow },
    };
    if (ctx.branchId) where.branchId = ctx.branchId;
    if (params.doctorId) where.doctorUserId = params.doctorId;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    return { appointments, count: appointments.length };
  },
});
