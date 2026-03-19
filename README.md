# DentAI - Dental Practice Management System

A modern, AI-powered dental practice management system built with Node.js (Express) backend and React frontend.

## 📁 Project Structure

```
DentAIWeb/
├── backend/                 # Backend (Node.js + Express)
│   ├── server.js           # Express server entry point
│   ├── routes/             # API route handlers
│   │   ├── auth.js        # Authentication routes
│   │   ├── patients.js    # Patient management routes
│   │   ├── appointments.js # Appointment routes
│   │   └── ai.js          # AI job routes
│   ├── middleware/        # Express middleware
│   │   └── auth.js        # Authentication middleware
│   └── lib/               # Backend utilities (CommonJS)
│       ├── prisma.js      # Prisma client
│       ├── audit.js        # Audit logging
│       └── ...
│
├── frontend/               # Frontend (React + Vite)
│   ├── src/
│   │   ├── main.jsx       # React entry point
│   │   ├── App.jsx        # Main app component with routes
│   │   ├── pages/         # Page components
│   │   │   ├── app/       # Protected app pages
│   │   │   └── auth/      # Authentication pages
│   │   ├── components/   # Reusable components
│   │   │   ├── ui/        # UI component library
│   │   │   ├── app-header.jsx
│   │   │   └── app-sidebar.jsx
│   │   ├── layouts/       # Layout components
│   │   ├── contexts/      # React contexts
│   │   └── lib/           # Frontend utilities (ES modules)
│   ├── index.html         # HTML template
│   └── vite.config.js     # Vite configuration
│
├── prisma/                # Database schema & migrations
│   ├── schema.prisma
│   └── seed.js
│
└── package.json           # Root package.json (shared dependencies)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL 16+ (local installation OR Docker)

**Note:** Redis and MinIO are optional and not currently used. You can run the project with just PostgreSQL!

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DentAIWeb
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # For local PostgreSQL (no password):
   DATABASE_URL="postgresql://postgres@localhost:5432/dentops"
   
   # OR for local PostgreSQL with password:
   # DATABASE_URL="postgresql://username:password@localhost:5432/dentops"
   
   # OR for Docker PostgreSQL:
   # DATABASE_URL="postgresql://dentops:dentops@localhost:5432/dentops"
   
   SESSION_SECRET="your-secret-key-here"
   CLIENT_URL="http://localhost:3000"
   PORT=3001
   
   # AI Assistant (Ollama) - optional, for local LLM planning
   AI_MODE=auto
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=llama3.1:8b-instruct-q4_K_M
   OLLAMA_TIMEOUT_MS=60000
   ```

4. **Set up PostgreSQL** (choose one method):

   **Option A: Local PostgreSQL (No Docker)**
   ```bash
   # macOS:
   brew install postgresql@16
   brew services start postgresql@16
   createdb dentops
   
   # Linux:
   sudo apt install postgresql
   sudo systemctl start postgresql
   createdb dentops
   
   # Windows: Install from https://www.postgresql.org/download/windows/
   ```

   **Option B: Docker (Optional)**
   ```bash
   docker compose up -d
   ```

5. **Set up database**
   ```bash
   npm run db:push
   npm run db:seed
   ```

5b. **AI Assistant with Ollama (optional)**
   To use the AI Assistant with a local LLM (e.g. Llama 3.1):
   ```bash
   # Install Ollama: https://ollama.ai
   ollama serve          # Start Ollama (or run as background service)
   ollama pull llama3.1:8b-instruct-q4_K_M
   ```
   Set in `.env`:
   - `AI_MODE=auto` – Use LLM when available, fallback to deterministic planner on failure
   - `AI_MODE=llm` – Force LLM only (returns error if Ollama unavailable)
   - `AI_MODE=fallback` – Deterministic planner only (no Ollama)
   - `OLLAMA_BASE_URL=http://127.0.0.1:11434`
   - `OLLAMA_MODEL=llama3.1:8b-instruct-q4_K_M`
   - `OLLAMA_TIMEOUT_MS=60000`

6. **Start development servers**
   
   **Important**: Always run commands from the **root directory** (`DentAIWeb/`), not from `backend/` or `frontend/` subdirectories.
   
   ```bash
   # From root directory (DentAIWeb/)
   npm run dev
   ```
   
   This will start:
   - Backend server on http://localhost:3001
   - Frontend dev server on http://localhost:3000
   
   **Alternative ways to start:**
   ```bash
   # Start only backend
   npm run dev:server
   
   # Start only frontend
   npm run dev:client
   
   # Start production server
   npm start
   ```

## 📜 Available Scripts

- `npm run dev` - Start both backend and frontend in development mode
- `npm run dev:server` - Start only the backend server
- `npm run dev:client` - Start only the frontend dev server
- `npm run build` - Build frontend for production
- `npm run start` - Start production server
- `npm run db:push` - Push Prisma schema to database
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:seed` - Seed database with demo data

## 🚀 Quick Start (Without Docker)

See [START_WITHOUT_DOCKER.md](./START_WITHOUT_DOCKER.md) for detailed instructions on running without Docker.

## 🏗️ Architecture

### Backend
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Express sessions
- **API**: RESTful API design

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Routing**: React Router v6
- **UI Components**: Radix UI + Tailwind CSS
- **State Management**: React Context API

## 🔐 Authentication

The application uses Express sessions for authentication. Users authenticate via `/api/auth/login` and receive a session cookie.

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Get current session

### Patients
- `GET /api/patients` - List patients
- `GET /api/patients/:id` - Get patient details
- `POST /api/patients` - Create patient
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Appointments
- `GET /api/appointments` - List appointments
- `GET /api/appointments/:id` - Get appointment details
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment

### AI Jobs
- `GET /api/ai/jobs` - List AI jobs
- `POST /api/ai/jobs` - Create AI job

## 🛠️ Development

### Code Organization

- **Backend code** lives in `backend/` directory
- **Frontend code** lives in `frontend/src/` directory
- **Shared utilities** can be placed in respective `lib/` directories
- **Database schema** is in `prisma/schema.prisma`

### Adding New Features

1. **Backend Route**: Add new route file in `backend/routes/`
2. **Frontend Page**: Add new page component in `frontend/src/pages/`
3. **Component**: Add reusable component in `frontend/src/components/`
4. **Update Routes**: Add route in `frontend/src/App.jsx`

## 📦 Deployment

### Production Build

```bash
npm run build
npm start
```

The frontend will be built to `frontend/dist/` and the backend server will serve both API and static files.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

[Your License Here]
