"use client";

import { Crown, TrendingUp, Target, AlertTriangle, DollarSign, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

const premiumFeatures = [
  {
    id: "case_acceptance",
    icon: "🎯",
    title: "Tedavi Kabul Skorlayıcı",
    description: "Hangi hastaya hangi tedavi satılabilir? AI ile kabul olasılığını tahmin edin",
    category: "REVENUE",
    impact: "💰 Klinik geliri %15-30 artar",
    features: [
      "Hasta profili analizi",
      "Fiyat hassasiyeti tespiti",
      "Doktor başarı geçmişi",
      "Alternatif plan önerileri",
    ],
    roi: "%72 kabul oranı artışı",
    status: "PREMIUM",
  },
  {
    id: "dynamic_pricing",
    icon: "💎",
    title: "Fiyat Optimizasyonu",
    description: "Bu hastaya bu fiyat uygun mu? AI destekli dinamik fiyatlandırma",
    category: "REVENUE",
    impact: "💰 Kabul oranı +%18, gelir maksimize",
    features: [
      "Bölgesel fiyat analizi",
      "Hasta geçmiş bazlı öneri",
      "Taksit optimizasyonu",
      "Kampanya zamanlaması",
    ],
    roi: "Aylık 45.000₺ ek gelir",
    status: "PREMIUM",
  },
  {
    id: "doctor_analytics",
    icon: "👨‍⚕️",
    title: "Doktor Performans Analizi",
    description: "Hangi doktor para kazandırıyor? Davranışsal analiz + coaching",
    category: "MANAGEMENT",
    impact: "📊 Yönetici için altın madeni",
    features: [
      "Tedavi kabul oranı",
      "No-show geri kazanım",
      "İletişim becerisi skoru",
      "Hasta memnuniyet analizi",
    ],
    roi: "DentSoft'ta YOK",
    status: "PREMIUM",
  },
  {
    id: "churn_prediction",
    icon: "🚨",
    title: "Hasta Kaybetme Tahmini",
    description: "Hangi hasta kliniği terk etmek üzere? Erken müdahale ile kurtarın",
    category: "RETENTION",
    impact: "💰 Hasta LTV koruması",
    features: [
      "Risk skoru (0-100)",
      "Sentiment analizi",
      "Otomatik aksiyon önerisi",
      "Urgency seviyesi",
    ],
    roi: "%40 hasta kaybı azaltma",
    status: "PREMIUM",
  },
  {
    id: "ai_coordinator",
    icon: "🤖",
    title: "Klinik Koordinatör AI",
    description: "WhatsApp/SMS/Mail otomasyonu. Asistan yerine geçer, personel maliyeti düşer",
    category: "AUTOMATION",
    impact: "⚡ 1 personel tasarrufu = 15.000₺/ay",
    features: [
      "Otomatik randevu ayarlama",
      "Fiyat sorgularına cevap",
      "İptal sonrası yeniden planlama",
      "Tedavi sonrası takip",
    ],
    roi: "Aylık 15.000₺ personel tasarrufu",
    status: "PREMIUM",
  },
  {
    id: "profit_map",
    icon: "📊",
    title: "Kârlılık Haritası (Owner Panel)",
    description: "Hangi tedavi para kazandırıyor? Hangi doktor zarar ettiriyor?",
    category: "MANAGEMENT",
    impact: "💰 Stratejik karar desteği",
    features: [
      "Tedavi bazlı kârlılık",
      "Doktor ROI analizi",
      "Hasta tipi profitability",
      "Gerçek zamanlı uyarılar",
    ],
    roi: "Sahipler bunu görünce kilitlenir",
    status: "PREMIUM",
  },
  {
    id: "daily_loss_alert",
    icon: "⚠️",
    title: "Günlük Kayıp Uyarısı",
    description: "Bugün para kaybettiniz! No-show, stok israfı, yanlış fiyatlandırma",
    category: "MANAGEMENT",
    impact: "🚨 Anında müdahale",
    features: [
      "No-show kayıp hesaplama",
      "Stok israfı tespiti",
      "Fiyat hataları",
      "Personel verimsizliği",
    ],
    roi: "Günde 5-10 bin ₺ tasarruf",
    status: "PREMIUM",
  },
  {
    id: "staff_productivity",
    icon: "⚡",
    title: "Personel Verimlilik Skoru",
    description: "Kim çalışıyor, kim boşa geçiyor? AI destekli performans takibi",
    category: "MANAGEMENT",
    impact: "📈 Verimlilik +%25",
    features: [
      "Saat/işlem analizi",
      "Hasta başına gelir",
      "Hata oranı takibi",
      "Organizasyon içi sıralama",
    ],
    roi: "Yönetici için kritik",
    status: "PREMIUM",
  },
  {
    id: "legal_shield",
    icon: "🛡️",
    title: "Medico-Legal AI Kalkanı",
    description: "Her işlem için: Kim, ne zaman, hangi veriye dayanarak? Dava koruması",
    category: "COMPLIANCE",
    impact: "⚖️ Hukuki güvenlik",
    features: [
      "Tam veri snapshot",
      "Dijital imza",
      "Geolocation kayıt",
      "AI anomali tespiti",
    ],
    roi: "1 dava = 50.000₺+ tasarruf",
    status: "PREMIUM",
  },
  {
    id: "patient_portal",
    icon: "📱",
    title: "Hasta Portalı",
    description: "Hastalar başka kliniğe gitmesin! Mobil + web portal",
    category: "RETENTION",
    impact: "🔐 Hasta bağımlılığı",
    features: [
      "Randevu görüntüleme",
      "Tedavi planı takibi",
      "Fatura görüntüleme",
      "AI hasta asistanı",
    ],
    roi: "Hasta churn -%60",
    status: "PREMIUM",
  },
  {
    id: "clinic_memory",
    icon: "🧠",
    title: "Klinik Hafızası",
    description: "Doktor ayrılsa bile bilgi kaybolmaz. Kurumsal zeka",
    category: "INSTITUTIONAL",
    impact: "🏛️ Kurumsal değer",
    features: [
      "Tedavi pattern analizi",
      "Hasta davranış öğrenme",
      "Pazar trend tespiti",
      "Kolektif akıl birikimi",
    ],
    roi: "Zincir klinikler için altın",
    status: "PREMIUM",
  },
  {
    id: "dental_chart_ai",
    icon: "🦷",
    title: "Dijital Diş Şeması + AI",
    description: "Exocad entegrasyonuna hazır. AI destekli tedavi planı",
    category: "CLINICAL",
    impact: "⚡ Hekim zamanı -%40",
    features: [
      "Drag & drop tedavi",
      "Alternatif senaryolar",
      "Geçmiş işlem gösterimi",
      "AI öneri sistemi",
    ],
    roi: "Hekim verimliliği artışı",
    status: "PREMIUM",
  },
];

const categoryLabels = {
  REVENUE: { label: "Gelir Artırıcı", color: "bg-green-500" },
  MANAGEMENT: { label: "Yönetim", color: "bg-blue-500" },
  RETENTION: { label: "Hasta Tutma", color: "bg-purple-500" },
  AUTOMATION: { label: "Otomasyon", color: "bg-orange-500" },
  COMPLIANCE: { label: "Uyumluluk", color: "bg-gray-500" },
  INSTITUTIONAL: { label: "Kurumsal", color: "bg-indigo-500" },
  CLINICAL: { label: "Klinik", color: "bg-teal-500" },
};

export default function PremiumAIPage() {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-8 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Crown className="h-10 w-10" />
            <h1 className="text-4xl font-bold">Premium AI Modülleri</h1>
          </div>
          <p className="text-xl mb-6 opacity-90">
            DentSoft'un yapamadığı, kliniklerin <strong>gerçekten para verdiği</strong> özellikler
          </p>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-3xl font-bold">%15-30</div>
              <div className="text-sm opacity-90">Gelir Artışı</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-3xl font-bold">%40</div>
              <div className="text-sm opacity-90">No-Show Azalma</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-3xl font-bold">15K₺/ay</div>
              <div className="text-sm opacity-90">Personel Tasarrufu</div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Message */}
      <Card className="border-2 border-primary">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Target className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold mb-2">Stratejik Gerçek</h3>
              <p className="text-muted-foreground mb-3">
                ❌ "Her şeyi yapan yazılım" satmaz
              </p>
              <p className="text-lg font-semibold text-primary">
                ✅ "Para kazandıran yazılım" satar
              </p>
              <p className="mt-3 text-sm">
                Bu modüller, kliniğin <strong>aylık yazılım ücretini 3 kat geri kazandırır</strong>. 
                DentSoft'ta hiçbiri yok!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Premium Features Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {premiumFeatures.map((feature) => {
          const categoryInfo = categoryLabels[feature.category];
          return (
            <Card key={feature.id} className="hover:shadow-xl transition-all border-2 hover:border-primary">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-4xl">{feature.icon}</span>
                  <div className="flex gap-2">
                    <Badge className={`${categoryInfo.color} text-white`}>
                      {categoryInfo.label}
                    </Badge>
                    <Badge variant="secondary">
                      <Crown className="h-3 w-3 mr-1" />
                      {feature.status}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Impact */}
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm font-semibold text-primary">
                    {feature.impact}
                  </p>
                </div>

                {/* Features */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    ÖZELLİKLER
                  </p>
                  <ul className="space-y-1">
                    {feature.features.map((f, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ROI */}
                <div className="pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-600">
                      ROI: {feature.roi}
                    </span>
                  </div>
                </div>

                {/* Action */}
                <Button className="w-full" variant="default">
                  <Crown className="mr-2 h-4 w-4" />
                  Premium'a Geç
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Why This Matters */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
            Klinikler Neye Para Verir?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3 text-green-700">✅ SATAR:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                  Daha fazla hasta
                </li>
                <li className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                  Daha az no-show
                </li>
                <li className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                  Hekimin zamanı boşa gitmesin
                </li>
                <li className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                  Daha çok tedavi satılsın
                </li>
                <li className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                  Personel hatası azalsın
                </li>
                <li className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                  Hasta memnuniyeti artsın
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-red-700">❌ SATMAZ:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• "Güzel dashboard" (tek başına)</li>
                <li>• "Modern arayüz" (değer katmadan)</li>
                <li>• "Çok özellik" (kullanılmayan)</li>
                <li>• "Mobil uyumlu" (ROI olmadan)</li>
              </ul>
              <div className="mt-4 p-3 bg-white rounded border-l-4 border-primary">
                <p className="text-sm font-semibold">
                  Bu modüller, kliniğin <span className="text-primary">gerçek problemlerini</span> çözüyor.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Architecture Info */}
      <Card>
        <CardHeader>
          <CardTitle>🧩 Teknik Mimari</CardTitle>
          <CardDescription>
            Bu modüller nasıl implement edilir?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Frontend (Next.js)</h4>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`/app/(app)/ai/
  ├── premium/              # Bu sayfa
  ├── acceptance-score/     # Tedavi kabul skorlayıcı
  ├── pricing-advisor/      # Fiyat optimizasyonu
  ├── doctor-analytics/     # Doktor performans
  ├── churn-prediction/     # Hasta kaybetme
  └── coordinator-ai/       # Klinik koordinatör`}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Backend (Microservices)</h4>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`Python FastAPI:
  - ML Models (XGBoost, LSTM)
  - LLM Integration (GPT-4)
  - Queue Processing (BullMQ)
  - Real-time Analytics`}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Database Extensions</h4>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`New Tables:
  - case_acceptance_scores
  - pricing_recommendations
  - doctor_performance_metrics
  - churn_risk_scores
  - clinical_insights`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

