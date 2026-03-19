"use client";

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  X,
  Eye,
  Printer,
  DollarSign,
  Receipt,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
  DialogFooter,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { formatCurrency } from "../../lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import * as XLSX from "xlsx";

const PAYMENT_METHOD_LABELS = {
  CASH: "Nakit",
  CARD: "Kredi Kartı",
  BANK_TRANSFER: "Banka Transferi",
  ONLINE: "Online",
  OTHER: "Diğer",
};

const STATUS_LABELS = {
  OPEN: "Açık",
  PARTIAL: "Kısmi",
  PAID: "Ödendi",
  VOID: "İptal",
  REFUNDED: "İade",
};

const PAGE_SIZE = 20;

export default function FinanceInvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "CASH",
    paidAt: new Date().toISOString().split("T")[0],
    reference: "",
    doctorId: "",
    vatRate: "0",
    notes: "",
  });

  const [filters, setFilters] = useState({ search: "", status: "" });
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "" });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/doctors");
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchInvoices = useCallback(
    async (page) => {
      try {
        setLoading(true);
        const f = appliedFilters;
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));
        if (f.status) params.set("status", f.status);

        const res = await fetch(`/api/billing/invoices?${params.toString()}`);
        const data = await res.json();
        let invs = data.invoices || [];
        if (f.search) {
          const q = f.search.toLowerCase();
          invs = invs.filter(
            (i) =>
              (i.number && i.number.toLowerCase().includes(q)) ||
              (i.patient?.firstName && i.patient.firstName.toLowerCase().includes(q)) ||
              (i.patient?.lastName && i.patient.lastName.toLowerCase().includes(q))
          );
        }
        setInvoices(invs);
        setPagination(data.pagination || { page: 1, limit: 20, total: data.invoices?.length || 0 });
      } catch (err) {
        console.error(err);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters]
  );

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    fetchInvoices(currentPage);
  }, [currentPage, fetchInvoices]);

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: "", status: "" });
    setAppliedFilters({ search: "", status: "" });
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await fetch(`/api/billing/invoices?page=1&limit=9999` + (appliedFilters.status ? `&status=${appliedFilters.status}` : ""));
      const data = await res.json();
      const rows = (data.invoices || []).map((inv) => {
        const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
        const remaining = Math.max(0, (inv.netTotal || 0) - paid);
        return {
          "Fatura No": inv.number,
          Hasta: inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}` : "-",
          Tarih: inv.createdAt ? format(new Date(inv.createdAt), "dd.MM.yyyy", { locale: tr }) : "-",
          "Toplam (TL)": inv.netTotal ? (inv.netTotal / 100).toFixed(2) : "0",
          "Ödenen (TL)": (paid / 100).toFixed(2),
          "Kalan (TL)": (remaining / 100).toFixed(2),
          Durum: STATUS_LABELS[inv.status] || inv.status,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Faturalar");
      XLSX.writeFile(wb, `faturalar_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Dışa aktarma sırasında hata oluştu.");
    } finally {
      setExporting(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice?.patientId) return;
    const amount = Math.round(parseFloat(paymentForm.amount) * 100);
    if (!amount || amount < 1) {
      alert("Geçerli bir tutar girin.");
      return;
    }
    try {
      const res = await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedInvoice.patientId,
          invoiceId: selectedInvoice.id,
          amount,
          method: paymentForm.method,
          doctorId: paymentForm.doctorId || undefined,
          vatRate: parseInt(paymentForm.vatRate, 10) || 0,
          reference: paymentForm.reference || undefined,
          notes: paymentForm.notes || undefined,
          paidAt: paymentForm.paidAt || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Ödeme kaydedilemedi.");
        return;
      }
      setShowPaymentDialog(false);
      setPaymentForm({
        amount: "",
        method: "CASH",
        paidAt: new Date().toISOString().split("T")[0],
        reference: "",
        doctorId: "",
        vatRate: "0",
        notes: "",
      });
      setSelectedInvoice(null);
      fetchInvoices(currentPage);
    } catch (err) {
      console.error(err);
      alert("Ödeme kaydedilirken hata oluştu.");
    }
  };

  const printInvoice = (inv) => {
    const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
    const remaining = Math.max(0, (inv.netTotal || 0) - paid);
    const content = `
      <div style="font-family: sans-serif; padding: 24px; max-width: 600px;">
        <h2>Fatura: ${inv.number}</h2>
        <p><strong>Hasta:</strong> ${inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}` : "-"}</p>
        <p><strong>Tarih:</strong> ${inv.createdAt ? format(new Date(inv.createdAt), "dd.MM.yyyy", { locale: tr }) : "-"}</p>
        <p><strong>Toplam:</strong> ${formatCurrency(inv.netTotal)}</p>
        <p><strong>Ödenen:</strong> ${formatCurrency(paid)}</p>
        <p><strong>Kalan:</strong> ${formatCurrency(remaining)}</p>
        <p><strong>Durum:</strong> ${STATUS_LABELS[inv.status] || inv.status}</p>
      </div>
    `;
    const w = window.open("", "_blank");
    w.document.write(content);
    w.document.close();
    w.print();
    w.close();
  };

  const hasActiveFilters = appliedFilters.search || appliedFilters.status;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Faturalar</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fatura listesi ve tahsilat takibi
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport} disabled={exporting}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          {exporting ? "Hazırlanıyor..." : "Dışa Aktar"}
        </Button>
      </div>

      <div className="glass-effect rounded-xl border border-border/50 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Fatura no veya hasta ara..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <Select value={filters.status || "__all__"} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "__all__" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs w-[150px]">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Durumlar</SelectItem>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Yükleniyor...
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Receipt className="h-8 w-8 opacity-30" />
            <p className="text-sm">Fatura bulunamadı</p>
            {hasActiveFilters && <p className="text-xs">Filtreleri değiştirmeyi deneyin</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Fatura No</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hasta</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tarih</th>
                    <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Toplam</th>
                    <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Ödenen</th>
                    <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Kalan</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Durum</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {invoices.map((inv) => {
                    const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
                    const remaining = Math.max(0, (inv.netTotal || 0) - paid);
                    const statusStyle =
                      inv.status === "PAID"
                        ? "bg-green-500/10 text-green-700"
                        : inv.status === "PARTIAL"
                        ? "bg-orange-500/10 text-orange-700"
                        : "bg-red-500/10 text-red-700";
                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-muted/5 transition-colors cursor-pointer"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <td className="py-2.5 px-4 font-medium">{inv.number}</td>
                        <td className="py-2.5 px-4">
                          {inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}` : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {inv.createdAt ? format(new Date(inv.createdAt), "dd MMM yyyy", { locale: tr }) : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(inv.netTotal)}</td>
                        <td className="py-2.5 px-4 text-right text-emerald-600">{formatCurrency(paid)}</td>
                        <td className="py-2.5 px-4 text-right">{formatCurrency(remaining)}</td>
                        <td className="py-2.5 px-4">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle}`}>
                            {STATUS_LABELS[inv.status] || inv.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setSelectedInvoice(inv);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Görüntüle
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => printInvoice(inv)}
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" /> Yazdır
                            </Button>
                            {inv.status !== "PAID" && remaining > 0 && (
                              <Button
                                size="sm"
                                className="h-7 text-xs btn-primary-gradient"
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setPaymentForm((f) => ({ ...f, amount: String((remaining / 100).toFixed(2)) }));
                                  setShowPaymentDialog(true);
                                }}
                              >
                                <DollarSign className="h-3.5 w-3.5 mr-1" /> Ödeme Al
                              </Button>
                            )}
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
                Toplam <span className="font-semibold text-foreground">{pagination.total}</span> fatura
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
                  Sayfa {pagination.page} / {Math.ceil(pagination.total / pagination.limit) || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={currentPage >= Math.ceil(pagination.total / pagination.limit)}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Sonraki <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice && !showPaymentDialog} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Fatura Detayı
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Fatura No</div>
                  <div className="font-semibold">{selectedInvoice.number}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Hasta</div>
                  <div className="font-semibold">
                    {selectedInvoice.patient ? `${selectedInvoice.patient.firstName} ${selectedInvoice.patient.lastName}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Tarih</div>
                  <div className="font-semibold">
                    {selectedInvoice.createdAt ? format(new Date(selectedInvoice.createdAt), "dd.MM.yyyy", { locale: tr }) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Durum</div>
                  <div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      selectedInvoice.status === "PAID" ? "bg-green-500/10 text-green-700" :
                      selectedInvoice.status === "PARTIAL" ? "bg-orange-500/10 text-orange-700" : "bg-red-500/10 text-red-700"
                    }`}>
                      {STATUS_LABELS[selectedInvoice.status] || selectedInvoice.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg mt-2">
                  <span>Toplam</span>
                  <span className="font-bold">{formatCurrency(selectedInvoice.netTotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground mt-1">
                  <span>Ödenen</span>
                  <span>{formatCurrency(selectedInvoice.payments?.reduce((s, p) => s + p.amount, 0) || 0)}</span>
                </div>
                <div className="flex justify-between font-semibold mt-2">
                  <span>Kalan</span>
                  <span className="text-orange-600">
                    {formatCurrency(Math.max(0, (selectedInvoice.netTotal || 0) - (selectedInvoice.payments?.reduce((s, p) => s + p.amount, 0) || 0)))}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => printInvoice(selectedInvoice)}>
                  <Printer className="h-4 w-4 mr-2" /> Yazdır
                </Button>
                {selectedInvoice.status !== "PAID" && (
                  <Button
                    className="btn-primary-gradient"
                    onClick={() => {
                      const paid = selectedInvoice.payments?.reduce((s, p) => s + p.amount, 0) || 0;
                      const remaining = Math.max(0, (selectedInvoice.netTotal || 0) - paid);
                      setPaymentForm((f) => ({ ...f, amount: String((remaining / 100).toFixed(2)) }));
                      setShowPaymentDialog(true);
                    }}
                  >
                    <DollarSign className="h-4 w-4 mr-2" /> Ödeme Al
                  </Button>
                )}
                {selectedInvoice.patientId && (
                  <Button variant="outline" onClick={() => navigate(`/patients/${selectedInvoice.patientId}?tab=payments`)}>
                    Hasta Ödemeleri
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => !open && setShowPaymentDialog(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ödeme Al</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tutar (TL) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ödeme Yöntemi</Label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Nakit</SelectItem>
                    <SelectItem value="CARD">Kredi Kartı</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Banka Transferi</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                    <SelectItem value="OTHER">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ödeme Tarihi</Label>
                <Input
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Referans / Makbuz No</Label>
                <Input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hekim</Label>
                <Select
                  value={paymentForm.doctorId || "__none__"}
                  onValueChange={(v) => setPaymentForm((f) => ({ ...f, doctorId: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Seçilmedi —</SelectItem>
                    {doctors.map((d) => (
                      <SelectItem key={d.user?.id} value={d.user?.id}>{d.user?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>KDV Oranı (%)</Label>
                <Select value={paymentForm.vatRate} onValueChange={(v) => setPaymentForm((f) => ({ ...f, vatRate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">KDV Yok</SelectItem>
                    <SelectItem value="1">%1</SelectItem>
                    <SelectItem value="10">%10</SelectItem>
                    <SelectItem value="20">%20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <Textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">Kaydet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
