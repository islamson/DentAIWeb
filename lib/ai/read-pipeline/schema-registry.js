/**
 * Schema Registry — Real database identifiers for the guarded text-to-SQL pipeline.
 *
 * SOURCE OF TRUTH: prisma/schema.prisma
 *
 * Prisma uses camelCase field names as the physical PostgreSQL column names.
 * Table names come from @@map() directives (snake_case).
 *
 * EVERY identifier in this file is taken directly from the Prisma schema.
 * The LLM receives exactly these identifiers — nothing invented.
 *
 * Column flags:
 *   scopeColumn  – injected by scope-injector.js, LLM must NOT filter on it
 *   forbidden    – never exposed to the LLM (e.g. password)
 *   pk           – primary key
 */

'use strict';

// ── Column shorthand helpers ────────────────────────────────────────────────
const pk   = (name = 'id')  => ({ name, type: 'TEXT', pk: true });
const scope = (name)        => ({ name, type: 'TEXT', scopeColumn: true });
const text  = (name)        => ({ name, type: 'TEXT' });
const int   = (name)        => ({ name, type: 'INTEGER' });
const ts    = (name)        => ({ name, type: 'TIMESTAMP' });
const bool  = (name)        => ({ name, type: 'BOOLEAN' });
const enm   = (name, vals)  => ({ name, type: 'ENUM', values: vals });
const fk    = (name, ref)   => ({ name, type: 'TEXT', fk: ref }); // ref = "table.column"

// ── Table definitions ───────────────────────────────────────────────────────
// Column names are EXACT camelCase identifiers from prisma/schema.prisma.
// Table names are EXACT @@map() identifiers.

