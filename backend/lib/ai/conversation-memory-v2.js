/**
 * Conversation Memory V2 - Structured short-term memory.
 * Per chat session: lastResolvedPatient, lastResolvedCurrentAccount, lastResolvedDoctor, lastResolvedTreatmentPlan, lastDomain, timestamp.
 * Memory only for referential follow-ups. Explicit new entity always overrides.
 */

const MEMORY_KEY = 'aiMemory';

function getMemory(session, userId) {
  if (!session) return null;
  if (!session[MEMORY_KEY]) {
    session[MEMORY_KEY] = { userId, updatedAt: Date.now() };
  }
  if (session[MEMORY_KEY].userId !== userId) {
    session[MEMORY_KEY] = { userId, updatedAt: Date.now() };
  }
  return session[MEMORY_KEY];
}

/**
 * Update memory with resolved entity.
 * @param {Object} memory
 * @param {string} entityType - patient | current_account | doctor | treatment_plan
 * @param {Object} entity - { id, name }
 * @param {string} domain - optional
 */
function setResolvedEntity(memory, entityType, entity, domain = null) {
  if (!memory || !entity?.id) return;

  switch (entityType) {
    case 'patient':
      memory.lastResolvedPatient = { id: entity.id, name: entity.name };
      memory.lastResolvedCurrentAccount = null;
      memory.lastResolvedDoctor = null;
      memory.lastResolvedTreatmentPlan = null;
      break;
    case 'current_account':
      memory.lastResolvedCurrentAccount = { id: entity.id, name: entity.name };
      memory.lastResolvedPatient = null;
      memory.lastResolvedDoctor = null;
      memory.lastResolvedTreatmentPlan = null;
      break;
    case 'doctor':
      memory.lastResolvedDoctor = { id: entity.id, name: entity.name };
      memory.lastResolvedPatient = null;
      memory.lastResolvedCurrentAccount = null;
      memory.lastResolvedTreatmentPlan = null;
      break;
    case 'treatment_plan':
      memory.lastResolvedTreatmentPlan = { id: entity.id, name: entity.name };
      break;
    default:
      break;
  }

  if (domain) memory.lastDomain = domain;
  memory.updatedAt = Date.now();
}

/**
 * Store the last validated query state for follow-up planning.
 * @param {Object} memory
 * @param {Object} state - { intent, metric, timeScope, filters, retrievalName, entityType, entityId, comparisonBase }
 */
function setLastQueryState(memory, state = {}) {
  if (!memory) return;
  memory.lastQueryState = {
    intent: state.intent || null,
    metric: state.metric || null,
    timeScope: state.timeScope || null,
    filters: state.filters || {},
    retrievalName: state.retrievalName || null,
    lastEntityType: state.entityType || null,
    lastEntityId: state.entityId || null,
    lastComparisonBase: state.comparisonBase || null,
  };
  memory.updatedAt = Date.now();
}

/**
 * Get analytic context for inheritance logic.
 * @param {Object} memory
 * @returns {{ lastIntent, lastMetric, lastEntityType, lastEntityId, lastTimeScope, lastFilters, lastComparisonBase }|null}
 */
function getAnalyticContext(memory) {
  if (!memory?.lastQueryState) return null;
  const qs = memory.lastQueryState;
  return {
    lastIntent: qs.intent || null,
    lastMetric: qs.metric || null,
    lastEntityType: qs.lastEntityType || null,
    lastEntityId: qs.lastEntityId || null,
    lastTimeScope: qs.timeScope || null,
    lastFilters: qs.filters || {},
    lastComparisonBase: qs.lastComparisonBase || null,
  };
}

/**
 * Store pending clarification state when we asked for clarification.
 * Used when user answers "Evet bekliyorum", "Bu ay", "Dr. X" etc.
 */
function setPendingClarification(memory, state = {}) {
  if (!memory) return;
  memory.pendingClarification = {
    clarificationType: state.clarificationType || null,
    expectedEntityType: state.expectedEntityType || null,
    expectedTimeScope: state.expectedTimeScope || null,
    expectedMetric: state.expectedMetric || null,
    previousPlan: state.previousPlan || null,
    previousQuestion: state.previousQuestion || null,
    at: Date.now(),
  };
  memory.updatedAt = Date.now();
}

function getPendingClarification(memory) {
  if (!memory?.pendingClarification) return null;
  const pc = memory.pendingClarification;
  if (Date.now() - pc.at > 5 * 60 * 1000) {
    delete memory.pendingClarification;
    return null;
  }
  return pc;
}

function clearPendingClarification(memory) {
  if (!memory) return;
  delete memory.pendingClarification;
  memory.updatedAt = Date.now();
}

/**
 * Clear entity memory (e.g. topic change).
 */
function clearEntityMemory(memory) {
  if (!memory) return;
  delete memory.lastResolvedPatient;
  delete memory.lastResolvedCurrentAccount;
  delete memory.lastResolvedDoctor;
  delete memory.lastResolvedTreatmentPlan;
  delete memory.lastDomain;
  delete memory.lastQueryState;
  delete memory.pendingClarification;
  memory.updatedAt = Date.now();
}

module.exports = {
  getMemory,
  setResolvedEntity,
  setLastQueryState,
  getAnalyticContext,
  setPendingClarification,
  getPendingClarification,
  clearPendingClarification,
  clearEntityMemory,
  MEMORY_KEY,
};
