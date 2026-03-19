/**
 * Deterministic Entity Resolver - Resolve entity names against real DB.
 * Supports: full name, partial name, Turkish possessive, follow-up from memory.
 * Never silently resolve to wrong entity. Return clarification when ambiguous.
 */

const { prisma } = require('../prisma');
const { executeTool } = require('./tool-registry');

/**
 * Resolve patient query to { id, name } or { needsClarification, candidates }.
 */
async function resolvePatient(ctx, patientQuery) {
  if (!patientQuery || !String(patientQuery).trim()) return null;
  const result = await executeTool('search_patient', ctx, { query: patientQuery.trim(), limit: 5 });
  const patients = result?.patients || [];
  if (patients.length === 0) return null;
  if (patients.length > 1) {
    return {
      needsClarification: true,
      entityType: 'patient',
      candidates: patients.map((p) => ({ id: p.id, name: `${p.firstName || ''} ${p.lastName || ''}`.trim() })),
    };
  }
  return {
    id: patients[0].id,
    name: `${patients[0].firstName || ''} ${patients[0].lastName || ''}`.trim(),
    entityType: 'patient',
  };
}

/**
 * Resolve doctor query to { id, name } or null.
 */
async function resolveDoctor(ctx, doctorQuery) {
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

/**
 * Resolve current account query to { id, name } or { needsClarification, candidates }.
 */
async function resolveCurrentAccount(ctx, currentAccountQuery) {
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
 * Resolve entities from query params. Explicit entity in message overrides memory.
 * @param {Object} ctx - AiContext
 * @param {Object} query - Structured query from understandQuery
 * @param {Object} memory - Conversation memory
 * @returns {Promise<Object>} { resolved, entityLog, clarification }
 */
async function resolveEntities(ctx, query, memory = null) {
  const params = query.params || {};
  const resolved = { ...params };
  const entityLog = {
    entityType: null,
    entitySource: null,
    resolvedEntityName: null,
    resolvedEntityId: null,
  };

  // Patient: explicit patientQuery wins over memory
  if (params.patientQuery) {
    const r = await resolvePatient(ctx, params.patientQuery);
    if (!r) return { resolved: null, entityLog };
    if (r.needsClarification) return { resolved: null, entityLog, clarification: r };
    resolved.patientId = r.id;
    delete resolved.patientQuery;
    entityLog.entityType = 'patient';
    entityLog.entitySource = 'explicit';
    entityLog.resolvedEntityName = r.name;
    entityLog.resolvedEntityId = r.id;
  } else if (params.patientId) {
    delete resolved.patientQuery;
    entityLog.entityType = 'patient';
    entityLog.entitySource = 'memory';
    entityLog.resolvedEntityId = params.patientId;
    entityLog.resolvedEntityName = memory?.lastReferencedPatientName || memory?.activeEntityName || null;
  }

  // Doctor: explicit doctorQuery wins over memory
  if (params.doctorQuery) {
    const r = await resolveDoctor(ctx, params.doctorQuery);
    if (!r) return { resolved: null, entityLog };
    if (r.needsClarification) return { resolved: null, entityLog, clarification: r };
    resolved.doctorId = r.id;
    delete resolved.doctorQuery;
    resolved.date = resolved.date || new Date().toISOString().slice(0, 10);
    entityLog.entityType = 'doctor';
    entityLog.entitySource = 'explicit';
    entityLog.resolvedEntityName = r.name;
    entityLog.resolvedEntityId = r.id;
  } else if (params.doctorId) {
    delete resolved.doctorQuery;
    resolved.date = resolved.date || new Date().toISOString().slice(0, 10);
    entityLog.entityType = 'doctor';
    entityLog.entitySource = 'memory';
    entityLog.resolvedEntityId = params.doctorId;
    entityLog.resolvedEntityName = memory?.lastReferencedDoctorName || memory?.activeEntityName || null;
  }

  // Current account: explicit currentAccountQuery wins over memory
  if (params.currentAccountQuery) {
    const r = await resolveCurrentAccount(ctx, params.currentAccountQuery);
    if (!r) return { resolved: null, entityLog };
    if (r.needsClarification) return { resolved: null, entityLog, clarification: r };
    resolved.currentAccountId = r.id;
    delete resolved.currentAccountQuery;
    entityLog.entityType = 'current_account';
    entityLog.entitySource = 'explicit';
    entityLog.resolvedEntityName = r.name;
    entityLog.resolvedEntityId = r.id;
  } else if (params.currentAccountId) {
    delete resolved.currentAccountQuery;
    entityLog.entityType = 'current_account';
    entityLog.entitySource = 'memory';
    entityLog.resolvedEntityId = params.currentAccountId;
    entityLog.resolvedEntityName = memory?.lastReferencedCurrentAccountName || memory?.activeEntityName || null;
  }

  return { resolved, entityLog };
}

module.exports = {
  resolvePatient,
  resolveDoctor,
  resolveCurrentAccount,
  resolveEntities,
};
