# Quick Start Guide

## ⚠️ Important: Always Run from Root Directory

**Always run npm commands from the root directory** (`DentAIWeb/`), not from `backend/` or `frontend/` subdirectories.

The `node_modules` folder is in the root directory, so Node.js needs to resolve modules from there.

## 🚀 Starting the Application

### Option 1: Start Both Backend and Frontend (Recommended)

```bash
# Make sure you're in the root directory
cd /Users/furkanislamoglu/Desktop/DentAI/DentAIWeb

# Start both servers
npm run dev
```

This starts:
- ✅ Backend server: http://localhost:3001
- ✅ Frontend dev server: http://localhost:3000

### Option 2: Start Backend Only

```bash
# From root directory
npm run dev:server
```

### Option 3: Start Frontend Only

```bash
# From root directory
npm run dev:client
```

## ❌ Common Mistakes

### ❌ Wrong: Running from backend directory
```bash
cd backend
node server.js  # ❌ Error: Cannot find module 'express'
```

### ✅ Correct: Running from root directory
```bash
# From root directory
npm run dev:server  # ✅ Works!
```

Or if you want to use node directly:
```bash
# From root directory
node backend/server.js  # ✅ Works!
```

## 📁 Project Structure

```
DentAIWeb/                    ← Run commands from HERE
├── node_modules/            ← Dependencies are here
├── backend/
│   └── server.js           ← Server file
├── frontend/
│   └── src/                ← Frontend code
└── package.json            ← Root package.json
```

## 🔧 Troubleshooting

### Error: "Cannot find module 'express'"

**Cause**: Running from `backend/` directory instead of root.

**Solution**: 
```bash
cd /Users/furkanislamoglu/Desktop/DentAI/DentAIWeb  # Go to root
npm run dev:server  # Use npm script
```

### Error: "Cannot find module" (any module)

**Cause**: Dependencies not installed or running from wrong directory.

**Solution**:
```bash
# Make sure you're in root directory
cd /Users/furkanislamoglu/Desktop/DentAI/DentAIWeb

# Install dependencies
npm install

# Then run
npm run dev
```

## 📝 Why This Structure?

We use a **monorepo** structure where:
- ✅ All dependencies are in root `node_modules/` (shared)
- ✅ Backend code is in `backend/` directory
- ✅ Frontend code is in `frontend/` directory
- ✅ Commands run from root to access shared dependencies

This is cleaner than having separate `node_modules` in each directory.

