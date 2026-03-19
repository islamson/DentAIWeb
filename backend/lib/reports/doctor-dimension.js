const { prisma } = require("../prisma");
const { formatLabelValueOptions } = require("./base-filters");

const ROLE_LABELS = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  MANAGER: "Klinik Müdürü",
  DOCTOR: "Hekim",
  ASSISTANT: "Asistan",
  RECEPTION: "Resepsiyon",
  ACCOUNTING: "Muhasebe",
  INVENTORY: "Stok",
  CALLCENTER: "Çağrı Merkezi",
  READONLY: "Salt Okunur",
};

async function getDoctorDimension(organizationId) {
  const doctors = await prisma.userOrganization.findMany({
    where: {
      organizationId,
      role: { in: ["DOCTOR", "OWNER", "ADMIN"] },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });

  return doctors.map((doctor) => ({
    id: doctor.user?.id,
    label: doctor.user?.name || doctor.user?.email || "İsimsiz Kullanıcı",
    role: doctor.role,
    branchId: doctor.branchId || null,
  }));
}

async function getBranches(organizationId) {
  const branches = await prisma.branch.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return formatLabelValueOptions(branches);
}

async function getPatients(organizationId) {
  const patients = await prisma.patient.findMany({
    where: { organizationId },
    orderBy: [{ updatedAt: "desc" }, { firstName: "asc" }],
    take: 200,
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  return patients.map((patient) => ({
    value: patient.id,
    label: `${patient.firstName} ${patient.lastName}`.trim(),
  }));
}

async function getInstitutionAccounts(organizationId) {
  const accounts = await prisma.currentAccount.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    take: 200,
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  return accounts.map((account) => ({
    value: account.id,
    label: account.type ? `${account.name} (${account.type})` : account.name,
  }));
}

async function getUserDimension(organizationId) {
  const users = await prisma.userOrganization.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });

  return users.map((member) => ({
    id: member.user?.id,
    name: member.user?.name || member.user?.email || "İsimsiz Kullanıcı",
    role: member.role,
    roleLabel: ROLE_LABELS[member.role] || member.role,
    branchId: member.branchId || null,
  }));
}

async function getGlobalReportFilterOptions(organizationId) {
  const [doctors, branches, patients, institutions] = await Promise.all([
    getDoctorDimension(organizationId),
    getBranches(organizationId),
    getPatients(organizationId),
    getInstitutionAccounts(organizationId),
  ]);

  return {
    doctors: doctors.map((doctor) => ({
      value: doctor.id,
      label: doctor.label,
    })),
    branches,
    patients,
    institutions,
  };
}

module.exports = {
  ROLE_LABELS,
  getDoctorDimension,
  getBranches,
  getPatients,
  getInstitutionAccounts,
  getUserDimension,
  getGlobalReportFilterOptions,
};
