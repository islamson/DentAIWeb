const express = require("express");
const { ZodError } = require("zod");
const { getCurrentUser } = require("../middleware/auth");
const {
  createReportResponse,
  parseReportQuery,
} = require("../lib/reports/base-filters");
const { getGlobalReportFilterOptions } = require("../lib/reports/doctor-dimension");
const {
  getGeneralOverviewReport,
  getEndOfDayReport,
  getCollectionAnalyticsReport,
  getExpenseReport,
  getDebtPerDoctorReport,
  getPaymentTreatmentCommissionReport,
  getTreatmentBasedCommissionReport,
  getCashBasedCommissionReport,
} = require("../lib/reports/finance-reports");
const {
  getCompletedTreatmentsReport,
  getIncompleteTreatmentsReport,
  getDailyMonitoringReport,
} = require("../lib/reports/treatment-reports");
const {
  getAppointmentOccupancyReport,
  getAppointmentEfficiencyReport,
} = require("../lib/reports/appointment-reports");
const { getStockMovementReport } = require("../lib/reports/stock-lab-reports");
const {
  getLostPatientsReport,
  getNewPatientsReport,
  getStaffWorkingHoursReport,
} = require("../lib/reports/staff-patient-reports");

const router = express.Router();

const reportHandlers = {
  "general-overview": {
    defaultSortBy: "collectedAmount",
    defaultSortOrder: "desc",
    handler: getGeneralOverviewReport,
  },
  "end-of-day": {
    defaultSortBy: "occurredAt",
    defaultSortOrder: "desc",
    handler: getEndOfDayReport,
  },
  "collection-analytics": {
    defaultSortBy: "paidAt",
    defaultSortOrder: "desc",
    handler: getCollectionAnalyticsReport,
  },
  "expense-report": {
    defaultSortBy: "occurredAt",
    defaultSortOrder: "desc",
    handler: getExpenseReport,
  },
  "debt-per-doctor": {
    defaultSortBy: "outstandingDebt",
    defaultSortOrder: "desc",
    handler: getDebtPerDoctorReport,
  },
  "payment-treatment-commission": {
    defaultSortBy: "commissionAmount",
    defaultSortOrder: "desc",
    handler: getPaymentTreatmentCommissionReport,
  },
  "treatment-based-commission": {
    defaultSortBy: "commissionAmount",
    defaultSortOrder: "desc",
    handler: getTreatmentBasedCommissionReport,
  },
  "cash-based-commission": {
    defaultSortBy: "commissionAmount",
    defaultSortOrder: "desc",
    handler: getCashBasedCommissionReport,
  },
  "completed-treatments": {
    defaultSortBy: "completedAt",
    defaultSortOrder: "desc",
    handler: getCompletedTreatmentsReport,
  },
  "incomplete-treatments": {
    defaultSortBy: "updatedAt",
    defaultSortOrder: "desc",
    handler: getIncompleteTreatmentsReport,
  },
  "daily-monitoring": {
    defaultSortBy: "date",
    defaultSortOrder: "desc",
    handler: getDailyMonitoringReport,
  },
  "appointment-occupancy": {
    defaultSortBy: "occupancyRate",
    defaultSortOrder: "desc",
    handler: getAppointmentOccupancyReport,
  },
  "appointment-efficiency": {
    defaultSortBy: "efficiencyScore",
    defaultSortOrder: "desc",
    handler: getAppointmentEfficiencyReport,
  },
  "lost-patients": {
    defaultSortBy: "daysSinceLastActivity",
    defaultSortOrder: "desc",
    handler: getLostPatientsReport,
  },
  "new-patients": {
    defaultSortBy: "createdAt",
    defaultSortOrder: "desc",
    handler: getNewPatientsReport,
  },
  "stock-movement": {
    defaultSortBy: "occurredAt",
    defaultSortOrder: "desc",
    handler: getStockMovementReport,
  },
  "staff-working-hours": {
    defaultSortBy: "workingHours",
    defaultSortOrder: "desc",
    handler: getStaffWorkingHoursReport,
  },
};

router.get("/meta", getCurrentUser, async (req, res) => {
  try {
    const availableFilters = await getGlobalReportFilterOptions(req.user.organizationId);

    res.json({
      availableFilters,
      reports: Object.keys(reportHandlers),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching report meta:", error);
    res.status(500).json({ error: "Failed to fetch report metadata" });
  }
});

router.get("/:slug", getCurrentUser, async (req, res) => {
  try {
    const reportEntry = reportHandlers[req.params.slug];

    if (!reportEntry) {
      return res.status(404).json({ error: "Report not found" });
    }

    const query = parseReportQuery(req.query, {
      sortBy: reportEntry.defaultSortBy,
      sortOrder: reportEntry.defaultSortOrder,
      limit: 20,
    });

    const [availableFilters, reportPayload] = await Promise.all([
      getGlobalReportFilterOptions(req.user.organizationId),
      reportEntry.handler({
        organizationId: req.user.organizationId,
        branchId: req.user.branchId || null,
        user: req.user,
        query,
      }),
    ]);

    res.json(
      createReportResponse({
        query,
        availableFilters: {
          ...availableFilters,
          ...(reportPayload.availableFilters || {}),
        },
        stats: reportPayload.stats || [],
        charts: reportPayload.charts || [],
        rows: reportPayload.rows || [],
        meta: reportPayload.meta || {},
      })
    );
  } catch (error) {
    console.error(`Error fetching report ${req.params.slug}:`, error);
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid report filters", details: error.errors });
    }
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

module.exports = router;
