/**
 * search_patient - Search patients by name, phone, or email.
 * Phase 1: Read-only stub implementation.
 */

const { prisma } = require('../../prisma');
const { register } = require('../tool-registry');

register({
  name: 'search_patient',
  description: 'Search patients by name, phone, or email. Returns matching patients with basic info.',
  requiredPermission: 'PATIENT_READ',
  async execute(ctx, params) {
    const { query = '', limit = 10 } = params;
    const where = { organizationId: ctx.organizationId };
    if (ctx.branchId) where.branchId = ctx.branchId;

    if (query && query.trim()) {
      const q = query.trim();
      const parts = q.split(/\s+/);
      if (parts.length >= 2) {
        where.AND = [
          { firstName: { contains: parts[0], mode: 'insensitive' } },
          { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
        ];
      } else {
        where.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
          { nationalId: { contains: q } },
        ];
      }
    }

    const patients = await prisma.patient.findMany({
      where,
      take: Math.min(limit, 20),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
      orderBy: { lastName: 'asc' },
    });

    return { patients, count: patients.length };
  },
});
