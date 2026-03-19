/**
 * get_patient_contact - Get patient phone and email.
 * Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_patient_contact',
  description: 'Get patient phone number and email.',
  requiredPermission: 'PATIENT_READ',
  async execute(ctx, params) {
    const { patientId } = params;
    if (!patientId) return { error: 'patientId required' };

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId: ctx.organizationId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    });
    if (!patient) return { error: 'Hasta bulunamadı.' };

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      phone: patient.phone || null,
      email: patient.email || null,
    };
  },
});
