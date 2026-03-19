import { formatCurrency, formatDate, formatDateTime } from "../../lib/utils";

export function formatNumber(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("tr-TR").format(number);
}

export function formatPercent(value) {
  const number = Number(value || 0);
  return `%${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: number % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(number)}`;
}

export function buildQueryStringFromObject(values) {
  const params = new URLSearchParams();

  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  return params;
}

export function getInitialFilterState(fields, searchParams, defaults = {}) {
  return fields.reduce(
    (acc, field) => {
      const initialValue = searchParams.get(field.key);
      acc[field.key] = initialValue ?? defaults[field.key] ?? "";
      return acc;
    },
    { ...defaults }
  );
}

export function getOptionList(field, availableFilters = {}) {
  if (field.options?.length) {
    return field.options;
  }

  if (field.optionsKey) {
    return availableFilters[field.optionsKey] || [];
  }

  return [];
}

export function getBadgeTone(value) {
  const normalized = String(value || "").toUpperCase();

  if (
    normalized.includes("PAID") ||
    normalized.includes("COMPLETED") ||
    normalized.includes("ACTIVE") ||
    normalized.includes("READY") ||
    normalized.includes("DELIVERED")
  ) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (
    normalized.includes("OPEN") ||
    normalized.includes("PARTIAL") ||
    normalized.includes("PENDING") ||
    normalized.includes("SCHEDULED") ||
    normalized.includes("CONFIRMED") ||
    normalized.includes("ARRIVED") ||
    normalized.includes("IN_PROGRESS") ||
    normalized.includes("IN_PRODUCTION")
  ) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (
    normalized.includes("CANCELLED") ||
    normalized.includes("VOID") ||
    normalized.includes("NOSHOW") ||
    normalized.includes("REFUNDED") ||
    normalized.includes("OVERDUE")
  ) {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  return "bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

export function formatCellValue(value, column) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  switch (column.format) {
    case "currency":
      return formatCurrency(Number(value));
    case "number":
      return `${formatNumber(value)}${column.suffix || ""}`;
    case "percent":
      return formatPercent(value);
    case "date":
      return formatDate(value);
    case "dateTime":
      return formatDateTime(value);
    default:
      return String(value);
  }
}

export function isNumericColumn(column) {
  return ["currency", "number", "percent"].includes(column.format);
}

export function getTableSortLabel(sortBy, sortOrder, key) {
  if (sortBy !== key) return "";
  return sortOrder === "asc" ? "▲" : "▼";
}
