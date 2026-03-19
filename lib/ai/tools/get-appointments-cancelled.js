/**
 * get_appointments_cancelled - Get cancelled appointments summary.
 * Read-only. Date-bounded.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_appointments_cancelled',
  description: 'Get cancelled appointments summary. Optional date range.',
  requiredPermission: 'APPOINTMENT_READ',
  async execute(ctx, params) {
    const { dateFrom, dateTo } = params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = dateFrom ? new Date(dateFrom) : new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const to = dateTo ? new Date(dateTo) : new Date();
    to.setHours(23, 59, 59, 999);

    const where = {
      organizationId: ctx.organizationId,
      status: 'CANCELLED',
      startAt: { gte: from, lte: to },
    };
    if (ctx.branchId) where.branchId = ctx.branchId;

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: { select: { firstName: true, lastName: true } },
          doctor: { select: { name: true } },
        },
        orderBy: { startAt: 'desc' },
        take: 10,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      appointments: appointments.map((a) => ({
        startAt: a.startAt,
        patient: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Misafir',
        doctor: a.doctor?.name,
      })),
      count: total,
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    };
  },
});
