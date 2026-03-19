"use client";

import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Search, MoreHorizontal, Eye, Edit, Trash, Users, Phone, Mail,
  User, Calendar, CreditCard, Filter, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { formatDate, formatCurrency } from "../../lib/utils";

const genderColors = { Erkek: "default", Kadın: "secondary" };

const EMPTY_FORM = {
  firstName: "", lastName: "", phone: "", email: "",
  nationalId: "", birthDate: "", gender: "", address: "", notes: "",
  primaryDoctorId: "",
};

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [showDialog, setShowDialog] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState([]);

  const fetchPatients = useCallback(async (page = 1, searchVal = search) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 20 });
      if (searchVal) params.set("search", searchVal);
      const res = await fetch(`/api/patients?${params}`);
      const data = await res.json();
      setPatients(data.patients || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      console.error("Error fetching patients:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/doctors");
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (err) {
      console.error("Error fetching doctors:", err);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchPatients(1, search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchPatients(pagination.page);
  }, [pagination.page]);

  const openCreate = () => {
    setEditingPatient(null);
    setFormData(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (patient) => {
    setEditingPatient(patient);
    setFormData({
      firstName: patient.firstName || "",
      lastName: patient.lastName || "",
      phone: patient.phone || "",
      email: patient.email || "",
      nationalId: patient.nationalId || "",
      birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : "",
      gender: patient.gender || "",
      address: patient.address || "",
      notes: patient.notes || "",
      primaryDoctorId: patient.primaryDoctorId || "",
    });
    setShowDialog(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingPatient ? `/api/patients/${editingPatient.id}` : "/api/patients";
      const method = editingPatient ? "PUT" : "POST";
      const payload = { ...formData };
      if (!payload.primaryDoctorId) delete payload.primaryDoctorId;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowDialog(false);
        fetchPatients(pagination.page);
      }
    } catch (err) {
      console.error("Error saving patient:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Bu hastayı silmek istediğinize emin misiniz?")) return;
    try {
      await fetch(`/api/patients/${id}`, { method: "DELETE" });
      fetchPatients(pagination.page);
    } catch (err) {
      console.error("Error deleting patient:", err);
    }
  };

  const getInitials = (p) =>
    `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase();

  const formatFinanceSummary = (fs) => {
    if (!fs || (!fs.totalPaid && !fs.remaining)) return null;
    return { paid: fs.totalPaid, remaining: fs.remaining };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hastalar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {pagination.total > 0 ? `${pagination.total} hasta kayıtlı` : "Hasta yönetimi"}
          </p>
        </div>
        <Button onClick={openCreate} className="btn-primary-gradient">
          <Plus className="h-4 w-4 mr-2" />
          Yeni Hasta
        </Button>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ad, telefon, TC kimlik veya e-posta ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => fetchPatients(pagination.page)} title="Yenile">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Toplam Hasta", value: pagination.total, icon: Users, color: "text-blue-500" },
          { label: "Bu Sayfada", value: patients.length, icon: Filter, color: "text-purple-500" },
        ].map((stat) => (
          <div key={stat.label} className="glass-effect rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Patients Table */}
      <div className="glass-effect rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1.5fr_auto] gap-4 px-5 py-3 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div>Hasta</div>
          <div>İletişim</div>
          <div>Birincil Hekim</div>
          <div>Kayıt</div>
          <div>Finansal Özet</div>
          <div></div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1.5fr_auto] gap-4 px-5 py-4 items-center">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">
              {search ? "Arama sonucu bulunamadı" : "Henüz hasta kaydı yok"}
            </p>
            {!search && (
              <Button onClick={openCreate} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                İlk hastayı ekle
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {patients.map((patient) => {
              const fs = formatFinanceSummary(patient.financeSummary);
              return (
                <div
                  key={patient.id}
                  onClick={() => navigate(`/patients/${patient.id}`)}
                  className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1.5fr_auto] gap-4 px-5 py-4 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  {/* Patient Name + Avatar */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {getInitials(patient)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-sm hover:text-primary transition-colors truncate block">
                        {patient.firstName} {patient.lastName}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {patient.gender && (
                          <Badge variant={genderColors[patient.gender] || "outline"} className="text-xs py-0 h-4">
                            {patient.gender}
                          </Badge>
                        )}
                        {patient.nationalId && (
                          <span className="text-xs text-muted-foreground font-mono">{patient.nationalId}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-1 text-sm min-w-0">
                    {patient.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{patient.phone}</span>
                      </div>
                    )}
                    {patient.email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate text-xs">{patient.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Primary Doctor */}
                  <div className="text-sm min-w-0">
                    {patient.primaryDoctor?.user?.name ? (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate text-sm">{patient.primaryDoctor.user.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>

                  {/* Registration Date */}
                  <div className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(patient.createdAt)}
                    </div>
                    {patient.lastAppointment && (
                      <div className="mt-1 text-xs opacity-70">
                        Son: {formatDate(patient.lastAppointment.startAt)}
                      </div>
                    )}
                  </div>

                  {/* Finance Summary */}
                  <div className="text-xs min-w-0">
                    {fs ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CreditCard className="h-3 w-3 flex-shrink-0" />
                          <span>Ödenen: {formatCurrency(fs.paid)}</span>
                        </div>
                        {fs.remaining > 0 && (
                          <div className="text-orange-500 dark:text-orange-400">
                            Kalan: {formatCurrency(fs.remaining)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/patients/${patient.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            Profili Görüntüle
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(patient)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(patient.id)}
                          className="text-destructive"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/50">
            <span className="text-sm text-muted-foreground">
              {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} / {pagination.total} hasta
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-1">{pagination.page} / {pagination.pages}</span>
              <Button
                variant="outline" size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPatient ? "Hasta Düzenle" : "Yeni Hasta Ekle"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Ad *</Label>
                <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData((f) => ({ ...f, firstName: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Soyad *</Label>
                <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData((f) => ({ ...f, lastName: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))} placeholder="05xx xxx xx xx" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-posta</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nationalId">TC Kimlik No</Label>
                <Input id="nationalId" value={formData.nationalId} onChange={(e) => setFormData((f) => ({ ...f, nationalId: e.target.value }))} maxLength={11} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birthDate">Doğum Tarihi</Label>
                <Input id="birthDate" type="date" value={formData.birthDate} onChange={(e) => setFormData((f) => ({ ...f, birthDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cinsiyet</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData((f) => ({ ...f, gender: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Erkek">Erkek</SelectItem>
                    <SelectItem value="Kadın">Kadın</SelectItem>
                    <SelectItem value="Diğer">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Birincil Hekim</Label>
                <Select
                  value={formData.primaryDoctorId || "__none__"}
                  onValueChange={(v) => setFormData((f) => ({ ...f, primaryDoctorId: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Hekim seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Seçilmedi</SelectItem>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.user?.name || d.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Adres</Label>
              <Input id="address" value={formData.address} onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notlar</Label>
              <Input id="notes" value={formData.notes} onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))} placeholder="Opsiyonel notlar..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
              <Button type="submit" disabled={saving} className="btn-primary-gradient">
                {saving ? "Kaydediliyor..." : editingPatient ? "Güncelle" : "Hasta Ekle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
