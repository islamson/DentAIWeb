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

/**
 * Resolve treatment plan by title for a patient. patientId required.
 */
async function resolveTreatmentPlanByNameForPatient(ctx, planQuery, patientId) {
  if (!planQuery || !String(planQuery).trim() || !patientId) return null;
  const plans = await prisma.treatmentPlan.findMany({
    where: {
      organizationId: ctx.organizationId,
      patientId,
      title: { contains: planQuery.trim(), mode: 'insensitive' },
    },
    select: { id: true, title: true },
    take: 5,
  });
  if (plans.length === 0) return null;
  if (plans.length > 1) {
    return {
      needsClarification: true,
      entityType: 'treatment_plan',
      candidates: plans.map((p) => ({ id: p.id, name: p.title })),
    };
  }
  return { id: plans[0].id, name: plans[0].title, entityType: 'treatment_plan' };
}

/**
 * Resolve inventory product by name (fuzzy). Optional for low_stock - no entity needed.
 */
async function resolveInventoryProductByName(ctx, productQuery) {
  if (!productQuery || !String(productQuery).trim()) return null;
  const items = await prisma.inventoryItem.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(ctx.branchId && { branchId: ctx.branchId }),
      name: { contains: productQuery.trim(), mode: 'insensitive' },
    },
    select: { id: true, name: true },
    take: 5,
  });
  if (items.length === 0) return null;
  if (items.length > 1) {
    return {
      needsClarification: true,
      entityType: 'inventory_product',
      candidates: items.map((i) => ({ id: i.id, name: i.name })),
    };
  }
  return { id: items[0].id, name: items[0].name, entityType: 'inventory_product' };
}

/**
 * Resolve entities from classification result.
 * Order: A) explicit in message B) memory C) clarification D) no match
 * @param {Object} ctx - { organizationId, branchId, userId, ... }
 * @param {Object} classification - from query-classifier
 * @param {Object} memory - conversation memory
 * @returns {Promise<{ resolved, entityLog, clarification }>}
 */
