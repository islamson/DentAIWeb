"use client";

import { Crown, TrendingDown, TrendingUp, DollarSign, AlertTriangle, Users, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

// Mock data - gerçekte API'den gelecek
const profitabilityData = {
  today: {
    revenue: 45000, // kuruş
    cost: 28000,
    profit: 17000,
    margin: 37.8,
    alerts: [
      { type: "HIGH_NOSHOW", message: "No-show nedeniyle 12.000₺ kayıp", severity: "high" },
      { type: "LOW_CONVERSION", message: "Tedavi kabul oranı %18 düşük", severity: "medium" },
    ],
  },
  treatmentProfitability: [
    { name: "İmplant", revenue: 180000, cost: 85000, profit: 95000, margin: 52.8, count: 12 },
    { name: "Diş Beyazlatma", revenue: 45000, cost: 8000, profit: 37000, margin: 82.2, count: 15 },
    { name: "Kanal Tedavisi", revenue: 65000, cost: 22000, profit: 43000, margin: 66.2, count: 8 },
    { name: "Ortodonti", revenue: 220000, cost: 125000, profit: 95000, margin: 43.2, count: 6 },
    { name: "Kompozit Dolgu", revenue: 38000, cost: 15000, profit: 23000, margin: 60.5, count: 25 },
  ],
  doctorPerformance: [
    {
      name: "Dr. Ayşe Demir",
      revenue: 285000,
      acceptanceRate: 78,
      noshowRecovery: 65,
      avgSessionTime: 42,
      patientSatisfaction: 4.7,
      flag: "star",
    },
    {
      name: "Dr. Mehmet Öz",
      revenue: 195000,
      acceptanceRate: 58,
      noshowRecovery: 45,
      avgSessionTime: 55,
      patientSatisfaction: 4.2,
      flag: "needs_training",
    },
    {
      name: "Dr. Zeynep Kaya",
      revenue: 165000,
      acceptanceRate: 72,
      noshowRecovery: 70,
      avgSessionTime: 38,
      patientSatisfaction: 4.8,
      flag: "star",
    },
  ],
  staffProductivity: [
    { name: "Elif Yılmaz (Asistan)", score: 87, efficiency: 92, quality: 88, revenue: 45000 },
    { name: "Can Arslan (Resepsiyon)", score: 73, efficiency: 78, quality: 82, revenue: 0 },
    { name: "Selin Demir (Asistan)", score: 91, efficiency: 95, quality: 90, revenue: 52000 },
  ],
};

export default function OwnerDashboardPage() {
  const { today, treatmentProfitability, doctorPerformance, staffProductivity } = profitabilityData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Crown className="h-8 w-8 text-amber-500" />
            Owner Dashboard
          </h1>
          <p className="text-muted-foreground">
            Klinik kârlılığı, doktor performansı ve stratejik metrikler
          </p>
        </div>
        <Badge className="bg-amber-500 text-white px-4 py-2 text-lg">
          <Crown className="h-4 w-4 mr-2" />
          Premium
        </Badge>
      </div>

      {/* Today's Alerts */}
      {today.alerts.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/10 dark:bg-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Bugün Para Kaybettiniz!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {today.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between bg-card p-3 rounded border-l-4 border-red-500"
                >
                  <div>
                    <p className="font-medium text-card-foreground">{alert.message}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tip: {alert.type}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Detay
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Profitability */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Günlük Ciro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">
              ₺{(today.revenue / 100).toLocaleString("tr-TR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Bugün</p>
          </CardContent>
        </Card>
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Maliyet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              ₺{(today.cost / 100).toLocaleString("tr-TR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Personel + Stok</p>
          </CardContent>
        </Card>
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Kâr</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ₺{(today.profit / 100).toLocaleString("tr-TR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Net</p>
          </CardContent>
        </Card>
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Kâr Marjı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">%{today.margin.toFixed(1)}</div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              +3.2% bu hafta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Treatment Profitability */}
      <Card className="glass-effect border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Tedavi Bazlı Kârlılık
          </CardTitle>
          <CardDescription>
            Hangi tedavi para kazandırıyor? (Bu ay)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {treatmentProfitability.map((treatment) => (
              <div
                key={treatment.name}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">{treatment.name}</h4>
                    <Badge variant="secondary">{treatment.count} işlem</Badge>
                  </div>
                  <div className="flex gap-6 text-sm mt-2">
                    <span className="text-muted-foreground">
                      Ciro: ₺{(treatment.revenue / 100).toLocaleString("tr-TR")}
                    </span>
                    <span className="text-muted-foreground">
                      Maliyet: ₺{(treatment.cost / 100).toLocaleString("tr-TR")}
                    </span>
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Kâr: ₺{(treatment.profit / 100).toLocaleString("tr-TR")}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    %{treatment.margin.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Marj</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Doctor Performance */}
      <Card className="glass-effect border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Doktor Performans Analizi
          </CardTitle>
          <CardDescription>
            Hangi doktor para kazandırıyor? (DentSoft'ta YOK!)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {doctorPerformance.map((doctor) => (
              <div
                key={doctor.name}
                className={`p-4 rounded-lg border-2 ${
                  doctor.flag === "star"
                    ? "bg-green-500/10 dark:bg-green-500/20 border-green-500/30"
                    : "bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/30"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">{doctor.name}</h4>
                    {doctor.flag === "star" ? (
                      <Badge className="bg-green-600">⭐ Star Performer</Badge>
                    ) : (
                      <Badge className="bg-orange-600">⚠️ Needs Training</Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      ₺{(doctor.revenue / 100).toLocaleString("tr-TR")}
                    </div>
                    <div className="text-xs text-muted-foreground">Bu ay ciro</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Kabul Oranı</div>
                    <div className="font-semibold">%{doctor.acceptanceRate}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">No-Show Geri Kazanım</div>
                    <div className="font-semibold">%{doctor.noshowRecovery}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Ort. Seans</div>
                    <div className="font-semibold">{doctor.avgSessionTime} dk</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Memnuniyet</div>
                    <div className="font-semibold">{doctor.patientSatisfaction}/5</div>
                  </div>
                </div>
                {doctor.flag === "needs_training" && (
                  <div className="mt-3 text-sm text-orange-600 dark:text-orange-400">
                    <strong>AI Önerisi:</strong> Bu doktor klinik olarak başarılı ama 
                    tedavi satış becerisi düşük. Satış eğitimi öneririz.
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Staff Productivity */}
      <Card className="glass-effect border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Personel Verimlilik Skoru
          </CardTitle>
          <CardDescription>
            Kim çalışıyor, kim boşa geçiyor?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {staffProductivity.map((staff, idx) => (
              <div
                key={staff.name}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-muted-foreground">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-medium">{staff.name}</h4>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span>Verimlilik: %{staff.efficiency}</span>
                      <span>Kalite: %{staff.quality}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {staff.revenue > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-600 dark:text-green-400">
                        ₺{(staff.revenue / 100).toLocaleString("tr-TR")}
                      </div>
                      <div className="text-xs text-muted-foreground">Üretim</div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-card-foreground">{staff.score}</div>
                    <div className="text-xs text-muted-foreground">Skor</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            AI Stratejik Öneriler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-card p-3 rounded border-l-4 border-green-500">
              <p className="font-medium text-card-foreground">💰 Gelir Fırsatı</p>
              <p className="text-sm text-muted-foreground mt-1">
                İmplant tedavilerini %12 daha fazla satabilirsiniz. 
                Dr. Mehmet Öz'e satış eğitimi verin → tahmini +65.000₺/ay
              </p>
            </div>
            <div className="bg-card p-3 rounded border-l-4 border-orange-500">
              <p className="font-medium text-card-foreground">⚠️ Maliyet Optimizasyonu</p>
              <p className="text-sm text-muted-foreground mt-1">
                Kompozit dolgu maliyeti pazar ortalamasından %8 yüksek. 
                Tedarikçi değişikliği → 12.000₺/ay tasarruf
              </p>
            </div>
            <div className="bg-card p-3 rounded border-l-4 border-blue-500">
              <p className="font-medium text-card-foreground">🎯 Hasta Segmentasyonu</p>
              <p className="text-sm text-muted-foreground mt-1">
                35-45 yaş arası hastalar en yüksek LTV'ye sahip. 
                Bu segmente özel pazarlama → +%22 dönüşüm
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

