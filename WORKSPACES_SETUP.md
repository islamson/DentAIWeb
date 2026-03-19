# npm Workspaces Setup - Complete Guide

## ✅ Migration Complete!

Your project has been successfully migrated to **npm workspaces**. Now you can run the server from `backend/` and the client from `frontend/` directories.

---

## 📁 New Structure

```
DentAIWeb/
├── package.json              # Workspace root (manages workspaces)
├── node_modules/             # Hoisted shared dependencies
├── backend/
│   ├── package.json          # Backend-specific dependencies
│   ├── server.js
│   └── node_modules/         # Backend-specific deps (if any)
└── frontend/
    ├── package.json          # Frontend-specific dependencies
    ├── src/
    └── node_modules/         # Frontend-specific deps (if any)
```

---

## 🚀 How to Run

### Option 1: Run from Package Directories (Your Requested Way)

#### Start Backend Server
```bash
cd backend
npm start
# or
npm run dev
```

#### Start Frontend Client
```bash
cd frontend
npm run dev
```

### Option 2: Run from Root Directory (Still Works!)

#### Start Both
```bash
# From root directory
npm run dev
```

#### Start Individual Services
```bash
# From root directory
npm run dev:server   # Starts backend
npm run dev:client   # Starts frontend
```

---

## 📋 Available Commands

### From Root Directory

```bash
npm run dev              # Start both backend + frontend
npm run dev:server       # Start only backend
npm run dev:client       # Start only frontend
npm start                # Start production backend
npm run build            # Build frontend
npm run db:push          # Push Prisma schema
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database
```

### From Backend Directory

```bash
cd backend
npm start                # Start server
npm run dev              # Start server (dev mode)
npm run db:push          # Push Prisma schema
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database
```

### From Frontend Directory

```bash
cd frontend
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run preview          # Preview production build
```

---

## 🎯 Key Benefits

### ✅ What You Can Do Now

1. **Run from package directories** ✅
   ```bash
   cd backend && npm start
   cd frontend && npm run dev
   ```

2. **Better isolation** ✅
   - Backend dependencies separate from frontend
   - Can have different versions if needed
   - Clearer dependency management

3. **Professional structure** ✅
   - Industry-standard monorepo pattern
   - Used by React, Next.js, and many enterprise projects
   - Scalable architecture

4. **Still works from root** ✅
   - All root scripts still work
   - Convenient for running both services

---

## 📦 Dependency Management

### How Workspaces Work

- **Shared dependencies**: Installed in root `node_modules/` (hoisted)
- **Package-specific**: Installed in package `node_modules/` if different version needed
- **Installation**: Run `npm install` from root (installs all workspaces)

### Adding Dependencies

#### Add to Backend
```bash
cd backend
npm install <package-name>
# or from root
npm install <package-name> --workspace=backend
```

#### Add to Frontend
```bash
cd frontend
npm install <package-name>
# or from root
npm install <package-name> --workspace=frontend
```

#### Add to Root (shared)
```bash
npm install <package-name> -w
```

---

## 🔧 Troubleshooting

### Issue: "Cannot find module" when running from backend/

**Solution**: Make sure you've run `npm install` from root directory first:
```bash
cd /path/to/DentAIWeb  # Root directory
npm install
```

### Issue: Prisma commands not working

**Solution**: Prisma is in backend workspace. Use:
```bash
cd backend
npm run db:push
# or from root
npm run db:push
```

### Issue: Want to reset everything

```bash
# From root directory
rm -rf node_modules backend/node_modules frontend/node_modules package-lock.json
npm install
```

---

## 📚 Workspace Configuration

### Root package.json
```json
{
  "workspaces": [
    "backend",
    "frontend"
  ]
}
```

This tells npm that `backend/` and `frontend/` are workspace packages.

### Backend package.json
- Contains backend-specific dependencies (express, prisma, etc.)
- Has backend scripts (start, dev, db:*)

### Frontend package.json
- Contains frontend-specific dependencies (react, vite, etc.)
- Has frontend scripts (dev, build, preview)

---

## ✨ Summary

**Before**: Single `package.json`, run from root only
**After**: Workspaces, run from anywhere! ✅

**You can now:**
- ✅ `cd backend && npm start`
- ✅ `cd frontend && npm run dev`
- ✅ `npm run dev` (from root, starts both)

Enjoy your professional monorepo setup! 🎉

