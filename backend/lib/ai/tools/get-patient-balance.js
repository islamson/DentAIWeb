/**
 * get_patient_balance - Get patient financial balance using canonical finance ledger.
 * Uses same logic as patient detail page: remaining = totalAppliedTreatment - totalPaid.
 * Phase 1: Read-only.
 */

const { prisma } = require('../../prisma');
const { getPatientFinanceLedger } = require('../../patient-finance-ledger');
const { register } = require('../tool-registry');

register({
  name: 'get_patient_balance',
  description: 'Get patient financial balance: total applied treatment, total paid, remaining balance. Same logic as patient detail page.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { patientId } = params;
    if (!patientId) return { error: 'patientId required' };

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId: ctx.organizationId },
      select: { firstName: true, lastName: true },
    });
    if (!patient) return { error: 'Hasta bulunamadı.' };

    const ledger = await getPatientFinanceLedger({
      organizationId: ctx.organizationId,
      patientId,
    });

    const { totalTreatmentCost, totalPaid, remaining } = ledger.summary;
    const patientName = `${patient.firstName} ${patient.lastName}`.trim();

    return {
      patientId,
      patientName,
      totalAppliedTreatment: totalTreatmentCost,
      totalPaid,
      remainingBalance: remaining,
      currency: 'TRY',
    };
  },
});
