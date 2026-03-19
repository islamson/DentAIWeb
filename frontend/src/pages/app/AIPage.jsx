"use client";

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Play, Clock, CheckCircle, XCircle, AlertCircle, Crown, Zap, ArrowRight, Brain, Target, TrendingUp, Shield, Star, Bell, FileText, MessageSquare, ClipboardList, BarChart3, Activity, Package, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";


const aiFeatures = [
  {
    id: "note_summarize",
    title: "Klinik Not Otomasyonu (Scribe)",
    description: "Muayene notlarını otomatik olarak SOAP formatında yapılandırın",
    icon: FileText,
    iconColor: "from-blue-500 to-indigo-600",
    input: "Hekim diktesi, muayene formu, ölçümler",
    output: "SOAP formatında klinik not, ICD etiketleri, kontrol tarihi önerisi",
    risk: "Düşük - Hekim onayı gerekli",
    benefit: "%80 zaman tasarrufu",
  },
  {
    id: "treatment_suggest",
    title: "Tedavi Planı Önerisi",
    description: "Hasta şikayeti ve bulgularına göre tedavi önerileri",
    icon: ClipboardList,
    iconColor: "from-green-500 to-emerald-600",
    input: "Şikayet, anamnez, klinik bulgular, geçmiş işlemler",
    output: "Önerilen prosedürler, alternatifler, risk notları",
    risk: "Orta - Hekim değerlendirmesi zorunlu",
    benefit: "Kapsamlı plan oluşturma",
  },
  {
    id: "noshow_predict",
    title: "No-Show Tahmini",
    description: "Randevuya gelmeme riskini önceden tespit edin",
    icon: BarChart3,
    iconColor: "from-purple-500 to-pink-600",
    input: "Geçmiş no-show, saat, gün, hasta yaşı, randevu tipi, ödeme davranışı",
    output: "0-100 risk skoru, önerilen aksiyonlar",
    risk: "Çok Düşük - Sadece bilgilendirme",
    benefit: "%40 no-show azaltma",
  },
  {
    id: "patient_message_reply",
    title: "Hasta Mesajlarını Otomatik Yanıtla",
    description: "WhatsApp/chat mesajlarına akıllı yanıt önerileri",
    icon: MessageSquare,
    iconColor: "from-cyan-500 to-blue-600",
    input: "Hasta mesajı, klinik FAQ, fiyat politikası, çalışma saatleri",
    output: "Hazır cevap taslağı, randevu önerisi",
    risk: "Düşük - Personel onayı ile gönderilir",
    benefit: "Anlık yanıt",
  },
  {
    id: "patient_summary",
    title: "Hasta Özeti ve Kronoloji",
    description: "Hasta geçmişini özetleyin ve önemli noktaları çıkarın",
    icon: Activity,
    iconColor: "from-orange-500 to-red-600",
    input: "Randevular, tedavi planları, faturalar, dokümanlar",
    output: "10 satır hasta özeti, riskler, önerilen sonraki adım",
    risk: "Çok Düşük - Sadece özet",
    benefit: "Hızlı bilgi erişimi",
  },
  {
    id: "inventory_demand",
    title: "Stok Talep Tahmini",
    description: "Gelecek haftalarda hangi malzemelere ihtiyaç olacağını tahmin edin",
    icon: Package,
    iconColor: "from-amber-500 to-orange-600",
    input: "Tedavi tipleri, geçmiş sarf, sezonluk yoğunluk",
    output: "2-4 hafta satınalma önerisi",
    risk: "Çok Düşük - Sadece öneri",
    benefit: "Stok optimizasyonu",
  },
  {
    id: "revenue_anomaly",
    title: "Gelir Tahmini & KPI Anomali",
    description: "Gelir trendlerini analiz edin ve anormal durumları tespit edin",
    icon: TrendingUp,
    iconColor: "from-green-500 to-teal-600",
    input: "Günlük gelir, randevu doluluk, no-show, hekim üretimi",
    output: "Trend analizi, anomali uyarıları, açıklamalar",
    risk: "Çok Düşük - Analitik",
    benefit: "Erken uyarı sistemi",
  },
  {
    id: "document_extract",
    title: "Doküman Veri Çıkarma",
    description: "PDF formlardan otomatik veri çıkarın",
    icon: FileText,
    iconColor: "from-indigo-500 to-purple-600",
    input: "Hasta kimlik/iletişim, seçilen şablon",
    output: "Ön-doldurulmuş onam PDF",
    risk: "Düşük - Hekim kontrol eder",
    benefit: "Form doldurma otomasyonu",
  },
  {
    id: "xray_analysis",
    title: "Radyografi Analizi (Eğitim Amaçlı)",
    description: "X-ray görüntülerinde olası bulguları işaretleyin",
    icon: AlertTriangle,
    iconColor: "from-red-500 to-rose-600",
    input: "X-ray görüntüsü",
    output: "Olası bulgular, hekim doğrulaması gerekli",
    risk: "YÜKSEK - Tıbbi cihaz regülasyonu",
    benefit: "Eğitim ve ikinci görüş",
  },
];

