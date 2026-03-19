# 🚀 Hızlı Başlangıç Rehberi

Bu rehber, DentOps'u **5 dakikada** çalıştırmanız için adım adım talimatlar içerir.

## ✅ Önkoşullar
- Node.js 18+ yüklü olmalı
- Docker Desktop çalışıyor olmalı
- pnpm yüklü olmalı (veya `npm install -g pnpm`)

## 📋 Adım Adım Kurulum

### 1️⃣ Terminali Aç
```bash
cd /Users/muhammetisabagci/Desktop/DentAI/DentalSoftware
```

### 2️⃣ Bağımlılıkları Yükle
```bash
pnpm install
```
⏱️ Yaklaşık 2-3 dakika sürer

### 3️⃣ Docker Servislerini Başlat
```bash
docker compose up -d
```
✅ PostgreSQL, Redis ve MinIO başlatılır
⏱️ İlk seferde 1-2 dakika, sonra 10 saniye

### 4️⃣ Veritabanını Oluştur
```bash
pnpm db:push
```
✅ Prisma schema'dan tüm tablolar oluşturulur

### 5️⃣ Demo Verileri Yükle
```bash
pnpm db:seed
```
✅ 2 kullanıcı, 3 hasta, örnek randevular oluşturulur

### 6️⃣ Uygulamayı Başlat
```bash
pnpm dev
```
✅ Geliştirme sunucusu başlar

### 7️⃣ Tarayıcıda Aç
http://localhost:3000

### 8️⃣ Giriş Yap
```
E-posta: admin@dentops.com
Şifre: admin123
```

## 🎉 Hazır!

Artık DentOps kullanmaya başlayabilirsiniz!

## 🧪 Test Etmek İçin

1. **Dashboard**: Genel istatistikleri görün
2. **Hastalar**: Yeni hasta ekleyin veya mevcut hastaları görün
3. **Randevular**: Haftalık takvim görünümünü kullanın
4. **AI Center**: AI özelliklerini keşfedin ve "Başlat" butonlarını deneyin
5. **Stok**: Düşük stok uyarılarını görün

## 🔄 Yeniden Başlatma

Eğer bir şeyler ters giderse:

```bash
# Docker'ı durdur ve verileri sil
docker compose down -v

# Docker'ı yeniden başlat
docker compose up -d

# Veritabanını yeniden oluştur
pnpm db:push
pnpm db:seed

# Uygulamayı başlat
pnpm dev
```

## 📊 Veritabanını Görselleştir

Prisma Studio ile:
```bash
pnpm db:studio
```
Tarayıcıda açılır: http://localhost:5555

## 🛑 Durdurma

```bash
# Ctrl+C ile Next.js'i durdur

# Docker'ı durdur (veriler kalır)
docker compose down

# Docker'ı durdur (veriler silinir)
docker compose down -v
```

## ❓ Sorun Giderme

### Docker çalışmıyor
- Docker Desktop'ın açık olduğundan emin olun
- `docker --version` komutuyla test edin

### Port çakışması (3000, 5432, 6379)
- Başka uygulamaları kapatın
- `docker compose down` ile eski container'ları durdurun

### Prisma hatası
```bash
# Prisma client'ı yeniden oluştur
npx prisma generate
```

### Node modülleri sorunu
```bash
rm -rf node_modules
pnpm install
```

## 📱 Erişim Bilgileri

| Servis | URL | Kullanıcı/Şifre |
|--------|-----|-----------------|
| DentOps Web | http://localhost:3000 | admin@dentops.com / admin123 |
| Prisma Studio | http://localhost:5555 | - |
| MinIO Console | http://localhost:9001 | dentops / dentopsdentops |
| PostgreSQL | localhost:5432 | dentops / dentops |
| Redis | localhost:6379 | - |

## 🎯 İlk Görevler

1. ✅ Giriş yap
2. ✅ Dashboard'u incele
3. ✅ Yeni hasta ekle
4. ✅ Randevu oluştur
5. ✅ AI Center'ı ziyaret et
6. ✅ AI job başlat

---

**Keyifli kullanımlar! 🚀**

