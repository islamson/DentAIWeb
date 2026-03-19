/**
 * Premium AI model stub tools.
 * Schema: schema-premium.prisma (NOT merged - models: CaseAcceptanceScore, PricingRecommendation,
 * DoctorPerformanceMetrics, ChurnRiskScore, AutomatedInteraction, ClinicProfitabilitySnapshot,
 * StaffProductivityScore, ComplianceAuditTrail, PatientPortalAccess, PatientPortalActivity, ClinicalInsight)
 *
 * TODO: When premium schema is merged, implement read-only tools using actual Prisma models.
 * NO write operations. Safe fallback: return contextual message.
 */

const { register } = require('../tool-registry');

const PREMIUM_STUB_MESSAGE = 'Bu özellik premium modülde mevcut. Şu an için veri bulunamadı.';

function createStub(name, description) {
  register({
    name,
    description: `${description} (Premium - stub)`,
    requiredPermission: null,
    async execute() {
      return { message: PREMIUM_STUB_MESSAGE, premium: true };
    },
  });
}

createStub('get_case_acceptance_score', 'CaseAcceptanceScore - treatment plan acceptance score');
createStub('get_pricing_recommendation', 'PricingRecommendation - AI pricing suggestion');
createStub('get_doctor_performance_metrics', 'DoctorPerformanceMetrics - doctor KPIs');
createStub('get_churn_risk_score', 'ChurnRiskScore - patient churn prediction');
createStub('get_automated_interaction', 'AutomatedInteraction - AI interaction log');
createStub('get_clinic_profitability_snapshot', 'ClinicProfitabilitySnapshot - clinic profitability');
createStub('get_staff_productivity_score', 'StaffProductivityScore - staff productivity');
createStub('get_compliance_audit_trail', 'ComplianceAuditTrail - compliance audit');
createStub('get_patient_portal_access', 'PatientPortalAccess - portal access status');
createStub('get_patient_portal_activity', 'PatientPortalActivity - portal activity');
createStub('get_clinical_insight', 'ClinicalInsight - AI clinical insights');