const statusIcons = {
  queued: Clock,
  running: Play,
  done: CheckCircle,
  error: XCircle,
};

const statusLabels = {
  queued: "Sırada",
  running: "İşleniyor",
  done: "Tamamlandı",
  error: "Hata",
};

const statusVariants = {
  queued: "secondary",
  running: "default",
  done: "success",
  error: "destructive",
};

export default function AIPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  
  // Mock AI Results
  const mockResults = {
    note_summarize: {
      soap: {
        subjective: "Hasta sağ alt çene bölgesinde ağrı şikayeti ile başvurdu. Ağrı 3 gündür devam ediyor.",
        objective: "Diş 46'da derin çürük tespit edildi. Pulpada canlılık testi pozitif. Radyografide periapikal lezyon görülmedi.",
        assessment: "Diş 46 irreversibl pulpitis",
        plan: "Kanal tedavisi planlandı. İlk seans anestezi altında kanal açımı yapılacak."
      },
      icdCodes: ["K04.0 - Pulpitis", "K02.1 - Dentin çürüğü"],
      recallDate: "2024-02-15",
      risk: "Düşük",
      estimatedDuration: "45 dakika"
    },
    treatment_suggest: {
      primaryTreatments: [
        { code: "D3310", name: "Kanal Tedavisi (Tek Kanal)", priority: "Yüksek", price: 2500 },
        { code: "D2740", name: "Porselen Kuron", priority: "Yüksek", price: 3500 }
      ],
      alternativeTreatments: [
        { code: "D3220", name: "Pulpa Kaplama", priority: "Orta", price: 1200 }
      ],
      risks: ["Tedavi gecikirse enfeksiyon riski artar", "Dişin kırılma riski mevcut"],
      totalEstimate: 6000,
      duration: "2-3 seans, toplam 3 hafta"
    },
    noshow_predict: {
      score: 67,
      risk: "Yüksek",
      factors: [
        { factor: "Daha önce 2 no-show kaydı var", impact: "Yüksek" },
        { factor: "Randevu akşam saatinde", impact: "Orta" },
        { factor: "Ödemede gecikme var", impact: "Orta" }
      ],
      actions: [
        "24 saat önce WhatsApp hatırlatması gönder",
        "Randevu gününden 1 gün önce telefon araması yap",
        "Depozito alma düşünülebilir"
      ]
    },
    patient_message_reply: {
      originalMessage: "Merhaba, diş ağrım var. Bu hafta randevu alabilir miyim?",
      suggestedReply: "Merhaba! Diş ağrınız için üzgünüz. Size yardımcı olmak isteriz. Bu hafta Perşembe 14:00 veya Cuma 10:30 için randevumuz müsait. Hangisi sizin için uygun? Aciliyet durumunuza göre bugün için de bir boşluk oluşturabiliriz.",
      appointmentSuggestions: [
        { day: "Perşembe", time: "14:00", doctor: "Dr. Ayşe Demir" },
        { day: "Cuma", time: "10:30", doctor: "Dr. Mehmet Öz" }
      ],
      tone: "Empatik ve yardımsever"
    },
    patient_summary: {
      summary: "42 yaşında kadın hasta. 2 yıldır kliniğimizde takipte. Periodontal hassasiyeti var. Düzenli kontrollere geliyor. Ödeme disiplini iyi. Son 6 ayda 3 temizlik seansı tamamlandı.",
      risks: ["Periodontal hastalık riski", "Diş eti çekilmesi"],
      nextSteps: ["6 ay sonra kontrol", "Diş taşı temizliği", "Dişeti durumu takibi"],
      lastVisit: "2024-01-05",
      totalSpent: 8500,
      upcomingAppointments: 1
    },
    inventory_demand: {
      predictions: [
        { item: "Kompozit Rezin A2", current: 12, predicted: 8, order: "4 adet", urgency: "Orta" },
        { item: "Anestezi Kartuşu", current: 45, predicted: 60, order: "15 adet", urgency: "Düşük" },
        { item: "Eldiven (M)", current: 8, predicted: 25, order: "20 kutu", urgency: "Yüksek" }
      ],
      totalCost: 2340,
      deliveryDate: "2024-02-10"
    },
    revenue_anomaly: {
      anomalies: [
        { metric: "İmplant Geliri", change: "-30%", reason: "Dr. Mehmet Öz'ün izinli olması", severity: "Orta" },
        { metric: "Hafta Sonu Randevuları", change: "+45%", reason: "Yeni randevu politikası başarılı", severity: "Pozitif" }
      ],
      forecast: {
        nextWeek: 32000,
        nextMonth: 128000,
        confidence: "85%"
      }
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/ai/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error("Error fetching AI jobs:", error);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleStartJob = async (type) => {
    try {
      setLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Show result
      const result = mockResults[type] || { message: "AI işlemi tamamlandı!" };
      setSelectedJob({ type, result });
      
      // Also call the real API
      try {
        const res = await fetch("/api/ai/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            inputRef: "demo",
            inputData: { demo: true },
          }),
        });

        if (res.ok) {
          fetchJobs();
        }
      } catch (error) {
        console.error("Error calling API:", error);
      }
    } catch (error) {
      console.error("Error starting AI job:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in">
      {/* Hero Section */}
      <div className="glass-effect rounded-3xl p-8 border border-purple-200/50 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-32 h-32 bg-purple-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-4 left-4 w-24 h-24 bg-blue-500 rounded-full blur-2xl"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  AI Center
                </h1>
                <p className="text-lg text-gray-700 font-medium">
                  Yapay Zeka Destekli Akıllı Klinik Yönetimi
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-6 mt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{aiFeatures.length}</div>
                <div className="text-sm text-gray-600 font-medium">AI Özellik</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{jobs.filter(j => j.status === 'done').length}</div>
                <div className="text-sm text-gray-600 font-medium">Tamamlanan</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{jobs.filter(j => j.status === 'running').length}</div>
                <div className="text-sm text-gray-600 font-medium">İşleniyor</div>
              </div>
            </div>
          </div>
          
          <div className="hidden md:block">
            <div className="flex flex-col gap-3">
              <Button className="btn-primary-gradient shadow-xl">
                <Target className="h-4 w-4 mr-2" />
                Hızlı Başlat
              </Button>
              <Button variant="outline" className="border-purple-200 text-purple-600 hover:bg-purple-50">
                <TrendingUp className="h-4 w-4 mr-2" />
                İstatistikler
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Banner */}
      <Card className="glass-effect border-0 bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 shadow-2xl">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-xl animate-bounce">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Premium AI Modülleri</h2>
                  <p className="text-orange-700 font-medium">Kliniğinizin Gelirini %30 Artıran AI Çözümleri</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-4 leading-relaxed">
                <strong>DentSoft'un yapamadığı, kliniklerin gerçekten para verdiği</strong> 12 premium AI özelliği:
                Tedavi Kabul Skorlayıcı, Dinamik Fiyatlandırma, Doktor Performans Analizi, ve daha fazlası...
              </p>
              
              <div className="flex flex-wrap gap-2 mb-6">
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  %15-30 Gelir Artışı
                </Badge>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                  <Shield className="h-3 w-3 mr-1" />
                  %40 No-Show Azalma
                </Badge>
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  <Star className="h-3 w-3 mr-1" />
                  ROI Garantili
                </Badge>
              </div>
              
              <div className="flex gap-4">
                <Button asChild className="bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 shadow-lg">
                  <Link to="/ai/premium">
                    <Crown className="mr-2 h-4 w-4" />
                    Premium Modülleri Keşfet
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50">
                  Demo İzle
                </Button>
              </div>
            </div>
            
            <div className="hidden lg:block">
              <div className="relative">
                <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-2xl">
                  <div className="text-4xl font-bold text-white">PRO</div>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle>AI Özellikler Hakkında</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Bu sayfada DentOps'un AI yetenekleri listelenmektedir. Her kart bir AI
            özelliğini temsil eder. <strong>"Başlat"</strong> butonuna tıklayarak
            AI job'ı oluşturabilir ve işlem geçmişini görebilirsiniz.
          </p>
          <p className="text-sm mt-2 text-muted-foreground">
            <AlertCircle className="inline h-4 w-4 mr-1" />
            Not: AI modelleri farklı bir sistemde çalıştırılacak. Bu arayüz
            sadece tetikleme ve sonuç görüntüleme için kullanılır.
          </p>
        </CardContent>
      </Card>

      {/* AI Features Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {aiFeatures.map((feature, index) => {
          const IconComponent = feature.icon;
          return (
            <Card key={feature.id} className="glass-effect border-0 shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.iconColor}`}></div>
              
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 bg-gradient-to-br ${feature.iconColor} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className="h-7 w-7 text-white" />
                    </div>
                    <div className="text-sm text-gray-500 font-semibold">
                      AI #{String(index + 1).padStart(2, '0')}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    feature.risk.includes('YÜKSEK') 
                      ? 'bg-red-100 text-red-700 border-red-200' 
                      : feature.risk.includes('Orta')
                      ? 'bg-orange-100 text-orange-700 border-orange-200'
                      : 'bg-green-100 text-green-700 border-green-200'
                  }`}>
                    {feature.risk}
                  </div>
                </div>
                
                <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                  {feature.title}
                </CardTitle>
                <CardDescription className="text-gray-600 leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                        <ArrowRight className="h-4 w-4 text-white rotate-180" />
                      </div>
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                        Girdi Verileri
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{feature.input}</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center">
                        <ArrowRight className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-xs font-bold text-green-700 uppercase tracking-wider">
                        Çıktı Sonuçları
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{feature.output}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-200">
                    <Zap className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">
                      {feature.benefit}
                    </span>
                  </div>
                  
                  <Button
                    onClick={() => handleStartJob(feature.id)}
                    disabled={loading}
                    className="btn-primary-gradient shadow-lg hover:shadow-xl transition-all duration-300 px-6"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Başlat
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Jobs */}
      <Card className="glass-effect border-0 shadow-xl">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                AI İşlem Geçmişi
              </CardTitle>
              <CardDescription className="mt-2 text-gray-600 font-medium">
                Son çalıştırılan AI işlemleri ve sonuçları • {jobs.length} toplam işlem
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              Tümünü Gör
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-gray-400" />
              </div>
              <div className="text-gray-500 font-medium mb-2">Henüz AI İşlemi Yok</div>
              <div className="text-sm text-gray-400">İlk AI özelliğinizi çalıştırmak için yukarıdaki kartlardan birini seçin</div>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.slice(0, 10).map((job, index) => {
                const StatusIcon = statusIcons[job.status] || Clock;
                const feature = aiFeatures.find((f) => f.id === job.type);
                
                return (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-white border border-gray-100 hover:shadow-lg transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                        job.status === 'done' ? 'bg-green-500' :
                        job.status === 'error' ? 'bg-red-500' :
                        job.status === 'running' ? 'bg-blue-500' :
                        'bg-gray-500'
                      }`}>
                        <StatusIcon className="h-5 w-5 text-white" />
                      </div>
                      
                      <div>
                        <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {feature?.title || job.type}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {new Date(job.createdAt).toLocaleString("tr-TR")}
                        </p>
                        {job.error && (
                          <p className="text-sm text-red-600 font-medium mt-1 flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            {job.error}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <Badge 
                        className={`${
                          job.status === 'done' ? 'bg-green-100 text-green-700 border-green-200' :
                          job.status === 'error' ? 'bg-red-100 text-red-700 border-red-200' :
                          job.status === 'running' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {statusLabels[job.status]}
                      </Badge>
                      {job.status === 'done' && (
                        <Button variant="ghost" size="sm" className="mt-2 text-xs">
                          Sonuçları Gör <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* AI Result Dialog */}
      <Dialog open={selectedJob !== null} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-4xl glass-effect border-0 shadow-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl animate-pulse">
                <Brain className="h-7 w-7 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">AI İşlem Sonucu</DialogTitle>
                <DialogDescription className="text-base">
                  {selectedJob && aiFeatures.find(f => f.id === selectedJob.type)?.title}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {selectedJob?.type === 'note_summarize' && (
              <div className="space-y-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      SOAP Notu Oluşturuldu
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="font-semibold text-blue-900">📋 Subjective (Öznel)</div>
                      <div className="text-gray-700 mt-1">{selectedJob.result.soap.subjective}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-blue-900">🔍 Objective (Nesnel)</div>
                      <div className="text-gray-700 mt-1">{selectedJob.result.soap.objective}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-blue-900">⚕️ Assessment (Değerlendirme)</div>
                      <div className="text-gray-700 mt-1">{selectedJob.result.soap.assessment}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-blue-900">📝 Plan</div>
                      <div className="text-gray-700 mt-1">{selectedJob.result.soap.plan}</div>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-3 gap-4">
                  <Card className="glass-effect">
                    <CardContent className="p-4 text-center">
                      <div className="text-sm text-gray-600">ICD Kodları</div>
                      <div className="text-lg font-bold text-purple-600">{selectedJob.result.icdCodes.length}</div>
                    </CardContent>
                  </Card>
                  <Card className="glass-effect">
                    <CardContent className="p-4 text-center">
                      <div className="text-sm text-gray-600">Risk Seviyesi</div>
                      <div className="text-lg font-bold text-green-600">{selectedJob.result.risk}</div>
                    </CardContent>
                  </Card>
                  <Card className="glass-effect">
                    <CardContent className="p-4 text-center">
                      <div className="text-sm text-gray-600">Tahmini Süre</div>
                      <div className="text-lg font-bold text-blue-600">{selectedJob.result.estimatedDuration}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            {selectedJob?.type === 'noshow_predict' && (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="text-7xl font-bold text-red-600 mb-2">{selectedJob.result.score}</div>
                  <div className="text-xl text-gray-600">No-Show Risk Skoru</div>
                  <Badge className="mt-3 text-lg px-4 py-2 bg-red-100 text-red-700">{selectedJob.result.risk} Risk</Badge>
                </div>
                
                <Card className="bg-amber-50 border-amber-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      Risk Faktörleri
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedJob.result.factors.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span>{f.factor}</span>
                        <Badge className={f.impact === 'Yüksek' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                          {f.impact}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-600" />
                      Önerilen Aksiyonlar
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedJob.result.actions.map((action, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
            
            {selectedJob && selectedJob.type === 'treatment_suggest' && selectedJob.result?.primaryTreatments && (
              <div className="space-y-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle>Önerilen Tedaviler</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedJob.result.primaryTreatments.map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white rounded-xl">
                        <div>
                          <div className="font-semibold text-gray-900">{t.name}</div>
                          <div className="text-sm text-gray-500">Kod: {t.code}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-600">₺{t.price.toLocaleString('tr-TR')}</div>
                          <Badge className="mt-1">{t.priority} Öncelik</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                
                <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200">
                  <div className="text-sm text-gray-600 mb-2">Toplam Tahmini Maliyet</div>
                  <div className="text-4xl font-bold text-green-600 mb-2">₺{selectedJob.result.totalEstimate.toLocaleString('tr-TR')}</div>
                  <div className="text-sm text-gray-600">Süre: {selectedJob.result.duration}</div>
                </div>
              </div>
            )}
            
            {/* Generic result for other AI types */}
            {selectedJob && !['note_summarize', 'noshow_predict', 'treatment_suggest'].includes(selectedJob.type) && (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-2">AI İşlemi Başarıyla Tamamlandı!</div>
                <div className="text-gray-600 mb-6">Sonuçlar sisteme kaydedildi ve kullanıma hazır.</div>
                <pre className="bg-gray-100 p-6 rounded-xl text-left text-sm max-w-2xl mx-auto overflow-auto">
                  {JSON.stringify(selectedJob.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
          
          <div className="flex gap-4 pt-6 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedJob(null)}>
              Kapat
            </Button>
            <Button className="flex-1 btn-primary-gradient">
              Sonuçları Kaydet
              <CheckCircle className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

