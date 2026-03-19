"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Settings as SettingsIcon,
  Building,
  Users,
  Bell,
  Shield,
  Palette,
  Globe,
  Mail,
  Phone,
  Save,
  CheckCircle,
  Sun,
  Moon,
  Package,
  ChevronRight,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";

export default function SettingsPage() {
  const { theme, setLightTheme, setDarkTheme } = useTheme();
  const [saved, setSaved] = useState(false);
  
  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-8 animate-in">
      {/* Hero */}
      <div className="glass-effect rounded-3xl p-8 border border-gray-200/50 bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-900 rounded-3xl flex items-center justify-center shadow-2xl">
            <SettingsIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
              Ayarlar
            </h1>
            <p className="text-lg text-gray-700 font-medium">
              Sistem ve klinik ayarlarınızı yönetin
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Organization Settings */}
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl">
                <Building className="h-5 w-5 text-white" />
              </div>
              Organizasyon Bilgileri
            </CardTitle>
            <CardDescription>Klinik bilgilerinizi güncelleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Klinik Adı</Label>
              <Input id="orgName" defaultValue="DentCare AI Klinik" className="input-modern" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxNo">Vergi No</Label>
              <Input id="taxNo" defaultValue="1234567890" className="input-modern" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Input id="address" defaultValue="İstanbul, Türkiye" className="input-modern" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-500" />
                  Telefon
                </Label>
                <Input id="phone" defaultValue="+90 555 123 4567" className="input-modern" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  E-posta
                </Label>
                <Input id="email" defaultValue="info@dentcare.com" className="input-modern" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Settings */}
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-2 rounded-xl">
                <Users className="h-5 w-5 text-white" />
              </div>
              Kullanıcı Ayarları
            </CardTitle>
            <CardDescription>Kişisel bilgilerinizi düzenleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Ad Soyad</Label>
              <Input id="userName" defaultValue="Admin User" className="input-modern" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userEmail">E-posta</Label>
              <Input id="userEmail" defaultValue="admin@dentcare.com" className="input-modern" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mevcut Şifre</Label>
              <Input id="currentPassword" type="password" className="input-modern" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Yeni Şifre</Label>
              <Input id="newPassword" type="password" className="input-modern" />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-yellow-500 to-orange-600 p-2 rounded-xl">
                <Bell className="h-5 w-5 text-white" />
              </div>
              Bildirim Tercihleri
            </CardTitle>
            <CardDescription>Bildirim ayarlarınızı özelleştirin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="font-semibold">E-posta Bildirimleri</div>
                <div className="text-sm text-gray-600">Önemli güncellemeler</div>
              </div>
              <Badge className="bg-green-100 text-green-700">Aktif</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="font-semibold">SMS Bildirimleri</div>
                <div className="text-sm text-gray-600">Randevu hatırlatmaları</div>
              </div>
              <Badge className="bg-green-100 text-green-700">Aktif</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="font-semibold">Mobil Push</div>
                <div className="text-sm text-gray-600">Gerçek zamanlı güncellemeler</div>
              </div>
              <Badge className="bg-gray-100 text-gray-700">Pasif</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="glass-effect border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-red-500 to-rose-600 p-2 rounded-xl">
                <Shield className="h-5 w-5 text-white" />
              </div>
              Güvenlik
            </CardTitle>
            <CardDescription>Güvenlik ve gizlilik ayarları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="font-semibold">İki Faktörlü Doğrulama</div>
                <div className="text-sm text-gray-600">Ekstra güvenlik katmanı</div>
              </div>
              <Button size="sm" variant="outline">Etkinleştir</Button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="font-semibold">Oturum Süresi</div>
                <div className="text-sm text-gray-600">Otomatik çıkış süresi</div>
              </div>
              <select className="text-sm border rounded-lg px-3 py-2">
                <option>30 dakika</option>
                <option>1 saat</option>
                <option>4 saat</option>
                <option>1 gün</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="font-semibold">Veri Şifreleme</div>
                <div className="text-sm text-gray-600">AES-256 şifreleme</div>
              </div>
              <Badge className="bg-green-100 text-green-700 border border-green-200">
                <CheckCircle className="h-3 w-3 mr-1 inline" />
                Aktif
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Kurum Ayarları */}
        <Card className="glass-effect border-0 shadow-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-2 rounded-xl">
                <Package className="h-5 w-5 text-white" />
              </div>
              Kurum Ayarları
            </CardTitle>
            <CardDescription>Stok ve modül ayarlarınızı yönetin</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/settings/stock"
              className="flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-orange-500 to-yellow-600 p-2 rounded-lg">
                  <Package className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="font-semibold">Stok Ayarları</div>
                  <div className="text-sm text-muted-foreground">Stok kategorileri ve çıkış yönleri</div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card className="glass-effect border-0 shadow-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl">
                <Palette className="h-5 w-5 text-white" />
              </div>
              Görünüm ve Dil
            </CardTitle>
            <CardDescription>Arayüz tercihlerinizi ayarlayın</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Tema</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={setLightTheme}
                    className={cn(
                      "p-4 border-2 rounded-xl bg-white cursor-pointer transition-all duration-200 hover:scale-105",
                      theme === 'light' 
                        ? "border-blue-500 shadow-lg" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                      <Sun className="h-4 w-4" />
                      Açık
                    </div>
                    <div className="h-8 bg-gradient-to-r from-blue-100 to-indigo-100 rounded"></div>
                  </button>
                  <button
                    onClick={setDarkTheme}
                    className={cn(
                      "p-4 border-2 rounded-xl bg-gray-900 cursor-pointer transition-all duration-200 hover:scale-105",
                      theme === 'dark' 
                        ? "border-blue-500 shadow-lg shadow-blue-500/50" 
                        : "border-gray-700 hover:border-gray-600"
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold mb-2 text-white">
                      <Moon className="h-4 w-4" />
                      Koyu
                    </div>
                    <div className="h-8 bg-gradient-to-r from-blue-900 to-indigo-900 rounded"></div>
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  Dil
                </Label>
                <select className="w-full border-2 rounded-xl px-4 py-3 input-modern">
                  <option>🇹🇷 Türkçe</option>
                  <option>🇬🇧 English</option>
                  <option>🇩🇪 Deutsch</option>
                  <option>🇫🇷 Français</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Tarih Formatı</Label>
                <select className="w-full border-2 rounded-xl px-4 py-3 input-modern">
                  <option>DD/MM/YYYY</option>
                  <option>MM/DD/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" size="lg">
          Vazgeç
        </Button>
        <Button 
          className="btn-primary-gradient" 
          size="lg"
          onClick={handleSave}
        >
          {saved ? (
            <>
              <CheckCircle className="h-5 w-5 mr-2" />
              Kaydedildi!
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Değişiklikleri Kaydet
            </>
          )}
        </Button>
      </div>
      
      {saved && (
        <div className="fixed bottom-8 right-8 glass-effect p-4 rounded-2xl shadow-2xl border border-green-200 bg-green-50 animate-in">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <div className="font-bold text-green-900">Başarılı!</div>
              <div className="text-sm text-green-700">Ayarlarınız kaydedildi</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

