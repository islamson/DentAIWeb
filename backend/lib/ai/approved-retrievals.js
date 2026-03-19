const { assertCanUseTool } = require('./context');
const { buildFilter } = require('./query-filter-builder');
const {
  INTENTS,
  METRICS,
  TIME_SCOPES,
} = require('./assistant-contracts');
const {
  buildPatientBalanceContext,
  buildPatientLastPaymentContext,
  buildPatientSummaryContext,
  buildPatientTreatmentProgressContext,
  buildDoctorScheduleContext,
  buildDoctorTreatmentItemCountContext,
  buildDoctorTreatmentItemCountComparisonContext,
  buildMonthlyAppointmentCountContext,
  buildMonthlyAppointmentCountForDoctorContext,
  buildTodayAppointmentCountForDoctorContext,
  buildClinicRevenueContext,
  buildClinicRevenueComparisonContext,
  buildClinicCollectionContext,
  buildClinicPendingCollectionContext,
  buildClinicPendingCollectionComparisonContext,
  buildClinicOutstandingReceivablesContext,
  buildOverdueReceivablesSummaryContext,
  buildCurrentAccountBalanceContext,
  buildCurrentAccountTransactionsContext,
  buildLowStockProductsContext,
  buildClinicOverviewContext,
  buildClinicPatientCountContext,
  buildClinicMonthlyAppointmentListContext,
  buildClinicAppointmentDemographicsByGenderContext,
  buildDoctorAppointmentListContext,
  buildDoctorCompletedTreatmentValueContext,
  buildClinicNewPatientCountContext,
  buildClinicNoShowRateContext,
  buildClinicCancellationRateContext,
  buildClinicCompletedTreatmentCountContext,
  // Phase 1 — new aggregators
  buildDoctorRevenueContext,
  buildDoctorCollectionContext,
  buildDoctorPatientCountContext,
  buildDoctorCompletedTreatmentListContext,
  buildClinicCompletedTreatmentListContext,
  buildClinicTreatmentCompletionRateContext,
  buildCancelledAppointmentsListContext,
  buildNoShowPatientsListContext,
  buildClinicCollectionComparisonContext,
  buildClinicAppointmentCountComparisonContext,
  buildClinicInventoryItemCountContext,
  buildClinicLowStockItemCountContext,
  buildClinicExpiringStockContext,
  buildClinicStockValueTotalContext,
  buildDebtorPatientListContext,
  buildClinicCancelledAppointmentCountContext,
  buildClinicNoShowCountContext,
} = require('./data-aggregators');

function withError(data) {
  if (data?.error) return { error: data.error };
  return null;
}

function getMonthYearFromRange(filter) {
  const from = new Date(filter.timeRange?.from || new Date());
  return {
    month: from.getMonth() + 1,
    year: from.getFullYear(),
  };
}

// ── Broadened time scope set ─────────────────────────────────────
// All intents should accept these core time scopes.
const BROAD_TIME_SCOPES = [
  TIME_SCOPES.none,
  TIME_SCOPES.today,
  TIME_SCOPES.this_week,
  TIME_SCOPES.this_month,
  TIME_SCOPES.custom,
  TIME_SCOPES.yesterday,
  TIME_SCOPES.last_week,
  TIME_SCOPES.last_month,
  TIME_SCOPES.this_quarter,
  TIME_SCOPES.last_quarter,
  TIME_SCOPES.this_year,
  TIME_SCOPES.last_year,
];

