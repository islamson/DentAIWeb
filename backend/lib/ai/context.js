/**
 * Builds structured AI request context from authenticated user.
 * Used by orchestrator and tools for tenant scoping and permission checks.
 * Request-level cache avoids repeated auth/org/branch resolution within same AI request.
 */

const { randomUUID } = require('crypto');
const { canUseAi, canUseTool } = require('./permissions');

const requestContextCache = new Map();

/**
 * @typedef {Object} AiContext
 * @property {string} userId
 * @property {string} userEmail
 * @property {string} userName
 * @property {string} organizationId
 * @property {string|null} branchId
 * @property {string} role
 * @property {boolean} canUseAi
 */

/**
 * Build AI context from req.user (set by getCurrentUser middleware).
 * @param {Object} reqUser - req.user from getCurrentUser
 * @returns {AiContext}
 */
function buildContext(reqUser) {
  if (!reqUser) {
    throw new Error('User context required');
  }

  const role = reqUser.role || 'READONLY';
  return {
    userId: reqUser.id,
    userEmail: reqUser.email,
    userName: reqUser.name,
    organizationId: reqUser.organizationId,
    branchId: reqUser.branchId || null,
    role,
    canUseAi: canUseAi(role),
  };
}

/**
 * Get or build context with request-level cache.
 * Reduces latency by avoiding repeated context build within same AI request.
 * @param {Object} reqUser - req.user from getCurrentUser
 * @param {string} requestId - unique id for this request (e.g. from createRequestId())
 * @returns {{ ctx: AiContext, cacheHit: boolean }}
 */
function getOrBuildContext(reqUser, requestId) {
  const cached = requestContextCache.get(requestId);
  if (cached) {
    return { ctx: cached, cacheHit: true };
  }
  const ctx = buildContext(reqUser);
  requestContextCache.set(requestId, ctx);
  return { ctx, cacheHit: false };
}

/**
 * Clear request context from cache (call at end of request).
 * @param {string} requestId
 */
function clearRequestContext(requestId) {
  requestContextCache.delete(requestId);
}

/**
 * Create a unique request ID for this AI request.
 * @returns {string}
 */
function createRequestId() {
  return randomUUID();
}

/**
 * Assert user can use AI; throw if not.
 */
function assertCanUseAi(ctx) {
  if (!ctx.canUseAi) {
    const err = new Error('Bu işlem için yetkiniz bulunmuyor.');
    err.code = 'AI_PERMISSION_DENIED';
    throw err;
  }
}

/**
 * Assert user can execute a specific tool.
 */
function assertCanUseTool(ctx, requiredPermission) {
  if (!canUseTool(ctx.role, requiredPermission)) {
    const err = new Error(`Bu araç için yetkiniz bulunmuyor: ${requiredPermission}`);
    err.code = 'TOOL_PERMISSION_DENIED';
    throw err;
  }
}

module.exports = {
  buildContext,
  getOrBuildContext,
  clearRequestContext,
  createRequestId,
  assertCanUseAi,
  assertCanUseTool,
};
