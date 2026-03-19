"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Progress } from "../../components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import { Fragment } from "react";
import {
  Search, ChevronDown, ChevronRight, Pencil, Filter, X, TrendingUp, Clock, CheckCircle2,
  Layers, CircleDollarSign, Hourglass,
} from "lucide-react";

const STATUS_LABELS = {
  PENDING: "Bekliyor", IN_PRODUCTION: "Üretimde", READY: "Hazır", DELIVERED: "Teslim Edildi", CANCELLED: "İptal",
};
const STATUS_COLORS = {
  PENDING: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  IN_PRODUCTION: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  READY: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  DELIVERED: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  CANCELLED: "bg-red-500/15 text-red-600 border-red-500/30",
};

const CURRENCY_SYMBOLS = { TRY: "₺", USD: "$", EUR: "€" };

function formatCurrency(kurus, currency = "TRY") {
  if (!kurus && kurus !== 0) return `${CURRENCY_SYMBOLS[currency] || "₺"}0`;
  const sym = CURRENCY_SYMBOLS[currency] || "₺";
  return sym + (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const EMPTY_FILTERS = {
  search: "", patientId: "", doctorId: "", responsibleUserId: "",
  treatmentType: "", labSupplierId: "", status: "", priceMin: "", priceMax: "",
  dateFrom: "", dateTo: "", currency: "",
};

export default function LaboratoryDetailsPage() {
  const [data, setData] = useState({ items: [], summaryByCurrency: {}, generalTotal: { completed: 0, pending: 0, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  const [suppliers, setSuppliers] = useState([]);
  const [users, setUsers] = useState([]);
  const [patients, setPatients] = useState([]);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRelation, setEditingRelation] = useState(null);
  const [editForm, setEditForm] = useState({ status: "", completionRate: "", completionPriceRate: "", responsibleUserId: "", color: "", description: "" });

  const fetchFilterData = useCallback(async () => {
    try {
      const [supRes, usersRes, patientsRes] = await Promise.all([
        fetch("/api/laboratory/suppliers").then(r => r.json()),
        fetch("/api/laboratory/users").then(r => r.json()),
        fetch("/api/patients?limit=500").then(r => r.json()),
      ]);
      setSuppliers(supRes.items || []);
      setUsers(usersRes.users || []);
      setPatients(patientsRes.patients || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/laboratory/relations?${params}`);
      const json = await res.json();
      setData({
        items: json.items || [],
        summaryByCurrency: json.summaryByCurrency || {},
        generalTotal: json.generalTotal || { completed: 0, pending: 0, total: 0 },
      });
      setPagination(json.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchFilterData(); }, [fetchFilterData]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const openEditDialog = (rel) => {
    setEditingRelation(rel);
    setEditForm({
      status: rel.status,
      completionRate: String(rel.completionRate),
      completionPriceRate: String(rel.completionPriceRate),
      responsibleUserId: rel.responsibleUserId || "",
      color: rel.color || "",
      description: rel.description || "",
    });
    setShowEditDialog(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingRelation) return;
    await fetch(`/api/laboratory/relations/${editingRelation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        completionRate: parseInt(editForm.completionRate) || 0,
        completionPriceRate: parseInt(editForm.completionPriceRate) || 0,
        responsibleUserId: editForm.responsibleUserId || null,
      }),
    });
    setShowEditDialog(false);
    fetchData(pagination.page);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Laboratuvar Detay</h2>
          <p className="text-muted-foreground text-sm">Tedavi planlarından oluşturulan laboratuvar işleri</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="glass-effect rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
            <Layers className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium">Toplam Kayıt</span>
          </div>
          <div className="text-2xl font-bold">{data.generalTotal.count ?? pagination.total}</div>
        </div>
        <div className="glass-effect rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium">Tamamlanan</span>
          </div>
          <div className="text-2xl font-bold font-mono">{formatCurrency(data.generalTotal.completed)}</div>
        </div>
        <div className="glass-effect rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
            <Hourglass className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium">Bekleyen</span>
          </div>
          <div className="text-2xl font-bold font-mono">{formatCurrency(data.generalTotal.pending)}</div>
        </div>
        <div className="glass-effect rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
            <CircleDollarSign className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium">Genel Toplam</span>
          </div>
          <div className="text-2xl font-bold font-mono">{formatCurrency(data.generalTotal.total)}</div>
        </div>
      </div>

      {/* Currency breakdown (only shown when multiple currencies exist) */}
      {Object.keys(data.summaryByCurrency).length > 1 && (
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(data.summaryByCurrency).map(([cur, summary]) => (
            <div key={cur} className="glass-effect rounded-xl p-4 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium">{cur} Özet</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{cur}</Badge>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Tamamlanan</span>
                  <span className="font-mono font-semibold text-emerald-600">{formatCurrency(summary.completed, cur)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Bekleyen</span>
                  <span className="font-mono font-semibold text-amber-600">{formatCurrency(summary.pending, cur)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-xs font-medium">Toplam</span>
                  <span className="font-mono font-bold">{formatCurrency(summary.total, cur)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tedavi, hasta veya tedarikçi ara..." value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} className="pl-9" />
        </div>
        <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters(!showFilters)} className="gap-1.5">
          <Filter className="h-4 w-4" />Filtreler
          {hasActiveFilters && <Badge className="ml-1 h-5 px-1.5 text-xs bg-primary text-primary-foreground">!</Badge>}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1">
            <X className="h-3.5 w-3.5" />Temizle
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Hasta</Label>
                <Select value={filters.patientId || "__all__"} onValueChange={(v) => setFilters(f => ({ ...f, patientId: v === "__all__" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tümü" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tümü</SelectItem>
                    {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Doktor</Label>
                <Select value={filters.doctorId || "__all__"} onValueChange={(v) => setFilters(f => ({ ...f, doctorId: v === "__all__" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tümü" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tümü</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sorumlu Kişi</Label>
                <Select value={filters.responsibleUserId || "__all__"} onValueChange={(v) => setFilters(f => ({ ...f, responsibleUserId: v === "__all__" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tümü" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tümü</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tedarikçi</Label>
                <Select value={filters.labSupplierId || "__all__"} onValueChange={(v) => setFilters(f => ({ ...f, labSupplierId: v === "__all__" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tümü" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tümü</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Durum</Label>
                <Select value={filters.status || "__all__"} onValueChange={(v) => setFilters(f => ({ ...f, status: v === "__all__" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tümü" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tümü</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tedavi Tipi</Label>
                <Input className="h-8 text-xs" placeholder="ör: Zirkonyum" value={filters.treatmentType}
                  onChange={(e) => setFilters(f => ({ ...f, treatmentType: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Para Birimi</Label>
                <Select value={filters.currency || "__all__"} onValueChange={(v) => setFilters(f => ({ ...f, currency: v === "__all__" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tümü" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tümü</SelectItem>
                    <SelectItem value="TRY">TRY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fiyat Aralığı</Label>
                <div className="flex gap-1">
                  <Input className="h-8 text-xs" type="number" placeholder="Min" value={filters.priceMin}
                    onChange={(e) => setFilters(f => ({ ...f, priceMin: e.target.value }))} />
                  <Input className="h-8 text-xs" type="number" placeholder="Max" value={filters.priceMax}
                    onChange={(e) => setFilters(f => ({ ...f, priceMax: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tarih Başlangıç</Label>
                <Input className="h-8 text-xs" type="date" value={filters.dateFrom}
                  onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tarih Bitiş</Label>
                <Input className="h-8 text-xs" type="date" value={filters.dateTo}
                  onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-8 p-3"></th>
                  <th className="text-left p-3 font-medium">Tedavi Adı</th>
                  <th className="text-left p-3 font-medium">Tedarikçi</th>
                  <th className="text-left p-3 font-medium">Hasta</th>
                  <th className="text-right p-3 font-medium">Birim Fiyat</th>
                  <th className="text-center p-3 font-medium">Tamamlanma</th>
                  <th className="text-center p-3 font-medium">Fiyat İlerleme</th>
                  <th className="text-left p-3 font-medium">Sorumlu</th>
                  <th className="text-left p-3 font-medium">Doktor</th>
                  <th className="text-center p-3 font-medium">Durum</th>
                  <th className="text-center p-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Yükleniyor...</td></tr>
                ) : data.items.length === 0 ? (
                  <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">
                    Laboratuvar kaydı bulunamadı. Tedavi planlarından laboratuvar gerektiren tedavi ekleyerek kayıt oluşturabilirsiniz.
                  </td></tr>
                ) : data.items.map(rel => (
                  <Fragment key={rel.id}>
                    <tr className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => toggleRow(rel.id)}>
                      <td className="p-3 text-center">
                        {expandedRows[rel.id] ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </td>
                      <td className="p-3 font-medium">{rel.treatmentItem?.name || "—"}</td>
                      <td className="p-3">{rel.labSupplier?.name || "—"}</td>
                      <td className="p-3">{rel.patient ? `${rel.patient.firstName} ${rel.patient.lastName}` : "—"}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(rel.price, rel.labMaterial?.currency)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Progress value={rel.completionRate} className="h-2 flex-1" />
                          <span className="text-xs font-mono w-8 text-right">%{rel.completionRate}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Progress value={rel.completionPriceRate} className="h-2 flex-1" />
                          <span className="text-xs font-mono w-8 text-right">%{rel.completionPriceRate}</span>
                        </div>
                      </td>
                      <td className="p-3">{rel.responsible?.name || "—"}</td>
                      <td className="p-3">{rel.doctor?.name || "—"}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={STATUS_COLORS[rel.status]}>{STATUS_LABELS[rel.status]}</Badge>
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(rel)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                    {expandedRows[rel.id] && (
                      <tr className="bg-muted/10">
                        <td colSpan={11} className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs">Malzeme</span>
                              <p className="font-medium">{rel.labMaterial?.name || "—"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Renk / Shade</span>
                              <p className="font-medium">{rel.color || "—"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Adet</span>
                              <p className="font-medium">{rel.quantity}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Toplam Fiyat</span>
                              <p className="font-medium font-mono">{formatCurrency(rel.price * rel.quantity, rel.labMaterial?.currency)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Tedavi Durumu</span>
                              <p className="font-medium">{rel.treatmentItem?.status || "—"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Açıklama</span>
                              <p className="font-medium">{rel.description || "—"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Oluşturulma Tarihi</span>
                              <p className="font-medium">{formatDate(rel.createdAt)}</p>
                            </div>
                            {rel.treatmentItem?.teeth?.length > 0 && (
                              <div>
                                <span className="text-muted-foreground text-xs">Dişler</span>
                                <p className="font-medium">{rel.treatmentItem.teeth.map(t => t.toothCode).join(", ")}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <span className="text-xs text-muted-foreground">
                Toplam {pagination.total} kayıt ({pagination.page}/{pagination.pages} sayfa)
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                  onClick={() => fetchData(pagination.page - 1)}>Önceki</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages}
                  onClick={() => fetchData(pagination.page + 1)}>Sonraki</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Laboratuvar Kaydı Düzenle</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-1.5"><Label>Durum</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Tamamlanma Oranı (%)</Label>
                <Input type="number" min="0" max="100" value={editForm.completionRate}
                  onChange={(e) => setEditForm(f => ({ ...f, completionRate: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label>Fiyat İlerleme (%)</Label>
                <Input type="number" min="0" max="100" value={editForm.completionPriceRate}
                  onChange={(e) => setEditForm(f => ({ ...f, completionPriceRate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Sorumlu Kişi</Label>
              <Select value={editForm.responsibleUserId || "__none__"} onValueChange={(v) => setEditForm(f => ({ ...f, responsibleUserId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Atanmamış</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Renk / Shade</Label>
              <Input value={editForm.color} onChange={(e) => setEditForm(f => ({ ...f, color: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Açıklama</Label>
              <Input value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">Güncelle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
