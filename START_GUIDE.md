# 🚀 DentAI Web - Başlatma Kılavuzu (Docker ile)

## ✅ Docker Kullanarak Başlatma

Bu kılavuz Docker kullanarak projeyi başlatmanızı gösterir. **Docker kullanmak istemiyorsanız**, [START_WITHOUT_DOCKER.md](./START_WITHOUT_DOCKER.md) dosyasına bakın.

Docker şu servisleri sağlar:
- **PostgreSQL** (Veritabanı)
- **Redis** (Opsiyonel - şu anda kullanılmıyor)
- **MinIO** (Opsiyonel - şu anda kullanılmıyor)

**Not:** Sadece PostgreSQL gereklidir. Redis ve MinIO şu anda kullanılmıyor.

## 📋 Adım Adım Başlatma

### 1️⃣ Docker Desktop'ı Başlat

Docker Desktop'ın açık ve çalışıyor olduğundan emin olun.

### 2️⃣ Proje Dizinine Git

```bash
cd /Users/furkanislamoglu/Desktop/DentAI/DentAIWeb
```

### 3️⃣ Bağımlılıkları Yükle

```bash
npm install
```

Bu komut hem `backend/` hem de `frontend/` klasörlerindeki tüm paketleri yükler.

### 4️⃣ Environment Variables (.env) Dosyası Oluştur

Proje kök dizininde (DentAIWeb/) bir `.env` dosyası oluşturun:

```bash
# Root dizinde .env dosyası oluştur
touch .env
```

`.env` dosyasına şunları ekleyin:

```env
# Database (Docker Compose'daki ayarlarla eşleşmeli)
DATABASE_URL="postgresql://dentops:dentops@localhost:5432/dentops"

# Session Secret (güvenli bir random string)
SESSION_SECRET="your-super-secret-key-change-this-in-production-12345"

# Client URL (Frontend)
CLIENT_URL="http://localhost:3000"

# Backend Port
PORT=3001

# Node Environment
NODE_ENV=development
```

### 5️⃣ Docker Servislerini Başlat

```bash
docker compose up -d
```

Bu komut şunları başlatır:
- ✅ PostgreSQL (port 5432)
- ✅ Redis (port 6379)  
- ✅ MinIO (port 9000, console 9001)

**Kontrol etmek için:**
```bash
docker compose ps
```

Tüm servislerin `Up` durumunda olduğunu görmelisiniz.

### 6️⃣ Veritabanını Hazırla

```bash
# Prisma Client'ı generate et
npx prisma generate

# Veritabanı şemasını oluştur (tabloları oluşturur)
npm run db:push

# Demo verileri yükle (opsiyonel ama önerilir)
npm run db:seed
```

### 7️⃣ Uygulamayı Başlat

**ÖNEMLİ:** Tüm komutları **root dizinden** (`DentAIWeb/`) çalıştırın!

```bash
# Hem backend hem frontend'i birlikte başlat
npm run dev
```

Bu komut:
- ✅ Backend'i `http://localhost:3001` adresinde başlatır
- ✅ Frontend'i `http://localhost:3000` adresinde başlatır

### 8️⃣ Tarayıcıda Aç

```
http://localhost:3000
```

## 🎯 Alternatif Başlatma Yöntemleri

### Sadece Backend Başlatmak İçin:
```bash
npm run dev:server
```

### Sadece Frontend Başlatmak İçin:
```bash
npm run dev:client
```

## 🔐 Giriş Bilgileri

Eğer `npm run db:seed` çalıştırdıysanız, demo kullanıcılar oluşturulmuştur. 
Giriş bilgileri seed dosyasında tanımlıdır (genellikle `admin@example.com` / `password123` gibi).

## 🛑 Durdurma

### Development Server'ı Durdur:
```bash
# Terminal'de Ctrl+C tuşlarına basın
```

### Docker Servislerini Durdur:
```bash
docker compose down
```

### Tümünü Durdur (veriler kalır):
```bash
docker compose down
# Ctrl+C ile dev server'ı durdur
```

### Tümünü Durdur ve Verileri Sil:
```bash
docker compose down -v
```

## 🔄 Yeniden Başlatma

```bash
# 1. Docker'ı başlat
docker compose up -d

# 2. Uygulamayı başlat
npm run dev
```

## 📊 Servis Durumlarını Kontrol Et

### Docker Servisleri:
```bash
docker compose ps
```

### Port Kullanımı:
```bash
# Backend (3001)
lsof -i :3001

# Frontend (3000)
lsof -i :3000

# PostgreSQL (5432)
lsof -i :5432
```

## 🐛 Sorun Giderme

### Port Zaten Kullanılıyorsa:
```bash
# Port'u kullanan process'i bul ve durdur
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Docker Servisleri Çalışmıyorsa:
```bash
# Docker Desktop'ın açık olduğundan emin ol
# Servisleri yeniden başlat
docker compose restart
```

### Veritabanı Bağlantı Hatası:
```bash
# Docker servislerinin çalıştığını kontrol et
docker compose ps

# Veritabanını yeniden oluştur
npm run db:push
```

### Prisma Client Hatası:
```bash
# Prisma Client'ı yeniden generate et
npx prisma generate
```

## 📝 Önemli Notlar

1. **Her zaman root dizinden çalıştırın** (`DentAIWeb/`)
2. **Docker Desktop açık olmalı** - Docker servisleri olmadan proje çalışmaz
3. **.env dosyası gerekli** - Environment variables olmadan backend başlamaz
4. **İlk kurulumda `db:push` ve `db:seed` çalıştırın** - Veritabanı tabloları oluşturulmalı

## 🎉 Başarılı Başlatma Kontrol Listesi

- [ ] Docker Desktop açık ve çalışıyor
- [ ] `npm install` tamamlandı
- [ ] `.env` dosyası oluşturuldu ve dolduruldu
- [ ] `docker compose up -d` başarılı
- [ ] `npm run db:push` başarılı
- [ ] `npm run db:seed` başarılı (opsiyonel)
- [ ] `npm run dev` başarılı
- [ ] `http://localhost:3000` açılıyor
- [ ] `http://localhost:3001/api/health` çalışıyor

## 📚 Ek Komutlar

```bash
# Prisma Studio (Veritabanı görselleştirme)
npm run db:studio
# Tarayıcıda açılır: http://localhost:5555

# Production build
npm run build

# Production server
npm start
```