const TABLES = {
  patients: {
    table: 'patients',
    description: 'Hasta kayıtları',
    columns: [
      pk(),
      scope('organizationId'),
      fk('branchId', 'branches.id'),
      fk('primaryDoctorId', 'user_organizations.id'),
      text('firstName'),
      text('lastName'),
      text('phone'),
      text('email'),
      text('nationalId'),
      ts('birthDate'),
      text('gender'),
      text('address'),
      text('notes'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  appointments: {
    table: 'appointments',
    description: 'Randevu kayıtları',
    columns: [
      pk(),
      scope('organizationId'),
      fk('branchId', 'branches.id'),
      fk('patientId', 'patients.id'),
      fk('doctorUserId', 'users.id'),
      text('roomResource'),
      ts('startAt'),
      ts('endAt'),
      int('durationMinutes'),
      enm('appointmentType', ['CONSULTATION','ORTHODONTICS','TREATMENT','SURGERY','ROOT_CANAL','CONTROL','TRYON','IMPLANT','OTHER']),
      enm('status', ['SCHEDULED','CONFIRMED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','NOSHOW']),
      text('reason'),
      text('notes'),
      bool('reminderSent'),
      bool('sendSms'),
      int('noShowRisk'),
      bool('isUrgent'),
      text('guestFirstName'),
      text('guestLastName'),
      text('guestPhone'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  users: {
    table: 'users',
    description: 'Sistem kullanıcıları (doktorlar dahil)',
    columns: [
      pk(),
      text('name'),
      { name: 'email', type: 'TEXT', forbidden: true },
      { name: 'password', type: 'TEXT', forbidden: true },
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  user_organizations: {
    table: 'user_organizations',
    description: 'Kullanıcı-organizasyon ilişkileri ve roller',
    columns: [
      pk(),
      fk('userId', 'users.id'),
      scope('organizationId'),
      fk('branchId', 'branches.id'),
      enm('role', ['OWNER','ADMIN','MANAGER','DOCTOR','ASSISTANT','RECEPTION','ACCOUNTING','INVENTORY','CALLCENTER','READONLY']),
      ts('createdAt'),
    ],
  },

  invoices: {
    table: 'invoices',
    description: 'Fatura kayıtları',
    columns: [
      pk(),
      scope('organizationId'),
      fk('branchId', 'branches.id'),
      fk('patientId', 'patients.id'),
      text('number'),
      int('total'),
      int('tax'),
      int('discount'),
      int('netTotal'),
      enm('status', ['OPEN','PARTIAL','PAID','VOID','REFUNDED']),
      text('notes'),
      ts('dueDate'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  payments: {
    table: 'payments',
    description: 'Ödeme kayıtları',
    columns: [
      pk(),
      scope('organizationId'),
      fk('patientId', 'patients.id'),
      fk('invoiceId', 'invoices.id'),
      fk('treatmentPlanId', 'treatment_plans.id'),
      fk('doctorId', 'users.id'),
      int('amount'),
      enm('method', ['CASH','CARD','BANK_TRANSFER','ONLINE','OTHER']),
      text('reference'),
      text('notes'),
      ts('paidAt'),
      ts('createdAt'),
      ts('deletedAt'),
      text('deletedBy'),
      text('voidReason'),
      int('vatRate'),
      bool('isRefund'),
      ts('updatedAt'),
    ],
  },

  treatment_plans: {
    table: 'treatment_plans',
    description: 'Tedavi planları',
    columns: [
      pk(),
      scope('organizationId'),
      fk('branchId', 'branches.id'),
      fk('patientId', 'patients.id'),
      fk('doctorUserId', 'users.id'),
      text('title'),
      enm('status', ['DRAFT','PROPOSED','APPROVED','REJECTED','IN_PROGRESS','COMPLETED','CANCELLED']),
      bool('isActive'),
      int('totalPrice'),
      int('plannedTotal'),
      int('completedTotal'),
      ts('approvedAt'),
      text('approvedBy'),
      int('version'),
      text('notes'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  treatment_items: {
    table: 'treatment_items',
    description: 'Tedavi kalemleri (her bir tedavi işlemi)',
    columns: [
      pk(),
      fk('treatmentPlanId', 'treatment_plans.id'),
      scope('organizationId'),
      fk('catalogServiceId', 'service_catalog.id'),
      fk('assignedDoctorId', 'users.id'),
      text('code'),
      text('name'),
      text('tooth'),
      text('surface'),
      int('price'),
      int('quantity'),
      int('discount'),
      int('progress'),
      enm('status', ['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED']),
      text('notes'),
      ts('completedAt'),
      ts('createdAt'),
      ts('updatedAt'),
      text('parentItemId'),
      text('sessionId'),
    ],
  },

  treatment_item_teeth: {
    table: 'treatment_item_teeth',
    description: 'Tedavi kalemi - diş ilişkisi',
    columns: [
      pk(),
      fk('treatmentItemId', 'treatment_items.id'),
      text('toothCode'),
    ],
  },

  treatment_sessions: {
    table: 'treatment_sessions',
    description: 'Tedavi seansları',
    columns: [
      pk(),
      scope('organizationId'),
      fk('treatmentItemId', 'treatment_items.id'),
      fk('doctorId', 'users.id'),
      fk('treatmentPlanId', 'treatment_plans.id'),
      ts('sessionDate'),
      enm('status', ['PLANNED','COMPLETED','CANCELLED']),
      int('amount'),
      text('notes'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  service_catalog: {
    table: 'service_catalog',
    description: 'Hizmet kataloğu (tedavi türleri)',
    columns: [
      pk(),
      scope('organizationId'),
      text('name'),
      text('category'),
      int('defaultPrice'),
      bool('active'),
      bool('requiresLab'),
      text('description'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  financial_movements: {
    table: 'financial_movements',
    description: 'Finansal hareketler (tüm para akışı)',
    columns: [
      pk(),
      scope('organizationId'),
      enm('type', ['PAYMENT','TREATMENT_COST','INVOICE','CARI_TX','REFUND','BANK_TX','EXPENSE','ADJUSTMENT']),
      enm('sourceType', ['PAYMENT','TREATMENT_ITEM','INVOICE','CARI_TRANSACTION','BANK_TRANSACTION','MANUAL']),
      text('sourceId'),
      fk('patientId', 'patients.id'),
      fk('currentAccountId', 'current_accounts.id'),
      fk('doctorId', 'users.id'),
      fk('bankAccountId', 'bank_accounts.id'),
      text('description'),
      int('amount'),
      int('vatRate'),
      enm('paymentMethod', ['CASH','CARD','BANK_TRANSFER','ONLINE','OTHER']),
      ts('occurredAt'),
      text('reference'),
      enm('status', ['ACTIVE','VOIDED','CANCELLED']),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  current_accounts: {
    table: 'current_accounts',
    description: 'Cari hesaplar (tedarikçi, lab, vs.)',
    columns: [
      pk(),
      scope('organizationId'),
      text('name'),
      enm('type', ['SUPPLIER','LAB','EXTERNAL_INSTITUTION','VENDOR','DOCTOR','PERSONNEL','HEALTH_AGENCY','OPERATING_EXPENSE','MEDICAL','BANK','CASH','OTHER']),
      text('phone'),
      text('contactName'),
      text('taxOffice'),
      text('taxNumber'),
      text('address'),
      text('note'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  current_account_transactions: {
    table: 'current_account_transactions',
    description: 'Cari hesap hareketleri (borç/alacak)',
    columns: [
      pk(),
      scope('organizationId'),
      fk('currentAccountId', 'current_accounts.id'),
      enm('transactionType', ['DEBIT','CREDIT']),
      text('description'),
      int('debit'),
      int('credit'),
      ts('occurredAt'),
      text('reference'),
      text('relatedEntityType'),
      text('relatedEntityId'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  inventory_items: {
    table: 'inventory_items',
    description: 'Stok kalemleri',
    columns: [
      pk(),
      scope('organizationId'),
      fk('branchId', 'branches.id'),
      fk('categoryId', 'stock_categories.id'),
      text('sku'),
      text('barcode'),
      text('name'),
      text('description'),
      text('unit'),
      int('vatRate'),
      int('minLevel'),
      int('currentStock'),
      int('cost'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  stock_categories: {
    table: 'stock_categories',
    description: 'Stok kategorileri',
    columns: [
      pk(),
      scope('organizationId'),
      text('name'),
      bool('isActive'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  stock_expiry_batches: {
    table: 'stock_expiry_batches',
    description: 'Stok son kullanma tarihi partileri',
    columns: [
      pk(),
      scope('organizationId'),
      fk('inventoryItemId', 'inventory_items.id'),
      int('quantity'),
      ts('expiryDate'),
      text('notes'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  stock_movements: {
    table: 'stock_movements',
    description: 'Stok hareketleri (giriş/çıkış)',
    columns: [
      pk(),
      fk('inventoryItemId', 'inventory_items.id'),
      int('qty'),
      enm('type', ['IN','OUT','ADJUST','RETURN']),
      fk('outputDirectionId', 'stock_output_directions.id'),
      int('totalPrice'),
      text('reference'),
      text('notes'),
      text('createdBy'),
      ts('occurredAt'),
      ts('createdAt'),
    ],
  },

  payment_plans: {
    table: 'payment_plans',
    description: 'Taksit planları',
    columns: [
      pk(),
      scope('organizationId'),
      fk('patientId', 'patients.id'),
      int('totalAmount'),
      text('notes'),
      enm('status', ['ACTIVE','COMPLETED','CANCELLED']),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  installments: {
    table: 'installments',
    description: 'Taksitler',
    columns: [
      pk(),
      fk('paymentPlanId', 'payment_plans.id'),
      int('amount'),
      ts('dueDate'),
      enm('status', ['PENDING','PAID','CANCELLED']),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  lab_materials: {
    table: 'lab_materials',
    description: 'Laboratuvar malzemeleri',
    columns: [
      pk(),
      scope('organizationId'),
      fk('labSupplierId', 'current_accounts.id'),
      text('name'),
      int('unitPrice'),
      int('vatRate'),
      text('currency'),
      bool('isActive'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  treatment_lab_relations: {
    table: 'treatment_lab_relations',
    description: 'Tedavi-laboratuvar ilişkileri',
    columns: [
      pk(),
      scope('organizationId'),
      fk('treatmentItemId', 'treatment_items.id'),
      fk('patientId', 'patients.id'),
      fk('labSupplierId', 'current_accounts.id'),
      fk('labMaterialId', 'lab_materials.id'),
      fk('responsibleUserId', 'users.id'),
      fk('doctorId', 'users.id'),
      int('price'),
      int('quantity'),
      text('color'),
      enm('status', ['PENDING','IN_PRODUCTION','READY','DELIVERED','CANCELLED']),
      int('completionRate'),
      int('completionPriceRate'),
      text('description'),
      ts('deletedAt'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  bank_accounts: {
    table: 'bank_accounts',
    description: 'Banka hesapları',
    columns: [
      pk(),
      scope('organizationId'),
      text('name'),
      enm('type', ['BANK','CASH']),
      text('bankName'),
      text('accountNumber'),
      text('iban'),
      int('currentBalance'),
      bool('isDefault'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },

  schedule_blocks: {
    table: 'schedule_blocks',
    description: 'Doktor takvim blokları',
    columns: [
      pk(),
      scope('organizationId'),
      fk('doctorUserId', 'users.id'),
      ts('startAt'),
      ts('endAt'),
      enm('type', ['WORKING','BREAK','BLOCKED']),
      text('title'),
      ts('createdAt'),
    ],
  },

  branches: {
    table: 'branches',
    description: 'Şubeler',
    columns: [
      pk(),
      scope('organizationId'),
      text('name'),
      text('address'),
      text('phone'),
      ts('createdAt'),
      ts('updatedAt'),
    ],
  },
};

// ── Forbidden tables — never exposed to LLM ─────────────────────────────
const FORBIDDEN_TABLES = new Set([
  'ai_request_logs',
  'ai_jobs',
  'audit_logs',
  'activity_logs',
  'organizations',  // scope-only, not queryable
]);

// ── Forbidden columns by table ───────────────────────────────────────────
const FORBIDDEN_COLUMNS = {
  users: new Set(['password', 'email']),
};

// ── Join paths (pre-defined for the SQL generator) ───────────────────────
// All column references use exact camelCase identifiers from Prisma schema.
const JOIN_PATHS = [
  { from: 'appointments', to: 'patients',           on: 'appointments."patientId" = patients.id' },
  { from: 'appointments', to: 'users',              on: 'appointments."doctorUserId" = users.id', alias: 'doctor' },
  { from: 'invoices',     to: 'patients',           on: 'invoices."patientId" = patients.id' },
  { from: 'payments',     to: 'patients',           on: 'payments."patientId" = patients.id' },
  { from: 'payments',     to: 'invoices',           on: 'payments."invoiceId" = invoices.id' },
  { from: 'payments',     to: 'users',              on: 'payments."doctorId" = users.id', alias: 'doctor' },
  { from: 'payments',     to: 'treatment_plans',    on: 'payments."treatmentPlanId" = treatment_plans.id' },
  { from: 'treatment_plans', to: 'patients',        on: 'treatment_plans."patientId" = patients.id' },
  { from: 'treatment_plans', to: 'users',           on: 'treatment_plans."doctorUserId" = users.id', alias: 'doctor' },
  { from: 'treatment_items', to: 'treatment_plans', on: 'treatment_items."treatmentPlanId" = treatment_plans.id' },
  { from: 'treatment_items', to: 'users',           on: 'treatment_items."assignedDoctorId" = users.id', alias: 'doctor' },
  { from: 'treatment_items', to: 'service_catalog', on: 'treatment_items."catalogServiceId" = service_catalog.id' },
  { from: 'treatment_item_teeth', to: 'treatment_items', on: 'treatment_item_teeth."treatmentItemId" = treatment_items.id' },
  { from: 'treatment_sessions', to: 'treatment_items',   on: 'treatment_sessions."treatmentItemId" = treatment_items.id' },
  { from: 'treatment_sessions', to: 'users',             on: 'treatment_sessions."doctorId" = users.id', alias: 'doctor' },
  { from: 'treatment_sessions', to: 'treatment_plans',   on: 'treatment_sessions."treatmentPlanId" = treatment_plans.id' },
  { from: 'financial_movements', to: 'patients',          on: 'financial_movements."patientId" = patients.id' },
  { from: 'financial_movements', to: 'users',             on: 'financial_movements."doctorId" = users.id', alias: 'doctor' },
  { from: 'financial_movements', to: 'current_accounts',  on: 'financial_movements."currentAccountId" = current_accounts.id' },
  { from: 'financial_movements', to: 'bank_accounts',     on: 'financial_movements."bankAccountId" = bank_accounts.id' },
  { from: 'current_account_transactions', to: 'current_accounts', on: 'current_account_transactions."currentAccountId" = current_accounts.id' },
  { from: 'inventory_items', to: 'stock_categories',     on: 'inventory_items."categoryId" = stock_categories.id' },
  { from: 'stock_expiry_batches', to: 'inventory_items', on: 'stock_expiry_batches."inventoryItemId" = inventory_items.id' },
  { from: 'stock_movements', to: 'inventory_items',      on: 'stock_movements."inventoryItemId" = inventory_items.id' },
  { from: 'payment_plans', to: 'patients',               on: 'payment_plans."patientId" = patients.id' },
  { from: 'installments', to: 'payment_plans',            on: 'installments."paymentPlanId" = payment_plans.id' },
  { from: 'lab_materials', to: 'current_accounts',        on: 'lab_materials."labSupplierId" = current_accounts.id', alias: 'supplier' },
  { from: 'treatment_lab_relations', to: 'treatment_items', on: 'treatment_lab_relations."treatmentItemId" = treatment_items.id' },
  { from: 'treatment_lab_relations', to: 'patients',        on: 'treatment_lab_relations."patientId" = patients.id' },
  { from: 'treatment_lab_relations', to: 'current_accounts', on: 'treatment_lab_relations."labSupplierId" = current_accounts.id', alias: 'supplier' },
  { from: 'treatment_lab_relations', to: 'lab_materials',    on: 'treatment_lab_relations."labMaterialId" = lab_materials.id' },
  { from: 'treatment_lab_relations', to: 'users',           on: 'treatment_lab_relations."doctorId" = users.id', alias: 'doctor' },
  { from: 'user_organizations', to: 'users',               on: 'user_organizations."userId" = users.id' },
  { from: 'schedule_blocks', to: 'users',                  on: 'schedule_blocks."doctorUserId" = users.id', alias: 'doctor' },
];

// ── Build a lookup set of all valid column names ─────────────────────────
const ALL_COLUMNS_BY_TABLE = {};
for (const [key, def] of Object.entries(TABLES)) {
  ALL_COLUMNS_BY_TABLE[def.table] = new Set(def.columns.map(c => c.name));
}

/**
 * Get all table names (excluding forbidden).
 */
function getAllTableNames() {
  return Object.keys(TABLES);
}

/**
 * Get table definition by name.
 */
function getTable(tableName) {
  return TABLES[tableName] || null;
}

/**
 * Get columns for a table, excluding forbidden columns.
 */
function getVisibleColumns(tableName) {
  const table = TABLES[tableName];
  if (!table) return [];
  const forbidden = FORBIDDEN_COLUMNS[tableName] || new Set();
  return table.columns.filter(c => !c.forbidden && !forbidden.has(c.name));
}

/**
 * Get scope columns for a table (organizationId, branchId).
 */
function getScopeColumns(tableName) {
  const table = TABLES[tableName];
  if (!table) return [];
  return table.columns.filter(c => c.scopeColumn).map(c => c.name);
}

/**
 * Check if a table is forbidden.
 */
function isForbiddenTable(tableName) {
  return FORBIDDEN_TABLES.has(tableName);
}

/**
 * Check if a column exists on a table.
 */
function isValidColumn(tableName, columnName) {
  const cols = ALL_COLUMNS_BY_TABLE[tableName];
  return cols ? cols.has(columnName) : false;
}

/**
 * Get all valid column names for a table (including scope/forbidden).
 */
function getAllColumnNames(tableName) {
  return ALL_COLUMNS_BY_TABLE[tableName] || new Set();
}

/**
 * Get join paths for given set of table names.
 */
function getJoinPathsForTables(tableNames) {
  const tableSet = new Set(tableNames);
  return JOIN_PATHS.filter(j => tableSet.has(j.from) && tableSet.has(j.to));
}

/**
 * Format a table definition as DDL-like text for the LLM prompt.
 * Uses double-quoted camelCase identifiers so the LLM produces valid PostgreSQL.
 */
function formatTableForPrompt(tableName) {
  const table = TABLES[tableName];
  if (!table) return '';
  const cols = getVisibleColumns(tableName);
  const colLines = cols
    .filter(c => !c.scopeColumn) // hide scope columns from LLM
    .map(c => {
      let desc = `  "${c.name}" ${c.type}`;
      if (c.pk) desc += ' PRIMARY KEY';
      if (c.fk) desc += ` REFERENCES ${c.fk}`;
      if (c.values) desc += ` (${c.values.join(', ')})`;
      return desc;
    });
  return `-- ${table.description}\nTABLE ${table.table} (\n${colLines.join(',\n')}\n)`;
}

module.exports = {
  TABLES,
  FORBIDDEN_TABLES,
  FORBIDDEN_COLUMNS,
  JOIN_PATHS,
  ALL_COLUMNS_BY_TABLE,
  getAllTableNames,
  getTable,
  getVisibleColumns,
  getScopeColumns,
  isForbiddenTable,
  isValidColumn,
  getAllColumnNames,
  getJoinPathsForTables,
  formatTableForPrompt,
};
