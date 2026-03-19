"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, ChevronLeft, ChevronRight, Download, Filter, X,
  MoreHorizontal, Eye, User, ClipboardList, Trash2
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import * as XLSX from "xlsx";

const PLAN_STATUS_LABELS = {
  DRAFT:       "Taslak",
  PROPOSED:    "Teklif Edildi",
  APPROVED:    "Onaylandı",
  REJECTED:    "Reddedildi",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED:   "Tamamlandı",
  CANCELLED:   "İptal",
};

const PLAN_STATUS_STYLES = {
  DRAFT:       "bg-slate-100 text-slate-700 border-slate-300",
  PROPOSED:    "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED:    "bg-blue-100 text-blue-800 border-blue-300",
  REJECTED:    "bg-red-100 text-red-700 border-red-300",
  IN_PROGRESS: "bg-purple-100 text-purple-800 border-purple-300",
  COMPLETED:   "bg-emerald-100 text-emerald-800 border-emerald-300",
  CANCELLED:   "bg-red-50 text-red-400 border-red-200",
};

const PAGE_SIZE = 15;

function computeProgress(plan) {
  const leafItems = (plan.items || []).flatMap((item) =>
    item.children?.length ? item.children : [item]
  );
  const total = leafItems.length;
  const completed = leafItems.filter((i) => i.status === "COMPLETED").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const completedCost = leafItems
    .filter((i) => i.status === "COMPLETED")
    .reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  return { total, completed, pct, completedCost };
}

function formatCurrency(kurus) {
  if (!kurus && kurus !== 0) return "0 TL";
  return (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 0 }) + " TL";
}

