import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/app/DashboardPage';
import PatientsPage from './pages/app/PatientsPage';
import PatientDetailPage from './pages/app/PatientDetailPage';
import AppointmentsPage from './pages/app/AppointmentsPage';
import TreatmentsPage from './pages/app/TreatmentsPage';
import FinanceLayout from './layouts/FinanceLayout';
import FinanceOverviewPage from './pages/app/FinanceOverviewPage';
import FinanceMovementsPage from './pages/app/FinanceMovementsPage';
import FinanceCariPage from './pages/app/FinanceCariPage';
import FinanceCariDetailPage from './pages/app/FinanceCariDetailPage';
import FinanceInvoicesPage from './pages/app/FinanceInvoicesPage';
import FinancePaymentPlansPage from './pages/app/FinancePaymentPlansPage';
import FinancePendingCollectionsPage from './pages/app/FinancePendingCollectionsPage';
import FinancePreAccountingPage from './pages/app/FinancePreAccountingPage';
import FinancePatientIncomePage from './pages/app/FinancePatientIncomePage';
import FinancePatientRefundsPage from './pages/app/FinancePatientRefundsPage';
import FinanceDebtorPatientsPage from './pages/app/FinanceDebtorPatientsPage';
import FinanceDebtorTreatmentsPage from './pages/app/FinanceDebtorTreatmentsPage';
import FinancePatientCreditsPage from './pages/app/FinancePatientCreditsPage';
import FinanceBankTransactionsPage from './pages/app/FinanceBankTransactionsPage';
import FinanceEndOfDayPage from './pages/app/FinanceEndOfDayPage';
import StockLayout from './layouts/StockLayout';
import StockManagementPage from './pages/app/StockManagementPage';
import StockRequestsPage from './pages/app/StockRequestsPage';
import LaboratoriesPage from './pages/app/LaboratoriesPage';
import LaboratoryDetailsPage from './pages/app/LaboratoryDetailsPage';
import DocumentsPage from './pages/app/DocumentsPage';
import CommunicationsPage from './pages/app/CommunicationsPage';
import ReportsLayout from './layouts/ReportsLayout';
import ReportsLandingPage from './pages/app/reports/ReportsLandingPage';
import ReportDetailPage from './pages/app/reports/ReportDetailPage';
import SettingsPage from './pages/app/SettingsPage';
import StockSettingsPage from './pages/app/StockSettingsPage';
import OwnerPage from './pages/app/OwnerPage';
import AIPage from './pages/app/AIPage';
import PremiumAIPage from './pages/app/PremiumAIPage';
import { REPORT_DEFINITIONS } from './features/reports/reportRegistry';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Yükleniyor...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          } />

          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout>
                <Navigate to="/dashboard" replace />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/patients" element={
            <ProtectedRoute>
              <AppLayout>
                <PatientsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/patients/:id" element={
            <ProtectedRoute>
              <AppLayout>
                <PatientDetailPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/appointments" element={
            <ProtectedRoute>
              <AppLayout>
                <AppointmentsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/treatments" element={
            <ProtectedRoute>
              <AppLayout>
                <TreatmentsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/billing" element={<Navigate to="/finance" replace />} />
          <Route path="/finance" element={
            <ProtectedRoute>
              <AppLayout>
                <FinanceLayout />
              </AppLayout>
            </ProtectedRoute>
          }>
            <Route index element={<FinanceOverviewPage />} />
            <Route path="movements" element={<FinanceMovementsPage />} />
            <Route path="current-accounts" element={<FinanceCariPage />} />
            <Route path="current-accounts/:id" element={<FinanceCariDetailPage />} />
            <Route path="invoices" element={<FinanceInvoicesPage />} />
            <Route path="payment-plans" element={<FinancePaymentPlansPage />} />
            <Route path="pending" element={<FinancePendingCollectionsPage />} />
            <Route path="pre-accounting" element={<FinancePreAccountingPage />} />
            <Route path="patient-income" element={<FinancePatientIncomePage />} />
            <Route path="patient-refunds" element={<FinancePatientRefundsPage />} />
            <Route path="debtor-patients" element={<FinanceDebtorPatientsPage />} />
            <Route path="debtor-treatments" element={<FinanceDebtorTreatmentsPage />} />
            <Route path="patient-credits" element={<FinancePatientCreditsPage />} />
            <Route path="bank-transactions" element={<FinanceBankTransactionsPage />} />
            <Route path="end-of-day" element={<FinanceEndOfDayPage />} />
          </Route>

          <Route path="/inventory" element={
            <ProtectedRoute>
              <AppLayout>
                <StockLayout />
              </AppLayout>
            </ProtectedRoute>
          }>
            <Route index element={<StockManagementPage />} />
            <Route path="requests" element={<StockRequestsPage />} />
            <Route path="laboratories" element={<LaboratoriesPage />} />
            <Route path="lab-details" element={<LaboratoryDetailsPage />} />
          </Route>

          <Route path="/documents" element={
            <ProtectedRoute>
              <AppLayout>
                <DocumentsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/communications" element={
            <ProtectedRoute>
              <AppLayout>
                <CommunicationsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/reports" element={
            <ProtectedRoute>
              <AppLayout>
                <ReportsLayout />
              </AppLayout>
            </ProtectedRoute>
          }>
            <Route index element={<ReportsLandingPage />} />
            {REPORT_DEFINITIONS.map((report) => (
              <Route
                key={report.slug}
                path={report.slug}
                element={<ReportDetailPage report={report} />}
              />
            ))}
          </Route>

          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings/stock" element={
            <ProtectedRoute>
              <AppLayout>
                <StockSettingsPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/owner" element={
            <ProtectedRoute>
              <AppLayout>
                <OwnerPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/ai" element={
            <ProtectedRoute>
              <AppLayout>
                <AIPage />
              </AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/ai/premium" element={
            <ProtectedRoute>
              <AppLayout>
                <PremiumAIPage />
              </AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

