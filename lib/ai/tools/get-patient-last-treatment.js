/**
 * get_patient_last_treatment - Get patient's last treatment (TREATMENT_COST movement or session).
 * Uses FinancialMovement. Read-only.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_patient_last_treatment',
  description: 'Get patient last treatment: most recent TREATMENT_COST from financial movements.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { patientId } = params;
    if (!patientId) return { error: 'patientId required' };

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId: ctx.organizationId },
      select: { firstName: true, lastName: true },
    });
    if (!patient) return { error: 'Hasta bulunamadı.' };

    const lastMovement = await prisma.financialMovement.findFirst({
      where: {
        organizationId: ctx.organizationId,
        patientId,
        type: 'TREATMENT_COST',
        status: 'ACTIVE',
      },
      include: { doctor: { select: { name: true } } },
      orderBy: { occurredAt: 'desc' },
    });

    if (!lastMovement) {
      return {
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`.trim(),
        lastTreatment: null,
      };
    }

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      lastTreatment: {
        description: lastMovement.description,
        amount: Math.abs(lastMovement.amount),
        occurredAt: lastMovement.occurredAt,
        doctor: lastMovement.doctor?.name,
      },
    };
  },
});
