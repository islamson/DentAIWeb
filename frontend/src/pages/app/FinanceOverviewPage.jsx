"use client";

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { formatCurrency } from "../../lib/utils";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Wallet,
  Receipt,
  CreditCard,
  CalendarClock,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

const PAYMENT_METHOD_LABELS = {
  CASH: "Nakit",
  CARD: "Kredi Kartı",
  BANK_TRANSFER: "Banka Transferi",
  ONLINE: "Online",
  OTHER: "Diğer",
};

export default function FinanceOverviewPage() {
  const [summary, setSummary] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [upcomingInstallments, setUpcomingInstallments] = useState([]);
  const [largestPending, setLargestPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [summaryRes, movementsRes, invoicesRes, pendingRes] = await Promise.all([
          fetch("/api/billing/summary"),
          fetch("/api/billing/movements?type=PAYMENT&limit=5"),
          fetch("/api/billing/invoices?limit=5").catch(() => ({ ok: false })),
          fetch("/api/billing/pending-collections").catch(() => ({ ok: false })),
        ]);

        if (summaryRes.ok) {
          const d = await summaryRes.json();
          setSummary(d);
        } else {
          setSummary({
            totalCollections: 0,
            pendingCollections: 0,
            collectedToday: 0,
            collectedThisMonth: 0,
            openInvoiceCount: 0,
            activePaymentPlanCount: 0,
          });
        }

        if (movementsRes.ok) {
          const d = await movementsRes.json();
          setRecentPayments(d.movements || []);
        }

        if (invoicesRes?.ok) {
          const d = await invoicesRes.json();
          const all = d.invoices || [];
          setOpenInvoices(all.filter((i) => i.status === "OPEN" || i.status === "PARTIAL"));
        }

        if (pendingRes?.ok) {
          const d = await pendingRes.json();
          setUpcomingInstallments(d.nearDueInstallments || []);
          setLargestPending(d.patientsWithBalance || []);
        }
      } catch (err) {
        console.error(err);
        setSummary({
          totalCollections: 0,
          pendingCollections: 0,
          collectedToday: 0,
          collectedThisMonth: 0,
          openInvoiceCount: 0,
          activePaymentPlanCount: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const stats = summary || {
    totalCollections: 0,
    pendingCollections: 0,
    collectedToday: 0,
    collectedThisMonth: 0,
    openInvoiceCount: 0,
    activePaymentPlanCount: 0,
  };

  return (
    <div className="space-y-8 animate-in">
      {/* Hero Section */}
      <div className="glass-effect rounded-3xl p-8 border border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 right-4 w-32 h-32 bg-green-500 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 rounded-3xl flex items-center justify-center shadow-2xl">
              <DollarSign className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Finans Özeti
              </h1>
              <p className="text-lg text-muted-foreground font-medium">
                Gelir ve ödeme takibi
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Toplam Tahsilat</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">
                {loading ? "—" : formatCurrency(stats.totalCollections)}
              </div>
            </div>
            <div className="gradient-success p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Toplam gelir</p>
          </CardContent>
          <div className="absolute inset-0 gradient-success rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>

        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Bekleyen Tahsilat</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">
                {loading ? "—" : formatCurrency(stats.pendingCollections)}
              </div>
            </div>
            <div className="gradient-warning p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <Clock className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Toplanacak</p>
          </CardContent>
          <div className="absolute inset-0 gradient-warning rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>

        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Bu Ay</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">
                {loading ? "—" : formatCurrency(stats.collectedThisMonth)}
              </div>
            </div>
            <div className="gradient-primary p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Aylık tahsilat</p>
          </CardContent>
          <div className="absolute inset-0 gradient-primary rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>

        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Bugün Ödenen</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">
                {loading ? "—" : formatCurrency(stats.collectedToday)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <Wallet className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Günlük tahsilat</p>
          </CardContent>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>
      </div>

      {/* Extra stats row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-effect border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Açık Fatura</div>
                <div className="text-2xl font-bold">{loading ? "—" : stats.openInvoiceCount}</div>
              </div>
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-effect border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Aktif Ödeme Planı</div>
                <div className="text-2xl font-bold">{loading ? "—" : stats.activePaymentPlanCount}</div>
              </div>
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Blocks */}
      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-500" />
                Son Ödemeler
              </CardTitle>
              <Link to="/finance/movements?type=PAYMENT">
                <span className="text-sm text-primary hover:underline flex items-center gap-1">
                  Tümü <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground py-4">Son ödeme bulunamadı</p>
            ) : (
              <div className="space-y-3">
                {recentPayments.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div>
                      <div className="font-medium">{m.patientName || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.paymentMethod ? PAYMENT_METHOD_LABELS[m.paymentMethod] : "—"} • {m.occurredAt ? new Date(m.occurredAt).toLocaleDateString("tr-TR") : ""}
                      </div>
                    </div>
                    <div className="font-bold text-emerald-600">{formatCurrency(m.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-500" />
                Açık Faturalar
              </CardTitle>
              <Link to="/finance/invoices?status=OPEN">
                <span className="text-sm text-primary hover:underline flex items-center gap-1">
                  Tümü <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {openInvoices.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground py-4">Açık fatura bulunamadı</p>
            ) : (
              <div className="space-y-3">
                {openInvoices.slice(0, 5).map((inv) => {
                  const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
                  const remaining = (inv.netTotal || 0) - paid;
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <div>
                        <div className="font-medium">{inv.number}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.patient?.firstName} {inv.patient?.lastName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(remaining)}</div>
                        <div className="text-xs text-muted-foreground">kalan</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              Yaklaşan Taksitler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingInstallments.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground py-4">Yaklaşan taksit bulunamadı</p>
            ) : (
              <div className="space-y-3">
                {upcomingInstallments.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div>
                      <div className="font-medium">{item.patientName || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString("tr-TR") : "—"}
                      </div>
                    </div>
                    <div className="font-bold">{formatCurrency(item.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                En Yüksek Bekleyen Bakiyeler
              </CardTitle>
              <Link to="/finance/pending">
                <span className="text-sm text-primary hover:underline flex items-center gap-1">
                  Tümü <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {largestPending.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground py-4">Bekleyen bakiye bulunamadı</p>
            ) : (
              <div className="space-y-3">
                {largestPending.slice(0, 5).map((item) => (
                  <div key={item.patientId || item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div>
                      <div className="font-medium">{item.patientName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{item.source || "Bakiye"}</div>
                    </div>
                    <div className="font-bold text-orange-600">{formatCurrency(item.amountDue || item.remaining)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
