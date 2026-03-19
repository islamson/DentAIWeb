"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit2,
  Save,
  Plus,
  Trash2,
  User,
  CalendarClock,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatCurrency } from "../../lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const PAGE_SIZE = 20;

export default function FinancePaymentPlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editPlanData, setEditPlanData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchPlans = useCallback(async (page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/billing/payment-plans?${params.toString()}`);
      const data = await res.json();
      setPlans(data.paymentPlans || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error(err);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans(currentPage);
  }, [currentPage, fetchPlans]);

  const toggleExpand = (planId) => {
    setExpandedPlanId((prev) => (prev === planId ? null : planId));
    if (editingPlanId === planId) {
      setEditingPlanId(null);
      setEditPlanData([]);
    }
  };

  const startEditingPlan = (plan) => {
    setEditingPlanId(plan.id);
    setEditPlanData(
      (plan.installments || []).map((inst) => ({
        ...inst,
        amount: inst.amount / 100,
      }))
    );
  };

  const cancelEditingPlan = () => {
    setEditingPlanId(null);
    setEditPlanData([]);
  };

  const handleEditInstallmentChange = (instId, field, value) => {
    setEditPlanData((prev) =>
      prev.map((inst) => (inst.id === instId ? { ...inst, [field]: value } : inst))
    );
  };

  const removeEditInstallment = (instId) => {
    setEditPlanData((prev) => prev.filter((inst) => inst.id !== instId));
  };

  const addEditInstallment = () => {
    setEditPlanData((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, amount: 0, dueDate: null, status: "PENDING" },
    ]);
  };

  const saveEditedPlan = async () => {
    if (!editingPlanId) return;
    try {
      const res = await fetch(`/api/billing/payment-plans/${editingPlanId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installments: editPlanData.map((inst) => ({
            id: String(inst.id).startsWith("temp-") ? undefined : inst.id,
            amount: Math.round(parseFloat(inst.amount || 0) * 100),
            dueDate: inst.dueDate ? new Date(inst.dueDate).toISOString() : null,
            status: inst.status,
          })),
        }),
      });
      if (!res.ok) throw new Error("Plan güncellenemedi");
      setEditingPlanId(null);
      setEditPlanData([]);
      fetchPlans(currentPage);
    } catch (err) {
      console.error(err);
      alert("Plan güncellenirken hata oluştu.");
    }
  };

  const getPlanStats = (plan) => {
    const installments = plan.installments || [];
    const pending = installments.filter((i) => i.status === "PENDING");
    const remaining = pending.reduce((s, i) => s + i.amount, 0);
    const nextDue = pending.find((i) => i.dueDate);

    return {
      remaining,
      nextDueDate: nextDue?.dueDate,
      installmentCount: installments.length,
      pendingCount: pending.length,
    };
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ödeme Planları</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Taksit planları ve ödeme takibi
        </p>
      </div>

      <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Yükleniyor...
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <CalendarClock className="h-8 w-8 opacity-30" />
            <p className="text-sm">Ödeme planı bulunamadı</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium w-8"></th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hasta</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Plan</th>
                    <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Toplam</th>
                    <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Kalan</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Sonraki Vade</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Durum</th>
                    <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {plans.map((plan) => {
                    const stats = getPlanStats(plan);
                    const isExpanded = expandedPlanId === plan.id;
                    const isEditing = editingPlanId === plan.id;
                    const displayInstallments = isEditing ? editPlanData : plan.installments || [];
                    const patientName = plan.patient
                      ? `${plan.patient.firstName || ""} ${plan.patient.lastName || ""}`.trim()
                      : "—";

                    return (
                      <React.Fragment key={plan.id}>
                        <tr
                          key={plan.id}
                          className="hover:bg-muted/5 transition-colors cursor-pointer"
                          onClick={() => toggleExpand(plan.id)}
                        >
                          <td className="py-2.5 px-4">
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </td>
                          <td className="py-2.5 px-4 font-medium">{patientName}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {stats.installmentCount} Taksitli Plan
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(plan.totalAmount)}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-orange-600">
                            {formatCurrency(stats.remaining)}
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {stats.nextDueDate ? format(new Date(stats.nextDueDate), "dd MMM yyyy", { locale: tr }) : "—"}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                plan.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {plan.status === "COMPLETED" ? "Tamamlandı" : "Aktif"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              {plan.patientId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => navigate(`/patients/${plan.patientId}?tab=payments`)}
                                >
                                  <User className="h-3.5 w-3.5 mr-1" /> Hasta
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${plan.id}-expand`}>
                            <td colSpan={8} className="p-0 bg-muted/10">
                              <div className="px-4 py-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Taksit Detayları
                                  </h4>
                                  {!isEditing ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditingPlan(plan);
                                      }}
                                    >
                                      <Edit2 className="h-3 w-3 mr-1.5" /> Düzenle
                                    </Button>
                                  ) : (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          cancelEditingPlan();
                                        }}
                                      >
                                        İptal
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs btn-primary-gradient"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          saveEditedPlan();
                                        }}
                                      >
                                        <Save className="h-3 w-3 mr-1.5" /> Kaydet
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="border border-border/60 rounded-xl overflow-hidden bg-background">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted/30 text-muted-foreground">
                                      <tr>
                                        <th className="py-2 px-4 font-medium">Sıra</th>
                                        <th className="py-2 px-4 font-medium">Vade Tarihi</th>
                                        <th className="py-2 px-4 font-medium text-right">Tutar</th>
                                        <th className="py-2 px-4 font-medium">Durum</th>
                                        {isEditing && <th className="py-2 px-4 w-10" />}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                      {displayInstallments.map((inst, idx) => (
                                        <tr key={inst.id} className="hover:bg-muted/5">
                                          <td className="py-2 px-4 text-muted-foreground">{idx + 1}. Taksit</td>
                                          <td className="py-2 px-4">
                                            {isEditing ? (
                                              <Input
                                                type="date"
                                                className="h-8 max-w-[150px] text-xs"
                                                value={inst.dueDate ? new Date(inst.dueDate).toISOString().split("T")[0] : ""}
                                                onChange={(e) =>
                                                  handleEditInstallmentChange(inst.id, "dueDate", e.target.value)
                                                }
                                              />
                                            ) : (
                                              inst.dueDate ? format(new Date(inst.dueDate), "dd.MM.yyyy", { locale: tr }) : "—"
                                            )}
                                          </td>
                                          <td className="py-2 px-4 text-right font-semibold">
                                            {isEditing ? (
                                              <Input
                                                type="number"
                                                step="0.01"
                                                className="h-8 w-24 text-right text-xs ml-auto"
                                                value={inst.amount}
                                                onChange={(e) =>
                                                  handleEditInstallmentChange(inst.id, "amount", parseFloat(e.target.value))
                                                }
                                              />
                                            ) : (
                                              formatCurrency(inst.amount)
                                            )}
                                          </td>
                                          <td className="py-2 px-4">
                                            {isEditing ? (
                                              <select
                                                className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                                                value={inst.status}
                                                onChange={(e) =>
                                                  handleEditInstallmentChange(inst.id, "status", e.target.value)
                                                }
                                              >
                                                <option value="PENDING">Bekliyor</option>
                                                <option value="PAID">Ödendi</option>
                                                <option value="CANCELLED">İptal</option>
                                              </select>
                                            ) : (
                                              <span
                                                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                                  inst.status === "PAID"
                                                    ? "bg-emerald-500/10 text-emerald-600"
                                                    : inst.status === "CANCELLED"
                                                    ? "bg-destructive/10 text-destructive"
                                                    : "bg-amber-500/10 text-amber-600"
                                                }`}
                                              >
                                                {inst.status === "PAID" ? "Ödendi" : inst.status === "CANCELLED" ? "İptal" : "Bekliyor"}
                                              </span>
                                            )}
                                          </td>
                                          {isEditing && (
                                            <td className="py-2 px-2">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive"
                                                onClick={() => removeEditInstallment(inst.id)}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                      {isEditing && (
                                        <tr>
                                          <td colSpan={5} className="py-2 px-4">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 text-xs w-full border border-dashed border-border/60"
                                              onClick={addEditInstallment}
                                            >
                                              <Plus className="h-3 w-3 mr-1" /> Taksit Ekle
                                            </Button>
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

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
