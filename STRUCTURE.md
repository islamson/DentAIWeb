# Project Structure Overview

## 📂 Directory Structure

```
DentAIWeb/
│
├── backend/                          # Backend Application (Node.js + Express)
│   ├── server.js                     # Express server entry point
│   │
│   ├── routes/                       # API Route Handlers
│   │   ├── auth.js                  # Authentication endpoints
│   │   ├── patients.js              # Patient CRUD operations
│   │   ├── appointments.js          # Appointment management
│   │   └── ai.js                    # AI job processing
│   │
│   ├── middleware/                  # Express Middleware
│   │   └── auth.js                  # Authentication & authorization middleware
│   │
│   └── lib/                         # Backend Utilities (CommonJS)
│       ├── prisma.js                # Prisma client instance
│       ├── audit.js                 # Audit logging functions
│       ├── rbac.js                  # Role-based access control
│       └── utils.js                 # Utility functions
│
├── frontend/                        # Frontend Application (React + Vite)
│   ├── src/
│   │   ├── main.jsx                 # React application entry point
│   │   ├── App.jsx                  # Main app component with routing
│   │   ├── index.css                # Global styles
│   │   │
│   │   ├── pages/                   # Page Components
│   │   │   ├── app/                 # Protected application pages
│   │   │   │   ├── DashboardPage.jsx
│   │   │   │   ├── PatientsPage.jsx
│   │   │   │   ├── PatientDetailPage.jsx
│   │   │   │   ├── AppointmentsPage.jsx
│   │   │   │   ├── TreatmentsPage.jsx
│   │   │   │   ├── BillingPage.jsx
│   │   │   │   ├── InventoryPage.jsx
│   │   │   │   ├── DocumentsPage.jsx
│   │   │   │   ├── CommunicationsPage.jsx
│   │   │   │   ├── ReportsPage.jsx
│   │   │   │   ├── SettingsPage.jsx
│   │   │   │   ├── OwnerPage.jsx
│   │   │   │   ├── AIPage.jsx
│   │   │   │   └── PremiumAIPage.jsx
│   │   │   │
│   │   │   └── auth/                # Authentication pages
│   │   │       └── LoginPage.jsx
│   │   │
│   │   ├── components/              # Reusable Components
│   │   │   ├── ui/                  # UI Component Library (shadcn/ui)
│   │   │   │   ├── button.jsx
│   │   │   │   ├── card.jsx
│   │   │   │   ├── input.jsx
│   │   │   │   ├── dialog.jsx
│   │   │   │   ├── badge.jsx
│   │   │   │   ├── avatar.jsx
│   │   │   │   ├── label.jsx
│   │   │   │   ├── separator.jsx
│   │   │   │   └── dropdown-menu.jsx
│   │   │   │
│   │   │   ├── app-header.jsx       # Application header component
│   │   │   └── app-sidebar.jsx      # Application sidebar navigation
│   │   │
│   │   ├── layouts/                 # Layout Components
│   │   │   ├── AppLayout.jsx        # Main app layout (with sidebar & header)
│   │   │   └── AuthLayout.jsx       # Authentication layout
│   │   │
│   │   ├── contexts/                # React Context Providers
│   │   │   └── AuthContext.jsx      # Authentication context
│   │   │
│   │   └── lib/                    # Frontend Utilities (ES Modules)
│   │       ├── utils.js            # Utility functions
│   │       ├── rbac.js             # Role-based access control (frontend)
│   │       └── ...
│   │
│   ├── index.html                   # HTML template
│   ├── vite.config.js               # Vite configuration
│   └── public/                      # Static assets
│
├── prisma/                          # Database Schema & Migrations
│   ├── schema.prisma               # Prisma schema definition
│   ├── schema-premium.prisma       # Premium features schema
│   └── seed.js                     # Database seeding script
│
├── .gitignore                       # Git ignore rules
├── package.json                     # Root package.json (shared dependencies)
├── tailwind.config.js              # Tailwind CSS configuration
├── postcss.config.mjs              # PostCSS configuration
└── README.md                        # Project documentation
```

## 🎯 Key Principles

### Separation of Concerns
- **Backend**: All server-side code in `backend/`
- **Frontend**: All client-side code in `frontend/`
- **Shared**: Database schema in `prisma/` (used by both)

### Module Systems
- **Backend**: CommonJS (`require`/`module.exports`)
- **Frontend**: ES Modules (`import`/`export`)

### File Naming Conventions
- **Components**: PascalCase (e.g., `DashboardPage.jsx`)
- **Utilities**: camelCase (e.g., `utils.js`)
- **Routes**: kebab-case (e.g., `auth.js`)

### Import Paths
- **Frontend**: Use relative paths (`../components/...`)
- **Backend**: Use relative paths (`../lib/...`)
- **Vite alias**: `@` maps to `frontend/src/` (for frontend only)

## 🔄 Data Flow

```
Frontend (React)          Backend (Express)          Database (PostgreSQL)
     │                            │                           │
     │  HTTP Request              │                           │
     ├───────────────────────────>│                           │
     │                            │  Prisma Query             │
     │                            ├──────────────────────────>│
     │                            │                           │
     │                            │  Response                 │
     │                            │<──────────────────────────┤
     │  HTTP Response             │                           │
     │<───────────────────────────┤                           │
```

## 📝 Adding New Features

### Adding a New Backend Route
1. Create route file: `backend/routes/feature.js`
2. Import in `backend/server.js`: `const featureRoutes = require('./routes/feature');`
3. Mount route: `app.use('/api/feature', featureRoutes);`

### Adding a New Frontend Page
1. Create page: `frontend/src/pages/app/NewPage.jsx`
2. Import in `frontend/src/App.jsx`
3. Add route: `<Route path="/new-page" element={<ProtectedRoute><AppLayout><NewPage /></AppLayout></ProtectedRoute>} />`

### Adding a New Component
1. Create component: `frontend/src/components/NewComponent.jsx`
2. Import where needed: `import NewComponent from '../components/NewComponent';`

## 🚀 Development Workflow

1. **Start Backend**: `npm run dev:server` (port 3001)
2. **Start Frontend**: `npm run dev:client` (port 3000)
3. **Or Both**: `npm run dev` (uses concurrently)

## 📦 Build & Deploy

- **Frontend Build**: `npm run build` → outputs to `frontend/dist/`
- **Production**: `npm start` → runs backend server

