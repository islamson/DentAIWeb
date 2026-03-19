// Frontend-only RBAC - for UI permission checks
// Note: This is a copy of backend permissions for frontend use
// Backend always has the final say on permissions

export const permissions = {
  // Patients
  PATIENT_READ: [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "DOCTOR",
    "ASSISTANT",
    "RECEPTION",
    "ACCOUNTING",
    "READONLY",
  ],
  PATIENT_WRITE: ["OWNER", "ADMIN", "MANAGER", "DOCTOR", "ASSISTANT", "RECEPTION"],
  PATIENT_DELETE: ["OWNER", "ADMIN"],

  // Appointments
  APPOINTMENT_READ: [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "DOCTOR",
    "ASSISTANT",
    "RECEPTION",
    "READONLY",
  ],
  APPOINTMENT_WRITE: ["OWNER", "ADMIN", "MANAGER", "DOCTOR", "ASSISTANT", "RECEPTION"],
  APPOINTMENT_DELETE: ["OWNER", "ADMIN", "MANAGER"],

  // Treatments
  TREATMENT_READ: [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "DOCTOR",
    "ASSISTANT",
    "ACCOUNTING",
    "READONLY",
  ],
  TREATMENT_WRITE: ["OWNER", "ADMIN", "MANAGER", "DOCTOR"],
  TREATMENT_APPROVE: ["OWNER", "ADMIN", "MANAGER", "DOCTOR"],

  // Billing
  BILLING_READ: [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "ACCOUNTING",
    "RECEPTION",
    "READONLY",
  ],
  BILLING_WRITE: ["OWNER", "ADMIN", "ACCOUNTING"],
  BILLING_REFUND: ["OWNER", "ADMIN"],

  // Inventory
  INVENTORY_READ: [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "INVENTORY",
    "DOCTOR",
    "READONLY",
  ],
  INVENTORY_WRITE: ["OWNER", "ADMIN", "INVENTORY"],

  // Documents
  DOCUMENT_READ: [
    "OWNER",
    "ADMIN",
    "MANAGER",
    "DOCTOR",
    "ASSISTANT",
    "RECEPTION",
    "READONLY",
  ],
  DOCUMENT_WRITE: ["OWNER", "ADMIN", "MANAGER", "DOCTOR", "ASSISTANT"],

  // Reports
  REPORT_VIEW: ["OWNER", "ADMIN", "MANAGER", "ACCOUNTING", "DOCTOR"],

  // AI
  AI_RUN: ["OWNER", "ADMIN", "MANAGER", "DOCTOR"],

  // Settings
  SETTINGS_MANAGE: ["OWNER", "ADMIN"],
  USER_MANAGE: ["OWNER", "ADMIN"],
};

export function can(role, permission) {
  return permissions[permission].includes(role);
}

export function canAny(role, perms) {
  return perms.some((p) => can(role, p));
}

export function canAll(role, perms) {
  return perms.every((p) => can(role, p));
}

export const roleLabels = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  MANAGER: "Klinik Müdürü",
  DOCTOR: "Hekim",
  ASSISTANT: "Asistan",
  RECEPTION: "Resepsiyon",
  ACCOUNTING: "Muhasebe",
  INVENTORY: "Depo/Stok",
  CALLCENTER: "Çağrı Merkezi",
  READONLY: "Salt Okunur",
};
