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
  Package, AlertTriangle, TrendingUp, Box, Plus, Search, Filter, Download,
  ChevronLeft, ChevronRight, XCircle, MoreHorizontal, Pencil, History,
  CalendarClock, PlusCircle, X, Trash2, Clock,
} from "lucide-react";
import * as XLSX from "xlsx";

const MOVEMENT_TYPE_LABELS = { IN: "Giriş", OUT: "Çıkış", ADJUST: "Sayım", RETURN: "İade" };
const MOVEMENT_TYPE_COLORS = { IN: "text-emerald-600", OUT: "text-red-600", ADJUST: "text-blue-600", RETURN: "text-amber-600" };

function formatCurrency(kurus) {
  if (!kurus && kurus !== 0) return "₺0";
  return "₺" + (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const EMPTY_PRODUCT = { name: "", barcode: "", sku: "", unit: "adet", categoryId: "", cost: 0, vatRate: 0, minLevel: 0, currentStock: 0, description: "" };
const EMPTY_MOVEMENT = { inventoryItemId: "", qty: 1, type: "IN", outputDirectionId: "", totalPrice: "", notes: "", occurredAt: "" };

export default function StockManagementPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, outOfStock: 0, belowCritical: 0, totalValue: 0, expiringSoon: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const [categories, setCategories] = useState([]);
  const [outputDirections, setOutputDirections] = useState([]);

  const [filters, setFilters] = useState({ search: "", categoryId: "", unit: "" });
  const [appliedFilters, setAppliedFilters] = useState({ search: "", categoryId: "", unit: "" });
  const searchTimer = useRef(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [productForm, setProductForm] = useState({ ...EMPTY_PRODUCT });
  const [saving, setSaving] = useState(false);

  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [movementForm, setMovementForm] = useState({ ...EMPTY_MOVEMENT });
  const [movementItemName, setMovementItemName] = useState("");

  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [showExpiryDialog, setShowExpiryDialog] = useState(false);
  const [expiryItem, setExpiryItem] = useState(null);
  const [expiryBatches, setExpiryBatches] = useState([]);
  const [expiryLoading, setExpiryLoading] = useState(false);
  const [newExpiry, setNewExpiry] = useState({ quantity: 0, expiryDate: "", notes: "" });

  const [exporting, setExporting] = useState(false);

  const fetchMasterData = useCallback(async () => {
    try {
      const [catRes, dirRes] = await Promise.all([
        fetch("/api/inventory/categories?activeOnly=true&limit=200"),
        fetch("/api/inventory/output-directions?activeOnly=true&limit=200"),
      ]);
      setCategories((await catRes.json()).items || []);
      setOutputDirections((await dirRes.json()).items || []);
    } catch (err) { console.error(err); }
  }, []);

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: pagination.limit });
      if (appliedFilters.search) params.set("search", appliedFilters.search);
      if (appliedFilters.categoryId) params.set("categoryId", appliedFilters.categoryId);
      if (appliedFilters.unit) params.set("unit", appliedFilters.unit);
      const res = await fetch(`/api/inventory/items?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || stats);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [appliedFilters, pagination.limit]);

  useEffect(() => { fetchMasterData(); }, [fetchMasterData]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSearchChange = (val) => {
    setFilters(f => ({ ...f, search: val }));
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setAppliedFilters(prev => ({ ...prev, search: val }));
    }, 400);
  };

  const applyFilters = () => { setAppliedFilters({ ...filters }); };
  const clearFilters = () => {
    const empty = { search: "", categoryId: "", unit: "" };
    setFilters(empty);
    setAppliedFilters(empty);
  };

  const hasActiveFilters = appliedFilters.search || appliedFilters.categoryId || appliedFilters.unit;
  const getItemStatus = (item) => {
    if (item.currentStock <= 0) return "out";
    if (item.currentStock <= item.minLevel) return "low";
    return "normal";
  };

  const nearestExpiry = (item) => {
    if (item.expiryBatches && item.expiryBatches.length > 0) return item.expiryBatches[0].expiryDate;
    return null;
  };

  // ── Product Create/Edit ──
  const openCreate = () => { setEditingItem(null); setProductForm({ ...EMPTY_PRODUCT }); setShowCreateDialog(true); };
  const openEdit = (item) => {
    setEditingItem(item);
    setProductForm({ name: item.name, barcode: item.barcode || "", sku: item.sku || "", unit: item.unit || "adet", categoryId: item.categoryId || "", cost: item.cost || 0, vatRate: item.vatRate || 0, minLevel: item.minLevel || 0, currentStock: item.currentStock || 0, description: item.description || "" });
    setShowCreateDialog(true);
  };
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;
    setSaving(true);
    try {
      const url = editingItem ? `/api/inventory/items/${editingItem.id}` : "/api/inventory/items";
      const method = editingItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...productForm, cost: Number(productForm.cost) || null, vatRate: Number(productForm.vatRate) || 0, minLevel: Number(productForm.minLevel) || 0, currentStock: Number(productForm.currentStock) || 0, categoryId: productForm.categoryId || null }),
      });
      if (res.ok) { setShowCreateDialog(false); fetchItems(pagination.page); }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Movement ──
  const openMovement = (item) => {
    setMovementForm({ ...EMPTY_MOVEMENT, inventoryItemId: item.id });
    setMovementItemName(item.name);
    setShowMovementDialog(true);
  };
  const handleSaveMovement = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...movementForm, qty: Number(movementForm.qty), totalPrice: movementForm.totalPrice ? Number(movementForm.totalPrice) : null, outputDirectionId: movementForm.type === "OUT" ? (movementForm.outputDirectionId || null) : null, occurredAt: movementForm.occurredAt || null }),
      });
      if (res.ok) { setShowMovementDialog(false); fetchItems(pagination.page); }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Movement History ──
  const openHistory = async (item) => {
    setHistoryItem(item);
    setShowHistoryDialog(true);
    setMovementsLoading(true);
    try {
      const res = await fetch(`/api/inventory/movements?itemId=${item.id}&limit=50`);
      const data = await res.json();
      setMovements(data.items || []);
    } catch (err) { console.error(err); }
    finally { setMovementsLoading(false); }
  };

  // ── Expiry ──
  const openExpiry = async (item) => {
    setExpiryItem(item);
    setShowExpiryDialog(true);
    setExpiryLoading(true);
    setNewExpiry({ quantity: 0, expiryDate: "", notes: "" });
    try {
      const res = await fetch(`/api/inventory/expiry-batches?itemId=${item.id}`);
      const data = await res.json();
      setExpiryBatches(data.items || []);
    } catch (err) { console.error(err); }
    finally { setExpiryLoading(false); }
  };
  const handleAddExpiry = async () => {
    if (!newExpiry.expiryDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/expiry-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId: expiryItem.id, quantity: Number(newExpiry.quantity) || 0, expiryDate: newExpiry.expiryDate, notes: newExpiry.notes }),
      });
      if (res.ok) {
        setNewExpiry({ quantity: 0, expiryDate: "", notes: "" });
        const r2 = await fetch(`/api/inventory/expiry-batches?itemId=${expiryItem.id}`);
        setExpiryBatches((await r2.json()).items || []);
        fetchItems(pagination.page);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };
  const handleDeleteExpiry = async (id) => {
    if (!confirm("Bu SKT kaydını silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/inventory/expiry-batches/${id}`, { method: "DELETE" });
    const r2 = await fetch(`/api/inventory/expiry-batches?itemId=${expiryItem.id}`);
    setExpiryBatches((await r2.json()).items || []);
    fetchItems(pagination.page);
  };

  // ── Export ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: 1, limit: 9999 });
      if (appliedFilters.search) params.set("search", appliedFilters.search);
      if (appliedFilters.categoryId) params.set("categoryId", appliedFilters.categoryId);
      const res = await fetch(`/api/inventory/items?${params}`);
      const data = await res.json();
      const rows = (data.items || []).map(i => ({
        "Barkod": i.barcode || "",
        "SKU": i.sku || "",
        "Ad": i.name,
        "Kategori": i.category?.name || "",
        "Birim": i.unit || "",
        "Kritik Miktar": i.minLevel,
        "Miktar": i.currentStock,
        "Birim Fiyat": i.cost ? (i.cost / 100).toFixed(2) : "",
        "Toplam Değer": i.cost ? ((i.currentStock * i.cost) / 100).toFixed(2) : "",
        "KDV %": i.vatRate || 0,
        "Oluşturulma": formatDate(i.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stok");
      XLSX.writeFile(wb, `stok_yonetimi_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { console.error(err); alert("Dışa aktarma hatası"); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stok Yönetimi</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Malzeme ve ürün takibi, stok hareketleri</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport} disabled={exporting}>
            <Download className="h-3.5 w-3.5 mr-1.5" />{exporting ? "Hazırlanıyor..." : "Dışa Aktar"}
          </Button>
          <Button className="btn-primary-gradient h-8 text-xs" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Yeni Ürün Oluştur
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Toplam Ürün", value: stats.totalItems, icon: Box, color: "text-blue-500" },
          { label: "Düşük Stok", value: stats.lowStock, icon: AlertTriangle, color: "text-orange-500" },
          { label: "Tükenen", value: stats.outOfStock, icon: XCircle, color: "text-red-500" },
          { label: "Kritik Altı", value: stats.belowCritical, icon: AlertTriangle, color: "text-rose-500" },
          { label: "Toplam Değer", value: formatCurrency(stats.totalValue), icon: TrendingUp, color: "text-emerald-500" },
          { label: "SKT Yaklaşan", value: stats.expiringSoon, icon: Clock, color: "text-purple-500" },
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
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Ad, barkod veya SKU ara..." value={filters.search} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>
          <Select value={filters.categoryId || "__all__"} onValueChange={v => setFilters(f => ({ ...f, categoryId: v === "__all__" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Kategoriler</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs btn-primary-gradient" onClick={applyFilters}><Filter className="h-3 w-3 mr-1" />Filtrele</Button>
          {hasActiveFilters && <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}><X className="h-3 w-3 mr-1" />Temizle</Button>}
        </div>
      </div>

      {/* Table */}
      <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Package className="h-8 w-8 opacity-30" />
            <p className="text-sm">Ürün bulunamadı</p>
            {hasActiveFilters && <p className="text-xs">Filtreleri değiştirmeyi deneyin</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-left text-[11px] uppercase tracking-wide font-medium">Barkod</th>
                    <th className="py-2.5 px-3 text-left text-[11px] uppercase tracking-wide font-medium">Ad</th>
                    <th className="py-2.5 px-3 text-left text-[11px] uppercase tracking-wide font-medium">Kategori</th>
                    <th className="py-2.5 px-3 text-left text-[11px] uppercase tracking-wide font-medium">Tarih</th>
                    <th className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wide font-medium">Kritik</th>
                    <th className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wide font-medium">Miktar</th>
                    <th className="py-2.5 px-3 text-left text-[11px] uppercase tracking-wide font-medium">Birim</th>
                    <th className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wide font-medium">B.Fiyat</th>
                    <th className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wide font-medium">Toplam</th>
                    <th className="py-2.5 px-3 text-left text-[11px] uppercase tracking-wide font-medium">SKT</th>
                    <th className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wide font-medium w-[120px]">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {items.map(item => {
                    const status = getItemStatus(item);
                    const exp = nearestExpiry(item);
                    const isExpiringSoon = exp && new Date(exp) <= new Date(Date.now() + 30 * 86400000);
                    return (
                      <tr key={item.id} className="hover:bg-muted/5 transition-colors">
                        <td className="py-2 px-3 text-xs text-muted-foreground font-mono">{item.barcode || "—"}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.sku && <div className="text-[10px] text-muted-foreground">{item.sku}</div>}
                        </td>
                        <td className="py-2 px-3">
                          {item.category ? <Badge variant="secondary" className="text-[10px]">{item.category.name}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{formatDate(item.createdAt)}</td>
                        <td className="py-2 px-3 text-right text-xs">{item.minLevel}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-semibold text-sm ${status === "out" ? "text-red-600" : status === "low" ? "text-orange-600" : ""}`}>
                            {item.currentStock}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs">{item.unit || "adet"}</td>
                        <td className="py-2 px-3 text-right text-xs">{item.cost ? formatCurrency(item.cost) : "—"}</td>
                        <td className="py-2 px-3 text-right text-xs font-medium">{item.cost ? formatCurrency(item.currentStock * item.cost) : "—"}</td>
                        <td className="py-2 px-3 text-xs">
                          {exp ? <span className={isExpiringSoon ? "text-red-600 font-semibold" : "text-muted-foreground"}>{formatDate(exp)}</span> : "—"}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Son Kullanma Tarihi" onClick={() => openExpiry(item)}>
                              <CalendarClock className="h-3.5 w-3.5 text-purple-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Stok Hareketleri" onClick={() => openHistory(item)}>
                              <History className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Stok Hareketi Ekle" onClick={() => openMovement(item)}>
                              <PlusCircle className="h-3.5 w-3.5 text-emerald-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Düzenle" onClick={() => openEdit(item)}>
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Toplam <span className="font-semibold text-foreground">{pagination.total}</span> ürün
              </div>
              {pagination.pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={pagination.page <= 1} onClick={() => fetchItems(pagination.page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />Önceki
                  </Button>
                  <span className="text-xs font-medium text-muted-foreground px-2">Sayfa {pagination.page} / {pagination.pages}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={pagination.page >= pagination.pages} onClick={() => fetchItems(pagination.page + 1)}>
                    Sonraki<ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Create/Edit Product Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? "Ürün Düzenle" : "Yeni Ürün Oluştur"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Stok Adı *</Label><Input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Barkod</Label><Input value={productForm.barcode} onChange={e => setProductForm(f => ({ ...f, barcode: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={productForm.categoryId || "__none__"} onValueChange={v => setProductForm(f => ({ ...f, categoryId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Yok</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Birim</Label>
                <Select value={productForm.unit} onValueChange={v => setProductForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue placeholder="Birim seçin..." /></SelectTrigger>
                  <SelectContent>
                    {[
                      { value: "adet", label: "Adet" },
                      { value: "gram", label: "Gram" },
                      { value: "kilogram", label: "Kilogram" },
                      { value: "miligram", label: "Miligram" },
                      { value: "litre", label: "Litre" },
                      { value: "mililitre", label: "Mililitre" },
                      { value: "cc", label: "Santimetre Küp (cc)" },
                      { value: "libre", label: "Libre" },
                      { value: "kutu", label: "Kutu" },
                      { value: "paket", label: "Paket" },
                      { value: "metre", label: "Metre" },
                      { value: "rulo", label: "Rulo" },
                      { value: "tüp", label: "Tüp" },
                      { value: "şişe", label: "Şişe" },
                      { value: "takım", label: "Takım" },
                    ].map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Birim Fiyat (kuruş)</Label><Input type="number" value={productForm.cost} onChange={e => setProductForm(f => ({ ...f, cost: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>KDV Oranı %</Label><Input type="number" value={productForm.vatRate} onChange={e => setProductForm(f => ({ ...f, vatRate: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Kritik Miktar</Label><Input type="number" value={productForm.minLevel} onChange={e => setProductForm(f => ({ ...f, minLevel: e.target.value }))} /></div>
            </div>
            {!editingItem && (
              <div className="space-y-1.5"><Label>Başlangıç Stok</Label><Input type="number" value={productForm.currentStock} onChange={e => setProductForm(f => ({ ...f, currentStock: e.target.value }))} /></div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>İptal</Button>
              <Button type="submit" disabled={saving || !productForm.name.trim()} className="btn-primary-gradient">{saving ? "Kaydediliyor..." : editingItem ? "Güncelle" : "Oluştur"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Stock Movement Dialog ── */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Stok Hareketi Ekle</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveMovement} className="space-y-3">
            <div className="p-3 bg-muted/30 rounded-lg"><span className="text-xs text-muted-foreground">Stok: </span><span className="font-semibold text-sm">{movementItemName}</span></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>İşlem Türü</Label>
                <Select value={movementForm.type} onValueChange={v => setMovementForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Giriş</SelectItem>
                    <SelectItem value="OUT">Çıkış</SelectItem>
                    <SelectItem value="ADJUST">Sayım</SelectItem>
                    <SelectItem value="RETURN">İade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Miktar</Label><Input type="number" min="0" value={movementForm.qty} onChange={e => setMovementForm(f => ({ ...f, qty: e.target.value }))} /></div>
            </div>
            {movementForm.type === "OUT" && (
              <div className="space-y-1.5">
                <Label>Çıkış Yönü</Label>
                <Select value={movementForm.outputDirectionId || "__none__"} onValueChange={v => setMovementForm(f => ({ ...f, outputDirectionId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Belirtilmedi</SelectItem>
                    {outputDirections.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Toplam Fiyat (kuruş)</Label><Input type="number" value={movementForm.totalPrice} onChange={e => setMovementForm(f => ({ ...f, totalPrice: e.target.value }))} placeholder="Opsiyonel" /></div>
              <div className="space-y-1.5"><Label>Tarih</Label><Input type="date" value={movementForm.occurredAt} onChange={e => setMovementForm(f => ({ ...f, occurredAt: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Açıklama</Label><Input value={movementForm.notes} onChange={e => setMovementForm(f => ({ ...f, notes: e.target.value }))} placeholder="Not ekleyin..." /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMovementDialog(false)}>İptal</Button>
              <Button type="submit" disabled={saving} className="btn-primary-gradient">{saving ? "Kaydediliyor..." : "Hareketi Kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Movement History Dialog ── */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Stok Hareketleri — {historyItem?.name}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {movementsLoading ? <div className="py-8 text-center text-muted-foreground text-sm">Yükleniyor...</div> : movements.length === 0 ? <div className="py-8 text-center text-muted-foreground text-sm">Hareket bulunamadı</div> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-left text-[11px] uppercase font-medium">Tarih</th>
                    <th className="py-2 px-3 text-left text-[11px] uppercase font-medium">Tür</th>
                    <th className="py-2 px-3 text-right text-[11px] uppercase font-medium">Miktar</th>
                    <th className="py-2 px-3 text-left text-[11px] uppercase font-medium">Yön</th>
                    <th className="py-2 px-3 text-left text-[11px] uppercase font-medium">Açıklama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {movements.map(m => (
                    <tr key={m.id} className="hover:bg-muted/5">
                      <td className="py-2 px-3 text-xs text-muted-foreground">{new Date(m.occurredAt || m.createdAt).toLocaleString("tr-TR")}</td>
                      <td className="py-2 px-3"><span className={`text-xs font-semibold ${MOVEMENT_TYPE_COLORS[m.type]}`}>{MOVEMENT_TYPE_LABELS[m.type]}</span></td>
                      <td className="py-2 px-3 text-right font-semibold">{m.type === "IN" || m.type === "RETURN" ? "+" : m.type === "ADJUST" ? "=" : "−"}{Math.abs(m.qty)}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{m.outputDirection?.name || "—"}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{m.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Expiry Dialog ── */}
      <Dialog open={showExpiryDialog} onOpenChange={setShowExpiryDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Son Kullanma Tarihi — {expiryItem?.name}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            {expiryLoading ? <div className="py-6 text-center text-muted-foreground text-sm">Yükleniyor...</div> : expiryBatches.length === 0 ? <div className="py-6 text-center text-muted-foreground text-sm">SKT kaydı yok</div> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground">
                  <tr>
                    <th className="py-2 px-3 text-left text-[11px] uppercase font-medium">SKT</th>
                    <th className="py-2 px-3 text-right text-[11px] uppercase font-medium">Miktar</th>
                    <th className="py-2 px-3 text-left text-[11px] uppercase font-medium">Not</th>
                    <th className="py-2 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {expiryBatches.map(b => {
                    const expired = new Date(b.expiryDate) < new Date();
                    const soon = !expired && new Date(b.expiryDate) <= new Date(Date.now() + 30 * 86400000);
                    return (
                      <tr key={b.id} className="hover:bg-muted/5">
                        <td className={`py-2 px-3 text-xs font-semibold ${expired ? "text-red-600" : soon ? "text-orange-600" : ""}`}>{formatDate(b.expiryDate)}</td>
                        <td className="py-2 px-3 text-right text-xs">{b.quantity} {expiryItem?.unit || "adet"}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{b.notes || "—"}</td>
                        <td className="py-2 px-3"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteExpiry(b.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="border-t border-border/40 pt-3">
              <div className="text-xs font-semibold mb-2">Yeni SKT Kaydı Ekle</div>
              <div className="grid grid-cols-3 gap-2">
                <Input type="date" className="h-8 text-xs" value={newExpiry.expiryDate} onChange={e => setNewExpiry(p => ({ ...p, expiryDate: e.target.value }))} />
                <Input type="number" className="h-8 text-xs" placeholder="Miktar" value={newExpiry.quantity} onChange={e => setNewExpiry(p => ({ ...p, quantity: e.target.value }))} />
                <Button size="sm" className="h-8 text-xs btn-primary-gradient" onClick={handleAddExpiry} disabled={!newExpiry.expiryDate || saving}>Ekle</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
