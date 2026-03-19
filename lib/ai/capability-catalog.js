/**
 * Capability Catalog - Single source of truth for all supported AI capabilities.
 *
 * Every capability declares:
 *  - capability name (canonical)
 *  - intent
 *  - metric
 *  - outputShape (count | amount | ratio | list | summary)
 *  - requiredEntities
 *  - requiredFilters
 *  - retrievalName
 *  - layer: 'atomic' (all entries here are atomic; composite capabilities live in composite-catalog.js)
 *
 * The grounding guard, semantic validator, and pipeline all reference this catalog
 * to determine whether retrieved data matches the expected output shape.
 */

const { INTENTS, METRICS, OUTPUT_SHAPES } = require('./assistant-contracts');

/**
 * Canonical capability catalog.
 * Key = `${intent}:${metric}` for fast lookup.
 */
const CAPABILITY_CATALOG = {
  // ═══════════════════════════════════════════════════════════════
  // CLINIC FINANCE / MONEY
  // ═══════════════════════════════════════════════════════════════
  [`${INTENTS.finance_summary}:${METRICS.revenue_amount}`]: {
    capability: 'clinic_revenue_amount',
    intent: INTENTS.finance_summary,
    metric: METRICS.revenue_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicMonthlyRevenue',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.collection_amount}`]: {
    capability: 'clinic_collection_amount',
    intent: INTENTS.finance_summary,
    metric: METRICS.collection_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicMonthlyCollection',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.pending_collection_amount}`]: {
    capability: 'clinic_pending_collection_amount',
    intent: INTENTS.finance_summary,
    metric: METRICS.pending_collection_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicPendingCollectionAmount',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.outstanding_balance_amount}`]: {
    capability: 'clinic_outstanding_balance_amount',
    intent: INTENTS.finance_summary,
    metric: METRICS.outstanding_balance_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicOutstandingReceivables',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.overdue_receivables_amount}`]: {
    capability: 'clinic_overdue_receivables_amount',
    intent: INTENTS.finance_summary,
    metric: METRICS.overdue_receivables_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getOverdueReceivablesSummary',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.overdue_patient_list}`]: {
    capability: 'clinic_overdue_patient_list',
    intent: INTENTS.finance_summary,
    metric: METRICS.overdue_patient_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getDebtorPatientList',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.avg_invoice_amount}`]: {
    capability: 'clinic_avg_invoice_amount',
    intent: INTENTS.finance_summary,
    metric: METRICS.avg_invoice_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicAvgInvoiceAmount',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.avg_payment_amount}`]: {
    capability: 'clinic_avg_payment_amount',
    intent: INTENTS.finance_summary,
    metric: METRICS.avg_payment_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicAvgPaymentAmount',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.discount_total_amount}`]: {
    capability: 'clinic_discount_total',
    intent: INTENTS.finance_summary,
    metric: METRICS.discount_total_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicDiscountTotal',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.invoice_count}`]: {
    capability: 'clinic_invoice_count',
    intent: INTENTS.finance_summary,
    metric: METRICS.invoice_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicInvoiceCount',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.payment_count}`]: {
    capability: 'clinic_payment_count',
    intent: INTENTS.finance_summary,
    metric: METRICS.payment_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicPaymentCount',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.collection_rate}`]: {
    capability: 'clinic_collection_rate',
    intent: INTENTS.finance_summary,
    metric: METRICS.collection_rate,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicCollectionRate',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.overdue_ratio}`]: {
    capability: 'clinic_overdue_ratio',
    intent: INTENTS.finance_summary,
    metric: METRICS.overdue_ratio,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicOverdueRatio',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.debtor_patient_list}`]: {
    capability: 'clinic_debtor_patient_list',
    intent: INTENTS.finance_summary,
    metric: METRICS.debtor_patient_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getDebtorPatientList',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.top_revenue_patients}`]: {
    capability: 'clinic_top_revenue_patients',
    intent: INTENTS.finance_summary,
    metric: METRICS.top_revenue_patients,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getTopRevenuePatients',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.top_revenue_doctors}`]: {
    capability: 'clinic_top_revenue_doctors',
    intent: INTENTS.finance_summary,
    metric: METRICS.top_revenue_doctors,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getTopRevenueDoctors',
    layer: 'atomic',
  },

  // ═══════════════════════════════════════════════════════════════
  // CLINIC PATIENT ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  [`${INTENTS.clinic_patient_analysis}:${METRICS.patient_count}`]: {
    capability: 'clinic_patient_count',
    intent: INTENTS.clinic_patient_analysis,
    metric: METRICS.patient_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicPatientCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_patient_analysis}:${METRICS.new_patient_count}`]: {
    capability: 'clinic_new_patient_count',
    intent: INTENTS.clinic_patient_analysis,
    metric: METRICS.new_patient_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicNewPatientCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_patient_analysis}:${METRICS.active_patient_count}`]: {
    capability: 'clinic_active_patient_count',
    intent: INTENTS.clinic_patient_analysis,
    metric: METRICS.active_patient_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicActivePatientCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_patient_analysis}:${METRICS.inactive_patient_count}`]: {
    capability: 'clinic_inactive_patient_count',
    intent: INTENTS.clinic_patient_analysis,
    metric: METRICS.inactive_patient_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicInactivePatientCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_patient_analysis}:${METRICS.new_patients_list}`]: {
    capability: 'clinic_new_patients_list',
    intent: INTENTS.clinic_patient_analysis,
    metric: METRICS.new_patients_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicNewPatientsList',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_patient_demographics}:${METRICS.patient_gender_ratio}`]: {
    capability: 'clinic_patient_gender_ratio',
    intent: INTENTS.clinic_patient_demographics,
    metric: METRICS.patient_gender_ratio,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicAppointmentDemographicsByGender',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_patient_demographics}:${METRICS.appointment_patient_count_by_gender}`]: {
    capability: 'clinic_patient_count_by_gender',
    intent: INTENTS.clinic_patient_demographics,
    metric: METRICS.appointment_patient_count_by_gender,
    outputShape: OUTPUT_SHAPES.summary,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicAppointmentDemographicsByGender',
    layer: 'atomic',
  },

  // ═══════════════════════════════════════════════════════════════
  // CLINIC APPOINTMENT ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.appointment_count}`]: {
    capability: 'clinic_appointment_count',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.appointment_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicMonthlyAppointmentCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.appointment_list}`]: {
    capability: 'clinic_appointment_list',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.appointment_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicMonthlyAppointmentList',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.completed_appointment_count}`]: {
    capability: 'clinic_completed_appointment_count',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.completed_appointment_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicCompletedAppointmentCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.cancelled_appointment_count}`]: {
    capability: 'clinic_cancelled_appointment_count',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.cancelled_appointment_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicCancelledAppointmentCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.no_show_count}`]: {
    capability: 'clinic_no_show_count',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.no_show_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicNoShowCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.no_show_rate}`]: {
    capability: 'clinic_no_show_rate',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.no_show_rate,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicNoShowRate',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.cancellation_rate}`]: {
    capability: 'clinic_cancellation_rate',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.cancellation_rate,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicCancellationRate',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.completed_treatment_count}`]: {
    capability: 'clinic_completed_treatment_count',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.completed_treatment_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicCompletedTreatmentCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.no_show_patients_list}`]: {
    capability: 'clinic_no_show_patients_list',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.no_show_patients_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicNoShowPatientsList',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.cancelled_appointments_list}`]: {
    capability: 'clinic_cancelled_appointments_list',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.cancelled_appointments_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicCancelledAppointmentsList',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_appointment_analysis}:${METRICS.appointment_fill_rate}`]: {
    capability: 'clinic_appointment_fill_rate',
    intent: INTENTS.clinic_appointment_analysis,
    metric: METRICS.appointment_fill_rate,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicAppointmentFillRate',
    layer: 'atomic',
  },

  // ═══════════════════════════════════════════════════════════════
  // CLINIC TREATMENT ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  [`${INTENTS.clinic_treatment_analysis}:${METRICS.treatment_item_count}`]: {
    capability: 'clinic_treatment_item_count',
    intent: INTENTS.clinic_treatment_analysis,
    metric: METRICS.treatment_item_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicTreatmentItemCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_treatment_analysis}:${METRICS.completed_treatment_item_count}`]: {
    capability: 'clinic_completed_treatment_item_count',
    intent: INTENTS.clinic_treatment_analysis,
    metric: METRICS.completed_treatment_item_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicCompletedTreatmentItemCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_treatment_analysis}:${METRICS.treatment_completion_rate}`]: {
    capability: 'clinic_treatment_completion_rate',
    intent: INTENTS.clinic_treatment_analysis,
    metric: METRICS.treatment_completion_rate,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicTreatmentCompletionRate',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_treatment_analysis}:${METRICS.completed_treatment_list}`]: {
    capability: 'clinic_completed_treatment_list',
    intent: INTENTS.clinic_treatment_analysis,
    metric: METRICS.completed_treatment_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicCompletedTreatmentList',
    layer: 'atomic',
  },

  // ═══════════════════════════════════════════════════════════════
  // CLINIC INVENTORY / STOCK
  // ═══════════════════════════════════════════════════════════════
  [`${INTENTS.inventory_low_stock}:${METRICS.low_stock_list}`]: {
    capability: 'clinic_low_stock_list',
    intent: INTENTS.inventory_low_stock,
    metric: METRICS.low_stock_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getLowStockProducts',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_inventory_analysis}:${METRICS.inventory_item_count}`]: {
    capability: 'clinic_inventory_item_count',
    intent: INTENTS.clinic_inventory_analysis,
    metric: METRICS.inventory_item_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicInventoryItemCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_inventory_analysis}:${METRICS.low_stock_item_count}`]: {
    capability: 'clinic_low_stock_item_count',
    intent: INTENTS.clinic_inventory_analysis,
    metric: METRICS.low_stock_item_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicLowStockItemCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_inventory_analysis}:${METRICS.expiring_stock_count}`]: {
    capability: 'clinic_expiring_stock_count',
    intent: INTENTS.clinic_inventory_analysis,
    metric: METRICS.expiring_stock_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicExpiringStockCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_inventory_analysis}:${METRICS.stock_value_total}`]: {
    capability: 'clinic_stock_value_total',
    intent: INTENTS.clinic_inventory_analysis,
    metric: METRICS.stock_value_total,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicStockValueTotal',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_inventory_analysis}:${METRICS.expiring_stock_list}`]: {
    capability: 'clinic_expiring_stock_list',
    intent: INTENTS.clinic_inventory_analysis,
    metric: METRICS.expiring_stock_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicExpiringStockList',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_inventory_analysis}:${METRICS.stock_by_category}`]: {
    capability: 'clinic_stock_by_category',
    intent: INTENTS.clinic_inventory_analysis,
    metric: METRICS.stock_by_category,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicStockByCategory',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_inventory_analysis}:${METRICS.low_stock_ratio}`]: {
    capability: 'clinic_low_stock_ratio',
    intent: INTENTS.clinic_inventory_analysis,
    metric: METRICS.low_stock_ratio,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicLowStockRatio',
    layer: 'atomic',
  },

  // ═══════════════════════════════════════════════════════════════
  // CLINIC LAB ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  [`${INTENTS.clinic_lab_analysis}:${METRICS.lab_case_count}`]: {
    capability: 'clinic_lab_case_count',
    intent: INTENTS.clinic_lab_analysis,
    metric: METRICS.lab_case_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicLabCaseCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_lab_analysis}:${METRICS.pending_lab_case_count}`]: {
    capability: 'clinic_pending_lab_case_count',
    intent: INTENTS.clinic_lab_analysis,
    metric: METRICS.pending_lab_case_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicPendingLabCaseCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_lab_analysis}:${METRICS.completed_lab_case_count}`]: {
    capability: 'clinic_completed_lab_case_count',
    intent: INTENTS.clinic_lab_analysis,
    metric: METRICS.completed_lab_case_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicCompletedLabCaseCount',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_lab_analysis}:${METRICS.lab_cost_total}`]: {
    capability: 'clinic_lab_cost_total',
    intent: INTENTS.clinic_lab_analysis,
    metric: METRICS.lab_cost_total,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicLabCostTotal',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_lab_analysis}:${METRICS.pending_lab_list}`]: {
    capability: 'clinic_pending_lab_list',
    intent: INTENTS.clinic_lab_analysis,
    metric: METRICS.pending_lab_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicPendingLabList',
    layer: 'atomic',
  },
  [`${INTENTS.clinic_lab_analysis}:${METRICS.lab_completion_rate}`]: {
    capability: 'clinic_lab_completion_rate',
    intent: INTENTS.clinic_lab_analysis,
    metric: METRICS.lab_completion_rate,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: [],
    requiredFilters: ['timeScope'],
    retrievalName: 'getClinicLabCompletionRate',
    layer: 'atomic',
  },

  // ═══════════════════════════════════════════════════════════════
  // DOCTOR CAPABILITIES
  // ═══════════════════════════════════════════════════════════════
  [`${INTENTS.doctor_appointment_analysis}:${METRICS.appointment_count}`]: {
    capability: 'doctor_appointment_count',
    intent: INTENTS.doctor_appointment_analysis,
    metric: METRICS.appointment_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: ['doctor'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getDoctorMonthlyAppointmentCount',
    layer: 'atomic',
  },
  [`${INTENTS.doctor_appointment_analysis}:${METRICS.appointment_list}`]: {
    capability: 'doctor_appointment_list',
    intent: INTENTS.doctor_appointment_analysis,
    metric: METRICS.appointment_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: ['doctor'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getDoctorAppointmentList',
    layer: 'atomic',
  },
  [`${INTENTS.doctor_schedule}:${METRICS.schedule_list}`]: {
    capability: 'doctor_schedule',
    intent: INTENTS.doctor_schedule,
    metric: METRICS.schedule_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: ['doctor'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getDoctorScheduleContext',
    layer: 'atomic',
  },
  [`${INTENTS.doctor_treatment_performance}:${METRICS.completed_treatment_item_count}`]: {
    capability: 'doctor_completed_treatment_item_count',
    intent: INTENTS.doctor_treatment_performance,
    metric: METRICS.completed_treatment_item_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: ['doctor'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getDoctorCompletedTreatmentItemCount',
    layer: 'atomic',
  },
  [`${INTENTS.doctor_treatment_performance}:${METRICS.completed_treatment_value}`]: {
    capability: 'doctor_completed_treatment_value',
    intent: INTENTS.doctor_treatment_performance,
    metric: METRICS.completed_treatment_value,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: ['doctor'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getDoctorCompletedTreatmentValue',
    layer: 'atomic',
  },
  [`${INTENTS.doctor_revenue_analysis}:${METRICS.doctor_revenue_amount}`]: {
    capability: 'doctor_revenue_amount',
    intent: INTENTS.doctor_revenue_analysis,
    metric: METRICS.doctor_revenue_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: ['doctor'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getDoctorRevenueAmount',
    layer: 'atomic',
  },
  [`${INTENTS.doctor_revenue_analysis}:${METRICS.doctor_collection_amount}`]: {
    capability: 'doctor_collection_amount',
    intent: INTENTS.doctor_revenue_analysis,
    metric: METRICS.doctor_collection_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: ['doctor'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getDoctorCollectionAmount',
    layer: 'atomic',
  },
  [`${INTENTS.doctor_revenue_analysis}:${METRICS.doctor_patient_count}`]: {
    capability: 'doctor_patient_count',
    intent: INTENTS.doctor_revenue_analysis,
    metric: METRICS.doctor_patient_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: ['doctor'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getDoctorPatientCount',
    layer: 'atomic',
  },

  // ═══════════════════════════════════════════════════════════════
  // PATIENT CAPABILITIES
  // ═══════════════════════════════════════════════════════════════
  [`${INTENTS.patient_balance}:${METRICS.outstanding_balance_amount}`]: {
    capability: 'patient_balance',
    intent: INTENTS.patient_balance,
    metric: METRICS.outstanding_balance_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: ['patient'],
    requiredFilters: [],
    retrievalName: 'getPatientBalanceContext',
    layer: 'atomic',
  },
  [`${INTENTS.patient_balance}:${METRICS.patient_invoice_amount}`]: {
    capability: 'patient_total_invoice_amount',
    intent: INTENTS.patient_balance,
    metric: METRICS.patient_invoice_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: ['patient'],
    requiredFilters: [],
    retrievalName: 'getPatientInvoiceTotal',
    layer: 'atomic',
  },
  [`${INTENTS.patient_balance}:${METRICS.patient_paid_amount}`]: {
    capability: 'patient_total_paid_amount',
    intent: INTENTS.patient_balance,
    metric: METRICS.patient_paid_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: ['patient'],
    requiredFilters: [],
    retrievalName: 'getPatientPaidTotal',
    layer: 'atomic',
  },
  [`${INTENTS.patient_treatment_progress}:${METRICS.completion_percentage}`]: {
    capability: 'patient_treatment_progress',
    intent: INTENTS.patient_treatment_progress,
    metric: METRICS.completion_percentage,
    outputShape: OUTPUT_SHAPES.ratio,
    requiredEntities: ['patient'],
    requiredFilters: [],
    retrievalName: 'getPatientTreatmentProgress',
    layer: 'atomic',
  },
  [`${INTENTS.patient_treatment_progress}:${METRICS.completed_treatment_value}`]: {
    capability: 'patient_completed_treatment_value',
    intent: INTENTS.patient_treatment_progress,
    metric: METRICS.completed_treatment_value,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: ['patient'],
    requiredFilters: [],
    retrievalName: 'getPatientTreatmentProgress',
    layer: 'atomic',
  },
  [`${INTENTS.patient_appointment_analysis}:${METRICS.appointment_count}`]: {
    capability: 'patient_appointment_count',
    intent: INTENTS.patient_appointment_analysis,
    metric: METRICS.appointment_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: ['patient'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getPatientAppointmentCount',
    layer: 'atomic',
  },
  [`${INTENTS.patient_appointment_analysis}:${METRICS.patient_appointment_list}`]: {
    capability: 'patient_appointment_list',
    intent: INTENTS.patient_appointment_analysis,
    metric: METRICS.patient_appointment_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: ['patient'],
    requiredFilters: ['timeScope'],
    retrievalName: 'getPatientAppointmentList',
    layer: 'atomic',
  },
  [`${INTENTS.patient_appointment_analysis}:${METRICS.patient_treatment_list}`]: {
    capability: 'patient_treatment_list',
    intent: INTENTS.patient_appointment_analysis,
    metric: METRICS.patient_treatment_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: ['patient'],
    requiredFilters: [],
    retrievalName: 'getPatientTreatmentList',
    layer: 'atomic',
  },
  [`${INTENTS.patient_summary}:${METRICS.summary}`]: {
    capability: 'patient_summary',
    intent: INTENTS.patient_summary,
    metric: METRICS.summary,
    outputShape: OUTPUT_SHAPES.summary,
    requiredEntities: ['patient'],
    requiredFilters: [],
    retrievalName: 'getPatientSummaryContext',
    layer: 'atomic',
  },
  [`${INTENTS.patient_last_payment}:${METRICS.last_payment}`]: {
    capability: 'patient_last_payment',
    intent: INTENTS.patient_last_payment,
    metric: METRICS.last_payment,
    outputShape: OUTPUT_SHAPES.summary,
    requiredEntities: ['patient'],
    requiredFilters: [],
    retrievalName: 'getPatientLastPaymentContext',
    layer: 'atomic',
  },

  // ═══════════════════════════════════════════════════════════════
  // CURRENT ACCOUNT CAPABILITIES
  // ═══════════════════════════════════════════════════════════════
  [`${INTENTS.current_account_balance}:${METRICS.outstanding_balance_amount}`]: {
    capability: 'current_account_balance',
    intent: INTENTS.current_account_balance,
    metric: METRICS.outstanding_balance_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: ['current_account'],
    requiredFilters: [],
    retrievalName: 'getCurrentAccountBalanceContext',
    layer: 'atomic',
  },
  [`${INTENTS.current_account_transactions}:${METRICS.transaction_list}`]: {
    capability: 'current_account_transactions',
    intent: INTENTS.current_account_transactions,
    metric: METRICS.transaction_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: ['current_account'],
    requiredFilters: [],
    retrievalName: 'getCurrentAccountTransactionsContext',
    layer: 'atomic',
  },
  [`${INTENTS.current_account_balance}:${METRICS.ca_overdue_amount}`]: {
    capability: 'current_account_overdue_amount',
    intent: INTENTS.current_account_balance,
    metric: METRICS.ca_overdue_amount,
    outputShape: OUTPUT_SHAPES.amount,
    requiredEntities: ['current_account'],
    requiredFilters: [],
    retrievalName: 'getCurrentAccountOverdueAmount',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.current_account_count}`]: {
    capability: 'clinic_current_account_count',
    intent: INTENTS.finance_summary,
    metric: METRICS.current_account_count,
    outputShape: OUTPUT_SHAPES.count,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicCurrentAccountCount',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.overdue_ca_list}`]: {
    capability: 'clinic_overdue_ca_list',
    intent: INTENTS.finance_summary,
    metric: METRICS.overdue_ca_list,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicOverdueCaList',
    layer: 'atomic',
  },
  [`${INTENTS.finance_summary}:${METRICS.ca_list_by_type}`]: {
    capability: 'clinic_ca_list_by_type',
    intent: INTENTS.finance_summary,
    metric: METRICS.ca_list_by_type,
    outputShape: OUTPUT_SHAPES.list,
    requiredEntities: [],
    requiredFilters: [],
    retrievalName: 'getClinicCaListByType',
    layer: 'atomic',
  },
};

/**
 * Look up a capability by intent + metric.
 */
function getCapability(intent, metric) {
  return CAPABILITY_CATALOG[`${intent}:${metric}`] || null;
}

/**
 * Get the declared output shape for an intent + metric pair.
 * Falls back to 'summary' if not found.
 */
function getExpectedOutputShape(intent, metric) {
  const cap = getCapability(intent, metric);
  return cap?.outputShape || OUTPUT_SHAPES.summary;
}

/**
 * List all capabilities as an array.
 */
function listCapabilities() {
  return Object.values(CAPABILITY_CATALOG);
}

/**
 * Get the list-variant metric key for a count metric (e.g. appointment_count → appointment_list).
 * Returns null if no list variant exists.
 */
function getListVariantMetric(intent, countMetric) {
  // Try direct _count → _list mapping
  const listKey = `${intent}:${countMetric.replace('_count', '_list')}`;
  const cap = CAPABILITY_CATALOG[listKey];
  if (cap) return cap.metric;

  // Try special mappings
  const SPECIAL_LIST_VARIANTS = {
    [`${INTENTS.clinic_appointment_analysis}:${METRICS.no_show_count}`]: METRICS.no_show_patients_list,
    [`${INTENTS.clinic_appointment_analysis}:${METRICS.cancelled_appointment_count}`]: METRICS.cancelled_appointments_list,
    [`${INTENTS.clinic_patient_analysis}:${METRICS.new_patient_count}`]: METRICS.new_patients_list,
    // Phase 7 — additional count→list reroutes
    [`${INTENTS.clinic_treatment_analysis}:${METRICS.completed_treatment_count}`]: METRICS.completed_treatment_list,
    [`${INTENTS.clinic_treatment_analysis}:${METRICS.completed_treatment_item_count}`]: METRICS.completed_treatment_list,
    [`${INTENTS.doctor_treatment_performance}:${METRICS.completed_treatment_item_count}`]: METRICS.completed_treatment_list,
    [`${INTENTS.clinic_inventory_analysis}:${METRICS.low_stock_item_count}`]: METRICS.low_stock_list,
    [`${INTENTS.clinic_inventory_analysis}:${METRICS.expiring_stock_count}`]: METRICS.expiring_stock_list,
    [`${INTENTS.finance_summary}:${METRICS.overdue_receivables_amount}`]: METRICS.debtor_patient_list,
  };
  return SPECIAL_LIST_VARIANTS[`${intent}:${countMetric}`] || null;
}

/**
 * Find all capabilities for a given intent.
 */
function getCapabilitiesByIntent(intent) {
  return Object.values(CAPABILITY_CATALOG).filter((c) => c.intent === intent);
}

/**
 * Find all capabilities with a given output shape.
 */
function getCapabilitiesByShape(outputShape) {
  return Object.values(CAPABILITY_CATALOG).filter((c) => c.outputShape === outputShape);
}

module.exports = {
  CAPABILITY_CATALOG,
  getCapability,
  getExpectedOutputShape,
  listCapabilities,
  getListVariantMetric,
  getCapabilitiesByIntent,
  getCapabilitiesByShape,
};
