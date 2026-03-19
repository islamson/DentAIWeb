import { cn } from "../../lib/utils";
import { formatCellValue } from "../../features/reports/reportUtils";

function itemToneClasses(tone) {
  if (tone === "success") return "bg-emerald-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "danger") return "bg-rose-500";
  if (tone === "info") return "bg-sky-500";
  if (tone === "violet") return "bg-violet-500";
  return "bg-primary";
}

export function ReportChartBlock({ blocks = [], loading = false }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {blocks.map((block) => (
        <section
          key={block.id}
          className="rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm backdrop-blur"
        >
          <div className="mb-4">
            <h3 className="text-sm font-semibold">{block.title}</h3>
            <p className="text-xs text-muted-foreground">
              {block.description || "Seçili aralık için dağılım özeti."}
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`${block.id}-loading-${index}`} className="space-y-2">
                  <div className="h-3 w-24 rounded-full bg-muted/70" />
                  <div className="h-2 rounded-full bg-muted/50" />
                </div>
              ))}
            </div>
          ) : block.items?.length ? (
            <div className="space-y-4">
              {block.items.map((item) => {
                const ratio = Math.max(0, Math.min(100, Number(item.percentage || item.share || 0)));

                return (
                  <div key={item.id || item.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        {item.meta && <p className="text-xs text-muted-foreground">{item.meta}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {item.displayValue || formatCellValue(item.value, { format: item.format })}
                        </p>
                        <p className="text-xs text-muted-foreground">{ratio.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={cn("h-full rounded-full transition-all", itemToneClasses(item.tone))}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              Grafik verisi bulunamadı.
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
