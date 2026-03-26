/**
 * Entity Resolver V2 - Deterministic entity resolution.
 * Never guess silently. Explicit > memory. Ambiguous -> clarification.
 * organizationId and branchId scoping always apply.
 */

const { prisma } = require('../prisma');
const { executeTool } = require('./tool-registry');

/**
 * Resolve patient by name. Returns { id, name } or { needsClarification, candidates } or null.
 */
async function resolvePatientByName(ctx, patientQuery) {
  if (!patientQuery || !String(patientQuery).trim()) return null;
  const result = await executeTool('search_patient', ctx, {
    query: patientQuery.trim(),
    limit: 5,
  });
  const patients = result?.patients || [];
  if (patients.length === 0) return null;
  if (patients.length > 1) {
    return {
      needsClarification: true,
      entityType: 'patient',
      candidates: patients.map((p) => ({
        id: p.id,
        name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      })),
    };
  }
  return {
    id: patients[0].id,
    name: `${patients[0].firstName || ''} ${patients[0].lastName || ''}`.trim(),
    entityType: 'patient',
  };
}

/**
 * Resolve current account by name.
 */
async function resolveCurrentAccountByName(ctx, currentAccountQuery) {
  if (!currentAccountQuery || !String(currentAccountQuery).trim()) return null;
  const result = await executeTool('search_current_account', ctx, {
    query: currentAccountQuery.trim(),
    limit: 5,
  });
  const accounts = result?.accounts || [];
  if (accounts.length === 0) return null;
  if (accounts.length > 1) {
    return {
      needsClarification: true,
      entityType: 'current_account',
      candidates: accounts.map((a) => ({ id: a.id, name: a.name })),
    };
  }
  return { id: accounts[0].id, name: accounts[0].name, entityType: 'current_account' };
}

/**
 * Resolve doctor by name. Scoped to org doctors.
 */
async function resolveDoctorByName(ctx, doctorQuery) {
  if (!doctorQuery || !String(doctorQuery).trim()) return null;
  const users = await prisma.user.findMany({
    where: {
      orgs: {
        some: {
          organizationId: ctx.organizationId,
          role: 'DOCTOR',
        },
      },
      name: { contains: doctorQuery.trim(), mode: 'insensitive' },
    },
    select: { id: true, name: true },
    take: 2,
  });
  if (users.length === 0) return null;
  if (users.length > 1) {
    return {
      needsClarification: true,
      entityType: 'doctor',
      candidates: users.map((u) => ({ id: u.id, name: u.name })),
    };
  }
  return { id: users[0].id, name: users[0].name, entityType: 'doctor' };
}

module.exports = {
  resolvePatientByName,
  resolveCurrentAccountByName,
  resolveDoctorByName,
};
