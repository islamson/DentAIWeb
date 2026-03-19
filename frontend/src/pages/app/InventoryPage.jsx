"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Package,
  AlertTriangle,
  TrendingUp,
  Box,
  Plus,
  Search,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  // Dialogs
  const [selectedItem, setSelectedItem] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Master data
  const [categories, setCategories] = useState([]);
  const [outputDirections, setOutputDirections] = useState([]);

  // Create product form
  const [productForm, setProductForm] = useState({
    name: "", sku: "", description: "", unit: "adet", minLevel: 0, currentStock: 0, cost: 0, categoryId: "",
  });

  // Movement form
  const [movementForm, setMovementForm] = useState({
    inventoryItemId: "", qty: 1, type: "IN", outputDirectionId: "", notes: "",
  });

  // Stats derived from data
  const stats = {
    totalItems: pagination.total,
    lowStock: items.filter(i => i.currentStock > 0 && i.currentStock <= i.minLevel).length,
    outOfStock: items.filter(i => i.currentStock <= 0).length,
    totalValue: items.reduce((sum, i) => sum + (i.currentStock * (i.cost || 0)), 0),
  };

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: pagination.limit });
      if (searchTerm) params.set("search", searchTerm);
      const res = await fetch(`/api/inventory/items?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      console.error("Failed to fetch items:", err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, pagination.limit]);

  const fetchMovements = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory/movements?limit=5");
      const data = await res.json();
      setMovements(data.items || []);
    } catch (err) {
      console.error("Failed to fetch movements:", err);
    }
  }, []);

  const fetchMasterData = useCallback(async () => {
    try {
      const [catRes, dirRes] = await Promise.all([
        fetch("/api/inventory/categories?activeOnly=true&limit=100"),
        fetch("/api/inventory/output-directions?activeOnly=true&limit=100"),
      ]);
      const catData = await catRes.json();
      const dirData = await dirRes.json();
      setCategories(catData.items || []);
      setOutputDirections(dirData.items || []);
    } catch (err) {
      console.error("Failed to fetch master data:", err);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchMovements(); }, [fetchMovements]);
  useEffect(() => { fetchMasterData(); }, [fetchMasterData]);

  const getItemStatus = (item) => {
    if (item.currentStock <= 0) return "out";
    if (item.currentStock <= item.minLevel) return "low";
    return "normal";
  };

  // ── Create product ──
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          cost: productForm.cost ? Number(productForm.cost) : null,
          minLevel: Number(productForm.minLevel) || 0,
          currentStock: Number(productForm.currentStock) || 0,
          categoryId: productForm.categoryId || null,
        }),
      });
      if (res.ok) {
        setShowCreateDialog(false);
        setProductForm({ name: "", sku: "", description: "", unit: "adet", minLevel: 0, currentStock: 0, cost: 0, categoryId: "" });
        fetchItems(pagination.page);
      }
    } catch (err) {
      console.error("Failed to create product:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Create movement ──
  const handleCreateMovement = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...movementForm,
          qty: Number(movementForm.qty),
          outputDirectionId: movementForm.type === "OUT" ? (movementForm.outputDirectionId || null) : null,
        }),
      });
      if (res.ok) {
        setShowMovementDialog(false);
        setMovementForm({ inventoryItemId: "", qty: 1, type: "IN", outputDirectionId: "", notes: "" });
        fetchItems(pagination.page);
        fetchMovements();
      }
    } catch (err) {
      console.error("Failed to create movement:", err);
    } finally {
      setSaving(false);
    }
  };

  const openMovementDialog = (item) => {
    setMovementForm({ inventoryItemId: item.id, qty: 1, type: "OUT", outputDirectionId: "", notes: "" });
    setSelectedItem(null);
    setShowMovementDialog(true);
  };

  return (
    <div className="space-y-8 animate-in">
      {/* Hero Section */}
      <div className="glass-effect rounded-3xl p-8 border border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 right-4 w-32 h-32 bg-orange-500 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-600 rounded-3xl flex items-center justify-center shadow-2xl">
                  <Package className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
                    Stok Yönetimi
                  </h1>
                  <p className="text-lg text-muted-foreground font-medium">Malzeme ve ürün takibi</p>
                </div>
              </div>
            </div>
            <div className="hidden md:flex gap-3">
              <Button className="btn-primary-gradient" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Ürün
              </Button>
              <Button variant="outline" className="border-orange-200">
                <Download className="h-4 w-4 mr-2" />
                Rapor Al
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Toplam Ürün</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">{stats.totalItems}</div>
            </div>
            <div className="gradient-primary p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <Box className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Stokta mevcut</p>
          </CardContent>
          <div className="absolute inset-0 gradient-primary rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>

        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Düşük Stok</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">{stats.lowStock}</div>
            </div>
            <div className="gradient-warning p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Sipariş gerekli</p>
          </CardContent>
          <div className="absolute inset-0 gradient-warning rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>

        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Tükendi</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">{stats.outOfStock}</div>
            </div>
            <div className="gradient-danger p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <XCircle className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Acil sipariş</p>
          </CardContent>
          <div className="absolute inset-0 gradient-danger rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>

        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Toplam Değer</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">
                ₺{(stats.totalValue / 100).toLocaleString("tr-TR")}
              </div>
            </div>
            <div className="gradient-success p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Envanter değeri</p>
          </CardContent>
          <div className="absolute inset-0 gradient-success rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>
      </div>

      {/* Items & Movements */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Inventory Items */}
        <div className="lg:col-span-2">
          <Card className="glass-effect border-0 shadow-xl">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  Ürün Listesi
                </CardTitle>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Filtrele
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Ürün ara..."
                  className="pl-12 input-modern"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground">Yükleniyor...</div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Henüz ürün yok</p>
                  <Button className="mt-3 btn-primary-gradient" size="sm" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" /> İlk Ürünü Ekle
                  </Button>
                </div>
              ) : (
                items.map((item) => {
                  const status = getItemStatus(item);
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-card border border-border hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-card-foreground">{item.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.sku || "—"} {item.category ? `• ${item.category.name}` : ""}
                          </div>
                        </div>
                        <Badge className={
                          status === "out" ? "bg-red-100 text-red-700 border border-red-200" :
                          status === "low" ? "bg-orange-100 text-orange-700 border border-orange-200" :
                          "bg-green-100 text-green-700 border border-green-200"
                        }>
                          {status === "out" ? (<><XCircle className="h-3 w-3 mr-1 inline" />Tükendi</>) :
                           status === "low" ? (<><AlertTriangle className="h-3 w-3 mr-1 inline" />Düşük</>) :
                           (<><CheckCircle className="h-3 w-3 mr-1 inline" />Normal</>)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{item.currentStock} {item.unit || "adet"}</div>
                          <div className="text-sm text-muted-foreground">Min: {item.minLevel}</div>
                        </div>
                        {item.minLevel > 0 && (
                          <div className="w-full max-w-[200px]">
                            <div className="w-full bg-muted rounded-full h-2 mb-1">
                              <div
                                className={`h-2 rounded-full ${status === "out" ? "bg-red-500" : status === "low" ? "bg-orange-500" : "bg-green-500"}`}
                                style={{ width: `${Math.min((item.currentStock / (item.minLevel * 3)) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/40">
                  <span className="text-sm text-muted-foreground">
                    {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} / {pagination.total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchItems(pagination.page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-1">{pagination.page} / {pagination.pages}</span>
                    <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => fetchItems(pagination.page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Movements */}
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-2 rounded-xl">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              Son Hareketler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {movements.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Henüz hareket yok</div>
            ) : (
              movements.map((mov) => (
                <div
                  key={mov.id}
                  className={`p-4 rounded-xl border ${
                    mov.type === "IN" || mov.type === "RETURN"
                      ? "bg-green-500/10 dark:bg-green-500/20 border-green-500/30"
                      : "bg-red-500/10 dark:bg-red-500/20 border-red-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-card-foreground text-sm">{mov.item?.name || "—"}</div>
                    <div className={`flex items-center gap-1 font-bold ${
                      mov.type === "IN" || mov.type === "RETURN" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      {mov.type === "IN" || mov.type === "RETURN" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {Math.abs(mov.qty)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(mov.createdAt).toLocaleString("tr-TR")}
                    {mov.outputDirection ? ` • ${mov.outputDirection.name}` : ""}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Item Detail Dialog ── */}
      <Dialog open={selectedItem !== null} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl glass-effect border-0 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-xl">
                <Package className="h-7 w-7 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">{selectedItem?.name}</DialogTitle>
                <DialogDescription>{selectedItem?.sku || "SKU yok"}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="glass-effect">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">{selectedItem.currentStock}</div>
                    <div className="text-sm text-muted-foreground">Mevcut Stok</div>
                  </CardContent>
                </Card>
                <Card className="glass-effect">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                      ₺{selectedItem.cost ? (selectedItem.cost / 100).toLocaleString("tr-TR") : "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">Birim Fiyat</div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-muted rounded-xl">
                  <span className="text-muted-foreground">Kategori</span>
                  <span className="font-semibold text-card-foreground">{selectedItem.category?.name || "—"}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted rounded-xl">
                  <span className="text-muted-foreground">Birim</span>
                  <span className="font-semibold text-card-foreground">{selectedItem.unit || "adet"}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted rounded-xl">
                  <span className="text-muted-foreground">Min Stok Seviyesi</span>
                  <span className="font-semibold text-card-foreground">{selectedItem.minLevel}</span>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => openMovementDialog(selectedItem)}>
                  Stok Hareketi Ekle
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Product Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Ürün Ekle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ürün Adı *</Label>
                <Input value={productForm.name} onChange={(e) => setProductForm(f => ({ ...f, name: e.target.value }))} className="input-modern" />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={productForm.sku} onChange={(e) => setProductForm(f => ({ ...f, sku: e.target.value }))} className="input-modern" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={productForm.categoryId || "__none__"} onValueChange={(v) => setProductForm(f => ({ ...f, categoryId: v === "__none__" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seçin..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Kategori yok</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Birim</Label>
                <Input value={productForm.unit} onChange={(e) => setProductForm(f => ({ ...f, unit: e.target.value }))} className="input-modern" />
              </div>
              <div className="space-y-2">
                <Label>Min Stok</Label>
                <Input type="number" value={productForm.minLevel} onChange={(e) => setProductForm(f => ({ ...f, minLevel: e.target.value }))} className="input-modern" />
              </div>
              <div className="space-y-2">
                <Label>Mevcut Stok</Label>
                <Input type="number" value={productForm.currentStock} onChange={(e) => setProductForm(f => ({ ...f, currentStock: e.target.value }))} className="input-modern" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Birim Fiyat (kuruş)</Label>
              <Input type="number" value={productForm.cost} onChange={(e) => setProductForm(f => ({ ...f, cost: e.target.value }))} className="input-modern" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>İptal</Button>
              <Button type="submit" disabled={saving || !productForm.name.trim()} className="btn-primary-gradient">
                {saving ? "Kaydediliyor..." : "Ürün Ekle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Stock Movement Dialog ── */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stok Hareketi</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMovement} className="space-y-4">
            <div className="space-y-2">
              <Label>Hareket Tipi</Label>
              <Select value={movementForm.type} onValueChange={(v) => setMovementForm(f => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">Giriş</SelectItem>
                  <SelectItem value="OUT">Çıkış</SelectItem>
                  <SelectItem value="ADJUST">Düzeltme</SelectItem>
                  <SelectItem value="RETURN">İade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {movementForm.type === "OUT" && (
              <div className="space-y-2">
                <Label>Çıkış Yönü</Label>
                <Select value={movementForm.outputDirectionId || "__none__"} onValueChange={(v) => setMovementForm(f => ({ ...f, outputDirectionId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Çıkış yönü seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Belirtilmedi</SelectItem>
                    {outputDirections.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Miktar</Label>
              <Input type="number" min="1" value={movementForm.qty} onChange={(e) => setMovementForm(f => ({ ...f, qty: e.target.value }))} className="input-modern" />
            </div>
            <div className="space-y-2">
              <Label>Not</Label>
              <Input value={movementForm.notes} onChange={(e) => setMovementForm(f => ({ ...f, notes: e.target.value }))} className="input-modern" placeholder="Opsiyonel not..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMovementDialog(false)}>İptal</Button>
              <Button type="submit" disabled={saving} className="btn-primary-gradient">
                {saving ? "Kaydediliyor..." : "Hareketi Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
