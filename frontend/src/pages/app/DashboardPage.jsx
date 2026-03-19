"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Calendar,
  DollarSign,
  Users,
  AlertTriangle,
  TrendingUp,
  XCircle,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Activity,
  Heart,
  Zap,
  Star,
  Bell,
  X,
  BarChart3,
  PieChart,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Link } from "react-router-dom";

// Mock data - gerçek uygulamada veritabanından gelecek
const stats = {
  todayAppointments: { total: 24, completed: 18, cancelled: 2, noshow: 1 },
  todayRevenue: 125000, // kuruş
  pendingPayments: 345000,
  activePatients: 1247,
  lowStockItems: 8,
};

const upcomingAppointments = [
  {
    id: "1",
    patient: "Ahmet Yılmaz",
    time: "14:00",
    doctor: "Dr. Ayşe Demir",
    type: "Kontrol",
    status: "confirmed",
  },
  {
    id: "2",
    patient: "Zeynep Kaya",
    time: "14:30",
    doctor: "Dr. Mehmet Öz",
    type: "İmplant",
    status: "scheduled",
  },
  {
    id: "3",
    patient: "Can Arslan",
    time: "15:00",
    doctor: "Dr. Ayşe Demir",
    type: "Kanal Tedavisi",
    status: "confirmed",
  },
];

