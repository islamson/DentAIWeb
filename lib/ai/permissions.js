/**
 * AI permission checks - CJS-compatible mirror of lib/rbac.js for AI tools.
 * Keeps AI layer independent of ESM rbac module.
 */

const PERMISSIONS = {
  PATIENT_READ: ['OWNER', 'ADMIN', 'MANAGER', 'DOCTOR', 'ASSISTANT', 'RECEPTION', 'ACCOUNTING', 'READONLY'],
  APPOINTMENT_READ: ['OWNER', 'ADMIN', 'MANAGER', 'DOCTOR', 'ASSISTANT', 'RECEPTION', 'READONLY'],
  BILLING_READ: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTING', 'RECEPTION', 'READONLY'],
  INVENTORY_READ: ['OWNER', 'ADMIN', 'MANAGER', 'INVENTORY', 'DOCTOR', 'READONLY'],
  REPORT_VIEW: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTING', 'DOCTOR'],
  AI_RUN: ['OWNER', 'ADMIN', 'MANAGER', 'DOCTOR'],
};

function can(role, permission) {
  const allowed = PERMISSIONS[permission];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Check if user can use the AI assistant at all.
 */
function canUseAi(role) {
  return can(role, 'AI_RUN');
}

/**
 * Check if user can execute a specific tool (based on tool's required permission).
 */
function canUseTool(role, requiredPermission) {
  if (!requiredPermission) return true;
  return can(role, requiredPermission);
}

module.exports = { can, canUseAi, canUseTool, PERMISSIONS };
