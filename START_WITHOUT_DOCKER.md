# 🚀 DentAI Web - Docker Olmadan Başlatma Kılavuzu

## ✅ Docker Gerekli Değil!

Bu proje sadece **PostgreSQL** veritabanına ihtiyaç duyuyor. Redis ve MinIO şu anda kullanılmıyor, bu yüzden Docker'a gerek yok!

## 📋 Adım Adım Başlatma (Docker Olmadan)

### 1️⃣ PostgreSQL Kurulumu

#### macOS (Homebrew ile):
```bash
brew install postgresql@16
brew services start postgresql@16
```

#### Windows:
[PostgreSQL Windows installer](https://www.postgresql.org/download/windows/) indirip kurun.

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2️⃣ PostgreSQL Veritabanı Oluştur

```bash
# PostgreSQL'e bağlan
psql postgres

# Veritabanı oluştur
CREATE DATABASE dentops;

# Kullanıcı oluştur (opsiyonel, varsayılan postgres kullanıcısını da kullanabilirsiniz)
CREATE USER dentops WITH PASSWORD 'dentops';
GRANT ALL PRIVILEGES ON DATABASE dentops TO dentops;

# Çıkış
\q
```

**Alternatif (tek satır):**
```bash
createdb dentops
```

### 3️⃣ Proje Dizinine Git

```bash
cd /Users/furkanislamoglu/Desktop/DentAI/DentAIWeb
```

### 4️⃣ Bağımlılıkları Yükle

```bash
npm install
```

### 5️⃣ Environment Variables (.env) Dosyası Oluştur

Root dizinde `.env` dosyası oluşturun:

```bash
touch .env
```

`.env` dosyasına şunları ekleyin:

```env
# Database - Kendi PostgreSQL kurulumunuzun bilgileri
# macOS Homebrew varsayılan: postgres kullanıcısı, şifre yok
DATABASE_URL="postgresql://postgres@localhost:5432/dentops"

# VEYA eğer şifre ayarladıysanız:
# DATABASE_URL="postgresql://dentops:dentops@localhost:5432/dentops"

# Session Secret (güvenli bir random string)
SESSION_SECRET="your-super-secret-key-change-this-in-production-12345"

# Client URL (Frontend)
CLIENT_URL="http://localhost:3000"

# Backend Port
PORT=3001

# Node Environment
NODE_ENV=development
```

**Önemli:** `DATABASE_URL` formatı:
- Şifresiz: `postgresql://postgres@localhost:5432/dentops`
- Şifreli: `postgresql://username:password@localhost:5432/dentops`

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
Seed dosyasını kontrol edin veya Prisma Studio ile veritabanına bakın:

```bash
npm run db:studio
# Tarayıcıda açılır: http://localhost:5555
```

## 🛑 Durdurma

### Development Server'ı Durdur:
```bash
# Terminal'de Ctrl+C tuşlarına basın
```

### PostgreSQL'i Durdur (macOS):
```bash
brew services stop postgresql@16
```

### PostgreSQL'i Durdur (Linux):
```bash
sudo systemctl stop postgresql
```

## 🔄 Yeniden Başlatma

```bash
# 1. PostgreSQL'in çalıştığından emin ol
# macOS:
brew services start postgresql@16

# Linux:
sudo systemctl start postgresql

# 2. Uygulamayı başlat
npm run dev
```

## 📊 Servis Durumlarını Kontrol Et

### PostgreSQL Durumu (macOS):
```bash
brew services list | grep postgresql
```

### PostgreSQL Durumu (Linux):
```bash
sudo systemctl status postgresql
```

### PostgreSQL'e Bağlan:
```bash
psql -d dentops
# VEYA
psql postgresql://postgres@localhost:5432/dentops
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

### PostgreSQL Bağlantı Hatası:

**Hata:** `Error: P1001: Can't reach database server`

**Çözüm:**
```bash
# PostgreSQL'in çalıştığını kontrol et
# macOS:
brew services list | grep postgresql

# Linux:
sudo systemctl status postgresql

# Eğer çalışmıyorsa başlat:
# macOS:
brew services start postgresql@16

# Linux:
sudo systemctl start postgresql
```

### Veritabanı Bulunamadı Hatası:

**Hata:** `Error: P1003: Database "dentops" does not exist`

**Çözüm:**
```bash
# Veritabanını oluştur
createdb dentops

# VEYA psql ile:
psql postgres
CREATE DATABASE dentops;
\q
```

### Port Zaten Kullanılıyorsa:
```bash
# Port'u kullanan process'i bul ve durdur
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
lsof -ti:5432 | xargs kill -9
```

### Prisma Client Hatası:
```bash
# Prisma Client'ı yeniden generate et
npx prisma generate
```

### DATABASE_URL Format Hatası:

Doğru formatlar:
- ✅ `postgresql://postgres@localhost:5432/dentops` (şifresiz)
- ✅ `postgresql://user:password@localhost:5432/dentops` (şifreli)
- ✅ `postgresql://dentops:dentops@localhost:5432/dentops`

Yanlış formatlar:
- ❌ `postgres://...` (postgresql:// olmalı)
- ❌ `localhost/dentops` (port eksik)

## 📝 Önemli Notlar

1. **Her zaman root dizinden çalıştırın** (`DentAIWeb/`)
2. **PostgreSQL çalışıyor olmalı** - Veritabanı olmadan proje çalışmaz
3. **.env dosyası gerekli** - Environment variables olmadan backend başlamaz
4. **İlk kurulumda `db:push` ve `db:seed` çalıştırın** - Veritabanı tabloları oluşturulmalı
5. **Redis ve MinIO gerekli değil** - Şu anda kullanılmıyor

## 🎉 Başarılı Başlatma Kontrol Listesi

- [ ] PostgreSQL kurulu ve çalışıyor
- [ ] `dentops` veritabanı oluşturuldu
- [ ] `npm install` tamamlandı
- [ ] `.env` dosyası oluşturuldu ve dolduruldu
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

# Veritabanını sıfırla (DİKKAT: Tüm veriler silinir!)
npx prisma migrate reset
npm run db:push
npm run db:seed
```

## 💡 İpuçları

### PostgreSQL Şifresini Ayarlamak İsterseniz:

```bash
# psql ile bağlan
psql postgres

# Şifre ayarla
ALTER USER postgres WITH PASSWORD 'yeni-sifre';

# .env dosyasını güncelle
# DATABASE_URL="postgresql://postgres:yeni-sifre@localhost:5432/dentops"
```

### Farklı Bir Veritabanı Adı Kullanmak İsterseniz:

```bash
# Yeni veritabanı oluştur
createdb my_database_name

# .env dosyasını güncelle
# DATABASE_URL="postgresql://postgres@localhost:5432/my_database_name"
```

## 🆚 Docker vs Docker Olmadan

| Özellik | Docker | Docker Olmadan |
|---------|--------|----------------|
| Kurulum | Kolay (docker compose up) | PostgreSQL manuel kurulum |
| İzolasyon | ✅ Tam izolasyon | ❌ Sistem PostgreSQL |
| Performans | Biraz daha yavaş | Daha hızlı |
| Disk Kullanımı | Daha fazla | Daha az |
| Geliştirme | Kolay | Biraz daha karmaşık |
| Production | Önerilir | Manuel yönetim |

**Öneri:** Geliştirme için Docker olmadan, production için Docker kullanın.

