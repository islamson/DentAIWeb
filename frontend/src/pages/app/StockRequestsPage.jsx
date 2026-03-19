"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  ClipboardList, Plus, Search, Filter, Download, ChevronLeft, ChevronRight,
  X, MoreHorizontal, Trash2, Clock, CheckCircle, Loader2, PackageCheck, AlertCircle, CalendarPlus,
} from "lucide-react";
import * as XLSX from "xlsx";

const STATUS_LABELS = { PENDING: "Bekliyor", PREPARING: "Hazırlanıyor", PREPARED: "Hazırlandı", COMPLETED: "Tamamlandı", CANCELLED: "İptal" };
const STATUS_COLORS = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-300",
  PREPARING: "bg-blue-100 text-blue-800 border-blue-300",
  PREPARED: "bg-purple-100 text-purple-800 border-purple-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CANCELLED: "bg-red-50 text-red-400 border-red-200",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function StockRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, preparing: 0, prepared: 0, completed: 0, todayCreated: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const [outputDirections, setOutputDirections] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  const [filters, setFilters] = useState({ search: "", status: "", outputDirectionId: "", dateFrom: "", dateTo: "" });
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "", outputDirectionId: "", dateFrom: "", dateTo: "" });
  const searchTimer = useRef(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestForm, setRequestForm] = useState({ outputDirectionId: "", description: "" });
  const [requestRows, setRequestRows] = useState([{ inventoryItemId: "", requestedQty: 1, neededByDate: "", notes: "" }]);

  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailRequest, setDetailRequest] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchMasterData = useCallback(async () => {
    try {
      const [dirRes, itemsRes] = await Promise.all([
        fetch("/api/inventory/output-directions?activeOnly=true&limit=200"),
        fetch("/api/inventory/items?limit=500"),
      ]);
      setOutputDirections((await dirRes.json()).items || []);
      setInventoryItems((await itemsRes.json()).items || []);
    } catch (err) { console.error(err); }
  }, []);

  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: pagination.limit });
      if (appliedFilters.search) params.set("search", appliedFilters.search);
      if (appliedFilters.status) params.set("status", appliedFilters.status);
      if (appliedFilters.outputDirectionId) params.set("outputDirectionId", appliedFilters.outputDirectionId);
      if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
      if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);
      const res = await fetch(`/api/inventory/requests?${params}`);
      const data = await res.json();
      setRequests(data.items || []);
      setStats(data.stats || stats);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [appliedFilters, pagination.limit]);

  useEffect(() => { fetchMasterData(); }, [fetchMasterData]);
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleSearchChange = (val) => {
    setFilters(f => ({ ...f, search: val }));
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setAppliedFilters(prev => ({ ...prev, search: val })); }, 400);
  };
  const applyFilters = () => { setAppliedFilters({ ...filters }); };
  const clearFilters = () => { const e = { search: "", status: "", outputDirectionId: "", dateFrom: "", dateTo: "" }; setFilters(e); setAppliedFilters(e); };
  const hasActiveFilters = appliedFilters.search || appliedFilters.status || appliedFilters.outputDirectionId || appliedFilters.dateFrom || appliedFilters.dateTo;

  const addRow = () => setRequestRows(r => [...r, { inventoryItemId: "", requestedQty: 1, neededByDate: "", notes: "" }]);
  const removeRow = (idx) => setRequestRows(r => r.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) => setRequestRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    const validRows = requestRows.filter(r => r.inventoryItemId && r.requestedQty > 0);
    if (!validRows.length) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputDirectionId: requestForm.outputDirectionId || null, description: requestForm.description || null, items: validRows }),
      });
      if (res.ok) {
        setShowCreateDialog(false);
        setRequestForm({ outputDirectionId: "", description: "" });
        setRequestRows([{ inventoryItemId: "", requestedQty: 1, neededByDate: "", notes: "" }]);
        fetchRequests(pagination.page);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const res = await fetch(`/api/inventory/requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchRequests(pagination.page);
    } catch (err) { console.error(err); }
  };

  const handleDeleteRequest = async (id) => {
    if (!confirm("Bu talebi silmek istediğinize emin misiniz?")) return;
    try {
      await fetch(`/api/inventory/requests/${id}`, { method: "DELETE" });
      fetchRequests(pagination.page);
    } catch (err) { console.error(err); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: 1, limit: 9999 });
      if (appliedFilters.status) params.set("status", appliedFilters.status);
      if (appliedFilters.outputDirectionId) params.set("outputDirectionId", appliedFilters.outputDirectionId);
      const res = await fetch(`/api/inventory/requests?${params}`);
      const data = await res.json();
      const rows = (data.items || []).map(r => ({
        "Çıkış Yönü": r.outputDirection?.name || "—",
        "Talep Eden": r.requestedBy?.name || "—",
        "Durum": STATUS_LABELS[r.status] || r.status,
        "Ürün Sayısı": r.items?.length || 0,
        "Açıklama": r.description || "",
        "Tarih": formatDate(r.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stok Talepleri");
      XLSX.writeFile(wb, `stok_talepleri_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { console.error(err); alert("Dışa aktarma hatası"); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stok Talepleri</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Stok talep oluşturma ve takibi</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport} disabled={exporting}>
            <Download className="h-3.5 w-3.5 mr-1.5" />{exporting ? "Hazırlanıyor..." : "Dışa Aktar"}
          </Button>
          <Button className="btn-primary-gradient h-8 text-xs" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Stok Talebi Ekle
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Toplam Talep", value: stats.total, icon: ClipboardList, color: "text-blue-500" },
          { label: "Bekliyor", value: stats.pending, icon: Clock, color: "text-amber-500" },
          { label: "Hazırlanıyor", value: stats.preparing, icon: Loader2, color: "text-blue-500" },
          { label: "Hazırlandı", value: stats.prepared, icon: PackageCheck, color: "text-purple-500" },
          { label: "Tamamlandı", value: stats.completed, icon: CheckCircle, color: "text-emerald-500" },
          { label: "Bugün", value: stats.todayCreated, icon: CalendarPlus, color: "text-indigo-500" },
        ].map(s => (
          <div key={s.label} className="glass-effect rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              <span className="text-[11px] font-medium">{s.label}</span>
            </div>
            <div className="text-xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-effect rounded-xl border border-border/50 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Açıklama veya ürün ara..." value={filters.search} onChange={e => handleSearchChange(e.target.value)} />
          </div>
          <Select value={filters.status || "__all__"} onValueChange={v => setFilters(f => ({ ...f, status: v === "__all__" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Durumlar</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.outputDirectionId || "__all__"} onValueChange={v => setFilters(f => ({ ...f, outputDirectionId: v === "__all__" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="Çıkış Yönü" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Yönler</SelectItem>
              {outputDirections.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="h-8 text-xs w-[130px]" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
          <Input type="date" className="h-8 text-xs w-[130px]" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          <Button size="sm" className="h-8 text-xs btn-primary-gradient" onClick={applyFilters}><Filter className="h-3 w-3 mr-1" />Filtrele</Button>
          {hasActiveFilters && <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}><X className="h-3 w-3 mr-1" />Temizle</Button>}
        </div>
      </div>

      {/* Table */}
      <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Yükleniyor...</div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <ClipboardList className="h-8 w-8 opacity-30" />
            <p className="text-sm">Talep bulunamadı</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Çıkış Yönü</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Talep Eden</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Durum</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tarih</th>
                    <th className="py-2.5 px-4 text-center text-[11px] uppercase tracking-wide font-medium">Ürün</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Açıklama</th>
                    <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium w-[80px]">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {requests.map(req => (
                    <tr key={req.id} className="hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => { setDetailRequest(req); setShowDetailDialog(true); }}>
                      <td className="py-2.5 px-4 text-sm">{req.outputDirection?.name || "—"}</td>
                      <td className="py-2.5 px-4 text-sm">{req.requestedBy?.name || "—"}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[req.status]}`}>
                          {STATUS_LABELS[req.status] || req.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">{formatDate(req.createdAt)}</td>
                      <td className="py-2.5 px-4 text-center text-xs font-medium">{req.items?.length || 0}</td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground truncate max-w-[200px]">{req.description || "—"}</td>
                      <td className="py-2.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {req.status === "PENDING" && <DropdownMenuItem onClick={() => handleStatusChange(req.id, "PREPARING")}>Hazırlanıyor</DropdownMenuItem>}
                            {req.status === "PREPARING" && <DropdownMenuItem onClick={() => handleStatusChange(req.id, "PREPARED")}>Hazırlandı</DropdownMenuItem>}
                            {req.status === "PREPARED" && <DropdownMenuItem onClick={() => handleStatusChange(req.id, "COMPLETED")}>Tamamlandı</DropdownMenuItem>}
                            {req.status !== "COMPLETED" && req.status !== "CANCELLED" && (
                              <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(req.id, "CANCELLED")}>İptal Et</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteRequest(req.id)}><Trash2 className="h-3.5 w-3.5 mr-2" />Sil</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Toplam <span className="font-semibold text-foreground">{pagination.total}</span> talep</div>
              {pagination.pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={pagination.page <= 1} onClick={() => fetchRequests(pagination.page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />Önceki
                  </Button>
                  <span className="text-xs font-medium text-muted-foreground px-2">Sayfa {pagination.page} / {pagination.pages}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={pagination.page >= pagination.pages} onClick={() => fetchRequests(pagination.page + 1)}>
                    Sonraki<ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Create Request Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Stok Talebi Oluştur</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Çıkış Yönü</Label>
                <Select value={requestForm.outputDirectionId || "__none__"} onValueChange={v => setRequestForm(f => ({ ...f, outputDirectionId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Belirtilmedi</SelectItem>
                    {outputDirections.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Genel Açıklama</Label>
                <Input value={requestForm.description} onChange={e => setRequestForm(f => ({ ...f, description: e.target.value }))} placeholder="Genel not..." />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Talep Kalemleri</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}><Plus className="h-3 w-3 mr-1" />Kalem Ekle</Button>
              </div>
              <div className="space-y-2">
                {requestRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_120px_auto] gap-2 items-end p-2 bg-muted/20 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Stok Adı</Label>
                      <Select value={row.inventoryItemId || "__none__"} onValueChange={v => updateRow(idx, "inventoryItemId", v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ürün seçin..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Seçin...</SelectItem>
                          {inventoryItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Miktar</Label>
                      <Input type="number" min="1" className="h-8 text-xs" value={row.requestedQty} onChange={e => updateRow(idx, "requestedQty", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Gerekli Tarih</Label>
                      <Input type="date" className="h-8 text-xs" value={row.neededByDate} onChange={e => updateRow(idx, "neededByDate", e.target.value)} />
                    </div>
                    {requestRows.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRow(idx)}><X className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>İptal</Button>
              <Button type="submit" disabled={saving || !requestRows.some(r => r.inventoryItemId)} className="btn-primary-gradient">{saving ? "Kaydediliyor..." : "Talebi Oluştur"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Talep Detayı</DialogTitle></DialogHeader>
          {detailRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Çıkış Yönü:</span> <span className="font-medium">{detailRequest.outputDirection?.name || "—"}</span></div>
                <div><span className="text-muted-foreground">Talep Eden:</span> <span className="font-medium">{detailRequest.requestedBy?.name || "—"}</span></div>
                <div><span className="text-muted-foreground">Durum:</span> <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[detailRequest.status]}`}>{STATUS_LABELS[detailRequest.status]}</Badge></div>
                <div><span className="text-muted-foreground">Tarih:</span> <span className="font-medium">{formatDate(detailRequest.createdAt)}</span></div>
              </div>
              {detailRequest.description && <div className="text-sm"><span className="text-muted-foreground">Açıklama:</span> {detailRequest.description}</div>}
              <div>
                <div className="text-xs font-semibold mb-2">Talep Kalemleri</div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr>
                      <th className="py-1.5 px-3 text-left text-[10px] uppercase font-medium">Ürün</th>
                      <th className="py-1.5 px-3 text-right text-[10px] uppercase font-medium">Miktar</th>
                      <th className="py-1.5 px-3 text-left text-[10px] uppercase font-medium">Gerekli Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {(detailRequest.items || []).map(ri => (
                      <tr key={ri.id}>
                        <td className="py-1.5 px-3 text-xs">{ri.item?.name || "—"}</td>
                        <td className="py-1.5 px-3 text-right text-xs font-medium">{ri.requestedQty} {ri.item?.unit || ""}</td>
                        <td className="py-1.5 px-3 text-xs text-muted-foreground">{formatDate(ri.neededByDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
