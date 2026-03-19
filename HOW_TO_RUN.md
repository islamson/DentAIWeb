# 🚀 DentAI - Nasıl Başlatılır

## ✅ Proje Yapısı

Bu proje **Next.js DEĞİL**, ayrı Node.js + React projesidir:
- **Backend**: Node.js + Express (port 3001)
- **Frontend**: React + Vite (port 3000)

## 🎯 Backend ve Frontend'i Ayrı Ayrı Başlatma

### Yöntem 1: Root Dizinden (Önerilen)

```bash
# Root dizine git
cd /Users/furkanislamoglu/Desktop/DentAI/DentAIWeb

# Sadece backend başlat
npm run dev:server
# VEYA
cd backend && node server.js

# Sadece frontend başlat (yeni terminal)
npm run dev:client
# VEYA
cd frontend && npm run dev

# İkisini birlikte başlat
npm run dev
```

### Yöntem 2: Ayrı Terminal Pencerelerinde

**Terminal 1 - Backend:**
```bash
cd /Users/furkanislamoglu/Desktop/DentAI/DentAIWeb/backend
node server.js
```

**Terminal 2 - Frontend:**
```bash
cd /Users/furkanislamoglu/Desktop/DentAI/DentAIWeb/frontend
npm run dev
```

## 🛑 Port Kullanımda Hatası

Eğer "address already in use" hatası alırsanız:

```bash
# Port 3001'i kullanan process'i bul ve durdur
lsof -ti:3001 | xargs kill -9

# Port 3000'i kullanan process'i bul ve durdur
lsof -ti:3000 | xargs kill -9

# Tüm Node process'lerini durdur (dikkatli kullanın!)
pkill -f node
```

## 📝 Komutlar Özeti

### Root Dizinden:
```bash
npm run dev          # Backend + Frontend birlikte
npm run dev:server   # Sadece backend
npm run dev:client   # Sadece frontend
```

### Backend Klasöründen:
```bash
cd backend
node server.js       # Backend başlat
```

### Frontend Klasöründen:
```bash
cd frontend
npm run dev          # Frontend başlat
```

## 🔍 Kontrol

- Backend: http://localhost:3001/api/health
- Frontend: http://localhost:3000

## ⚠️ Önemli Notlar

1. **Backend ve Frontend ayrı servislerdir** - Next.js gibi tek bir servis değil
2. **Backend önce başlatılmalı** - Frontend API çağrıları için backend'e ihtiyaç duyar
3. **Portlar sabit**: Backend 3001, Frontend 3000
4. **Vite proxy kullanıyor** - Frontend'den `/api/*` istekleri otomatik olarak backend'e yönlendirilir

