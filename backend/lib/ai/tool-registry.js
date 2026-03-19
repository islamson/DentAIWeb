/**
 * AI tool registry - permission-aware tool execution.
 * Every tool receives user/clinic/permission context.
 * Backend enforces permissions before execution.
 */

const { assertCanUseTool } = require('./context');

/**
 * @typedef {Object} ToolDefinition
 * @property {string} name
 * @property {string} description
 * @property {string} [requiredPermission] - RBAC permission (e.g. PATIENT_READ)
 * @property {function(ctx: AiContext, params: Object): Promise<Object>} execute
 */

/** @type {Map<string, ToolDefinition>} */
const registry = new Map();

/**
 * Register a tool.
 * @param {ToolDefinition} def
 */
function register(def) {
  if (!def.name || !def.execute) {
    throw new Error('Tool must have name and execute function');
  }
  registry.set(def.name, def);
}

/**
 * Get a tool by name.
 */
function get(name) {
  return registry.get(name);
}

/**
 * Get all registered tools (for AI to know available tools).
 */
function getAll() {
  return Array.from(registry.values()).map((t) => ({
    name: t.name,
    description: t.description,
    requiredPermission: t.requiredPermission,
  }));
}

/**
 * Execute a tool with permission check.
 * @param {string} toolName
 * @param {AiContext} ctx
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function executeTool(toolName, ctx, params = {}) {
  const tool = registry.get(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  assertCanUseTool(ctx, tool.requiredPermission);

  return tool.execute(ctx, params);
}

/**
 * Execute multiple tools and collect results.
 * @param {Array<{name: string, params?: Object}>} toolCalls
 * @param {AiContext} ctx
 * @returns {Promise<Array<{name: string, result: Object, error?: string}>>}
 */
async function executeTools(toolCalls, ctx) {
  const results = [];
  for (const call of toolCalls) {
    try {
      const result = await executeTool(call.name, ctx, call.params || {});
      results.push({ name: call.name, result });
    } catch (err) {
      results.push({
        name: call.name,
        result: null,
        error: err.message || 'Tool execution failed',
      });
    }
  }
  return results;
}

module.exports = { register, get, getAll, executeTool, executeTools };
