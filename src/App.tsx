import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import apiClient from './api/apiClient';

// Auth Components
import RoleSelection from './pages/auth/RoleSelection';
import AuthPage from './pages/auth/AuthPage';
import RoleRoute from './components/auth/RoleRoute';
import { AuthProvider } from './context/AuthContext';

// Layouts
import PatientLayout from './layouts/PatientLayout';
import PharmacyLayout from './layouts/PharmacyLayout';

// Patient Dashboards & Features
import PatientDashboard from './pages/patient/Dashboard';
import HomePage from './pages/HomePage'; // Medicine Listing
import AuthenticityChecker from './components/features/AuthenticityChecker';
import HealthAssistant from './pages/patient/HealthAssistant';
import PersonalHealthTracker from './components/features/PersonalHealthTracker';
import SmartReminders from './components/features/SmartReminders';
import MedicineComparison from './components/features/MedicineComparison';
import PrescriptionUpload from './components/prescriptions/PrescriptionUpload';
import PatientCart from './pages/patient/Cart';
import PatientOrders from './pages/patient/Orders';
import DoctorConsult from './pages/patient/DoctorConsult';
import NearbyMedicines from './pages/patient/NearbyMedicines';
import HealthRecords from './pages/patient/HealthRecords';

// Pharmacy Dashboards & Features
import PharmacyDashboard from './pages/pharmacy/Dashboard';
import PharmacyInventory from './pages/pharmacy/Inventory';
import PharmacyOrders from './pages/pharmacy/Orders';
import BlockchainLedger from './pages/pharmacy/BlockchainLedger';
import ExpiryRisk from './pages/pharmacy/ExpiryRisk';
import StockRisk from './pages/pharmacy/StockRisk';
import PrescriptionQueue from './pages/pharmacy/PrescriptionQueue';
import OperationsIntelligence from './pages/pharmacy/OperationsIntelligence';
import WorkflowCenter from './pages/pharmacy/WorkflowCenter';
import SaaSAdminDashboard from './pages/admin/SaaSAdminDashboard';
import OrganizationSettings from './pages/pharmacy/OrganizationSettings';

// Research
import ResearchDashboard from './pages/research/ResearchDashboard';
import KnowledgeGraphExplorer from './pages/research/KnowledgeGraphExplorer';
import AISafetyDashboard from './pages/research/AISafetyDashboard';
import PatientIntelligence from './pages/patient/PatientIntelligence';

// Settings
import AccessibilitySettings from './pages/settings/AccessibilitySettings';
import { useAccessibilityStore } from './stores/accessibilityStore';

