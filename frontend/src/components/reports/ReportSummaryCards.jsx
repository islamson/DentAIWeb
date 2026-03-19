import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatCellValue } from "../../features/reports/reportUtils";

function toneClasses(tone) {
  if (tone === "success") return "text-emerald-600 dark:text-emerald-300";
  if (tone === "warning") return "text-amber-600 dark:text-amber-300";
  if (tone === "danger") return "text-rose-600 dark:text-rose-300";
  if (tone === "info") return "text-sky-600 dark:text-sky-300";
  return "text-foreground";
}

export function ReportSummaryCards({ items = [], loading = false }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const trendValue = item.trend ?? 0;
        const trendPositive = trendValue >= 0;

        return (
          <article
            key={item.id}
            className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className={cn("mt-2 text-2xl font-bold", toneClasses(item.tone))}>
                  {loading ? "—" : formatCellValue(item.value, { format: item.format })}
                </p>
              </div>

              {typeof item.trend === "number" && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
                    trendPositive
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  )}
                >
                  {trendPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(trendValue).toFixed(1)}%
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              {item.description || "Güncel seçili filtreler üzerinden hesaplandı."}
            </p>
          </article>
        );
      })}
    </div>
  );
}
