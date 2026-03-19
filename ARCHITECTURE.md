# Architecture Guide: Frontend vs Backend Separation

## 🎯 Why Separate `lib/` Directories?

You're absolutely right to question this! Here's why we have separate `lib/` directories and what belongs where:

## 📂 Backend `lib/` Directory

**Location**: `backend/lib/`

**Purpose**: Server-side utilities that run on Node.js

**Files**:
- ✅ `prisma.js` - Database client (Prisma runs ONLY on server)
- ✅ `audit.js` - Server-side audit logging
- ✅ `rbac.js` - Server-side permission checks (authoritative)
- ✅ `utils.js` - Server-side utilities (if needed)

**Why**: These files use Node.js APIs, database connections, and server-only features.

---

## 📂 Frontend `lib/` Directory

**Location**: `frontend/src/lib/`

**Purpose**: Client-side utilities that run in the browser

**Files**:
- ✅ `utils.js` - **UI formatting functions** (formatCurrency, formatDate, etc.)
- ✅ `rbac.js` - **UI permission checks** (for showing/hiding buttons, NOT security)

**Why**: These are pure JavaScript functions that format data for display or check permissions for UI rendering.

---

## ❌ What Should NOT Be in Frontend

### 1. **`prisma.js`** ❌
```javascript
// ❌ WRONG - Prisma cannot run in browser
import { prisma } from '../lib/prisma';
```

**Why**: Prisma is a Node.js library that connects to databases. Browsers cannot:
- Connect directly to databases
- Use Node.js modules
- Access server-side resources

**Solution**: Frontend calls API endpoints, backend uses Prisma.

### 2. **`auth.js` (NextAuth config)** ❌
```javascript
// ❌ WRONG - Server-side auth config
import { authOptions } from '../lib/auth';
```

**Why**: Authentication configuration belongs on the server. Frontend only handles:
- Login forms
- Session state (via React Context)
- API calls to `/api/auth/*`

### 3. **`api-auth.js`** ❌
```javascript
// ❌ WRONG - Server-side API authentication
import { getApiSession } from '../lib/api-auth';
```

**Why**: API authentication happens on the server. Frontend just sends requests with credentials.

### 4. **`audit.js` (server implementation)** ❌
```javascript
// ❌ WRONG - Direct database access from frontend
import { createAuditLog } from '../lib/audit';
await createAuditLog({ ... }); // Tries to write to DB directly
```

**Why**: Audit logging should go through the API. Frontend can call `/api/audit` but shouldn't write directly to the database.

---

## ✅ What SHOULD Be in Frontend

### 1. **`utils.js`** ✅
```javascript
// ✅ CORRECT - Pure formatting functions
export function formatCurrency(amountInKurus) {
  const amount = amountInKurus / 100;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}
```

**Why**: These are pure JavaScript functions that format data for display. No server dependencies.

### 2. **`rbac.js` (UI-only)** ✅
```javascript
// ✅ CORRECT - UI permission checks (NOT security)
export const roleLabels = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  // ...
};

// Used to show/hide UI elements
{can(user.role, 'PATIENT_WRITE') && <Button>Create Patient</Button>}
```

**Why**: 
- **Frontend RBAC**: Controls UI visibility (UX optimization)
- **Backend RBAC**: Enforces actual security (authoritative)

**Important**: Frontend permission checks are for UX only. Backend always validates permissions.

---

## 🔄 Data Flow Example

### ❌ Wrong Approach:
```javascript
// Frontend trying to use Prisma directly
import { prisma } from '../lib/prisma';
const patients = await prisma.patient.findMany(); // ❌ Won't work!
```

### ✅ Correct Approach:
```javascript
// Frontend calls API
const response = await fetch('/api/patients');
const { patients } = await response.json();

// Backend uses Prisma
const patients = await prisma.patient.findMany();
```

---

## 🛡️ Security Principle

**Frontend = Presentation Layer**
- Formats data for display
- Controls UI visibility
- Sends requests to backend

**Backend = Business Logic & Security**
- Validates all requests
- Enforces permissions
- Accesses database
- Performs business logic

**Rule**: Never trust the frontend. Always validate on the backend.

---

## 📋 Summary

| File | Backend | Frontend | Reason |
|------|---------|----------|--------|
| `prisma.js` | ✅ | ❌ | Database client (server-only) |
| `audit.js` | ✅ | ❌ | Direct DB writes (server-only) |
| `auth.js` | ✅ | ❌ | Auth config (server-only) |
| `api-auth.js` | ✅ | ❌ | API auth (server-only) |
| `rbac.js` | ✅ | ✅ | Backend: security, Frontend: UI |
| `utils.js` | ✅ | ✅ | Both: formatting functions |

---

## 🎓 Key Takeaway

**Frontend `lib/` should only contain:**
1. Pure JavaScript functions (no Node.js APIs)
2. UI formatting utilities
3. Client-side permission checks (for UX, not security)

**Backend `lib/` contains:**
1. Database access (Prisma)
2. Server-side business logic
3. Authoritative permission checks
4. Server-side utilities

This separation ensures:
- ✅ Clear boundaries
- ✅ Better security
- ✅ Easier maintenance
- ✅ Proper architecture

