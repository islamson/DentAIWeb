const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Import routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const aiRoutes = require('./routes/ai');
const treatmentPlanRoutes = require('./routes/treatment-plans');
const serviceCatalogRoutes = require('./routes/service-catalog');
const tasksRoutes = require('./routes/tasks');
const activityLogRoutes = require('./routes/activity-log');
const scheduleRoutes = require('./routes/schedule');
const billingRoutes = require('./routes/billing');
const patientNotesRoutes = require('./routes/patient-notes');
const patientCommunicationsRoutes = require('./routes/patient-communications');
const patientFormsRoutes = require('./routes/patient-forms');
const perioRoutes = require('./routes/perio');
const documentsRoutes = require('./routes/documents');
const currentAccountRoutes = require('./routes/current-account');
const bankAccountRoutes = require('./routes/bank-accounts');
const inventoryRoutes = require('./routes/inventory');
const laboratoryRoutes = require('./routes/laboratory');
const reportsRoutes = require('./routes/reports');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);

// Nested patient sub-routes
app.use('/api/patients/:patientId/notes', patientNotesRoutes);
app.use('/api/patients/:patientId/communications', patientCommunicationsRoutes);
app.use('/api/patients/:patientId/forms', patientFormsRoutes);
app.use('/api/patients/:patientId/perio', perioRoutes);
app.use('/api/patients/:patientId/documents', documentsRoutes);

// Serve uploaded files
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use('/api/appointments', appointmentRoutes);
app.use('/api/treatment-plans', treatmentPlanRoutes);
app.use('/api/service-catalog', serviceCatalogRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/activity-log', activityLogRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/current-accounts', currentAccountRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/laboratory', laboratoryRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    const { checkOllamaModel } = require('./lib/ai/ollama');
    await checkOllamaModel();
  } catch {
    // Non-fatal
  }
});