const FINANCE_RETRIEVAL_CATALOGUE = {
  [METRICS.revenue_amount]: {
    supportedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      const compare = plan.filters?.compareToPrevious;
      return {
        retrievalName: compare ? 'getClinicMonthlyRevenueComparison' : 'getClinicMonthlyRevenue',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) =>
          compare ? buildClinicRevenueComparisonContext(filter) : buildClinicRevenueContext(filter),
      };
    },
  },
  [METRICS.collection_amount]: {
    supportedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      const compare = plan.filters?.compareToPrevious;
      if (compare) {
        return {
          retrievalName: 'getClinicCollectionComparison',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => buildClinicCollectionComparisonContext(filter),
        };
      }
      return {
        retrievalName: plan.timeScope === TIME_SCOPES.today ? 'getClinicTodayCollection' : 'getClinicMonthlyCollection',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => buildClinicCollectionContext(filter),
      };
    },
  },
  [METRICS.pending_collection_amount]: {
    supportedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      return {
        retrievalName: plan.filters?.compareToPrevious
          ? 'getClinicPendingCollectionAmountComparison'
          : 'getClinicPendingCollectionAmount',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) =>
          plan.filters?.compareToPrevious
            ? buildClinicPendingCollectionComparisonContext(filter)
            : buildClinicPendingCollectionContext(filter),
      };
    },
  },
  [METRICS.outstanding_balance_amount]: {
    supportedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getClinicOutstandingReceivables',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => buildClinicOutstandingReceivablesContext(filter),
      };
    },
  },
  [METRICS.overdue_receivables_amount]: {
    supportedTimeScopes: [TIME_SCOPES.none, ...BROAD_TIME_SCOPES],
    select(plan) {
      return {
        retrievalName: 'getOverdueReceivablesSummary',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => buildOverdueReceivablesSummaryContext(filter),
      };
    },
  },
  [METRICS.overdue_patient_list]: {
    supportedTimeScopes: [TIME_SCOPES.none, ...BROAD_TIME_SCOPES],
    select(plan) {
      return {
        retrievalName: 'getDebtorPatientList',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => buildOverdueReceivablesSummaryContext(filter),
      };
    },
  },
  [METRICS.debtor_patient_list]: {
    supportedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getDebtorPatientList',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => buildDebtorPatientListContext(filter),
      };
    },
  },
  [METRICS.collection_rate]: {
    supportedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      return {
        retrievalName: 'getClinicCollectionRate',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => {
          const [revenue, collection] = await Promise.all([
            buildClinicRevenueContext(filter),
            buildClinicCollectionContext(filter),
          ]);
          const revAmount = revenue.revenueAmount || 0;
          const colAmount = collection.collectionAmount || 0;
          const rate = revAmount > 0 ? Math.round((colAmount / revAmount) * 10000) / 100 : 0;
          return {
            type: 'clinic_collection_rate',
            revenueAmount: revAmount,
            collectionAmount: colAmount,
            collectionRate: rate,
            period: revenue.period,
            currency: 'TRY',
            source: 'invoices_and_payments',
          };
        },
      };
    },
  },
};

function selectFinanceRetrieval(plan) {
  const entry = FINANCE_RETRIEVAL_CATALOGUE[plan.metric];
  if (!entry) return null;
  if (!entry.supportedTimeScopes.includes(plan.timeScope)) return null;
  return entry.select(plan);
}

