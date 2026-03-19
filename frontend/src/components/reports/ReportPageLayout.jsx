import { cn } from "../../lib/utils";

export function ReportPageLayout({
  title,
  description,
  accentClass,
  actions,
  filterBar,
  summary,
  charts,
  table,
}) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
        <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accentClass)} />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          {actions}
        </div>
      </section>

      {filterBar}
      {summary}
      {charts}
      {table}
    </div>
  );
}
