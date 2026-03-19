"use client";

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  User,
  Receipt,
  CalendarClock,
  AlertCircle,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
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
import { formatCurrency } from "../../lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const PAYMENT_METHOD_LABELS = {
  CASH: "Nakit",
  CARD: "Kredi Kartı",
  BANK_TRANSFER: "Banka Transferi",
  ONLINE: "Online",
  OTHER: "Diğer",
};

export default function FinancePendingCollectionsPage() {
  const navigate = useNavigate();
  const [patientsWithBalance, setPatientsWithBalance] = useState([]);
  const [overdueInstallments, setOverdueInstallments] = useState([]);
  const [nearDueInstallments, setNearDueInstallments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentContext, setPaymentContext] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "CASH",
    paidAt: new Date().toISOString().split("T")[0],
    reference: "",
    doctorId: "",
    vatRate: "0",
    notes: "",
  });

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/doctors");
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/billing/pending-collections");
      const data = await res.json();
      setPatientsWithBalance(data.patientsWithBalance || []);
      setOverdueInstallments(data.overdueInstallments || []);
      setNearDueInstallments(data.nearDueInstallments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const openPaymentDialog = (context) => {
    setPaymentContext(context);
    setPaymentForm({
      amount: String((context.amount || context.amountDue || 0) / 100),
      method: "CASH",
      paidAt: new Date().toISOString().split("T")[0],
      reference: "",
      doctorId: "",
      vatRate: "0",
      notes: "",
    });
    setShowPaymentDialog(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentContext?.patientId) return;
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
          patientId: paymentContext.patientId,
          invoiceId: paymentContext.invoiceId || undefined,
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
      setPaymentContext(null);
      fetchPending();
    } catch (err) {
      console.error(err);
      alert("Ödeme kaydedilirken hata oluştu.");
    }
  };

  const allItems = [
    ...overdueInstallments.map((i) => ({
      ...i,
      type: "overdue",
      typeLabel: "Gecikmiş Taksit",
      amountDue: i.amount,
    })),
    ...nearDueInstallments.map((i) => ({
      ...i,
      type: "nearDue",
      typeLabel: "Yaklaşan Taksit",
      amountDue: i.amount,
    })),
    ...patientsWithBalance.map((i) => ({
      ...i,
      type: "invoice",
      typeLabel: "Açık Fatura",
    })),
  ].sort((a, b) => {
    const dateA = a.dueDate ? new Date(a.dueDate) : new Date(0);
    const dateB = b.dueDate ? new Date(b.dueDate) : new Date(0);
    return dateA - dateB;
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bekleyen Tahsilat</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tahsilat takip görünümü — gecikmiş ve yaklaşan ödemeler
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-effect rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Gecikmiş Taksit</span>
          </div>
          <div className="text-2xl font-bold">{overdueInstallments.length}</div>
        </div>
        <div className="glass-effect rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CalendarClock className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Yaklaşan Taksit</span>
          </div>
          <div className="text-2xl font-bold">{nearDueInstallments.length}</div>
        </div>
        <div className="glass-effect rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Receipt className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Açık Fatura Bakiyesi</span>
          </div>
          <div className="text-2xl font-bold">{patientsWithBalance.length}</div>
        </div>
      </div>

      <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Yükleniyor...
          </div>
        ) : allItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <AlertCircle className="h-8 w-8 opacity-30" />
            <p className="text-sm">Bekleyen tahsilat bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hasta</th>
                  <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Kaynak</th>
                  <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Tutar</th>
                  <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Vade</th>
                  <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Durum</th>
                  <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {allItems.map((item) => (
                  <tr key={`${item.type}-${item.id || item.patientId}-${item.source || ""}`} className="hover:bg-muted/5">
                    <td className="py-2.5 px-4 font-medium">{item.patientName || "—"}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.type === "overdue"
                            ? "bg-red-500/10 text-red-700"
                            : item.type === "nearDue"
                            ? "bg-amber-500/10 text-amber-700"
                            : "bg-blue-500/10 text-blue-700"
                        }`}
                      >
                        {item.typeLabel}
                      </span>
                      {item.source && <span className="ml-2 text-xs">{item.source}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-orange-600">
                      {formatCurrency(item.amountDue || item.remaining)}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {item.dueDate ? format(new Date(item.dueDate), "dd MMM yyyy", { locale: tr }) : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.type === "overdue" ? "bg-red-500/10 text-red-700" : "bg-amber-500/10 text-amber-700"
                        }`}
                      >
                        {item.type === "overdue" ? "Gecikmiş" : "Bekliyor"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex gap-2">
                        {item.patientId && (
                          <Button
                            size="sm"
                            className="h-7 text-xs btn-primary-gradient"
                            onClick={() =>
                              openPaymentDialog({
                                patientId: item.patientId,
                                invoiceId: item.invoiceId,
                                amount: item.amountDue || item.remaining,
                              })
                            }
                          >
                            <DollarSign className="h-3.5 w-3.5 mr-1" /> Ödeme Al
                          </Button>
                        )}
                        {item.patientId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => navigate(`/patients/${item.patientId}?tab=payments`)}
                          >
                            <User className="h-3.5 w-3.5 mr-1" /> Hasta
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
