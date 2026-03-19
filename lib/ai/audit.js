/**
 * Audit logging for AI requests.
 * Records: user id, clinic id, message, tools called, timestamp, status.
 */

const { prisma } = require('../prisma');

/**
 * Log an AI request for audit trail.
 * @param {Object} params
 * @param {string} params.organizationId
 * @param {string} params.userId
 * @param {string} params.message
 * @param {string} [params.selectedIntent]
 * @param {string} [params.plannerMode] - llm | fallback
 * @param {string} [params.modelUsed]
 * @param {string[]} params.toolsCalled
 * @param {'success'|'error'} params.status
 * @param {string} [params.errorMessage]
 */
async function logAiRequest({
  organizationId,
  userId,
  message,
  selectedIntent,
  plannerMode,
  modelUsed,
  toolsCalled,
  status,
  errorMessage,
}) {
  try {
    await prisma.aiRequestLog.create({
      data: {
        organizationId,
        userId,
        message,
        selectedIntent: selectedIntent || null,
        plannerMode: plannerMode || null,
        modelUsed: modelUsed || null,
        toolsCalled: toolsCalled || [],
        status,
        errorMessage: errorMessage || null,
      },
    });
  } catch (err) {
    console.error('Failed to log AI request:', err);
    // Don't throw - audit failure shouldn't break the main flow
  }
}

module.exports = { logAiRequest };
