/**
 * get_patient_financial_history - Get patient financial movements (ledger).
 * Uses canonical getPatientFinanceLedger. Read-only.
 */

const { getPatientFinanceLedger } = require('../../patient-finance-ledger');
const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_patient_financial_history',
  description: 'Get patient financial movement history: payments, treatment costs. Uses finance ledger.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { patientId, limit = 10 } = params;
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

    const movements = (ledger.movements || [])
      .slice(0, Math.min(limit, 20))
      .map((m) => ({
        type: m.type,
        description: m.title || m.description,
        amount: m.amount,
        occurredAt: m.occurredAt,
      }));

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      movements,
      summary: ledger.summary,
      count: movements.length,
    };
  },
});
