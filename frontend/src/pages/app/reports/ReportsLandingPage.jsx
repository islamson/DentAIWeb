import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3, Search, Star } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { ReportFilterBar } from "../../../components/reports/ReportFilterBar";
import {
  REPORT_CATEGORIES,
  REPORT_DEFINITIONS,
  REPORT_GLOBAL_FILTERS,
} from "../../../features/reports/reportRegistry";
import {
  buildQueryStringFromObject,
  getInitialFilterState,
} from "../../../features/reports/reportUtils";
import { useReportPreferences } from "../../../features/reports/preferences";

function SectionCard({ title, description, items, favoriteSlugs, onToggleFavorite, buildReportLink }) {
  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((report) => {
          const Icon = report.icon;
          const isFavorite = favoriteSlugs.includes(report.slug);

          return (
            <Link
              key={report.slug}
              to={buildReportLink(report.slug)}
              className="group rounded-2xl border border-border/60 bg-card/90 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={cn("rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg", report.accent)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {REPORT_CATEGORIES.find((category) => category.id === report.category)?.label}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold transition-colors group-hover:text-primary">
                      {report.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  onClick={(event) => {
                    event.preventDefault();
                    onToggleFavorite(report.slug);
                  }}
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      isFavorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground"
                    )}
                  />
                </Button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {report.tableColumns.length} kolon
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Aç
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function ReportsLandingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() =>
    getInitialFilterState(REPORT_GLOBAL_FILTERS, searchParams)
  );
  const [availableFilters, setAvailableFilters] = useState({});
  const { favoriteSlugs, recentSlugs, frequentlyUsedSlugs, toggleFavorite } =
    useReportPreferences(user);

  const selectedCategory = searchParams.get("category") || "";

  useEffect(() => {
    setFilters(getInitialFilterState(REPORT_GLOBAL_FILTERS, searchParams));
  }, [searchParams]);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const response = await fetch("/api/reports/meta");
        if (!response.ok) return;
        const data = await response.json();
        setAvailableFilters(data.availableFilters || {});
      } catch (error) {
        console.error("Failed to fetch report meta:", error);
      }
    }

    fetchMeta();
  }, []);

  const visibleReports = useMemo(() => {
    const query = (filters.search || "").trim().toLowerCase();

    return REPORT_DEFINITIONS.filter((report) => {
      const matchesCategory = selectedCategory ? report.category === selectedCategory : true;
      const matchesSearch = query
        ? `${report.title} ${report.description}`.toLowerCase().includes(query)
        : true;

      return matchesCategory && matchesSearch;
    });
  }, [filters.search, selectedCategory]);

  const reportsByCategory = useMemo(
    () =>
      REPORT_CATEGORIES.map((category) => ({
        ...category,
        reports: visibleReports.filter((report) => report.category === category.id),
      })),
    [visibleReports]
  );

  const favoriteReports = useMemo(
    () => favoriteSlugs.map((slug) => REPORT_DEFINITIONS.find((report) => report.slug === slug)).filter(Boolean),
    [favoriteSlugs]
  );

  const recentReports = useMemo(
    () => recentSlugs.map((slug) => REPORT_DEFINITIONS.find((report) => report.slug === slug)).filter(Boolean),
    [recentSlugs]
  );

  const frequentlyUsedReports = useMemo(
    () =>
      frequentlyUsedSlugs
        .map((slug) => REPORT_DEFINITIONS.find((report) => report.slug === slug))
        .filter(Boolean),
    [frequentlyUsedSlugs]
  );

  const applyFilters = () => {
    const nextParams = buildQueryStringFromObject({
      ...filters,
      ...(selectedCategory ? { category: selectedCategory } : {}),
    });

    setSearchParams(nextParams);
  };

  const resetFilters = () => {
    setFilters({});
    const nextParams = buildQueryStringFromObject(selectedCategory ? { category: selectedCategory } : {});
    setSearchParams(nextParams);
  };

  const buildReportLink = (slug) => {
    const queryString = buildQueryStringFromObject(filters).toString();
    return queryString ? `/reports/${slug}?${queryString}` : `/reports/${slug}`;
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 p-3 text-white shadow-lg">
              <Search className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Rapor Merkezi</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Tüm raporlar tek bir yapıdan beslenir: ortak filtreler, özet kartları, analitik bloklar ve
                detay tablolar. Finans, tedavi, randevu, stok ve hasta verileri aynı rapor diline taşınır.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Kullanım Özeti</h3>
              <p className="text-xs text-muted-foreground">Favoriler ve sık kullanılan raporlar kullanıcı bazında saklanır.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Toplam Rapor</p>
              <p className="mt-2 text-2xl font-bold">{REPORT_DEFINITIONS.length}</p>
            </div>
            <div className="rounded-2xl bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Favoriler</p>
              <p className="mt-2 text-2xl font-bold">{favoriteReports.length}</p>
            </div>
            <div className="rounded-2xl bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Son Kullanılan</p>
              <p className="mt-2 text-2xl font-bold">{recentReports.length}</p>
            </div>
          </div>
        </div>
      </section>

      <ReportFilterBar
        title="Global Filters"
        description="Rapor kartlarına geçmeden önce ortak kapsamı seçin."
        fields={REPORT_GLOBAL_FILTERS}
        values={filters}
        availableFilters={availableFilters}
        onValuesChange={setFilters}
        onApply={applyFilters}
        onReset={resetFilters}
        compact
      />

      <SectionCard
        title="Favorite Reports"
        description="Sabitlediğiniz raporlar burada tutulur."
        items={favoriteReports}
        favoriteSlugs={favoriteSlugs}
        onToggleFavorite={toggleFavorite}
        buildReportLink={buildReportLink}
      />

      <SectionCard
        title="Frequently Used"
        description="En sık açtığınız raporlar."
        items={frequentlyUsedReports}
        favoriteSlugs={favoriteSlugs}
        onToggleFavorite={toggleFavorite}
        buildReportLink={buildReportLink}
      />

      <SectionCard
        title="Recently Used"
        description="Yakın zamanda ziyaret edilen raporlar."
        items={recentReports}
        favoriteSlugs={favoriteSlugs}
        onToggleFavorite={toggleFavorite}
        buildReportLink={buildReportLink}
      />

      <div className="space-y-8">
        {reportsByCategory.map((category) => (
          <SectionCard
            key={category.id}
            title={category.label}
            description={category.description}
            items={category.reports}
            favoriteSlugs={favoriteSlugs}
            onToggleFavorite={toggleFavorite}
            buildReportLink={buildReportLink}
          />
        ))}
      </div>
    </div>
  );
}
