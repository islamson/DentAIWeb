import { Link, Outlet, useLocation } from "react-router-dom";
import { BarChart3, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import {
  REPORT_CATEGORIES,
  getReportBySlug,
} from "../features/reports/reportRegistry";

export default function ReportsLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const reportSlug = pathname.startsWith("/reports/") ? pathname.replace("/reports/", "") : null;
  const activeReport = reportSlug ? getReportBySlug(reportSlug) : null;
  const activeCategory = activeReport?.category || searchParams.get("category") || null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 p-3 text-white shadow-lg">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Raporlar</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                  <Sparkles className="h-3 w-3" />
                  DentAI Analytics
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Finans merkezli, modüller arası ilişkileri koruyan modern rapor merkezi.
              </p>
            </div>
          </div>

          <Link
            to="/reports"
            className={cn(
              "inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/reports"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Rapor Merkezi
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {REPORT_CATEGORIES.map((category) => (
            <Link
              key={category.id}
              to={`/reports?category=${category.id}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                activeCategory === category.id
                  ? "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {category.label}
            </Link>
          ))}
        </div>
      </section>

      <Outlet />
    </div>
  );
}
