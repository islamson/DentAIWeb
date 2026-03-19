"use client";

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Settings,
  Package,
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  FolderTree,
} from "lucide-react";

// ─────────────────────────────────────────────
// Generic settings table used by both tabs
// ─────────────────────────────────────────────
function SettingsTable({
  title,
  addLabel,
  nameHeader,
  items,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  onCreate,
  onToggle,
  onDelete,
  showToggle = false,
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreate(newName.trim());
      setNewName("");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") { setAdding(false); setNewName(""); }
  };

  return (
    <Card className="glass-effect border-0 shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">{title}</CardTitle>
          <Button
            size="sm"
            className="btn-primary-gradient"
            onClick={() => { setAdding(true); setNewName(""); }}
            disabled={adding}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {addLabel}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-hidden rounded-b-xl">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-muted-foreground">
              <tr>
                <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">{nameHeader}</th>
                <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Oluşturulma Tarihi</th>
                {showToggle && (
                  <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Durum</th>
                )}
                <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {adding && (
                <tr className="bg-blue-50/50 dark:bg-blue-950/20">
                  <td className="py-2.5 px-4" colSpan={showToggle ? 3 : 2}>
                    <Input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="İsim girin..."
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={handleCreate} disabled={saving || !newName.trim()}>
                        <Check className="h-4 w-4 mr-1" />
                        Oluştur
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => { setAdding(false); setNewName(""); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {loading ? (
                <tr>
                  <td colSpan={showToggle ? 4 : 3} className="py-12 text-center text-muted-foreground">
                    Yükleniyor...
                  </td>
                </tr>
              ) : items.length === 0 && !adding ? (
                <tr>
                  <td colSpan={showToggle ? 4 : 3} className="py-12 text-center text-muted-foreground">
                    Henüz kayıt yok
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/5 transition-colors">
                    <td className="py-2.5 px-4 font-medium">{item.name}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    {showToggle && (
                      <td className="py-2.5 px-4">
                        <button
                          onClick={() => onToggle(item.id, !item.isActive)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${item.isActive ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${item.isActive ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                        </button>
                      </td>
                    )}
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm("Bu kaydı silmek istediğinize emin misiniz?")) {
                            onDelete(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sayfa başı:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="text-xs border rounded-md px-2 py-1 bg-background"
                >
                  {[10, 20, 50].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground ml-2">
                  {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} / {pagination.total}
                </span>
              </div>
              {pagination.pages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-medium px-1">{pagination.page} / {pagination.pages}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={pagination.page >= pagination.pages} onClick={() => onPageChange(pagination.page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function StockSettingsPage() {
  const [activeTab, setActiveTab] = useState("output-directions");

  // Output directions state
  const [directions, setDirections] = useState([]);
  const [dirLoading, setDirLoading] = useState(true);
  const [dirPagination, setDirPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  // Categories state
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catPagination, setCatPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  // ── Fetch output directions ──
  const fetchDirections = useCallback(async (page = 1, limit = dirPagination.limit) => {
    setDirLoading(true);
    try {
      const res = await fetch(`/api/inventory/output-directions?page=${page}&limit=${limit}`);
      const data = await res.json();
      setDirections(data.items || []);
      setDirPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      console.error("Failed to fetch output directions:", err);
    } finally {
      setDirLoading(false);
    }
  }, [dirPagination.limit]);

  // ── Fetch categories ──
  const fetchCategories = useCallback(async (page = 1, limit = catPagination.limit) => {
    setCatLoading(true);
    try {
      const res = await fetch(`/api/inventory/categories?page=${page}&limit=${limit}`);
      const data = await res.json();
      setCategories(data.items || []);
      setCatPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setCatLoading(false);
    }
  }, [catPagination.limit]);

  useEffect(() => { fetchDirections(); }, [fetchDirections]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // ── Direction CRUD ──
  const createDirection = async (name) => {
    const res = await fetch("/api/inventory/output-directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) fetchDirections(dirPagination.page, dirPagination.limit);
  };

  const toggleDirection = async (id, isActive) => {
    const res = await fetch(`/api/inventory/output-directions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) fetchDirections(dirPagination.page, dirPagination.limit);
  };

  const deleteDirection = async (id) => {
    const res = await fetch(`/api/inventory/output-directions/${id}`, { method: "DELETE" });
    if (res.ok) fetchDirections(dirPagination.page, dirPagination.limit);
  };

  // ── Category CRUD ──
  const createCategory = async (name) => {
    const res = await fetch("/api/inventory/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) fetchCategories(catPagination.page, catPagination.limit);
  };

  const toggleCategory = async (id, isActive) => {
    const res = await fetch(`/api/inventory/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) fetchCategories(catPagination.page, catPagination.limit);
  };

  const deleteCategory = async (id) => {
    const res = await fetch(`/api/inventory/categories/${id}`, { method: "DELETE" });
    if (res.ok) fetchCategories(catPagination.page, catPagination.limit);
  };

  return (
    <div className="space-y-8 animate-in">
      {/* Hero */}
      <div className="glass-effect rounded-3xl p-8 border border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 right-4 w-32 h-32 bg-orange-500 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-600 rounded-3xl flex items-center justify-center shadow-2xl">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Ayarlar
                  </Link>
                  <span className="text-sm text-muted-foreground">/</span>
                  <span className="text-sm text-muted-foreground">Kurum Ayarları</span>
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
                  Stok Ayarları
                </h1>
                <p className="text-lg text-muted-foreground font-medium">
                  Stok çıkış yönlerini ve kategorileri yönetin
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto p-1">
          <TabsTrigger value="output-directions" className="text-sm flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Stok Çıkış Yönü
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-sm flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Stok Kategori
          </TabsTrigger>
        </TabsList>

        <TabsContent value="output-directions" className="mt-6">
          <SettingsTable
            title="Stok Çıkış Yönleri"
            addLabel="Çıkış Yönü Ekle"
            nameHeader="Çıkış Yönü"
            items={directions}
            loading={dirLoading}
            pagination={dirPagination}
            onPageChange={(p) => fetchDirections(p, dirPagination.limit)}
            onPageSizeChange={(s) => fetchDirections(1, s)}
            onCreate={createDirection}
            onToggle={toggleDirection}
            onDelete={deleteDirection}
            showToggle={true}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <SettingsTable
            title="Stok Kategorileri"
            addLabel="Kategori Ekle"
            nameHeader="Kategori"
            items={categories}
            loading={catLoading}
            pagination={catPagination}
            onPageChange={(p) => fetchCategories(p, catPagination.limit)}
            onPageSizeChange={(s) => fetchCategories(1, s)}
            onCreate={createCategory}
            onToggle={toggleCategory}
            onDelete={deleteCategory}
            showToggle={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
