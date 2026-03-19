"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Filter,
  Plus,
  Search,
  CreditCard,
  Wallet,
  Building,
  ArrowUpRight,
  Receipt,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

export default function BillingPage() {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  const stats = {
    totalRevenue: 523400,
    pendingPayments: 87600,
    thisMonth: 124300,
    paidToday: 15800,
  };
  
  const invoices = [
    {
      id: "INV-2024-001",
      patient: "Ahmet Yılmaz",
      date: "2024-01-15",
      total: 3500,
      paid: 3500,
      status: "PAID",
      items: [
        { name: "Kanal Tedavisi", price: 2500 },
        { name: "Porselen Kuron", price: 1000 },
      ],
    },
    {
      id: "INV-2024-002",
      patient: "Zeynep Kaya",
      date: "2024-01-16",
      total: 4200,
      paid: 2000,
      status: "PARTIAL",
      items: [
        { name: "İmplant", price: 4200 },
      ],
    },
    {
      id: "INV-2024-003",
      patient: "Can Arslan",
      date: "2024-01-16",
      total: 1500,
      paid: 0,
      status: "OPEN",
      items: [
        { name: "Kontrol", price: 300 },
        { name: "Temizlik", price: 800 },
        { name: "Beyazlatma", price: 400 },
      ],
    },
  ];
  
  const payments = [
    { id: "1", invoice: "INV-2024-001", patient: "Ahmet Yılmaz", amount: 3500, method: "Kredi Kartı", date: "2024-01-15 14:30" },
    { id: "2", invoice: "INV-2024-002", patient: "Zeynep Kaya", amount: 2000, method: "Nakit", date: "2024-01-16 10:15" },
    { id: "3", invoice: "INV-2024-003", patient: "Mehmet Öz", amount: 1200, method: "Havale", date: "2024-01-16 16:45" },
  ];

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
                Finans & Tahsilat
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
              <div className="text-sm font-semibold text-muted-foreground mb-1">Toplam Gelir</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">
                ₺{(stats.totalRevenue / 100).toLocaleString('tr-TR')}
              </div>
            </div>
            <div className="gradient-success p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Bu yıl toplam</p>
          </CardContent>
          <div className="absolute inset-0 gradient-success rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>
        
        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Bekleyen Tahsilat</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">
                ₺{(stats.pendingPayments / 100).toLocaleString('tr-TR')}
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
                ₺{(stats.thisMonth / 100).toLocaleString('tr-TR')}
              </div>
            </div>
            <div className="gradient-primary p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground group-hover:text-white/80">Aylık gelir</p>
          </CardContent>
          <div className="absolute inset-0 gradient-primary rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
        </Card>
        
        <Card className="stat-card group cursor-pointer border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Bugün Ödenen</div>
              <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors">
                ₺{(stats.paidToday / 100).toLocaleString('tr-TR')}
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

      {/* Invoices & Payments */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Invoices */}
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
                Faturalar
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Filtrele
                </Button>
                <Button className="btn-primary-gradient" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Yeni Fatura
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="p-4 rounded-2xl bg-card border border-border hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setSelectedInvoice(invoice)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-card-foreground">{invoice.id}</div>
                    <div className="text-sm text-muted-foreground">{invoice.patient}</div>
                  </div>
                  <Badge className={
                    invoice.status === 'PAID' ? 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30' :
                    invoice.status === 'PARTIAL' ? 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30' :
                    'bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30'
                  }>
                    {invoice.status === 'PAID' ? (
                      <><CheckCircle className="h-3 w-3 mr-1 inline" />Ödendi</>
                    ) : invoice.status === 'PARTIAL' ? (
                      <><Clock className="h-3 w-3 mr-1 inline" />Kısmi</>
                    ) : (
                      <><AlertCircle className="h-3 w-3 mr-1 inline" />Bekliyor</>
                    )}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-green-600">
                    ₺{invoice.total.toLocaleString('tr-TR')}
                  </div>
                  {invoice.status !== 'PAID' && (
                    <div className="text-sm text-muted-foreground">
                      Kalan: ₺{(invoice.total - invoice.paid).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-xl">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              Son Ödemeler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="p-4 rounded-2xl bg-card border border-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-card-foreground">{payment.patient}</div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    ₺{payment.amount.toLocaleString('tr-TR')}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {payment.method}
                  </div>
                  <div>{payment.date}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Detail Dialog */}
      <Dialog open={selectedInvoice !== null} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-2xl glass-effect border-0 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                <Receipt className="h-7 w-7 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-card-foreground">Fatura Detayı</DialogTitle>
                <div className="text-muted-foreground">{selectedInvoice?.id}</div>
              </div>
            </div>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Hasta</div>
                  <div className="text-lg font-semibold text-card-foreground">{selectedInvoice.patient}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Tarih</div>
                  <div className="text-lg font-semibold text-card-foreground">{selectedInvoice.date}</div>
                </div>
              </div>
              
              <div className="border-t border-border pt-4">
                <div className="text-lg font-bold mb-3 text-card-foreground">Hizmetler</div>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                      <div className="text-card-foreground">{item.name}</div>
                      <div className="font-semibold text-card-foreground">₺{item.price.toLocaleString('tr-TR')}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between text-2xl font-bold">
                  <div className="text-card-foreground">Toplam</div>
                  <div className="text-green-600 dark:text-green-400">₺{selectedInvoice.total.toLocaleString('tr-TR')}</div>
                </div>
                <div className="flex items-center justify-between text-lg mt-2">
                  <div className="text-card-foreground">Ödenen</div>
                  <div className="text-blue-600 dark:text-blue-400">₺{selectedInvoice.paid.toLocaleString('tr-TR')}</div>
                </div>
                {selectedInvoice.status !== 'PAID' && (
                  <div className="flex items-center justify-between text-lg font-semibold mt-2">
                    <div className="text-card-foreground">Kalan</div>
                    <div className="text-red-600 dark:text-red-400">₺{(selectedInvoice.total - selectedInvoice.paid).toLocaleString('tr-TR')}</div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  PDF İndir
                </Button>
                {selectedInvoice.status !== 'PAID' && (
                  <Button className="flex-1 btn-primary-gradient">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Ödeme Al
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