async function resolveEntities(ctx, classification, memory = null) {
  const { domain, extractedParams } = classification;
  const entityLog = {
    entityType: null,
    entitySource: null,
    resolvedEntityId: null,
    resolvedEntityName: null,
    ambiguityCount: 0,
  };

  const resolved = { ...extractedParams };

  // Patient entity
  if (
    [
      'patient_balance',
      'patient_last_payment',
      'patient_summary',
      'patient_appointments',
      'patient_treatment_plans',
      'patient_treatment_progress',
    ].includes(domain)
  ) {
    if (extractedParams.patientQuery) {
      const r = await resolvePatientByName(ctx, extractedParams.patientQuery);
      if (!r) {
        entityLog.entityType = 'patient';
        entityLog.entitySource = 'unresolved';
        return { resolved: null, entityLog };
      }
      if (r.needsClarification) {
        entityLog.entityType = 'patient';
        entityLog.entitySource = 'ambiguous';
        entityLog.ambiguityCount = r.candidates?.length || 0;
        return { resolved: null, entityLog, clarification: r };
      }
      resolved.patientId = r.id;
      delete resolved.patientQuery;
      entityLog.entityType = 'patient';
      entityLog.entitySource = 'explicit';
      entityLog.resolvedEntityId = r.id;
      entityLog.resolvedEntityName = r.name;
    } else if (extractedParams.patientId && memory?.lastResolvedPatient?.id === extractedParams.patientId) {
      entityLog.entityType = 'patient';
      entityLog.entitySource = 'memory';
      entityLog.resolvedEntityId = extractedParams.patientId;
      entityLog.resolvedEntityName = memory.lastResolvedPatient.name;
    } else if (extractedParams.patientId) {
      const p = await prisma.patient.findFirst({
        where: { id: extractedParams.patientId, organizationId: ctx.organizationId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!p) {
        entityLog.entityType = 'patient';
        entityLog.entitySource = 'unresolved';
        return { resolved: null, entityLog };
      }
      resolved.patientId = p.id;
      entityLog.entityType = 'patient';
      entityLog.entitySource = 'memory';
      entityLog.resolvedEntityId = p.id;
      entityLog.resolvedEntityName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
    } else {
      entityLog.entityType = 'patient';
      entityLog.entitySource = 'unresolved';
      return { resolved: null, entityLog };
    }
  }

  // Current account entity
  if (['current_account_balance', 'current_account_transactions'].includes(domain)) {
    if (extractedParams.currentAccountQuery) {
      const r = await resolveCurrentAccountByName(ctx, extractedParams.currentAccountQuery);
      if (!r) {
        entityLog.entityType = 'current_account';
        entityLog.entitySource = 'unresolved';
        return { resolved: null, entityLog };
      }
      if (r.needsClarification) {
        entityLog.entityType = 'current_account';
        entityLog.entitySource = 'ambiguous';
        entityLog.ambiguityCount = r.candidates?.length || 0;
        return { resolved: null, entityLog, clarification: r };
      }
      resolved.currentAccountId = r.id;
      delete resolved.currentAccountQuery;
      entityLog.entityType = 'current_account';
      entityLog.entitySource = 'explicit';
      entityLog.resolvedEntityId = r.id;
      entityLog.resolvedEntityName = r.name;
    } else if (
      extractedParams.currentAccountId &&
      memory?.lastResolvedCurrentAccount?.id === extractedParams.currentAccountId
    ) {
      entityLog.entityType = 'current_account';
      entityLog.entitySource = 'memory';
      entityLog.resolvedEntityId = extractedParams.currentAccountId;
      entityLog.resolvedEntityName = memory.lastResolvedCurrentAccount.name;
    } else if (extractedParams.currentAccountId) {
      const a = await prisma.currentAccount.findFirst({
        where: { id: extractedParams.currentAccountId, organizationId: ctx.organizationId },
        select: { id: true, name: true },
      });
      if (!a) {
        entityLog.entityType = 'current_account';
        entityLog.entitySource = 'unresolved';
        return { resolved: null, entityLog };
      }
      resolved.currentAccountId = a.id;
      entityLog.entityType = 'current_account';
      entityLog.entitySource = 'memory';
      entityLog.resolvedEntityId = a.id;
      entityLog.resolvedEntityName = a.name;
    } else {
      entityLog.entityType = 'current_account';
      entityLog.entitySource = 'unresolved';
      return { resolved: null, entityLog };
    }
  }

  // Doctor entity
  if (['doctor_schedule', 'doctor_treatment_performance', 'monthly_appointment_count_for_doctor', 'today_appointment_count_for_doctor'].includes(domain)) {
    if (extractedParams.doctorQuery) {
      const r = await resolveDoctorByName(ctx, extractedParams.doctorQuery);
      if (!r) {
        entityLog.entityType = 'doctor';
        entityLog.entitySource = 'unresolved';
        return { resolved: null, entityLog };
      }
      if (r.needsClarification) {
        entityLog.entityType = 'doctor';
        entityLog.entitySource = 'ambiguous';
        entityLog.ambiguityCount = r.candidates?.length || 0;
        return { resolved: null, entityLog, clarification: r };
      }
      resolved.doctorId = r.id;
      resolved.date = extractedParams.date || new Date().toISOString().slice(0, 10);
      delete resolved.doctorQuery;
      entityLog.entityType = 'doctor';
      entityLog.entitySource = 'explicit';
      entityLog.resolvedEntityId = r.id;
      entityLog.resolvedEntityName = r.name;
    } else if (extractedParams.doctorId && memory?.lastResolvedDoctor?.id === extractedParams.doctorId) {
      entityLog.entityType = 'doctor';
      entityLog.entitySource = 'memory';
      entityLog.resolvedEntityId = extractedParams.doctorId;
      entityLog.resolvedEntityName = memory.lastResolvedDoctor.name;
      resolved.date = extractedParams.date || new Date().toISOString().slice(0, 10);
    } else if (extractedParams.doctorId) {
      const d = await prisma.user.findFirst({
        where: {
          id: extractedParams.doctorId,
          orgs: { some: { organizationId: ctx.organizationId, role: 'DOCTOR' } },
        },
        select: { id: true, name: true },
      });
      if (!d) {
        entityLog.entityType = 'doctor';
        entityLog.entitySource = 'unresolved';
        return { resolved: null, entityLog };
      }
      resolved.doctorId = d.id;
      resolved.date = extractedParams.date || new Date().toISOString().slice(0, 10);
      entityLog.entityType = 'doctor';
      entityLog.entitySource = 'memory';
      entityLog.resolvedEntityId = d.id;
      entityLog.resolvedEntityName = d.name;
    } else {
      entityLog.entityType = 'doctor';
      entityLog.entitySource = 'unresolved';
      return { resolved: null, entityLog };
    }
  }

  // Treatment plan entity (requires patientId)
  if (domain === 'patient_treatment_plan_details') {
    const patientId = resolved.patientId || memory?.lastResolvedPatient?.id;
    if (!patientId) {
      entityLog.entityType = 'treatment_plan';
      entityLog.entitySource = 'unresolved';
      return { resolved: null, entityLog };
    }
    if (extractedParams.treatmentPlanQuery) {
      const r = await resolveTreatmentPlanByNameForPatient(ctx, extractedParams.treatmentPlanQuery, patientId);
      if (!r) {
        entityLog.entityType = 'treatment_plan';
        entityLog.entitySource = 'unresolved';
        return { resolved: null, entityLog };
      }
      if (r.needsClarification) {
        entityLog.entityType = 'treatment_plan';
        entityLog.entitySource = 'ambiguous';
        entityLog.ambiguityCount = r.candidates?.length || 0;
        return { resolved: null, entityLog, clarification: r };
      }
      resolved.treatmentPlanId = r.id;
      resolved.patientId = patientId;
      delete resolved.treatmentPlanQuery;
      entityLog.entityType = 'treatment_plan';
      entityLog.entitySource = 'explicit';
      entityLog.resolvedEntityId = r.id;
      entityLog.resolvedEntityName = r.name;
    } else if (
      extractedParams.treatmentPlanId &&
      memory?.lastResolvedTreatmentPlan?.id === extractedParams.treatmentPlanId
    ) {
      resolved.treatmentPlanId = extractedParams.treatmentPlanId;
      resolved.patientId = patientId;
      entityLog.entityType = 'treatment_plan';
      entityLog.entitySource = 'memory';
      entityLog.resolvedEntityId = extractedParams.treatmentPlanId;
      entityLog.resolvedEntityName = memory.lastResolvedTreatmentPlan.name;
    } else if (extractedParams.treatmentPlanId) {
      const tp = await prisma.treatmentPlan.findFirst({
        where: {
          id: extractedParams.treatmentPlanId,
          patientId,
          organizationId: ctx.organizationId,
        },
        select: { id: true, title: true },
      });
      if (!tp) {
        entityLog.entityType = 'treatment_plan';
        entityLog.entitySource = 'unresolved';
        return { resolved: null, entityLog };
      }
      resolved.treatmentPlanId = tp.id;
      resolved.patientId = patientId;
      entityLog.entityType = 'treatment_plan';
      entityLog.entitySource = 'memory';
      entityLog.resolvedEntityId = tp.id;
      entityLog.resolvedEntityName = tp.title;
    } else {
      entityLog.entityType = 'treatment_plan';
      entityLog.entitySource = 'unresolved';
      return { resolved: null, entityLog };
    }
  }

  return { resolved, entityLog };
}

module.exports = {
  resolvePatientByName,
  resolveCurrentAccountByName,
  resolveDoctorByName,
  resolveTreatmentPlanByNameForPatient,
  resolveInventoryProductByName,
  resolveEntities,
};
