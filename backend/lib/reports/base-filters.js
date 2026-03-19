const { z } = require("zod");

const paymentMethods = ["CASH", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"];
const sortOrders = ["asc", "desc"];

const reportQuerySchema = z.object({
  search: z.string().optional().default(""),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  doctorId: z.string().optional(),
  patientId: z.string().optional(),
  institutionId: z.string().optional(),
  branchId: z.string().optional(),
  paymentMethod: z.enum(paymentMethods).optional(),
  appointmentStatus: z.string().optional(),
  treatmentStatus: z.string().optional(),
  stockType: z.string().optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  paymentRate: z.coerce.number().min(0).max(100).optional(),
  treatmentRate: z.coerce.number().min(0).max(100).optional(),
  days: z.coerce.number().min(1).max(3650).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(sortOrders).optional().default("desc"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(20),
});

function parseReportQuery(query = {}, defaults = {}) {
  const result = reportQuerySchema.parse({
    ...defaults,
    ...query,
  });

  if (!result.sortBy && defaults.sortBy) {
    result.sortBy = defaults.sortBy;
  }

  if (!result.sortOrder && defaults.sortOrder) {
    result.sortOrder = defaults.sortOrder;
  }

  return result;
}

function startOfDay(date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target;
}

function endOfDay(date) {
  const target = new Date(date);
  target.setHours(23, 59, 59, 999);
  return target;
}

function buildDateRange(query, fallbackDays = null) {
  if (query.dateFrom || query.dateTo) {
    return {
      from: query.dateFrom ? startOfDay(query.dateFrom) : null,
      to: query.dateTo ? endOfDay(query.dateTo) : null,
    };
  }

  if (fallbackDays) {
    const to = endOfDay(new Date());
    const from = startOfDay(new Date(Date.now() - (fallbackDays - 1) * 24 * 60 * 60 * 1000));
    return { from, to };
  }

  return { from: null, to: null };
}

function isWithinDateRange(value, range) {
  if (!value) return false;
  const target = new Date(value);
  if (range.from && target < range.from) return false;
  if (range.to && target > range.to) return false;
  return true;
}

function paginateRows(rows, page, limit) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * limit;

  return {
    rows: rows.slice(start, start + limit),
    pagination: {
      page: safePage,
      limit,
      total,
      pages,
    },
  };
}

function sortRows(rows, sortBy, sortOrder = "desc") {
  if (!sortBy) return rows;

  const modifier = sortOrder === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const a = left?.[sortBy];
    const b = right?.[sortBy];

    if (a === undefined || a === null || a === "") return 1;
    if (b === undefined || b === null || b === "") return -1;

    const leftDate = Date.parse(a);
    const rightDate = Date.parse(b);

    if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
      return (leftDate - rightDate) * modifier;
    }

    if (typeof a === "number" && typeof b === "number") {
      return (a - b) * modifier;
    }

    return String(a).localeCompare(String(b), "tr") * modifier;
  });
}

function sumBy(items, accessor) {
  return items.reduce((total, item) => total + (Number(accessor(item)) || 0), 0);
}

function safePercentage(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function roundHours(minutes) {
  return Number((minutes / 60).toFixed(2));
}

function formatLabelValueOptions(items, valueKey = "id", labelBuilder = (item) => item.name) {
  return items.map((item) => ({
    value: item[valueKey],
    label: labelBuilder(item),
  }));
}

function groupCountBy(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item) || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildBarChartItems(entries, format = "number", tonePalette = ["info", "success", "warning", "violet"]) {
  const max = Math.max(1, ...entries.map((entry) => Number(entry.value || 0)));

  return entries.map((entry, index) => ({
    id: entry.id || entry.label,
    label: entry.label,
    value: entry.value,
    format,
    meta: entry.meta,
    percentage: safePercentage(entry.value, max),
    tone: entry.tone || tonePalette[index % tonePalette.length],
  }));
}

function createReportResponse({ query, availableFilters, stats, charts, rows, meta = {} }) {
  const sortedRows = sortRows(rows, query.sortBy, query.sortOrder);
  const paged = paginateRows(sortedRows, query.page, query.limit);

  return {
    filters: {
      applied: query,
      available: availableFilters,
    },
    stats,
    charts,
    rows: paged.rows,
    pagination: paged.pagination,
    meta: {
      generatedAt: new Date().toISOString(),
      ...meta,
    },
  };
}

module.exports = {
  paymentMethods,
  parseReportQuery,
  buildDateRange,
  isWithinDateRange,
  paginateRows,
  sortRows,
  sumBy,
  safePercentage,
  roundHours,
  formatLabelValueOptions,
  groupCountBy,
  buildBarChartItems,
  createReportResponse,
  startOfDay,
  endOfDay,
};