const REGISTRY = {
  // ─── Clinic Patient Analysis ──────────────────────────────────────
  [INTENTS.clinic_patient_analysis]: {
    requiredPermission: 'PATIENT_READ',
    requiredEntityType: null,
    allowedMetrics: [METRICS.patient_count, METRICS.new_patient_count],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      if (plan.metric === METRICS.new_patient_count) {
        return {
          retrievalName: 'getClinicNewPatientCount',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicNewPatientCountContext(filter);
            if (withError(data)) return withError(data);
            return { count: data.count, period: data.period };
          },
        };
      }
      return {
        retrievalName: 'getClinicPatientCount',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => {
          const data = await buildClinicPatientCountContext(filter);
          if (withError(data)) return withError(data);
          return { count: data.count, scope: data.scope };
        },
      };
    },
  },

  // ─── Finance Summary ──────────────────────────────────────────────
  [INTENTS.finance_summary]: {
    requiredPermission: 'BILLING_READ',
    requiredEntityType: null,
    allowedMetrics: [
      METRICS.revenue_amount,
      METRICS.collection_amount,
      METRICS.pending_collection_amount,
      METRICS.outstanding_balance_amount,
      METRICS.overdue_receivables_amount,
      METRICS.overdue_patient_list,
      METRICS.debtor_patient_list,
      METRICS.collection_rate,
    ],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      return selectFinanceRetrieval(plan);
    },
  },

  // ─── Patient Balance ──────────────────────────────────────────────
  [INTENTS.patient_balance]: {
    requiredPermission: 'BILLING_READ',
    requiredEntityType: 'patient',
    allowedMetrics: [METRICS.outstanding_balance_amount],
    allowedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getPatientBalanceContext',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, resolvedEntities }) => {
          const data = await buildPatientBalanceContext(
            resolvedEntities.patient.id,
            ctx.organizationId,
            ctx.branchId
          );
          if (withError(data)) return withError(data);
          return { patient: data.patient, totals: data.totals };
        },
      };
    },
  },

  // ─── Patient Summary ──────────────────────────────────────────────
  [INTENTS.patient_summary]: {
    requiredPermission: 'PATIENT_READ',
    requiredEntityType: 'patient',
    allowedMetrics: [METRICS.summary],
    allowedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getPatientSummaryContext',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, resolvedEntities }) => {
          const data = await buildPatientSummaryContext(
            resolvedEntities.patient.id,
            ctx.organizationId,
            ctx.branchId
          );
          if (withError(data)) return withError(data);
          return { patient: data.patient };
        },
      };
    },
  },

  // ─── Patient Last Payment ─────────────────────────────────────────
  [INTENTS.patient_last_payment]: {
    requiredPermission: 'BILLING_READ',
    requiredEntityType: 'patient',
    allowedMetrics: [METRICS.last_payment],
    allowedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getPatientLastPaymentContext',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, resolvedEntities }) => {
          const data = await buildPatientLastPaymentContext(
            resolvedEntities.patient.id,
            ctx.organizationId,
            ctx.branchId
          );
          if (withError(data)) return withError(data);
          return { patient: data.patient, payment: data.payment };
        },
      };
    },
  },

  // ─── Patient Treatment Progress ───────────────────────────────────
  [INTENTS.patient_treatment_progress]: {
    requiredPermission: 'PATIENT_READ',
    requiredEntityType: 'patient',
    allowedMetrics: [METRICS.completion_percentage, METRICS.completed_treatment_value],
    allowedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getPatientTreatmentProgress',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, resolvedEntities }) => {
          const data = await buildPatientTreatmentProgressContext(
            resolvedEntities.patient.id,
            ctx.organizationId
          );
          if (withError(data)) return withError(data);
          return {
            patient: data.patient,
            completionPercentage: data.completionPercentage,
            completedTotal: data.completedTotal,
            totalPrice: data.totalPrice,
            currency: data.currency,
          };
        },
      };
    },
  },

  // ─── Doctor Schedule ──────────────────────────────────────────────
  [INTENTS.doctor_schedule]: {
    requiredPermission: 'APPOINTMENT_READ',
    requiredEntityType: 'doctor',
    allowedMetrics: [METRICS.schedule_list],
    allowedTimeScopes: [TIME_SCOPES.today, TIME_SCOPES.custom, TIME_SCOPES.yesterday],
    select(plan) {
      return {
        retrievalName: 'getDoctorScheduleContext',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, resolvedEntities, filter }) => {
          const date = filter.timeRange?.from?.slice(0, 10) || new Date().toISOString().slice(0, 10);
          const data = await buildDoctorScheduleContext(
            resolvedEntities.doctor.id,
            date,
            ctx.organizationId,
            ctx.branchId
          );
          if (withError(data)) return withError(data);
          return {
            doctor: data.doctor,
            date: data.date,
            appointments: data.appointments,
            blocks: data.blocks,
          };
        },
      };
    },
  },

  // ─── Doctor Appointment Analysis ──────────────────────────────────
  [INTENTS.doctor_appointment_analysis]: {
    requiredPermission: 'APPOINTMENT_READ',
    requiredEntityType: 'doctor',
    allowedMetrics: [METRICS.appointment_count, METRICS.appointment_list],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      const wantsList = plan.metric === METRICS.appointment_list;
      if (plan.timeScope === TIME_SCOPES.today) {
        if (wantsList) {
          return {
            retrievalName: 'getDoctorTodayAppointmentList',
            buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
            execute: async ({ ctx, resolvedEntities, filter }) => {
              const date = filter.timeRange?.from?.slice(0, 10) || new Date().toISOString().slice(0, 10);
              const data = await buildDoctorScheduleContext(
                resolvedEntities.doctor.id,
                date,
                ctx.organizationId,
                ctx.branchId
              );
              if (withError(data)) return withError(data);
              return {
                doctor: data.doctor,
                date: data.date,
                count: data.appointments?.length || 0,
                appointments: data.appointments || [],
              };
            },
          };
        }
        return {
          retrievalName: 'getDoctorTodayAppointmentCount',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildTodayAppointmentCountForDoctorContext(filter);
          if (withError(data)) return withError(data);
            return {
              doctor: data.doctor,
              date: data.date,
              count: data.count,
            };
          },
        };
      }
      if (wantsList) {
        return {
          retrievalName: 'getDoctorAppointmentList',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildDoctorAppointmentListContext(filter);
            if (withError(data)) return withError(data);
            return {
              doctor: data.doctor,
              period: data.period,
              count: data.count,
              appointments: data.appointments || [],
            };
          },
        };
      }
      return {
        retrievalName: 'getDoctorMonthlyAppointmentCount',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => {
          const data = await buildMonthlyAppointmentCountForDoctorContext(filter);
          if (withError(data)) return withError(data);
          return {
            doctor: data.doctor,
            period: data.period,
            count: data.count,
          };
        },
      };
    },
  },

  // ─── Doctor Treatment Performance ─────────────────────────────────
  [INTENTS.doctor_treatment_performance]: {
    requiredPermission: 'REPORT_VIEW',
    requiredEntityType: 'doctor',
    allowedMetrics: [
      METRICS.completed_treatment_item_count,
      METRICS.completed_treatment_value,
      METRICS.completed_treatment_list,
    ],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      if (plan.metric === METRICS.completed_treatment_list) {
        return {
          retrievalName: 'getDoctorCompletedTreatmentList',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildDoctorCompletedTreatmentListContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.completed_treatment_value) {
        return {
          retrievalName: 'getDoctorCompletedTreatmentValue',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildDoctorCompletedTreatmentValueContext(filter);
            if (withError(data)) return withError(data);
            return {
              doctor: data.doctor,
              period: data.period,
              completedTreatmentValue: data.completedTreatmentValue,
              completedItemCount: data.completedItemCount,
              currency: data.currency,
            };
          },
        };
      }
      const compare = plan.filters?.compareToPrevious;
      if (compare) {
        return {
          retrievalName: 'getDoctorCompletedTreatmentItemCountComparison',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildDoctorTreatmentItemCountComparisonContext(filter);
            if (withError(data)) return withError(data);
            return {
              doctor: data.doctor,
              currentCount: data.currentCount,
              previousCount: data.previousCount,
              difference: data.difference,
              percentageChange: data.percentageChange,
              currentPeriod: data.currentPeriod,
              previousPeriod: data.previousPeriod,
            };
          },
        };
      }
      return {
        retrievalName: 'getDoctorCompletedTreatmentItemCount',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, resolvedEntities, filter }) => {
          const { month, year } = getMonthYearFromRange(filter);
          const data = await buildDoctorTreatmentItemCountContext(
            resolvedEntities.doctor.id,
            month,
            year,
            ctx.organizationId
          );
          if (withError(data)) return withError(data);
          return {
            doctor: data.doctor,
            period: data.period,
            count: data.count,
          };
        },
      };
    },
  },

  // ─── Clinic Appointment Analysis ──────────────────────────────────
  [INTENTS.clinic_appointment_analysis]: {
    requiredPermission: 'APPOINTMENT_READ',
    requiredEntityType: null,
    allowedMetrics: [
      METRICS.appointment_count,
      METRICS.appointment_list,
      METRICS.no_show_rate,
      METRICS.cancellation_rate,
      METRICS.completed_treatment_count,
      METRICS.cancelled_appointment_count,
      METRICS.no_show_count,
      METRICS.cancelled_appointments_list,
      METRICS.no_show_patients_list,
    ],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      if (plan.metric === METRICS.no_show_rate) {
        return {
          retrievalName: 'getClinicNoShowRate',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicNoShowRateContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.cancellation_rate) {
        return {
          retrievalName: 'getClinicCancellationRate',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicCancellationRateContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.completed_treatment_count) {
        return {
          retrievalName: 'getClinicCompletedTreatmentCount',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicCompletedTreatmentCountContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.cancelled_appointment_count) {
        return {
          retrievalName: 'getClinicCancelledAppointmentCount',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicCancelledAppointmentCountContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.no_show_count) {
        return {
          retrievalName: 'getClinicNoShowCount',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicNoShowCountContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.cancelled_appointments_list) {
        return {
          retrievalName: 'getCancelledAppointmentsList',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildCancelledAppointmentsListContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.no_show_patients_list) {
        return {
          retrievalName: 'getNoShowPatientsList',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildNoShowPatientsListContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      const wantsList = plan.metric === METRICS.appointment_list;
      if (plan.timeScope === TIME_SCOPES.today || plan.timeScope === TIME_SCOPES.yesterday) {
        if (wantsList) {
          return {
            retrievalName: 'getClinicTodayAppointmentList',
            buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
            execute: async ({ ctx, filter }) => {
              const data = await buildClinicOverviewContext(
                ctx.organizationId,
                ctx.branchId,
                filter.timeRange?.from?.slice(0, 10)
              );
              if (withError(data)) return withError(data);
              return {
                date: data.date,
                count: data.count,
                appointments: data.appointments || [],
              };
            },
          };
        }
        return {
          retrievalName: 'getClinicTodayAppointmentCount',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ ctx, filter }) => {
            const data = await buildClinicOverviewContext(
              ctx.organizationId,
              ctx.branchId,
              filter.timeRange?.from?.slice(0, 10)
            );
            if (withError(data)) return withError(data);
            return { date: data.date, count: data.count };
          },
        };
      }
      if (wantsList) {
        return {
          retrievalName: 'getClinicMonthlyAppointmentList',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ ctx, filter }) => {
            const { month, year } = getMonthYearFromRange(filter);
            const data = await buildClinicMonthlyAppointmentListContext(
              month, year, ctx.organizationId, ctx.branchId
            );
            if (withError(data)) return withError(data);
            return {
              period: data.period,
              count: data.count,
              appointments: data.appointments || [],
            };
          },
        };
      }
      // Comparison support for appointment_count
      if (plan.filters?.compareToPrevious) {
        return {
          retrievalName: 'getClinicAppointmentCountComparison',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicAppointmentCountComparisonContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      return {
        retrievalName: 'getClinicMonthlyAppointmentCount',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, filter }) => {
          const { month, year } = getMonthYearFromRange(filter);
          const data = await buildMonthlyAppointmentCountContext(
            month, year, ctx.organizationId, ctx.branchId
          );
          if (withError(data)) return withError(data);
          return { period: data.period, count: data.count };
        },
      };
    },
  },

  // ─── Clinic Patient Demographics ──────────────────────────────────
  [INTENTS.clinic_patient_demographics]: {
    requiredPermission: 'PATIENT_READ',
    requiredEntityType: null,
    allowedMetrics: [METRICS.patient_gender_ratio, METRICS.appointment_patient_count_by_gender],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      return {
        retrievalName: 'getClinicAppointmentDemographicsByGender',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, filter }) => {
          const { month, year } = getMonthYearFromRange(filter);
          const data = await buildClinicAppointmentDemographicsByGenderContext(
            month, year, ctx.organizationId, ctx.branchId,
            plan.filters?.gender || null
          );
          if (withError(data)) return withError(data);
          return data;
        },
      };
    },
  },

  // ─── Current Account Balance ──────────────────────────────────────
  [INTENTS.current_account_balance]: {
    requiredPermission: 'BILLING_READ',
    requiredEntityType: 'current_account',
    allowedMetrics: [METRICS.outstanding_balance_amount],
    allowedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getCurrentAccountBalanceContext',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, resolvedEntities }) => {
          const data = await buildCurrentAccountBalanceContext(
            resolvedEntities.currentAccount.id,
            ctx.organizationId
          );
          if (withError(data)) return withError(data);
          return { currentAccount: data.currentAccount, summary: data.summary };
        },
      };
    },
  },

  // ─── Current Account Transactions ─────────────────────────────────
  [INTENTS.current_account_transactions]: {
    requiredPermission: 'BILLING_READ',
    requiredEntityType: 'current_account',
    allowedMetrics: [METRICS.transaction_list],
    allowedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getCurrentAccountTransactionsContext',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, resolvedEntities }) => {
          const data = await buildCurrentAccountTransactionsContext(
            resolvedEntities.currentAccount.id,
            ctx.organizationId
          );
          if (withError(data)) return withError(data);
          return {
            currentAccount: data.currentAccount,
            summary: data.summary,
            transactions: data.transactions?.slice(0, 10) || [],
          };
        },
      };
    },
  },

  // ─── Inventory Low Stock ──────────────────────────────────────────
  [INTENTS.inventory_low_stock]: {
    requiredPermission: 'INVENTORY_READ',
    requiredEntityType: null,
    allowedMetrics: [METRICS.low_stock_list],
    allowedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getLowStockProducts',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx }) => {
          const data = await buildLowStockProductsContext(ctx.organizationId, ctx.branchId);
          if (withError(data)) return withError(data);
          return { count: data.count, items: data.items?.slice(0, 20) || [] };
        },
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2 — NEW INTENT REGISTRATIONS
  // ═══════════════════════════════════════════════════════════════════

  // ─── Doctor Revenue Analysis (NEW) ────────────────────────────────
  [INTENTS.doctor_revenue_analysis]: {
    requiredPermission: 'REPORT_VIEW',
    requiredEntityType: 'doctor',
    allowedMetrics: [
      METRICS.doctor_revenue_amount,
      METRICS.doctor_collection_amount,
      METRICS.doctor_patient_count,
    ],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      if (plan.metric === METRICS.doctor_collection_amount) {
        return {
          retrievalName: 'getDoctorCollection',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildDoctorCollectionContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.doctor_patient_count) {
        return {
          retrievalName: 'getDoctorPatientCount',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildDoctorPatientCountContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      // Default: doctor_revenue_amount
      return {
        retrievalName: 'getDoctorRevenue',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => {
          const data = await buildDoctorRevenueContext(filter);
          if (withError(data)) return withError(data);
          return data;
        },
      };
    },
  },

  // ─── Clinic Treatment Analysis (NEW) ──────────────────────────────
  [INTENTS.clinic_treatment_analysis]: {
    requiredPermission: 'REPORT_VIEW',
    requiredEntityType: null,
    allowedMetrics: [
      METRICS.completed_treatment_count,
      METRICS.completed_treatment_item_count,
      METRICS.treatment_completion_rate,
      METRICS.completed_treatment_list,
    ],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      if (plan.metric === METRICS.completed_treatment_list) {
        return {
          retrievalName: 'getClinicCompletedTreatmentList',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicCompletedTreatmentListContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.treatment_completion_rate) {
        return {
          retrievalName: 'getClinicTreatmentCompletionRate',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicTreatmentCompletionRateContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      // Default: count
      return {
        retrievalName: 'getClinicCompletedTreatmentCount',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => {
          const data = await buildClinicCompletedTreatmentCountContext(filter);
          if (withError(data)) return withError(data);
          return data;
        },
      };
    },
  },

  // ─── Clinic Inventory Analysis (NEW) ──────────────────────────────
  [INTENTS.clinic_inventory_analysis]: {
    requiredPermission: 'INVENTORY_READ',
    requiredEntityType: null,
    allowedMetrics: [
      METRICS.inventory_item_count,
      METRICS.low_stock_item_count,
      METRICS.low_stock_list,
      METRICS.expiring_stock_count,
      METRICS.expiring_stock_list,
      METRICS.stock_value_total,
    ],
    allowedTimeScopes: [TIME_SCOPES.none, ...BROAD_TIME_SCOPES],
    select(plan) {
      if (plan.metric === METRICS.low_stock_list) {
        return {
          retrievalName: 'getLowStockProducts',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ ctx }) => {
            const data = await buildLowStockProductsContext(ctx.organizationId, ctx.branchId);
            if (withError(data)) return withError(data);
            return { count: data.count, items: data.items?.slice(0, 20) || [] };
          },
        };
      }
      if (plan.metric === METRICS.low_stock_item_count) {
        return {
          retrievalName: 'getClinicLowStockItemCount',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicLowStockItemCountContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.expiring_stock_count || plan.metric === METRICS.expiring_stock_list) {
        return {
          retrievalName: 'getClinicExpiringStock',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicExpiringStockContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.stock_value_total) {
        return {
          retrievalName: 'getClinicStockValueTotal',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicStockValueTotalContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      // Default: inventory_item_count
      return {
        retrievalName: 'getClinicInventoryItemCount',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => {
          const data = await buildClinicInventoryItemCountContext(filter);
          if (withError(data)) return withError(data);
          return data;
        },
      };
    },
  },

  // ─── Clinic Financial Analytics (NEW — composite-capable) ─────────
  [INTENTS.clinic_financial_analytics]: {
    requiredPermission: 'BILLING_READ',
    requiredEntityType: null,
    allowedMetrics: [
      METRICS.collection_rate,
      METRICS.revenue_amount,
      METRICS.collection_amount,
      METRICS.pending_collection_amount,
      METRICS.summary,
    ],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      // If a specific finance metric, delegate to finance catalogue
      const financeResult = selectFinanceRetrieval(plan);
      if (financeResult) return financeResult;
      // Default: composite summary using revenue + collection + pending
      return {
        retrievalName: 'getClinicFinancialSummary',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ filter }) => {
          const [revenue, collection, pending] = await Promise.all([
            buildClinicRevenueContext(filter),
            buildClinicCollectionContext(filter),
            buildClinicPendingCollectionContext(filter),
          ]);
          const revAmount = revenue.revenueAmount || 0;
          const colAmount = collection.collectionAmount || 0;
          const pendAmount = pending.pendingCollectionAmount || 0;
          const collectionRate = revAmount > 0 ? Math.round((colAmount / revAmount) * 10000) / 100 : 0;
          return {
            type: 'clinic_financial_summary',
            revenueAmount: revAmount,
            collectionAmount: colAmount,
            pendingCollectionAmount: pendAmount,
            collectionRate,
            period: revenue.period,
            currency: 'TRY',
            source: 'composite',
          };
        },
      };
    },
  },

  // ─── Clinic Operational Analytics (NEW — composite-capable) ───────
  [INTENTS.clinic_operational_analytics]: {
    requiredPermission: 'REPORT_VIEW',
    requiredEntityType: null,
    allowedMetrics: [
      METRICS.appointment_count,
      METRICS.no_show_rate,
      METRICS.cancellation_rate,
      METRICS.completed_treatment_count,
      METRICS.summary,
    ],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      // If specific metric, try existing handlers
      if (plan.metric === METRICS.no_show_rate) {
        return {
          retrievalName: 'getClinicNoShowRate',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicNoShowRateContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      if (plan.metric === METRICS.cancellation_rate) {
        return {
          retrievalName: 'getClinicCancellationRate',
          buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
          execute: async ({ filter }) => {
            const data = await buildClinicCancellationRateContext(filter);
            if (withError(data)) return withError(data);
            return data;
          },
        };
      }
      // Default: composite operational summary
      return {
        retrievalName: 'getClinicOperationalSummary',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, filter }) => {
          const { month, year } = getMonthYearFromRange(filter);
          const [apptCount, noShow, cancellation, treatments] = await Promise.all([
            buildMonthlyAppointmentCountContext(month, year, ctx.organizationId, ctx.branchId),
            buildClinicNoShowRateContext(filter),
            buildClinicCancellationRateContext(filter),
            buildClinicCompletedTreatmentCountContext(filter),
          ]);
          return {
            type: 'clinic_operational_summary',
            appointmentCount: apptCount.count || 0,
            noShowRate: noShow.noShowRate || 0,
            noShowCount: noShow.noShowCount || 0,
            cancellationRate: cancellation.cancellationRate || 0,
            cancelledCount: cancellation.cancelledCount || 0,
            completedTreatmentCount: treatments.count || 0,
            period: apptCount.period,
            source: 'composite',
          };
        },
      };
    },
  },

  // ─── Patient Appointment Analysis (NEW) ───────────────────────────
  [INTENTS.patient_appointment_analysis]: {
    requiredPermission: 'APPOINTMENT_READ',
    requiredEntityType: 'patient',
    allowedMetrics: [METRICS.appointment_count, METRICS.appointment_list],
    allowedTimeScopes: BROAD_TIME_SCOPES,
    select(plan) {
      // Patient appointments re-use doctor-scoped aggregator logic with patientId
      return {
        retrievalName: 'getPatientAppointments',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx, resolvedEntities }) => {
          const { buildPatientAppointmentsContext } = require('./data-aggregators');
          const data = await buildPatientAppointmentsContext(
            resolvedEntities.patient.id,
            ctx.organizationId
          );
          if (withError(data)) return withError(data);
          return {
            patient: data.patient,
            count: data.appointments?.length || 0,
            appointments: data.appointments || [],
          };
        },
      };
    },
  },

  // ─── Clinic Lab Analysis (NEW — limited by schema) ────────────────
  // NOTE: No LabCase model exists in schema. Lab capabilities route to
  // TreatmentLabRelation which has limited data. Marked as best-effort.
  [INTENTS.clinic_lab_analysis]: {
    requiredPermission: 'REPORT_VIEW',
    requiredEntityType: null,
    allowedMetrics: [METRICS.summary],
    allowedTimeScopes: [TIME_SCOPES.none],
    select(plan) {
      return {
        retrievalName: 'getClinicLabSummary',
        buildFilter: (ctx, resolved) => buildFilter(ctx, plan, resolved),
        execute: async ({ ctx }) => {
          // Best-effort: count TreatmentLabRelation records
          const { prisma } = require('../prisma');
          const [total, pending] = await Promise.all([
            prisma.treatmentLabRelation.count({ where: { organizationId: ctx.organizationId } }),
            prisma.treatmentLabRelation.count({
              where: { organizationId: ctx.organizationId, status: 'PENDING' },
            }).catch(() => 0),
          ]);
          return {
            type: 'clinic_lab_summary',
            totalLabRelations: total,
            pendingLabRelations: typeof pending === 'number' ? pending : 0,
            note: 'Detaylı laboratuvar analizi için LabCase modeli henüz mevcut değil.',
            source: 'treatment_lab_relations',
          };
        },
      };
    },
  },
};

function getIntentPolicy(intent) {
  return REGISTRY[intent] || null;
}

function selectApprovedRetrieval(plan) {
  const policy = getIntentPolicy(plan.intent);
  if (!policy) return null;
  return policy.select(plan);
}

function assertRetrievalPermission(ctx, plan) {
  const policy = getIntentPolicy(plan.intent);
  if (!policy) return;
  assertCanUseTool(ctx, policy.requiredPermission);
}

module.exports = {
  FINANCE_RETRIEVAL_CATALOGUE,
  getIntentPolicy,
  selectApprovedRetrieval,
  assertRetrievalPermission,
  selectFinanceRetrieval,
};
