/**
 * get_patient_last_payment - Get last payment for a patient.
 * Phase 1: Read-only stub implementation.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'get_patient_last_payment',
  description: 'Get the most recent payment for a patient by patient ID.',
  requiredPermission: 'BILLING_READ',
  async execute(ctx, params) {
    const { patientId } = params;
    if (!patientId) return { error: 'patientId required' };

    const payment = await prisma.payment.findFirst({
      where: {
        patientId,
        organizationId: ctx.organizationId,
        deletedAt: null,
        isRefund: false,
      },
      orderBy: { paidAt: 'desc' },
      select: {
        id: true,
        amount: true,
        method: true,
        paidAt: true,
        reference: true,
      },
    });

    return { payment: payment || null };
  },
});
