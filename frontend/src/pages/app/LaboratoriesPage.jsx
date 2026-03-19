"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

function formatCurrency(kurus) {
  if (!kurus && kurus !== 0) return "₺0";
  return "₺" + (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const EMPTY_MATERIAL = { labSupplierId: "", name: "", unitPrice: "", vatRate: "0", currency: "TRY" };

export default function LaboratoriesPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [materialForm, setMaterialForm] = useState(EMPTY_MATERIAL);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, matRes] = await Promise.all([
        fetch("/api/laboratory/suppliers").then(r => r.json()),
        fetch("/api/laboratory/materials").then(r => r.json()),
      ]);
      setSuppliers(supRes.items || []);
      setMaterials(matRes.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateMaterial = () => {
    setEditingMaterial(null);
    setMaterialForm(EMPTY_MATERIAL);
    setShowMaterialDialog(true);
  };

  const openEditMaterial = (m) => {
    setEditingMaterial(m);
    setMaterialForm({
      labSupplierId: m.labSupplierId,
      name: m.name,
      unitPrice: String(m.unitPrice / 100),
      vatRate: String(m.vatRate),
      currency: m.currency || "TRY",
    });
    setShowMaterialDialog(true);
  };

  const saveMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.labSupplierId) return;
    const method = editingMaterial ? "PUT" : "POST";
    const url = editingMaterial ? `/api/laboratory/materials/${editingMaterial.id}` : "/api/laboratory/materials";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...materialForm,
        unitPrice: Math.round(parseFloat(materialForm.unitPrice || "0") * 100),
        vatRate: parseInt(materialForm.vatRate) || 0,
      }),
    });
    setShowMaterialDialog(false);
    fetchData();
  };

  const deleteMaterial = async (id) => {
    if (!confirm("Bu laboratuvar malzemesi silinsin mi?")) return;
    await fetch(`/api/laboratory/materials/${id}`, { method: "DELETE" });
    fetchData();
  };

  const filteredMaterials = materials.filter(m => {
    if (searchTerm && !m.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(m.supplier?.name || "").toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (supplierFilter && m.labSupplierId !== supplierFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Laboratuvarlar</h2>
          <p className="text-muted-foreground text-sm">Laboratuvar malzeme kataloğu — tedarikçiler Finans &gt; Cari Takibi'nden yönetilir</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Malzeme veya tedarikçi ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={supplierFilter || "__all__"} onValueChange={(v) => setSupplierFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tedarikçi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tüm Tedarikçiler</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openCreateMaterial} className="btn-primary-gradient">
          <Plus className="h-4 w-4 mr-1" />Malzeme Ekle
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium">Malzeme Adı</th>
                  <th className="text-left p-3 font-medium">Tedarikçi</th>
                  <th className="text-right p-3 font-medium">Birim Fiyat</th>
                  <th className="text-right p-3 font-medium">KDV %</th>
                  <th className="text-left p-3 font-medium">Para Birimi</th>
                  <th className="text-left p-3 font-medium">Oluşturulma</th>
                  <th className="text-center p-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Yükleniyor...</td></tr>
                ) : filteredMaterials.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {materials.length === 0 ? "Henüz malzeme eklenmemiş. Yukarıdaki butona tıklayarak ekleyin." : "Aramayla eşleşen malzeme bulunamadı."}
                  </td></tr>
                ) : filteredMaterials.map(m => (
                  <tr key={m.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">{m.name}</td>
                    <td className="p-3">{m.supplier?.name || "—"}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(m.unitPrice)}</td>
                    <td className="p-3 text-right">%{m.vatRate}</td>
                    <td className="p-3"><Badge variant="outline">{m.currency}</Badge></td>
                    <td className="p-3 text-muted-foreground">{formatDate(m.createdAt)}</td>
                    <td className="p-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditMaterial(m)}><Pencil className="h-3.5 w-3.5 mr-2" />Düzenle</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteMaterial(m.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" />Sil</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Material Dialog */}
      <Dialog open={showMaterialDialog} onOpenChange={setShowMaterialDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingMaterial ? "Malzeme Düzenle" : "Yeni Malzeme"}</DialogTitle></DialogHeader>
          <form onSubmit={saveMaterial} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tedarikçi (Cari Hesap) *</Label>
              <Select value={materialForm.labSupplierId || "__none__"} onValueChange={(v) => setMaterialForm(f => ({ ...f, labSupplierId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Tedarikçi seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Seçin...</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.type ? ` (${s.type === "LAB" ? "Laboratuvar" : s.type === "SUPPLIER" ? "Tedarikçi" : s.type === "MEDICAL" ? "Medikal" : s.type})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suppliers.length === 0 && (
                <p className="text-xs text-amber-600">Tedarikçi bulunamadı. Finans &gt; Cari Takibi bölümünden Tedarikçi, Laboratuvar veya Medikal tipinde bir cari hesap oluşturun.</p>
              )}
            </div>
            <div className="space-y-1.5"><Label>Malzeme Adı *</Label>
              <Input value={materialForm.name} onChange={(e) => setMaterialForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Birim Fiyat *</Label>
                <Input type="number" step="0.01" value={materialForm.unitPrice} onChange={(e) => setMaterialForm(f => ({ ...f, unitPrice: e.target.value }))} required />
              </div>
              <div className="space-y-1.5"><Label>KDV %</Label>
                <Input type="number" value={materialForm.vatRate} onChange={(e) => setMaterialForm(f => ({ ...f, vatRate: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label>Para Birimi</Label>
                <Select value={materialForm.currency} onValueChange={(v) => setMaterialForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRY">TRY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMaterialDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient" disabled={!materialForm.labSupplierId || !materialForm.name}>
                {editingMaterial ? "Güncelle" : "Oluştur"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
