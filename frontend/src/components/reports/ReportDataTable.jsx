import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import {
  formatCellValue,
  getBadgeTone,
  getTableSortLabel,
  isNumericColumn,
} from "../../features/reports/reportUtils";

function valueTone(value) {
  const numeric = Number(value || 0);
  if (numeric > 0) return "text-emerald-600 dark:text-emerald-300";
  if (numeric < 0) return "text-rose-600 dark:text-rose-300";
  return "";
}

export function ReportDataTable({
  columns = [],
  rows = [],
  loading = false,
  pagination,
  sortBy,
  sortOrder,
  onSortChange,
  onPageChange,
  emptyTitle = "Rapor verisi bulunamadı",
  emptyDescription = "Filtreleri değiştirerek yeniden deneyin.",
  onRowClick,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur">
      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Rapor verisi yükleniyor...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                <tr className="border-b border-border/60">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                        (column.align === "right" || isNumericColumn(column)) && "text-right"
                      )}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => column.sortable && onSortChange?.(column.key)}
                      >
                        {column.label}
                        {column.sortable && (
                          <span className="text-[10px] text-muted-foreground">
                            {getTableSortLabel(sortBy, sortOrder, column.key)}
                          </span>
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "transition-colors hover:bg-muted/20",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => {
                      const rawValue = row[column.key];

                      return (
                        <td
                          key={`${row.id}-${column.key}`}
                          className={cn(
                            "px-4 py-3 align-middle",
                            (column.align === "right" || isNumericColumn(column)) && "text-right"
                          )}
                        >
                          {column.format === "badge" ? (
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                getBadgeTone(rawValue)
                              )}
                            >
                              {formatCellValue(rawValue, column)}
                            </span>
                          ) : (
                            <span
                              className={cn(
                                column.toneFromValue && valueTone(rawValue),
                                isNumericColumn(column) && "font-semibold"
                              )}
                            >
                              {formatCellValue(rawValue, column)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">
              Toplam <span className="font-semibold text-foreground">{pagination?.total || rows.length}</span> kayıt
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl"
                disabled={!pagination || pagination.page <= 1}
                onClick={() => onPageChange?.(Math.max(1, pagination.page - 1))}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Önceki
              </Button>
              <span className="text-xs font-medium text-muted-foreground">
                Sayfa {pagination?.page || 1} / {pagination?.pages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl"
                disabled={!pagination || pagination.page >= pagination.pages}
                onClick={() => onPageChange?.(Math.min(pagination.pages, pagination.page + 1))}
              >
                Sonraki
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