// TrustRAG Verification Pages (Work Order 3B)
import { CasesListPage } from './modules/verification/pages/CasesListPage';
import { CreateCaseWizardPage } from './modules/verification/pages/CreateCaseWizardPage';
import { CaseDetailPage } from './modules/verification/pages/CaseDetailPage';
import { ReviewQueuePage } from './modules/verification/pages/ReviewQueuePage';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/" element={<Navigate to="/auth" replace />} />
      <Route path="/auth" element={<RoleSelection />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />

      {/* Patient Protected Routes */}
      <Route
        path="/patient"
        element={
          <RoleRoute allowedRole="patient">
            <PatientLayout />
          </RoleRoute>
        }
      >
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="medicines" element={<HomePage />} />
        <Route path="authenticity" element={<AuthenticityChecker />} />
        <Route path="health-assistant" element={<HealthAssistant />} />
        <Route path="health-tracker" element={<PersonalHealthTracker />} />
        <Route path="reminders" element={<SmartReminders />} />
        <Route path="comparisons" element={<MedicineComparison />} />
        <Route path="prescriptions" element={<PrescriptionUpload />} />
        <Route path="cart" element={<PatientCart />} />
        <Route path="orders" element={<PatientOrders />} />
        <Route path="doctor-consult" element={<DoctorConsult />} />
        <Route path="nearby-medicines" element={<NearbyMedicines />} />
        <Route path="health-records" element={<HealthRecords />} />
        <Route path="intelligence" element={<PatientIntelligence />} />
        <Route path="accessibility" element={<AccessibilitySettings />} />
        <Route index element={<Navigate to="/patient/dashboard" replace />} />
      </Route>

      {/* Pharmacy Protected Routes */}
      <Route
        path="/pharmacy"
        element={
          <RoleRoute allowedRole="pharmacy">
            <PharmacyLayout />
          </RoleRoute>
        }
      >
        <Route path="dashboard" element={<PharmacyDashboard />} />
        <Route path="inventory" element={<PharmacyInventory />} />
        <Route path="orders" element={<PharmacyOrders />} />
        <Route path="blockchain" element={<BlockchainLedger />} />
        <Route path="expiry-risk" element={<ExpiryRisk />} />
        <Route path="stock-risk" element={<StockRisk />} />
        <Route path="prescription-queue" element={<PrescriptionQueue />} />
        <Route path="operations-intelligence" element={<OperationsIntelligence />} />
        <Route path="workflow-center" element={<WorkflowCenter />} />
        <Route path="organization-settings" element={<OrganizationSettings />} />
        <Route path="accessibility" element={<AccessibilitySettings />} />
        <Route index element={<Navigate to="/pharmacy/dashboard" replace />} />
      </Route>

      {/* Research & Evaluation Route */}
      <Route path="/research/dashboard" element={<ResearchDashboard />} />
      <Route path="/research/knowledge-graph" element={<KnowledgeGraphExplorer />} />
      <Route path="/research/ai-safety" element={<AISafetyDashboard />} />

      {/* TrustRAG Verification Routes (Work Order 3B) */}
      <Route
        path="/cases"
        element={
          <RoleRoute allowedRoles={['patient', 'pharmacy', 'pharmacist', 'claims_reviewer', 'org_admin', 'super_admin']}>
            <CasesListPage />
          </RoleRoute>
        }
      />
      <Route
        path="/cases/new"
        element={
          <RoleRoute allowedRoles={['patient', 'pharmacy', 'pharmacist', 'claims_reviewer', 'org_admin', 'super_admin']}>
            <CreateCaseWizardPage />
          </RoleRoute>
        }
      />
      <Route
        path="/cases/:caseId"
        element={
          <RoleRoute allowedRoles={['patient', 'pharmacy', 'pharmacist', 'claims_reviewer', 'org_admin', 'super_admin']}>
            <CaseDetailPage />
          </RoleRoute>
        }
      />
      <Route
        path="/review-queue"
        element={
          <RoleRoute allowedRoles={['pharmacy', 'pharmacist', 'claims_reviewer', 'org_admin', 'super_admin']}>
            <ReviewQueuePage />
          </RoleRoute>
        }
      />

      {/* Catch-all */}
      {/* Super Admin Routes */}
      <Route path="/admin" element={<PharmacyLayout />}>
        <Route path="saas" element={<SaaSAdminDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
};

function App() {
  const [serverReachable, setServerReachable] = useState(true);
  const { highContrast, largeText } = useAccessibilityStore();

  useEffect(() => {
    // Check initial health
    const checkServer = async () => {
      try {
        await apiClient.get('/health');
        setServerReachable(true);
      } catch (error) {
        console.error("Server health check failed:", error);
        setServerReachable(false);
      }
    };
    checkServer();
  }, []);

  return (
    <div className={`${highContrast ? 'grayscale contrast-125 bg-black' : 'bg-slate-50'} ${largeText ? 'text-lg' : 'text-base'}`}>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff' } }} />
        {!serverReachable && (
          <div className="bg-red-600 text-white text-sm font-bold p-3 text-center sticky top-0 z-[9999] flex items-center justify-center gap-2 shadow-md">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Server not reachable: Backend API connection failed. Please check if the server is running on port 5001.
          </div>
        )}
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </div>
  );
}

export default App;