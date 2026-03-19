/**
 * Short-term conversation memory for AI chat.
 * Entity-centric: active entity, type, date range, last metric, last tool/context.
 * Scoped per authenticated session. Never bypasses permissions.
 */

const MEMORY_KEY = 'aiMemory';

/**
 * Get or init memory for a session.
 * @param {Object} session - req.session
 * @param {string} userId - authenticated user id
 * @returns {Object}
 */
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
 * Update memory when a request resolves an entity.
 * Entity-centric: activeEntity, activeEntityType, activeDateRange, lastMetric, lastToolName.
 * @param {Object} memory
 * @param {Object} updates - { lastReferencedPatientId, lastReferencedPatientName, lastReferencedDoctorId, lastReferencedDoctorName, lastReferencedCurrentAccountId, lastReferencedCurrentAccountName, activeEntityId, activeEntityType, activeEntityName, activeDateRange, activeTimeRange, activeIntentGroup, lastMetric, lastIntent, lastToolName, lastResolvedTool, lastContextPack }
 */
function updateMemory(memory, updates) {
  if (!memory) return;
  Object.assign(memory, updates, { updatedAt: Date.now() });
}

/**
 * Set active entity from resolved result. Clears other entity types.
 * @param {Object} memory
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} entityName
 * @param {Object|null} dateRange - { from, to }
 * @param {string|null} intentGroup - e.g. current_account_balance
 */
function setActiveEntity(memory, entityType, entityId, entityName, dateRange = null, intentGroup = null) {
  if (!memory) return;
  memory.activeEntityId = entityId;
  memory.activeEntityType = entityType;
  memory.activeEntityName = entityName;
  if (dateRange) memory.activeTimeRange = dateRange;
  if (dateRange) memory.activeDateRange = dateRange;
  if (intentGroup) memory.activeIntentGroup = intentGroup;
  if (entityType === 'patient') {
    memory.lastReferencedPatientId = entityId;
    memory.lastReferencedPatientName = entityName;
    memory.lastReferencedDoctorId = null;
    memory.lastReferencedDoctorName = null;
    memory.lastReferencedCurrentAccountId = null;
    memory.lastReferencedCurrentAccountName = null;
  } else if (entityType === 'doctor') {
    memory.lastReferencedDoctorId = entityId;
    memory.lastReferencedDoctorName = entityName;
    memory.lastReferencedPatientId = null;
    memory.lastReferencedPatientName = null;
    memory.lastReferencedCurrentAccountId = null;
    memory.lastReferencedCurrentAccountName = null;
  } else if (entityType === 'current_account') {
    memory.lastReferencedCurrentAccountId = entityId;
    memory.lastReferencedCurrentAccountName = entityName;
    memory.lastReferencedPatientId = null;
    memory.lastReferencedPatientName = null;
    memory.lastReferencedDoctorId = null;
    memory.lastReferencedDoctorName = null;
  }
  memory.updatedAt = Date.now();
}

/**
 * Clear patient/doctor/currentAccount from memory (e.g. when user changes topic).
 */
function clearEntityMemory(memory) {
  if (!memory) return;
  delete memory.lastReferencedPatientId;
  delete memory.lastReferencedPatientName;
  delete memory.lastReferencedDoctorId;
  delete memory.lastReferencedDoctorName;
  delete memory.lastReferencedCurrentAccountId;
  delete memory.lastReferencedCurrentAccountName;
  delete memory.activeEntityId;
  delete memory.activeEntityType;
  delete memory.activeEntityName;
  delete memory.activeDateRange;
  delete memory.activeTimeRange;
  delete memory.activeIntentGroup;
  delete memory.lastMetric;
  delete memory.lastContextPack;
  delete memory.lastResolvedTool;
  memory.updatedAt = Date.now();
}

module.exports = { getMemory, updateMemory, setActiveEntity, clearEntityMemory, MEMORY_KEY };
