import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  BriefcaseMedical,
  CalendarCheck2,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Coins,
  FileClock,
  Gauge,
  PackageSearch,
  Receipt,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

export const REPORT_CATEGORIES = [
  { id: "overview", label: "Overview", description: "Executive and operational snapshots." },
  { id: "financial", label: "Financial Reports", description: "Revenue, debt, expenses and commissions." },
  { id: "treatments", label: "Treatment Reports", description: "Production, completion and monitoring." },
  { id: "appointments", label: "Appointment Reports", description: "Capacity, attendance and efficiency." },
  { id: "stock-lab", label: "Stock & Laboratory Reports", description: "Material and movement analytics." },
  { id: "staff", label: "Staff Reports", description: "Working hours and staff activity." },
  { id: "patients", label: "Patient Reports", description: "Growth, churn and patient behavior." },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Nakit" },
  { value: "CARD", label: "Kart" },
  { value: "BANK_TRANSFER", label: "Banka Transferi" },
  { value: "ONLINE", label: "Online" },
  { value: "OTHER", label: "Diğer" },
];

const APPOINTMENT_STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "Planlandı" },
  { value: "CONFIRMED", label: "Onaylandı" },
  { value: "ARRIVED", label: "Geldi" },
  { value: "IN_PROGRESS", label: "İşlemde" },
  { value: "COMPLETED", label: "Tamamlandı" },
  { value: "CANCELLED", label: "İptal" },
  { value: "NOSHOW", label: "Gelmedi" },
];

const TREATMENT_STATUS_OPTIONS = [
  { value: "PLANNED", label: "Planlandı" },
  { value: "IN_PROGRESS", label: "Devam Ediyor" },
  { value: "COMPLETED", label: "Tamamlandı" },
  { value: "CANCELLED", label: "İptal" },
];

const STOCK_MOVEMENT_OPTIONS = [
  { value: "IN", label: "Giriş" },
  { value: "OUT", label: "Çıkış" },
  { value: "ADJUST", label: "Düzeltme" },
  { value: "RETURN", label: "İade" },
];

const COMMON_DATE_FILTERS = [
  { key: "dateFrom", type: "date", label: "Başlangıç" },
  { key: "dateTo", type: "date", label: "Bitiş" },
];

const COMMON_SEARCH_FILTER = {
  key: "search",
  type: "search",
  label: "Ara",
  placeholder: "Hasta, hekim, açıklama veya referans ara...",
};

const DOCTOR_FILTER = {
  key: "doctorId",
  type: "select",
  label: "Hekim",
  optionsKey: "doctors",
};

const PATIENT_FILTER = {
  key: "patientId",
  type: "select",
  label: "Hasta",
  optionsKey: "patients",
};

const INSTITUTION_FILTER = {
  key: "institutionId",
  type: "select",
  label: "Kurum / Cari",
  optionsKey: "institutions",
};

const BRANCH_FILTER = {
  key: "branchId",
  type: "select",
  label: "Şube",
  optionsKey: "branches",
};

const PAYMENT_FILTER = {
  key: "paymentMethod",
  type: "select",
  label: "Ödeme Türü",
  options: PAYMENT_METHOD_OPTIONS,
};

const APPOINTMENT_STATUS_FILTER = {
  key: "appointmentStatus",
  type: "select",
  label: "Randevu Durumu",
  options: APPOINTMENT_STATUS_OPTIONS,
};

const TREATMENT_STATUS_FILTER = {
  key: "treatmentStatus",
  type: "select",
  label: "Tedavi Durumu",
  options: TREATMENT_STATUS_OPTIONS,
};

const STOCK_MOVEMENT_FILTER = {
  key: "stockType",
  type: "select",
  label: "Hareket Tipi",
  options: STOCK_MOVEMENT_OPTIONS,
};

const DAYS_FILTER = {
  key: "days",
  type: "number",
  label: "Gün",
  min: 1,
  max: 3650,
  placeholder: "90",
};

