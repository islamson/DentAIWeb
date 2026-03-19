/**
 * Canonical Metric Definitions — Semantic layer for READ pipeline.
 *
 * Maps business metrics to their correct semantic meaning.
 * Planner outputs business semantics; SQL generator uses these definitions
 * to produce correct queries. No SQL-level enum or filter invention.
 */

'use strict';

const METRICS = {
  appointment_count: 'appointment_count',
  doctor_appointment_count: 'doctor_appointment_count',
  completed_treatment_count: 'completed_treatment_count',
  collection_amount: 'collection_amount',
  pending_collection_amount: 'pending_collection_amount',
  female_patient_ratio: 'female_patient_ratio',
  cancellation_distribution_by_hour: 'cancellation_distribution_by_hour',
};

/**
 * Valid appointment statuses (from schema-registry appointments.status).
 * Planner must NOT invent values like ACTIVE.
 */
const APPOINTMENT_STATUS_VALUES = ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NOSHOW'];

/**
 * Valid treatment_item statuses.
 */
const TREATMENT_ITEM_STATUS_VALUES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

/**
 * Valid invoice statuses for pending collection.
 */
const INVOICE_STATUS_OPEN = ['OPEN', 'PARTIAL'];

/**
 * Canonical definition for each metric.
 * Used by SQL generator to build correct queries.
 */
const DEFINITIONS = {
  [METRICS.appointment_count]: {
    description: 'Toplam randevu sayısı',
    tables: ['appointments'],
    groupBy: null,
    filters: {
      status: null, // no default; planner may request CANCELLED etc.
    },
    timeColumn: 'startAt',
    requiresLimit: false,
  },

  [METRICS.doctor_appointment_count]: {
    description: 'Doktor bazlı randevu sayısı',
    tables: ['appointments', 'users'],
    join: 'appointments."doctorUserId" = users.id',
    entityFilter: { type: 'doctor', nameColumn: 'users.name', idColumn: 'appointments.doctorUserId' },
    timeColumn: 'startAt',
    requiresLimit: false,
  },

  [METRICS.completed_treatment_count]: {
    description: 'Tamamlanan tedavi kalemi sayısı',
    tables: ['treatment_items', 'users'],
    join: 'treatment_items."assignedDoctorId" = users.id',
    entityFilter: { type: 'doctor', nameColumn: 'users.name', idColumn: 'treatment_items.assignedDoctorId' },
    statusFilter: 'COMPLETED', // from TREATMENT_ITEM_STATUS_VALUES
    timeColumn: 'completedAt',
    requiresLimit: false,
  },

  [METRICS.collection_amount]: {
    description: 'Tahsil edilen tutar (ödenen ödemeler)',
    tables: ['payments', 'financial_movements'],
    filters: {
      deletedAt: null,
      isRefund: false,
    },
    timeColumn: 'paidAt',
    amountColumn: 'payments.amount',
    requiresLimit: false,
  },

  [METRICS.pending_collection_amount]: {
    description: 'Bekleyen tahsilat = Açık/ Kısmi faturaların kalan bakiyesi (invoice.netTotal - ödenen)',
    semanticNote: 'NOT "payments"."paidAt" IS NULL. Use "invoices" with status \'OPEN\' or \'PARTIAL\', sum("netTotal" - paid amount).',
    tables: ['invoices', 'payments'],
    filters: {
      invoiceStatus: INVOICE_STATUS_OPEN,
    },
    requiresLimit: false,
  },

  [METRICS.female_patient_ratio]: {
    description: 'Kadın hasta oranı (randevu alan hastalar içinde)',
    tables: ['appointments', 'patients'],
    join: 'appointments."patientId" = patients.id',
    groupBy: 'patients.gender',
    timeColumn: 'startAt',
    requiresLimit: false,
  },

  [METRICS.cancellation_distribution_by_hour]: {
    description: 'Randevu iptallerinin saat bazında dağılımı',
    tables: ['appointments'],
    statusFilter: 'CANCELLED',
    groupBy: 'EXTRACT(HOUR FROM appointments."startAt")',
    timeColumn: 'startAt',
    requiresLimit: true,
    defaultLimit: 24,
  },
};

function getMetricDefinition(metric) {
  return DEFINITIONS[metric] || null;
}

function getValidAppointmentStatuses() {
  return [...APPOINTMENT_STATUS_VALUES];
}

function getValidTreatmentItemStatuses() {
  return [...TREATMENT_ITEM_STATUS_VALUES];
}

function mapPlannerStatusToSchema(metric, plannerStatus) {
  if (!plannerStatus) return null;
  const u = String(plannerStatus).toUpperCase();
  if (metric === 'appointment_count' || metric === 'cancellation_distribution_by_hour') {
    return APPOINTMENT_STATUS_VALUES.includes(u) ? u : null;
  }
  if (metric === 'completed_treatment_count') {
    return TREATMENT_ITEM_STATUS_VALUES.includes(u) ? u : null;
  }
  return null;
}

module.exports = {
  METRICS,
  DEFINITIONS,
  APPOINTMENT_STATUS_VALUES,
  TREATMENT_ITEM_STATUS_VALUES,
  INVOICE_STATUS_OPEN,
  getMetricDefinition,
  getValidAppointmentStatuses,
  getValidTreatmentItemStatuses,
  mapPlannerStatusToSchema,
};
