/**
 * Patient finance context pack - scoped to single patient.
 */

const { getPatientFinanceLedger } = require('../../patient-finance-ledger');
const { prisma } = require('../../prisma');

async function buildPatientFinanceContext(ctx, params) {
  const { patientId } = params;
  if (!patientId) return { error: 'patientId required' };

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) return { error: 'Hasta bulunamadı' };

  const ledger = await getPatientFinanceLedger({
    organizationId: ctx.organizationId,
    patientId,
  });

  const movements = (ledger.movements || []).slice(0, 15).map((m) => ({
    type: m.type,
    amount: m.amount,
    date: m.occurredAt,
    desc: (m.title || m.description || '').slice(0, 80),
  }));

  return {
    entityType: 'patient',
    entityId: patientId,
    entityName: `${patient.firstName} ${patient.lastName}`.trim(),
    summary: ledger.summary,
    movements,
    movementCount: ledger.movements?.length || 0,
  };
}

module.exports = { buildPatientFinanceContext };
