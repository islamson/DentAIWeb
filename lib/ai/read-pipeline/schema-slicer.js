/**
 * Schema Slicer — Selects relevant schema subsets based on the semantic read plan.
 *
 * The SQL generator NEVER sees the full database — only the domain-relevant slice.
 * This dramatically reduces hallucination risk and keeps LLM context small.
 */

'use strict';

const {
  getTable,
  getVisibleColumns,
  getJoinPathsForTables,
  formatTableForPrompt,
  isForbiddenTable,
} = require('./schema-registry');

// ── Domain → table mapping ──────────────────────────────────────────────────

const DOMAIN_TABLES = {
  appointments: [
    'appointments', 'patients', 'users',
  ],
  patients: [
    'patients', 'appointments', 'invoices', 'payments', 'treatment_plans',
  ],
  finance: [
    'invoices', 'payments', 'financial_movements', 'current_accounts',
    'current_account_transactions', 'payment_plans', 'installments',
    'patients', 'users', 'bank_accounts',
  ],
  treatment: [
    'treatment_items', 'treatment_plans', 'treatment_item_teeth',
    'treatment_sessions', 'users', 'patients', 'service_catalog',
  ],
  inventory: [
    'inventory_items', 'stock_categories', 'stock_expiry_batches',
    'stock_movements',
  ],
  lab: [
    'treatment_lab_relations', 'lab_materials', 'current_accounts',
    'patients', 'treatment_items', 'users',
  ],
  doctors: [
    'users', 'user_organizations', 'appointments', 'treatment_items',
    'payments', 'patients', 'treatment_plans',
  ],
  operational: [
    'appointments', 'patients', 'users', 'schedule_blocks',
  ],
};

/**
 * Get list of all known domains.
 */
function getDomainNames() {
  return Object.keys(DOMAIN_TABLES);
}

/**
 * Get table names for a single domain.
 */
function getTablesForDomain(domain) {
  return DOMAIN_TABLES[domain] || [];
}

/**
 * Build a schema slice from one or more domains.
 * Returns deduplicated table names, filtered columns, and relevant join paths.
 *
 * @param {string[]} domains - list of domain names
 * @returns {{ tables: string[], tableDefinitions: Object[], joinPaths: Object[], promptText: string }}
 */
function buildSchemaSlice(domains) {
  if (!domains || domains.length === 0) {
    domains = ['appointments']; // safe default
  }

  // Merge all tables from requested domains
  const tableSet = new Set();
  for (const domain of domains) {
    const tables = DOMAIN_TABLES[domain];
    if (tables) {
      for (const t of tables) {
        if (!isForbiddenTable(t)) {
          tableSet.add(t);
        }
      }
    }
  }

  const tableNames = Array.from(tableSet);

  // Build table definitions with visible columns
  const tableDefinitions = tableNames.map(name => {
    const table = getTable(name);
    if (!table) return null;
    return {
      name: table.table,
      description: table.description,
      columns: getVisibleColumns(name),
    };
  }).filter(Boolean);

  // Get relevant join paths
  const joinPaths = getJoinPathsForTables(tableNames);

  // Build prompt-friendly text
  const tableDDLs = tableNames.map(formatTableForPrompt).filter(Boolean);
  const joinLines = joinPaths.map(j => {
    const alias = j.alias ? ` (alias: ${j.alias})` : '';
    return `JOIN: ${j.on}${alias}`;
  });

  const promptText = [
    '=== AVAILABLE SCHEMA ===',
    '',
    tableDDLs.join('\n\n'),
    '',
    '=== JOIN PATHS ===',
    '',
    joinLines.join('\n'),
  ].join('\n');

  return {
    tables: tableNames,
    tableDefinitions,
    joinPaths,
    promptText,
  };
}

/**
 * Infer domains from a semantic read plan.
 * Falls back to broad coverage if no domains are specified.
 *
 * @param {Object} readPlan - semantic read plan
 * @returns {string[]}
 */
function inferDomainsFromPlan(readPlan) {
  if (readPlan.domains && readPlan.domains.length > 0) {
    return readPlan.domains.filter(d => DOMAIN_TABLES[d]);
  }

  // Infer from targetEntities
  const entities = readPlan.targetEntities || [];
  const inferred = new Set();

  for (const entity of entities) {
    const e = entity.toLowerCase();
    if (e.includes('appointment') || e.includes('randevu')) inferred.add('appointments');
    if (e.includes('patient') || e.includes('hasta')) inferred.add('patients');
    if (e.includes('invoice') || e.includes('payment') || e.includes('fatura') || e.includes('ödeme') || e.includes('tahsilat') || e.includes('ciro') || e.includes('gelir') || e.includes('borç') || e.includes('alacak')) inferred.add('finance');
    if (e.includes('treatment') || e.includes('tedavi')) inferred.add('treatment');
    if (e.includes('inventory') || e.includes('stock') || e.includes('stok')) inferred.add('inventory');
    if (e.includes('lab') || e.includes('laboratuvar')) inferred.add('lab');
    if (e.includes('doctor') || e.includes('doktor')) inferred.add('doctors');
  }

  // Fallback to appointments if nothing inferred
  return inferred.size > 0 ? Array.from(inferred) : ['appointments'];
}

module.exports = {
  DOMAIN_TABLES,
  getDomainNames,
  getTablesForDomain,
  buildSchemaSlice,
  inferDomainsFromPlan,
};