const aiInsights = [
  {
    type: "warning",
    title: "Yüksek No-Show Riski",
    description: "Bu hafta 12 randevuda no-show riski yüksek tespit edildi",
    action: "Detayları Gör",
  },
  {
    type: "info",
    title: "Stok Önerisi",
    description: "5 ürün için otomatik sipariş önerisi hazır",
    action: "Önerilere Bak",
  },
  {
    type: "success",
    title: "Gelir Artışı",
    description: "Bu ay geçen aya göre %18 gelir artışı görüldü",
    action: "Raporu İncele",
  },
];

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  gradient,
  onClick,
}) {
  return (
    <Card 
      className="stat-card group cursor-pointer border-0 shadow-lg"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-sm font-semibold text-muted-foreground mb-1">{title}</CardTitle>
          <div className="text-3xl font-bold text-card-foreground group-hover:text-white transition-colors duration-300">
            {value}
          </div>
        </div>
        <div className={`${gradient} p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {description && (
          <p className="text-sm text-muted-foreground mb-2 group-hover:text-white/80 transition-colors duration-300">{description}</p>
        )}
        {trend && (
          <div className={`text-sm flex items-center gap-1 ${
            trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
          } group-hover:text-white transition-colors duration-300`}>
            {trend.positive ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            <span className="font-semibold">{trend.value}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground group-hover:text-white/60 mt-2 flex items-center gap-1">
          <ArrowUpRight className="h-3 w-3" />
          Detaylı görüntüle
        </div>
      </CardContent>
      {/* Hover Background Gradient */}
      <div className={`absolute inset-0 ${gradient} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10`}></div>
    </Card>
  );
}

export default function DashboardPage() {
  const [selectedStat, setSelectedStat] = useState(null);
  
  const revenueData = {
    daily: [
      { day: "Pazartesi", amount: 1250, appointments: 8 },
      { day: "Salı", amount: 1580, appointments: 11 },
      { day: "Çarşamba", amount: 980, appointments: 6 },
      { day: "Perşembe", amount: 2100, appointments: 14 },
      { day: "Cuma", amount: 1840, appointments: 12 },
      { day: "Cumartesi", amount: 1650, appointments: 9 },
      { day: "Pazar", amount: 0, appointments: 0 },
    ],
    monthly: { current: 45600, lastMonth: 38200, growth: 19.4 },
    yearly: { current: 523000, lastYear: 442000, growth: 18.3 },
  };
  return (
    <div className="space-y-8 animate-in">
      {/* Hero Section */}
      <div className="glass-effect rounded-3xl p-8 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-ring bg-clip-text text-transparent mb-2">
              Hoş Geldiniz! 👋
            </h1>
            <p className="text-lg text-muted-foreground font-medium">
              Kliniğinizin günlük performansını takip edin
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-600 dark:text-green-400 font-semibold">Sistem Aktif</span>
              <span className="text-sm text-muted-foreground">• Son güncellenme: Az önce</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <Button className="btn-primary-gradient">
              <Target className="h-4 w-4 mr-2" />
              Hızlı İşlemler
            </Button>
            <Button variant="outline" className="border-2 border-violet-200 text-violet-600 hover:bg-violet-50">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Assistant
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Bugün Randevu"
          value={stats.todayAppointments.total}
          description={`${stats.todayAppointments.completed} tamamlandı, ${stats.todayAppointments.total - stats.todayAppointments.completed} devam ediyor`}
          icon={Calendar}
          gradient="gradient-primary"
          trend={{ value: "+12% bu hafta", positive: true }}
          onClick={() => setSelectedStat('appointments')}
        />
        <StatCard
          title="Günlük Ciro"
          value={`₺${(stats.todayRevenue / 100).toLocaleString("tr-TR")}`}
          description="Bugünkü toplam gelir"
          icon={DollarSign}
          gradient="gradient-success"
          trend={{ value: "+8% dün", positive: true }}
          onClick={() => setSelectedStat('revenue')}
        />
        <StatCard
          title="Bekleyen Tahsilat"
          value={`₺${(stats.pendingPayments / 100).toLocaleString("tr-TR")}`}
          description="Toplanacak ödemeler"
          icon={Clock}
          gradient="gradient-warning"
          onClick={() => setSelectedStat('payments')}
        />
        <StatCard
          title="Aktif Hasta"
          value={stats.activePatients}
          description="Son 6 ayda kayıtlı"
          icon={Users}
          gradient="bg-gradient-to-br from-purple-500 to-pink-600"
          trend={{ value: "+124 bu ay", positive: true }}
          onClick={() => setSelectedStat('patients')}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass-effect border-border group hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-500 p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.todayAppointments.completed}</div>
                <div className="text-sm text-muted-foreground">Tamamlandı</div>
              </div>
            </div>
            <div className="w-full bg-green-500/20 dark:bg-green-500/30 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.todayAppointments.completed / stats.todayAppointments.total) * 100}%` }}
              ></div>
            </div>
            <div className="text-xs text-green-600 mt-2 font-medium">
              %{Math.round((stats.todayAppointments.completed / stats.todayAppointments.total) * 100)} başarı oranı
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect border-border group hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-500 p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <XCircle className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.todayAppointments.cancelled}</div>
                <div className="text-sm text-muted-foreground">İptal Edilen</div>
              </div>
            </div>
            <div className="w-full bg-orange-500/20 dark:bg-orange-500/30 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.todayAppointments.cancelled / stats.todayAppointments.total) * 100 || 5}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect border-border group hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-red-500 p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.todayAppointments.noshow}</div>
                <div className="text-sm text-muted-foreground">No-Show</div>
              </div>
            </div>
            <div className="w-full bg-red-500/20 dark:bg-red-500/30 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-red-500 to-rose-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.todayAppointments.noshow / stats.todayAppointments.total) * 100 || 3}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-effect border-border group hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-500 p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.todayAppointments.total - stats.todayAppointments.completed - stats.todayAppointments.cancelled - stats.todayAppointments.noshow}
                </div>
                <div className="text-sm text-muted-foreground">Devam Ediyor</div>
              </div>
            </div>
            <div className="w-full bg-blue-500/20 dark:bg-blue-500/30 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Upcoming Appointments - 2/3 width */}
        <div className="lg:col-span-2">
          <Card className="glass-effect border-0 shadow-xl">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    Yaklaşan Randevular
                  </CardTitle>
                  <CardDescription className="mt-2 text-muted-foreground font-medium">
                    Bugün için planlanan randevular • {upcomingAppointments.length} randevu
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-muted">
                  Tümünü Gör
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingAppointments.map((apt, index) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:shadow-lg transition-all duration-300 group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-card-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {apt.patient}
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{apt.type}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Heart className="h-3 w-3" />
                          {apt.doctor}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-primary/10 dark:bg-primary/20 px-3 py-1 rounded-xl">
                        <p className="font-bold text-primary">{apt.time}</p>
                      </div>
                      <Badge
                        className={`mt-2 ${
                          apt.status === "confirmed" 
                            ? "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30 border border-green-500/30" 
                            : "bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 hover:bg-orange-500/20 dark:hover:bg-orange-500/30 border border-orange-500/30"
                        }`}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {apt.status === "confirmed" ? "Onaylı" : "Bekliyor"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights - 1/3 width */}
        <div>
          <Card className="glass-effect border-0 shadow-xl">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl font-bold text-card-foreground flex items-center gap-3">
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-2 rounded-xl animate-pulse">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                AI Insights
              </CardTitle>
              <CardDescription className="mt-2 text-muted-foreground font-medium">
                Yapay zeka önerileri
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border-l-4 transition-all duration-300 hover:shadow-lg cursor-pointer group ${
                      insight.type === 'warning' ? 'bg-amber-500/10 dark:bg-amber-500/20 border-l-amber-400 hover:bg-amber-500/20 dark:hover:bg-amber-500/30' :
                      insight.type === 'success' ? 'bg-green-500/10 dark:bg-green-500/20 border-l-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30' :
                      'bg-blue-500/10 dark:bg-blue-500/20 border-l-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl ${
                        insight.type === 'warning' ? 'bg-amber-500/30 dark:bg-amber-500/40' :
                        insight.type === 'success' ? 'bg-green-500/30 dark:bg-green-500/40' :
                        'bg-blue-500/30 dark:bg-blue-500/40'
                      }`}>
                        {insight.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" /> :
                         insight.type === 'success' ? <Star className="h-4 w-4 text-green-700 dark:text-green-400" /> :
                         <Bell className="h-4 w-4 text-blue-700 dark:text-blue-400" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
                          {insight.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {insight.description}
                        </p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`mt-3 p-0 h-auto font-semibold hover:bg-transparent ${
                            insight.type === 'warning' ? 'text-amber-600 hover:text-amber-700' :
                            insight.type === 'success' ? 'text-green-600 hover:text-green-700' :
                            'text-blue-600 hover:text-blue-700'
                          }`}
                        >
                          {insight.action} <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stock Alerts */}
      {stats.lowStockItems > 0 && (
        <Card className="glass-effect border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-orange-500 to-red-600 p-4 rounded-2xl shadow-lg animate-pulse">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-card-foreground mb-1">Stok Uyarıları!</h3>
                  <p className="text-muted-foreground font-medium">
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.lowStockItems}</span> ürün minimum stok seviyesinin altında
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Hemen sipariş vermeniz öneriliyor</p>
                </div>
              </div>
              <Link to="/inventory">
                <Button className="bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 shadow-lg">
                  <Zap className="h-4 w-4 mr-2" />
                  Stok Yönetimi
                </Button>
              </Link>
            </div>
            
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">3</div>
                <div className="text-sm text-muted-foreground">Kritik Seviye</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">5</div>
                <div className="text-sm text-muted-foreground">Düşük Seviye</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">47</div>
                <div className="text-sm text-muted-foreground">Normal Seviye</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Detail Dialogs */}
      <Dialog open={selectedStat === 'revenue'} onOpenChange={() => setSelectedStat(null)}>
        <DialogContent className="max-w-4xl glass-effect border-0 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 gradient-success rounded-2xl flex items-center justify-center shadow-xl">
                <DollarSign className="h-7 w-7 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Gelir Analizi</DialogTitle>
                <DialogDescription className="text-base">Detaylı finansal performans raporu</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Günlük Gelir */}
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Bu Hafta Günlük Gelir
              </h3>
              <div className="grid gap-3">
                {revenueData.daily.map((day) => (
                  <div key={day.day} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
                        {day.day.slice(0, 3)}
                      </div>
                      <div>
                        <div className="font-semibold text-card-foreground">{day.day}</div>
                        <div className="text-sm text-muted-foreground">{day.appointments} randevu</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">₺{day.amount.toLocaleString('tr-TR')}</div>
                      <div className="w-full bg-muted rounded-full h-2 mt-2">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full" style={{ width: `${(day.amount / 2500) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Aylık ve Yıllık */}
            <div className="grid grid-cols-2 gap-6">
              <Card className="glass-effect">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-600" />
                    Bu Ay
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    ₺{revenueData.monthly.current.toLocaleString('tr-TR')}
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-semibold">+{revenueData.monthly.growth}% geçen aya göre</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-effect">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-600" />
                    Bu Yıl
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600 mb-2">
                    ₺{revenueData.yearly.current.toLocaleString('tr-TR')}
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-semibold">+{revenueData.yearly.growth}% geçen yıla göre</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Similar dialogs for other stats */}
      <Dialog open={selectedStat === 'appointments'} onOpenChange={() => setSelectedStat(null)}>
        <DialogContent className="max-w-2xl glass-effect border-0 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center shadow-xl">
                <Calendar className="h-7 w-7 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Randevu Detayları</DialogTitle>
                <DialogDescription className="text-base">Bugünün randevu özeti</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-4">{stats.todayAppointments.total}</div>
            <div className="text-xl text-muted-foreground mb-6">Toplam Randevu</div>
            <Link to="/appointments">
              <Button className="btn-primary-gradient">
                Tüm Randevuları Görüntüle
                <ArrowUpRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

