import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { ReportPageLayout } from "../../../components/reports/ReportPageLayout";
import { ReportFilterBar } from "../../../components/reports/ReportFilterBar";
import { ReportSummaryCards } from "../../../components/reports/ReportSummaryCards";
import { ReportChartBlock } from "../../../components/reports/ReportChartBlock";
import { ReportDataTable } from "../../../components/reports/ReportDataTable";
import { ReportExportActions } from "../../../components/reports/ReportExportActions";
import {
  buildQueryStringFromObject,
  getInitialFilterState,
} from "../../../features/reports/reportUtils";
import { useReportPreferences } from "../../../features/reports/preferences";

export default function ReportDetailPage({ report }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() =>
    getInitialFilterState(report.filters, searchParams)
  );
  const [data, setData] = useState({
    stats: [],
    charts: [],
    rows: [],
    pagination: { page: 1, pages: 1, total: 0 },
    filters: { available: {} },
    meta: {},
  });
  const [metaFilters, setMetaFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const { trackVisit } = useReportPreferences(user);

  useEffect(() => {
    setFilters(getInitialFilterState(report.filters, searchParams));
  }, [report.filters, searchParams]);

  useEffect(() => {
    trackVisit(report.slug);
  }, [report.slug, trackVisit]);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const response = await fetch("/api/reports/meta");
        if (!response.ok) return;
        const payload = await response.json();
        setMetaFilters(payload.availableFilters || {});
      } catch (error) {
        console.error("Failed to fetch report meta:", error);
      }
    }

    fetchMeta();
  }, []);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        const response = await fetch(`/api/reports/${report.slug}?${searchParams.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch report ${report.slug}`);
        }

        const payload = await response.json();
        setData({
          stats: payload.stats || [],
          charts: payload.charts || [],
          rows: payload.rows || [],
          pagination: payload.pagination || { page: 1, pages: 1, total: 0 },
          filters: payload.filters || { available: {} },
          meta: payload.meta || {},
        });
      } catch (error) {
        console.error("Failed to fetch report data:", error);
        setData({
          stats: [],
          charts: [],
          rows: [],
          pagination: { page: 1, pages: 1, total: 0 },
          filters: { available: {} },
          meta: {},
        });
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [report.slug, searchParams]);

  const availableFilters = useMemo(
    () => ({
      ...(metaFilters || {}),
      ...(data.filters?.available || {}),
    }),
    [data.filters?.available, metaFilters]
  );

  const sortBy = searchParams.get("sortBy") || report.defaultSortBy;
  const sortOrder = searchParams.get("sortOrder") || report.defaultSortOrder;

  const applyFilters = () => {
    const nextParams = buildQueryStringFromObject({
      ...filters,
      sortBy,
      sortOrder,
      page: 1,
      limit: report.pageSize,
    });
    setSearchParams(nextParams);
  };

  const resetFilters = () => {
    const nextParams = buildQueryStringFromObject({
      sortBy: report.defaultSortBy,
      sortOrder: report.defaultSortOrder,
      page: 1,
      limit: report.pageSize,
    });
    setFilters({});
    setSearchParams(nextParams);
  };

  const handleSortChange = (columnKey) => {
    const nextSortOrder = sortBy === columnKey && sortOrder === "desc" ? "asc" : "desc";
    const nextParams = buildQueryStringFromObject({
      ...Object.fromEntries(searchParams.entries()),
      sortBy: columnKey,
      sortOrder: nextSortOrder,
      page: 1,
      limit: report.pageSize,
    });
    setSearchParams(nextParams);
  };

  const handlePageChange = (nextPage) => {
    const nextParams = buildQueryStringFromObject({
      ...Object.fromEntries(searchParams.entries()),
      page: nextPage,
      limit: report.pageSize,
    });
    setSearchParams(nextParams);
  };

  return (
    <div className="space-y-4">
      {data.meta?.note && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {data.meta.note}
        </div>
      )}

      <ReportPageLayout
        title={report.title}
        description={report.description}
        accentClass={report.accent}
        actions={
          <ReportExportActions
            reportTitle={report.title}
            columns={report.tableColumns}
            rows={data.rows}
            disabled={loading || data.rows.length === 0}
          />
        }
        filterBar={
          <ReportFilterBar
            fields={report.filters}
            values={filters}
            availableFilters={availableFilters}
            onValuesChange={setFilters}
            onApply={applyFilters}
            onReset={resetFilters}
            compact
          />
        }
        summary={<ReportSummaryCards items={data.stats} loading={loading} />}
        charts={<ReportChartBlock blocks={data.charts} loading={loading} />}
        table={
          <ReportDataTable
            columns={report.tableColumns}
            rows={data.rows}
            loading={loading}
            pagination={data.pagination}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onPageChange={handlePageChange}
            onRowClick={(row) => row.rowLink && navigate(row.rowLink)}
          />
        }
      />
    </div>
  );
}
