# 🚀 DentCare AI - Başlatma Kılavuzu

## 📋 Gereksinimler

- Node.js (v18+)
- pnpm (veya npm/yarn)
- Docker Desktop (PostgreSQL, Redis, MinIO için)

## 🏁 Hızlı Başlatma

### 1. Docker Servislerini Başlat

```bash
# Docker Desktop'ın açık olduğundan emin ol
docker compose up -d
```

Bu komut şunları başlatır:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MinIO (port 9000, console 9001)

### 2. Veritabanını Hazırla (İlk Kurulum İçin)

```bash
# Prisma Client'ı generate et
npx prisma generate

# Veritabanı şemasını oluştur
npx prisma db push

# Demo verileri yükle (opsiyonel)
npx prisma db seed
```

### 3. Development Server'ı Başlat

```bash
# Ana dizinde
cd /Users/muhammetisabagci/Desktop/DentAI/DentalSoftware

# Dependencies yüklü değilse
pnpm install

# Dev server'ı başlat
pnpm dev
```

### 4. Tarayıcıda Aç

```
http://localhost:3000
```

## 🔐 Giriş Bilgileri

**Demo Hesap:**
- Email: `admin@dentcare.com`
- Şifre: `admin123`

## 🛑 Durdurma

### Development Server'ı Durdur

```bash
# Terminal'de Ctrl+C ile durdur
# VEYA
pkill -f "next dev"
```

### Docker Servislerini Durdur

```bash
docker compose down
```

### Tüm Servisleri Durdur

```bash
docker compose down && pkill -f "next dev"
```

## 🔄 Yeniden Başlatma

### 1. Tümünü Durdur
```bash
docker compose down
pkill -f "next dev"
```

### 2. Docker Servislerini Başlat
```bash
docker compose up -d
```

### 3. Dev Server'ı Başlat
```bash
cd /Users/muhammetisabagci/Desktop/DentAI/DentalSoftware
pnpm dev
```

## 📊 Servis Durumlarını Kontrol Et

### Docker Servisleri
```bash
docker compose ps
```

### Port Kullanımı
```bash
# 3000 portu (Next.js)
lsof -i :3000

# 5432 portu (PostgreSQL)
lsof -i :5432

# 6379 portu (Redis)
lsof -i :6379

# 9000 portu (MinIO)
lsof -i :9000
```

## 🐛 Sorun Giderme

### Port Zaten Kullanılıyorsa

```bash
# Port'u kullanan process'i bul ve durdur
lsof -ti:3000 | xargs kill -9
```

### Docker Servisleri Çalışmıyorsa

```bash
# Docker Desktop'ı aç
open -a Docker

# Servisleri yeniden başlat
docker compose down
docker compose up -d
```

### Veritabanı Bağlantı Hatası

```bash
# Docker servislerini kontrol et
docker compose ps

# PostgreSQL loglarını kontrol et
docker compose logs db

# Veritabanını sıfırla (DİKKAT: Tüm veriler silinir!)
npx prisma migrate reset
```

### Cache Temizleme

```bash
# Next.js cache'i temizle
rm -rf .next/

# Node modules'ü yeniden yükle
rm -rf node_modules/
pnpm install
```

## 📝 Önemli Notlar

- **İlk kurulum:** `prisma db push` ve `prisma db seed` komutlarını çalıştırın
- **Docker:** Her zaman önce Docker servislerini başlatın
- **Portlar:** 3000, 5432, 6379, 9000 portlarının boş olduğundan emin olun
- **Environment:** `.env` dosyasının mevcut olduğundan emin olun

## 🎯 Hızlı Komutlar

```bash
# Tek seferde başlat
docker compose up -d && cd /Users/muhammetisabagci/Desktop/DentAI/DentalSoftware && pnpm dev

# Tek seferde durdur
docker compose down && pkill -f "next dev"
```