const COMMISSION_PAYMENT_FILTERS = [
  {
    key: "paymentRate",
    type: "number",
    label: "Tahsilat Oranı (%)",
    min: 0,
    max: 100,
    step: 0.1,
    placeholder: "0",
  },
  {
    key: "treatmentRate",
    type: "number",
    label: "Tedavi Oranı (%)",
    min: 0,
    max: 100,
    step: 0.1,
    placeholder: "0",
  },
];

const COMMISSION_SINGLE_RATE_FILTER = {
  key: "commissionRate",
  type: "number",
  label: "Komisyon Oranı (%)",
  min: 0,
  max: 100,
  step: 0.1,
  placeholder: "0",
};

function createReport(config) {
  return {
    accent: "from-cyan-500 via-sky-500 to-blue-600",
    defaultSortBy: "date",
    defaultSortOrder: "desc",
    pageSize: 20,
    filters: [],
    ...config,
  };
}

export const REPORT_DEFINITIONS = [
  createReport({
    id: "general-overview",
    slug: "general-overview",
    title: "General Overview",
    description: "Financial, operational and patient performance in one premium overview.",
    category: "overview",
    icon: Gauge,
    accent: "from-blue-500 via-cyan-500 to-indigo-600",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, BRANCH_FILTER, PAYMENT_FILTER, INSTITUTION_FILTER],
    tableColumns: [
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "appointmentCount", label: "Randevu", format: "number", sortable: true, align: "right" },
      { key: "completionRate", label: "Tamamlama", format: "percent", sortable: true, align: "right" },
      { key: "treatmentProduction", label: "Tedavi Üretimi", format: "currency", sortable: true, align: "right" },
      { key: "collectedAmount", label: "Tahsilat", format: "currency", sortable: true, align: "right" },
      { key: "outstandingDebt", label: "Kalan Borç", format: "currency", sortable: true, align: "right", toneFromValue: true },
      { key: "newPatients", label: "Yeni Hasta", format: "number", sortable: true, align: "right" },
      { key: "stockMovementCount", label: "Stok Hrk.", format: "number", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "end-of-day",
    slug: "end-of-day",
    title: "End of Day Report",
    description: "Chronological daily closing report across appointments, treatments and finance.",
    category: "financial",
    icon: CalendarCheck2,
    accent: "from-emerald-500 via-green-500 to-teal-600",
    defaultSortBy: "occurredAt",
    filters: [...COMMON_DATE_FILTERS, DOCTOR_FILTER, PAYMENT_FILTER, BRANCH_FILTER],
    tableColumns: [
      { key: "occurredAt", label: "Saat / Tarih", format: "dateTime", sortable: true },
      { key: "activityType", label: "Aktivite", format: "badge", sortable: true },
      { key: "patientName", label: "Hasta", sortable: true },
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "description", label: "Açıklama", sortable: true },
      { key: "paymentMethod", label: "Ödeme Türü", format: "badge", sortable: true },
      { key: "amount", label: "Tutar", format: "currency", sortable: true, align: "right", toneFromValue: true },
      { key: "status", label: "Durum", format: "badge", sortable: true },
    ],
  }),
  createReport({
    id: "collection-analytics",
    slug: "collection-analytics",
    title: "Collection Analytics",
    description: "Collection trends, payment mix and invoice settlement analytics.",
    category: "financial",
    icon: TrendingUp,
    accent: "from-emerald-500 via-lime-500 to-green-600",
    defaultSortBy: "paidAt",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, PAYMENT_FILTER, PATIENT_FILTER, INSTITUTION_FILTER],
    tableColumns: [
      { key: "paidAt", label: "Ödeme Tarihi", format: "dateTime", sortable: true },
      { key: "patientName", label: "Hasta", sortable: true },
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "invoiceNumber", label: "Fatura", sortable: true },
      { key: "paymentMethod", label: "Yöntem", format: "badge", sortable: true },
      { key: "amount", label: "Tahsilat", format: "currency", sortable: true, align: "right" },
      { key: "vatRate", label: "KDV", format: "percent", sortable: true, align: "right" },
      { key: "reference", label: "Referans", sortable: true },
    ],
  }),
  createReport({
    id: "expense-report",
    slug: "expense-report",
    title: "Expense Report",
    description: "Expense and outflow movements tied to current accounts and finance records.",
    category: "financial",
    icon: Receipt,
    accent: "from-rose-500 via-red-500 to-orange-600",
    defaultSortBy: "occurredAt",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, PAYMENT_FILTER, INSTITUTION_FILTER],
    tableColumns: [
      { key: "occurredAt", label: "Tarih", format: "dateTime", sortable: true },
      { key: "currentAccountName", label: "Cari / Kurum", sortable: true },
      { key: "accountType", label: "Cari Tipi", format: "badge", sortable: true },
      { key: "movementType", label: "Hareket", format: "badge", sortable: true },
      { key: "description", label: "Açıklama", sortable: true },
      { key: "paymentMethod", label: "Ödeme Türü", format: "badge", sortable: true },
      { key: "amount", label: "Tutar", format: "currency", sortable: true, align: "right", toneFromValue: true },
      { key: "reference", label: "Referans", sortable: true },
    ],
  }),
  createReport({
    id: "debt-per-doctor",
    slug: "debt-per-doctor",
    title: "Debt Per Doctor Report",
    description: "Doctor-level debt exposure using treatment planning, production and payment data.",
    category: "financial",
    icon: Users,
    accent: "from-amber-500 via-orange-500 to-red-500",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, BRANCH_FILTER],
    tableColumns: [
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "debtorPatientCount", label: "Borçlu Hasta", format: "number", sortable: true, align: "right" },
      { key: "plannedAmount", label: "Planlanan", format: "currency", sortable: true, align: "right" },
      { key: "completedAmount", label: "Tamamlanan", format: "currency", sortable: true, align: "right" },
      { key: "collectedAmount", label: "Tahsilat", format: "currency", sortable: true, align: "right" },
      { key: "outstandingDebt", label: "Açık Bakiye", format: "currency", sortable: true, align: "right", toneFromValue: true },
      { key: "collectionRate", label: "Tahsilat Oranı", format: "percent", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "payment-treatment-commission",
    slug: "payment-treatment-commission",
    title: "Payment & Treatment Based Commission Report",
    description: "Combined commission base from collections and completed treatment production.",
    category: "financial",
    icon: BadgeDollarSign,
    accent: "from-fuchsia-500 via-violet-500 to-indigo-600",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, ...COMMISSION_PAYMENT_FILTERS],
    tableColumns: [
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "paymentBase", label: "Tahsilat Bazı", format: "currency", sortable: true, align: "right" },
      { key: "treatmentBase", label: "Tedavi Bazı", format: "currency", sortable: true, align: "right" },
      { key: "paymentRate", label: "Tahsilat %", format: "percent", sortable: true, align: "right" },
      { key: "treatmentRate", label: "Tedavi %", format: "percent", sortable: true, align: "right" },
      { key: "commissionAmount", label: "Komisyon", format: "currency", sortable: true, align: "right" },
      { key: "paymentCount", label: "Ödeme", format: "number", sortable: true, align: "right" },
      { key: "completedTreatmentCount", label: "Tam. İşlem", format: "number", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "treatment-based-commission",
    slug: "treatment-based-commission",
    title: "Treatment Based Commission Report",
    description: "Commission based solely on completed treatment production.",
    category: "financial",
    icon: ClipboardCheck,
    accent: "from-cyan-500 via-teal-500 to-emerald-600",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, COMMISSION_SINGLE_RATE_FILTER],
    tableColumns: [
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "completedTreatmentCount", label: "Tam. İşlem", format: "number", sortable: true, align: "right" },
      { key: "completedTreatmentValue", label: "Üretim Bazı", format: "currency", sortable: true, align: "right" },
      { key: "commissionRate", label: "Komisyon %", format: "percent", sortable: true, align: "right" },
      { key: "commissionAmount", label: "Komisyon", format: "currency", sortable: true, align: "right" },
      { key: "avgTreatmentValue", label: "Ort. İşlem", format: "currency", sortable: true, align: "right" },
      { key: "patientCount", label: "Hasta", format: "number", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "cash-based-commission",
    slug: "cash-based-commission",
    title: "Cash Based Commission Report",
    description: "Commission based on doctor-attributed cash collections.",
    category: "financial",
    icon: CircleDollarSign,
    accent: "from-green-500 via-emerald-500 to-lime-600",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, PAYMENT_FILTER, COMMISSION_SINGLE_RATE_FILTER],
    tableColumns: [
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "paymentMethod", label: "Yöntem", format: "badge", sortable: true },
      { key: "paymentCount", label: "Ödeme", format: "number", sortable: true, align: "right" },
      { key: "collectedAmount", label: "Tahsilat Bazı", format: "currency", sortable: true, align: "right" },
      { key: "commissionRate", label: "Komisyon %", format: "percent", sortable: true, align: "right" },
      { key: "commissionAmount", label: "Komisyon", format: "currency", sortable: true, align: "right" },
      { key: "avgPaymentAmount", label: "Ort. Ödeme", format: "currency", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "completed-treatments",
    slug: "completed-treatments",
    title: "Completed Treatment Report",
    description: "Leaf treatment items completed within the selected period.",
    category: "treatments",
    icon: ClipboardCheck,
    accent: "from-teal-500 via-cyan-500 to-blue-600",
    defaultSortBy: "completedAt",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, PATIENT_FILTER, TREATMENT_STATUS_FILTER],
    tableColumns: [
      { key: "completedAt", label: "Tamamlanma", format: "dateTime", sortable: true },
      { key: "patientName", label: "Hasta", sortable: true },
      { key: "planTitle", label: "Plan", sortable: true },
      { key: "treatmentName", label: "İşlem", sortable: true },
      { key: "toothDisplay", label: "Diş", sortable: true },
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "status", label: "Durum", format: "badge", sortable: true },
      { key: "lineTotal", label: "Tutar", format: "currency", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "incomplete-treatments",
    slug: "incomplete-treatments",
    title: "Incomplete Treatments Report",
    description: "Planned and in-progress treatments that are not fully completed yet.",
    category: "treatments",
    icon: FileClock,
    accent: "from-amber-500 via-yellow-500 to-orange-600",
    defaultSortBy: "updatedAt",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, PATIENT_FILTER, TREATMENT_STATUS_FILTER],
    tableColumns: [
      { key: "updatedAt", label: "Son Güncelleme", format: "dateTime", sortable: true },
      { key: "patientName", label: "Hasta", sortable: true },
      { key: "planTitle", label: "Plan", sortable: true },
      { key: "treatmentName", label: "İşlem", sortable: true },
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "progress", label: "İlerleme", format: "percent", sortable: true, align: "right" },
      { key: "status", label: "Durum", format: "badge", sortable: true },
      { key: "remainingValue", label: "Kalan Tutar", format: "currency", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "daily-monitoring",
    slug: "daily-monitoring",
    title: "Daily Monitoring Report",
    description: "Day-by-day performance dashboard across revenue, treatments and appointments.",
    category: "treatments",
    icon: Activity,
    accent: "from-violet-500 via-purple-500 to-indigo-600",
    defaultSortBy: "date",
    filters: [...COMMON_DATE_FILTERS, DOCTOR_FILTER, BRANCH_FILTER],
    tableColumns: [
      { key: "date", label: "Tarih", format: "date", sortable: true },
      { key: "appointmentCount", label: "Randevu", format: "number", sortable: true, align: "right" },
      { key: "completedAppointments", label: "Tam. Randevu", format: "number", sortable: true, align: "right" },
      { key: "completedTreatmentCount", label: "Tam. Tedavi", format: "number", sortable: true, align: "right" },
      { key: "treatmentProduction", label: "Tedavi Üretimi", format: "currency", sortable: true, align: "right" },
      { key: "collections", label: "Tahsilat", format: "currency", sortable: true, align: "right" },
      { key: "newPatients", label: "Yeni Hasta", format: "number", sortable: true, align: "right" },
      { key: "attendanceRate", label: "Katılım", format: "percent", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "appointment-occupancy",
    slug: "appointment-occupancy",
    title: "Appointment Occupancy Report",
    description: "Capacity utilization based on schedule blocks and booked appointments.",
    category: "appointments",
    icon: CalendarDays,
    accent: "from-sky-500 via-blue-500 to-indigo-600",
    defaultSortBy: "occupancyRate",
    defaultSortOrder: "desc",
    filters: [...COMMON_DATE_FILTERS, DOCTOR_FILTER, BRANCH_FILTER, APPOINTMENT_STATUS_FILTER],
    tableColumns: [
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "workingHours", label: "Çalışma Saati", format: "number", suffix: " sa", sortable: true, align: "right" },
      { key: "bookedHours", label: "Dolu Saat", format: "number", suffix: " sa", sortable: true, align: "right" },
      { key: "appointmentCount", label: "Randevu", format: "number", sortable: true, align: "right" },
      { key: "occupiedMinutes", label: "Dolu Dakika", format: "number", sortable: true, align: "right" },
      { key: "occupancyRate", label: "Doluluk", format: "percent", sortable: true, align: "right" },
      { key: "noshowRate", label: "No-Show", format: "percent", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "appointment-efficiency",
    slug: "appointment-efficiency",
    title: "Appointment Efficiency Analysis",
    description: "Doctor-level efficiency from attendance, cancellation and completion behavior.",
    category: "appointments",
    icon: BarChart3,
    accent: "from-indigo-500 via-violet-500 to-fuchsia-600",
    defaultSortBy: "efficiencyScore",
    defaultSortOrder: "desc",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, BRANCH_FILTER, APPOINTMENT_STATUS_FILTER],
    tableColumns: [
      { key: "doctorName", label: "Hekim", sortable: true },
      { key: "appointmentCount", label: "Toplam", format: "number", sortable: true, align: "right" },
      { key: "completedCount", label: "Tamamlandı", format: "number", sortable: true, align: "right" },
      { key: "cancelledCount", label: "İptal", format: "number", sortable: true, align: "right" },
      { key: "noshowCount", label: "No-Show", format: "number", sortable: true, align: "right" },
      { key: "completionRate", label: "Tamamlama", format: "percent", sortable: true, align: "right" },
      { key: "efficiencyScore", label: "Verim Skoru", format: "percent", sortable: true, align: "right" },
      { key: "avgDuration", label: "Ort. Süre", format: "number", suffix: " dk", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "lost-patients",
    slug: "lost-patients",
    title: "Lost Patients Report",
    description: "Patients with no recent appointments, payments or treatment activity.",
    category: "patients",
    icon: UserMinus,
    accent: "from-rose-500 via-pink-500 to-red-600",
    defaultSortBy: "daysSinceLastActivity",
    defaultSortOrder: "desc",
    filters: [COMMON_SEARCH_FILTER, DOCTOR_FILTER, BRANCH_FILTER, DAYS_FILTER],
    tableColumns: [
      { key: "patientName", label: "Hasta", sortable: true },
      { key: "primaryDoctorName", label: "Sorumlu Hekim", sortable: true },
      { key: "createdAt", label: "Kayıt Tarihi", format: "date", sortable: true },
      { key: "lastAppointmentAt", label: "Son Randevu", format: "date", sortable: true },
      { key: "lastPaymentAt", label: "Son Ödeme", format: "date", sortable: true },
      { key: "lastTreatmentAt", label: "Son Tedavi", format: "date", sortable: true },
      { key: "daysSinceLastActivity", label: "Pasif Gün", format: "number", sortable: true, align: "right" },
      { key: "openDebt", label: "Açık Bakiye", format: "currency", sortable: true, align: "right", toneFromValue: true },
    ],
  }),
  createReport({
    id: "new-patients",
    slug: "new-patients",
    title: "New Patients Report",
    description: "Acquisition analytics for newly created patient records and their early activity.",
    category: "patients",
    icon: UserPlus,
    accent: "from-emerald-500 via-teal-500 to-cyan-600",
    defaultSortBy: "createdAt",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, BRANCH_FILTER],
    tableColumns: [
      { key: "createdAt", label: "Kayıt Tarihi", format: "dateTime", sortable: true },
      { key: "patientName", label: "Hasta", sortable: true },
      { key: "phone", label: "Telefon", sortable: true },
      { key: "primaryDoctorName", label: "Sorumlu Hekim", sortable: true },
      { key: "firstAppointmentAt", label: "İlk Randevu", format: "date", sortable: true },
      { key: "appointmentCount", label: "Randevu", format: "number", sortable: true, align: "right" },
      { key: "treatmentPlanCount", label: "Plan", format: "number", sortable: true, align: "right" },
      { key: "collectedAmount", label: "Tahsilat", format: "currency", sortable: true, align: "right" },
    ],
  }),
  createReport({
    id: "stock-movement",
    slug: "stock-movement",
    title: "Stock Movement Report",
    description: "Inventory movement, value flow and output direction analysis.",
    category: "stock-lab",
    icon: PackageSearch,
    accent: "from-orange-500 via-amber-500 to-yellow-600",
    defaultSortBy: "occurredAt",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, STOCK_MOVEMENT_FILTER, BRANCH_FILTER],
    tableColumns: [
      { key: "occurredAt", label: "Tarih", format: "dateTime", sortable: true },
      { key: "itemName", label: "Stok Kalemi", sortable: true },
      { key: "categoryName", label: "Kategori", sortable: true },
      { key: "movementType", label: "Hareket", format: "badge", sortable: true },
      { key: "qty", label: "Miktar", format: "number", sortable: true, align: "right" },
      { key: "currentStock", label: "Mevcut Stok", format: "number", sortable: true, align: "right" },
      { key: "totalPrice", label: "Tutar", format: "currency", sortable: true, align: "right" },
      { key: "outputDirection", label: "Yön", sortable: true },
    ],
  }),
  createReport({
    id: "staff-working-hours",
    slug: "staff-working-hours",
    title: "Staff Working Hours Report",
    description: "Working blocks, breaks and staff activity intensity by user.",
    category: "staff",
    icon: Clock3,
    accent: "from-slate-500 via-gray-500 to-zinc-700",
    defaultSortBy: "workingHours",
    defaultSortOrder: "desc",
    filters: [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, BRANCH_FILTER],
    tableColumns: [
      { key: "staffName", label: "Personel", sortable: true },
      { key: "role", label: "Rol", format: "badge", sortable: true },
      { key: "workingHours", label: "Çalışma", format: "number", suffix: " sa", sortable: true, align: "right" },
      { key: "breakHours", label: "Mola", format: "number", suffix: " sa", sortable: true, align: "right" },
      { key: "appointmentCount", label: "Randevu", format: "number", sortable: true, align: "right" },
      { key: "treatmentCount", label: "Tedavi", format: "number", sortable: true, align: "right" },
      { key: "paymentCount", label: "Ödeme", format: "number", sortable: true, align: "right" },
      { key: "activityCount", label: "Aktivite", format: "number", sortable: true, align: "right" },
    ],
  }),
];

export const REPORT_GLOBAL_FILTERS = [COMMON_SEARCH_FILTER, ...COMMON_DATE_FILTERS, DOCTOR_FILTER, PATIENT_FILTER, PAYMENT_FILTER, INSTITUTION_FILTER, BRANCH_FILTER];

export function getReportBySlug(slug) {
  return REPORT_DEFINITIONS.find((report) => report.slug === slug) || null;
}

export function getReportsByCategory(categoryId) {
  return REPORT_DEFINITIONS.filter((report) => report.category === categoryId);
}

export function getCategoryById(categoryId) {
  return REPORT_CATEGORIES.find((category) => category.id === categoryId) || null;
}
