const { prisma } = require("../prisma");
const {
  buildBarChartItems,
  buildDateRange,
  endOfDay,
  safePercentage,
  startOfDay,
  sumBy,
} = require("./base-filters");

function getPatientName(patient) {
  if (!patient) return "—";
  return `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "—";
}

function matchesSearch(query, ...values) {
  if (!query?.search) return true;
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.search.trim().toLowerCase());
}

function treatmentLineTotal(item) {
  const discountMultiplier = 1 - (Number(item.discount || 0) / 100);
  return Math.round((item.price || 0) * (item.quantity || 0) * discountMultiplier);
}

async function fetchLeafTreatmentItems(organizationId, range, statuses = null) {
  return prisma.treatmentItem.findMany({
    where: {
      organizationId,
      OR: [
        { parentItemId: { not: null } },
        {
          parentItemId: null,
          children: { none: {} },
        },
      ],
      ...(statuses ? { status: { in: statuses } } : {}),
      ...((range.from || range.to) && (statuses?.includes("COMPLETED") || statuses === null)
        ? {
            completedAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    include: {
      plan: {
        select: {
          id: true,
          title: true,
          branchId: true,
          doctorUserId: true,
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              branchId: true,
            },
          },
        },
      },
      assignedDoctor: { select: { id: true, name: true } },
      teeth: true,
      labRelations: {
        where: { deletedAt: null },
        select: { id: true, status: true, price: true, quantity: true },
      },
    },
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
  });
}

function filterTreatmentItems(items, query, includeStatus = true) {
  return items.filter((item) => {
    const doctorId = item.assignedDoctor?.id || item.plan?.doctorUserId || null;
    const patientId = item.plan?.patient?.id || null;
    const branchId = item.plan?.branchId || item.plan?.patient?.branchId || null;

    if (query.doctorId && doctorId !== query.doctorId) return false;
    if (query.patientId && patientId !== query.patientId) return false;
    if (query.branchId && branchId !== query.branchId) return false;
    if (includeStatus && query.treatmentStatus && item.status !== query.treatmentStatus) return false;

    return matchesSearch(
      query,
      item.name,
      item.plan?.title,
      item.assignedDoctor?.name,
      getPatientName(item.plan?.patient),
      item.teeth?.map((tooth) => tooth.toothCode).join(", ")
    );
  });
}

async function getCompletedTreatmentsReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const items = await fetchLeafTreatmentItems(organizationId, range, ["COMPLETED"]);
  const filtered = filterTreatmentItems(items, query);

  const rows = filtered.map((item) => ({
    id: item.id,
    completedAt: item.completedAt,
    patientName: getPatientName(item.plan?.patient),
    planTitle: item.plan?.title || "—",
    treatmentName: item.name,
    toothDisplay: item.teeth?.length ? item.teeth.map((tooth) => tooth.toothCode).join(", ") : "—",
    doctorName: item.assignedDoctor?.name || "—",
    status: item.status,
    lineTotal: treatmentLineTotal(item),
    rowLink: item.plan?.patient?.id ? `/patients/${item.plan.patient.id}?tab=plans&plan=${item.plan.id}` : null,
  }));

  return {
    stats: [
      { id: "completed-count", label: "Tamamlanan İşlem", value: rows.length, format: "number", tone: "success" },
      { id: "completed-value", label: "Toplam Tutar", value: sumBy(rows, (row) => row.lineTotal), format: "currency", tone: "info" },
      {
        id: "completed-average",
        label: "Ortalama İşlem",
        value: rows.length ? Math.round(sumBy(rows, (row) => row.lineTotal) / rows.length) : 0,
        format: "currency",
        tone: "warning",
      },
      {
        id: "completed-lab-related",
        label: "Lab Bağlantılı İşlem",
        value: filtered.filter((item) => item.labRelations?.length > 0).length,
        format: "number",
        tone: "info",
      },
    ],
    charts: [
      {
        id: "completed-doctors",
        title: "Hekim Bazlı Tamamlanan İşlem",
        description: "Tamamlanan işlem sayısına göre sıralama.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.doctorName] = (acc[row.doctorName] || 0) + 1;
              return acc;
            }, {})
          ).map(([label, value]) => ({ label, value })),
          "number"
        ),
      },
      {
        id: "completed-treatments",
        title: "İşlem Değeri",
        description: "En yüksek gelir üreten tamamlanmış işlemler.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.treatmentName] = (acc[row.treatmentName] || 0) + row.lineTotal;
              return acc;
            }, {})
          )
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6),
          "currency"
        ),
      },
    ],
    rows,
  };
}

async function getIncompleteTreatmentsReport({ organizationId, query }) {
  const range = buildDateRange(query);
  const items = await prisma.treatmentItem.findMany({
    where: {
      organizationId,
      OR: [
        { parentItemId: { not: null } },
        {
          parentItemId: null,
          children: { none: {} },
        },
      ],
      status: { in: ["PLANNED", "IN_PROGRESS"] },
      ...(range.from || range.to
        ? {
            updatedAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
    include: {
      plan: {
        select: {
          id: true,
          title: true,
          branchId: true,
          doctorUserId: true,
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              branchId: true,
            },
          },
        },
      },
      assignedDoctor: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const filtered = filterTreatmentItems(items, query);
  const rows = filtered.map((item) => {
    const lineTotal = treatmentLineTotal(item);
    const remainingValue = Math.round(lineTotal * ((100 - Number(item.progress || 0)) / 100));

    return {
      id: item.id,
      updatedAt: item.updatedAt,
      patientName: getPatientName(item.plan?.patient),
      planTitle: item.plan?.title || "—",
      treatmentName: item.name,
      doctorName: item.assignedDoctor?.name || "—",
      progress: Number(item.progress || 0),
      status: item.status,
      remainingValue,
      rowLink: item.plan?.patient?.id ? `/patients/${item.plan.patient.id}?tab=plans&plan=${item.plan.id}` : null,
    };
  });

  return {
    stats: [
      { id: "incomplete-count", label: "Açık İşlem", value: rows.length, format: "number", tone: "warning" },
      { id: "incomplete-remaining", label: "Kalan Tutar", value: sumBy(rows, (row) => row.remainingValue), format: "currency", tone: "danger" },
      { id: "incomplete-inprogress", label: "Devam Eden", value: rows.filter((row) => row.status === "IN_PROGRESS").length, format: "number", tone: "info" },
      { id: "incomplete-planned", label: "Planlanan", value: rows.filter((row) => row.status === "PLANNED").length, format: "number", tone: "info" },
    ],
    charts: [
      {
        id: "incomplete-status",
        title: "Durum Dağılımı",
        description: "Açık işlemlerin durum kırılımı.",
        items: buildBarChartItems(
          [
            { label: "Planlandı", value: rows.filter((row) => row.status === "PLANNED").length },
            { label: "Devam Ediyor", value: rows.filter((row) => row.status === "IN_PROGRESS").length },
          ],
          "number"
        ),
      },
      {
        id: "incomplete-doctor-backlog",
        title: "Hekim Bazlı Bekleyen Değer",
        description: "Kalan değeri en yüksek hekimler.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.doctorName] = (acc[row.doctorName] || 0) + row.remainingValue;
              return acc;
            }, {})
          )
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6),
          "currency"
        ),
      },
    ],
    rows,
  };
}

async function getDailyMonitoringReport({ organizationId, query }) {
  const range = buildDateRange(query, 14);
  const [appointments, payments, treatments, patients] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId,
        startAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      },
      select: {
        id: true,
        doctorUserId: true,
        branchId: true,
        startAt: true,
        status: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isRefund: false,
        paidAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      },
      include: {
        patient: { select: { branchId: true } },
      },
    }),
    fetchLeafTreatmentItems(organizationId, range, ["COMPLETED"]),
    prisma.patient.findMany({
      where: {
        organizationId,
        createdAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      },
      include: {
        primaryDoctor: { include: { user: { select: { id: true } } } },
      },
    }),
  ]);

  const days = [];
  let pointer = startOfDay(range.from || new Date());
  const lastDay = endOfDay(range.to || new Date());

  while (pointer <= lastDay) {
    days.push(new Date(pointer));
    pointer = new Date(pointer.getTime() + 24 * 60 * 60 * 1000);
  }

  const rows = days.map((day) => {
    const nextDay = endOfDay(day);
    const dayAppointments = appointments.filter((appointment) => {
      if (query.doctorId && appointment.doctorUserId !== query.doctorId) return false;
      if (query.branchId && appointment.branchId !== query.branchId) return false;
      return appointment.startAt >= day && appointment.startAt <= nextDay;
    });

    const dayPayments = payments.filter((payment) => {
      if (query.doctorId && payment.doctorId !== query.doctorId) return false;
      if (query.branchId && payment.patient?.branchId !== query.branchId) return false;
      return payment.paidAt >= day && payment.paidAt <= nextDay;
    });

    const dayTreatments = treatments.filter((item) => {
      const doctorId = item.assignedDoctor?.id || item.plan?.doctorUserId || null;
      const branchId = item.plan?.branchId || item.plan?.patient?.branchId || null;
      if (query.doctorId && doctorId !== query.doctorId) return false;
      if (query.branchId && branchId !== query.branchId) return false;
      return item.completedAt >= day && item.completedAt <= nextDay;
    });

    const dayPatients = patients.filter((patient) => {
      if (query.doctorId && patient.primaryDoctor?.user?.id !== query.doctorId) return false;
      if (query.branchId && patient.branchId !== query.branchId) return false;
      return patient.createdAt >= day && patient.createdAt <= nextDay;
    });

    return {
      id: day.toISOString(),
      date: day.toISOString(),
      appointmentCount: dayAppointments.length,
      completedAppointments: dayAppointments.filter((appointment) => appointment.status === "COMPLETED").length,
      completedTreatmentCount: dayTreatments.length,
      treatmentProduction: sumBy(dayTreatments, treatmentLineTotal),
      collections: sumBy(dayPayments, (payment) => payment.amount),
      newPatients: dayPatients.length,
      attendanceRate: safePercentage(
        dayAppointments.filter((appointment) => appointment.status === "COMPLETED").length,
        dayAppointments.length
      ),
    };
  });

  return {
    stats: [
      { id: "monitoring-collections", label: "Toplam Tahsilat", value: sumBy(rows, (row) => row.collections), format: "currency", tone: "success" },
      { id: "monitoring-production", label: "Tedavi Üretimi", value: sumBy(rows, (row) => row.treatmentProduction), format: "currency", tone: "info" },
      { id: "monitoring-appointments", label: "Toplam Randevu", value: sumBy(rows, (row) => row.appointmentCount), format: "number", tone: "warning" },
      { id: "monitoring-patients", label: "Yeni Hasta", value: sumBy(rows, (row) => row.newPatients), format: "number", tone: "info" },
    ],
    charts: [
      {
        id: "monitoring-collections-trend",
        title: "Günlük Tahsilat",
        description: "Gün bazında gelir akışı.",
        items: buildBarChartItems(rows.map((row) => ({ label: new Date(row.date).toLocaleDateString("tr-TR"), value: row.collections })), "currency"),
      },
      {
        id: "monitoring-attendance-trend",
        title: "Günlük Katılım",
        description: "Tamamlanan randevuların günlük oranı.",
        items: buildBarChartItems(rows.map((row) => ({ label: new Date(row.date).toLocaleDateString("tr-TR"), value: row.attendanceRate })), "percent"),
      },
    ],
    rows,
  };
}

module.exports = {
  getCompletedTreatmentsReport,
  getIncompleteTreatmentsReport,
  getDailyMonitoringReport,
};
