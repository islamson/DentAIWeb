/**
 * get_debtors_summary - Get summary of patients with outstanding debt.
 * Uses financial movements (canonical source), not invoices only.
 * remaining = totalTreatmentCost - totalPaid from FinancialMovement.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_debtors_summary',
  description: 'Get summary of patients with outstanding balance. Uses financial movements ledger.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { limit = 20 } = params;

    const [treatmentByPatient, paymentByPatient] = await Promise.all([
      prisma.financialMovement.groupBy({
        by: ['patientId'],
        where: {
          organizationId: ctx.organizationId,
          patientId: { not: null },
          type: 'TREATMENT_COST',
          status: 'ACTIVE',
        },
        _sum: { amount: true },
      }),
      prisma.financialMovement.groupBy({
        by: ['patientId'],
        where: {
          organizationId: ctx.organizationId,
          patientId: { not: null },
          type: 'PAYMENT',
          status: 'ACTIVE',
        },
        _sum: { amount: true },
      }),
    ]);

    const treatmentMap = new Map();
    treatmentByPatient.forEach((g) => {
      treatmentMap.set(g.patientId, Math.abs(g._sum.amount || 0));
    });
    const paymentMap = new Map();
    paymentByPatient.forEach((g) => {
      paymentMap.set(g.patientId, g._sum.amount || 0);
    });

    const patientIds = [...new Set([...treatmentMap.keys(), ...paymentMap.keys()])];
    const debtorsRaw = patientIds
      .map((pid) => {
        const totalTreatment = treatmentMap.get(pid) || 0;
        const totalPaid = paymentMap.get(pid) || 0;
        const remaining = totalTreatment - totalPaid;
        return { patientId: pid, remaining, totalTreatment, totalPaid };
      })
      .filter((d) => d.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, Math.min(limit, 50));

    if (debtorsRaw.length === 0) {
      return { debtors: [], totalRemaining: 0, count: 0 };
    }

    const patients = await prisma.patient.findMany({
      where: { id: { in: debtorsRaw.map((d) => d.patientId) }, organizationId: ctx.organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    const debtors = debtorsRaw.map((d) => {
      const p = patientMap.get(d.patientId);
      return {
        patientId: d.patientId,
        patientName: p ? `${p.firstName} ${p.lastName}` : 'Bilinmeyen',
        remaining: d.remaining,
        totalTreatment: d.totalTreatment,
        totalPaid: d.totalPaid,
      };
    });

    const totalRemaining = debtors.reduce((s, d) => s + d.remaining, 0);

    return { debtors, totalRemaining, count: debtors.length };
  },
});