export default function TreatmentsPage() {
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    doctorUserId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    status: "",
    doctorUserId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const searchTimerRef = useRef(null);

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/doctors");
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchPlans = useCallback(async (page, filterOverrides) => {
    try {
      setLoading(true);
      const f = filterOverrides || appliedFilters;
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (f.search) params.set("search", f.search);
      if (f.status) params.set("status", f.status);
      if (f.doctorUserId) params.set("doctorUserId", f.doctorUserId);
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);

      const res = await fetch(`/api/treatment-plans?${params.toString()}`);
      const data = await res.json();
      setPlans(data.plans || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);
  useEffect(() => { fetchPlans(currentPage); }, [currentPage, appliedFilters, fetchPlans]);

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    const empty = { search: "", status: "", doctorUserId: "", dateFrom: "", dateTo: "" };
    setFilters(empty);
    setAppliedFilters(empty);
    setCurrentPage(1);
  };

  const handleSearchChange = (val) => {
    setFilters((f) => ({ ...f, search: val }));
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setAppliedFilters((prev) => ({ ...prev, search: val }));
      setCurrentPage(1);
    }, 400);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "9999");
      if (appliedFilters.search) params.set("search", appliedFilters.search);
      if (appliedFilters.status) params.set("status", appliedFilters.status);
      if (appliedFilters.doctorUserId) params.set("doctorUserId", appliedFilters.doctorUserId);
      if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
      if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);

      const res = await fetch(`/api/treatment-plans?${params.toString()}`);
      const data = await res.json();
      const rows = (data.plans || []).map((plan) => {
        const prog = computeProgress(plan);
        return {
          "Hasta": plan.patient ? `${plan.patient.firstName} ${plan.patient.lastName}` : "-",
          "Plan Adı": plan.title,
          "Hekim": plan.doctor?.name || "-",
          "Durum": PLAN_STATUS_LABELS[plan.status] || plan.status,
          "İlerleme %": prog.pct,
          "Toplam İşlem": prog.total,
          "Tamamlanan": prog.completed,
          "Planlanan Tutar": plan.plannedTotal ? (plan.plannedTotal / 100).toFixed(2) : "0",
          "Tamamlanan Tutar": prog.completedCost ? (prog.completedCost / 100).toFixed(2) : "0",
          "Tarih": plan.createdAt ? format(new Date(plan.createdAt), "dd.MM.yyyy") : "-",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tedavi Planları");
      XLSX.writeFile(wb, `tedavi_planlari_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Dışa aktarma sırasında hata oluştu.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeletePlan = async (planId, e) => {
    if (e) e.stopPropagation();
    if (!confirm("Bu tedavi planını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;
    try {
      const res = await fetch(`/api/treatment-plans/${planId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Silme işlemi başarısız oldu.");
        return;
      }
      fetchPlans(currentPage);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Silme sırasında hata oluştu.");
    }
  };

  const hasActiveFilters = appliedFilters.search || appliedFilters.status || appliedFilters.doctorUserId || appliedFilters.dateFrom || appliedFilters.dateTo;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tedavi Planları</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tedavi planlarını görüntüleyin, filtreleyin ve dışa aktarın
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          {exporting ? "Hazırlanıyor..." : "Dışa Aktar"}
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-effect rounded-xl border border-border/50 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Hasta adı veya plan adı ara..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          <Select
            value={filters.doctorUserId || "__all__"}
            onValueChange={(v) => setFilters((f) => ({ ...f, doctorUserId: v === "__all__" ? "" : v }))}
          >
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="Hekim" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Hekimler</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.user?.id} value={d.user?.id || ""}>{d.user?.name || "—"}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status || "__all__"}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "__all__" ? "" : v }))}
          >
            <SelectTrigger className="h-8 text-xs w-[150px]">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Durumlar</SelectItem>
              {Object.entries(PLAN_STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="h-8 text-xs w-[130px]"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            placeholder="Başlangıç"
          />
          <Input
            type="date"
            className="h-8 text-xs w-[130px]"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            placeholder="Bitiş"
          />

          <Button size="sm" className="h-8 text-xs btn-primary-gradient" onClick={applyFilters}>
            <Filter className="h-3 w-3 mr-1" /> Filtrele
          </Button>

          {hasActiveFilters && (
            <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" /> Temizle
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Yükleniyor...
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <ClipboardList className="h-8 w-8 opacity-30" />
            <p className="text-sm">Tedavi planı bulunamadı</p>
            {hasActiveFilters && <p className="text-xs">Filtreleri değiştirmeyi deneyin</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hasta</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Plan Adı</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hekim</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Durum</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium min-w-[160px]">İlerleme</th>
                    <th className="py-2.5 px-4 text-center text-[11px] uppercase tracking-wide font-medium">İşlem</th>
                    <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Planlanan</th>
                    <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Tamamlanan</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tarih</th>
                    <th className="py-2.5 px-4 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {plans.map((plan) => {
                    const prog = computeProgress(plan);
                    const statusStyle = PLAN_STATUS_STYLES[plan.status] || PLAN_STATUS_STYLES.DRAFT;
                    return (
                      <tr
                        key={plan.id}
                        className="hover:bg-muted/5 transition-colors cursor-pointer"
                        onClick={() => navigate(`/patients/${plan.patientId}?tab=plans&plan=${plan.id}`)}
                      >
                        {/* Patient */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                              {plan.patient?.firstName?.[0] || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {plan.patient ? `${plan.patient.firstName} ${plan.patient.lastName}` : "—"}
                              </div>
                              {plan.patient?.phone && (
                                <div className="text-[10px] text-muted-foreground">{plan.patient.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Title */}
                        <td className="py-2.5 px-4">
                          <span className="text-sm font-medium truncate block max-w-[200px]">{plan.title}</span>
                        </td>

                        {/* Doctor */}
                        <td className="py-2.5 px-4 text-sm text-muted-foreground">
                          {plan.doctor?.name ? `Dr. ${plan.doctor.name}` : <span className="text-muted-foreground/40">—</span>}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-4">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle}`}>
                            {PLAN_STATUS_LABELS[plan.status] || plan.status}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <Progress value={prog.pct} className="h-2 flex-1" />
                            <span className="text-[10px] font-semibold text-muted-foreground w-8 text-right">
                              %{prog.pct}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {prog.completed}/{prog.total} tamamlandı
                          </div>
                        </td>

                        {/* Item counts */}
                        <td className="py-2.5 px-4 text-center">
                          <span className="text-sm font-medium">{prog.total}</span>
                        </td>

                        {/* Planned Cost */}
                        <td className="py-2.5 px-4 text-right">
                          <span className="text-sm font-semibold">
                            {formatCurrency(plan.plannedTotal || 0)}
                          </span>
                        </td>

                        {/* Completed Cost */}
                        <td className="py-2.5 px-4 text-right">
                          <span className="text-sm font-semibold text-emerald-600">
                            {formatCurrency(prog.completedCost)}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {plan.createdAt ? format(new Date(plan.createdAt), "dd MMM yyyy", { locale: tr }) : "—"}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/patients/${plan.patientId}?tab=plans&plan=${plan.id}`)}>
                                <Eye className="h-3.5 w-3.5 mr-2" /> Planı Görüntüle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/patients/${plan.patientId}`)}>
                                <User className="h-3.5 w-3.5 mr-2" /> Hasta Profili
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => handleDeletePlan(plan.id, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Planı Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Toplam <span className="font-semibold text-foreground">{pagination.total}</span> plan
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Önceki
                </Button>
                <span className="text-xs font-medium text-muted-foreground px-2">
                  Sayfa {pagination.page} / {pagination.pages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={currentPage >= (pagination.pages || 1)}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.pages || 1, p + 1))}
                >
                  Sonraki <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
