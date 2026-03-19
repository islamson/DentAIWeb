const { prisma } = require("../prisma");
const {
  buildBarChartItems,
  buildDateRange,
  roundHours,
  safePercentage,
  sumBy,
} = require("./base-filters");
const { getUserDimension } = require("./doctor-dimension");

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

async function getLostPatientsReport({ organizationId, query }) {
  const inactivityDays = Number(query.days || 90);
  const patients = await prisma.patient.findMany({
    where: {
      organizationId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
    },
    include: {
      primaryDoctor: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      appointments: {
        orderBy: { startAt: "desc" },
        select: {
          id: true,
          startAt: true,
          status: true,
        },
      },
      payments: {
        where: { deletedAt: null, isRefund: false },
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amount: true,
          paidAt: true,
        },
      },
      treatmentPlans: {
        include: {
          items: {
            where: {
              OR: [
                { parentItemId: { not: null } },
                {
                  parentItemId: null,
                  children: { none: {} },
                },
              ],
            },
            select: {
              id: true,
              status: true,
              price: true,
              quantity: true,
              discount: true,
              completedAt: true,
            },
          },
        },
      },
    },
  });

  const now = new Date();
  const rows = patients
    .map((patient) => {
      const lastAppointmentAt = patient.appointments[0]?.startAt || null;
      const lastPaymentAt = patient.payments[0]?.paidAt || null;
      const lastTreatmentAt = patient.treatmentPlans
        .flatMap((plan) => plan.items || [])
        .map((item) => item.completedAt)
        .filter(Boolean)
        .sort((left, right) => new Date(right) - new Date(left))[0] || null;

      const lastActivityAt = [lastAppointmentAt, lastPaymentAt, lastTreatmentAt]
        .filter(Boolean)
        .sort((left, right) => new Date(right) - new Date(left))[0] || patient.createdAt;

      const daysSinceLastActivity = Math.floor(
        (now.getTime() - new Date(lastActivityAt).getTime()) / (24 * 60 * 60 * 1000)
      );
      const openDebt = Math.max(
        0,
        sumBy(patient.treatmentPlans || [], (plan) => plan.totalPrice || 0) -
          sumBy(patient.payments || [], (payment) => payment.amount)
      );

      return {
        id: patient.id,
        patientName: getPatientName(patient),
        primaryDoctorId: patient.primaryDoctor?.user?.id || null,
        primaryDoctorName: patient.primaryDoctor?.user?.name || "—",
        createdAt: patient.createdAt,
        lastAppointmentAt,
        lastPaymentAt,
        lastTreatmentAt,
        daysSinceLastActivity,
        openDebt,
        rowLink: `/patients/${patient.id}`,
      };
    })
    .filter((row) => row.daysSinceLastActivity >= inactivityDays)
    .filter((row) => (!query.doctorId ? true : row.primaryDoctorId === query.doctorId))
    .filter((row) =>
      matchesSearch(query, row.patientName, row.primaryDoctorName)
    );

  return {
    stats: [
      { id: "lost-patient-count", label: "Kayıp Hasta", value: rows.length, format: "number", tone: "danger" },
      {
        id: "lost-patient-average",
        label: "Ort. Pasif Gün",
        value: rows.length ? Math.round(sumBy(rows, (row) => row.daysSinceLastActivity) / rows.length) : 0,
        format: "number",
        tone: "warning",
      },
      { id: "lost-patient-debt", label: "Açık Bakiye", value: sumBy(rows, (row) => row.openDebt), format: "currency", tone: "info" },
      {
        id: "lost-patient-with-debt",
        label: "Borçlu Kayıp Hasta",
        value: rows.filter((row) => row.openDebt > 0).length,
        format: "number",
        tone: "danger",
      },
    ],
    charts: [
      {
        id: "lost-patient-doctors",
        title: "Hekim Bazlı Kayıp Hasta",
        description: "En çok pasif hasta barındıran hekimler.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.primaryDoctorName] = (acc[row.primaryDoctorName] || 0) + 1;
              return acc;
            }, {})
          )
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
          "number"
        ),
      },
      {
        id: "lost-patient-buckets",
        title: "Pasiflik Seviyesi",
        description: "90+, 180+ ve 365+ gün segmentleri.",
        items: buildBarChartItems(
          [
            { label: "90+ Gün", value: rows.filter((row) => row.daysSinceLastActivity >= 90).length },
            { label: "180+ Gün", value: rows.filter((row) => row.daysSinceLastActivity >= 180).length },
            { label: "365+ Gün", value: rows.filter((row) => row.daysSinceLastActivity >= 365).length },
          ],
          "number"
        ),
      },
    ],
    rows,
  };
}

async function getNewPatientsReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const patients = await prisma.patient.findMany({
    where: {
      organizationId,
      createdAt: {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      },
      ...(query.branchId ? { branchId: query.branchId } : {}),
    },
    include: {
      primaryDoctor: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      appointments: {
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          startAt: true,
          status: true,
        },
      },
      treatmentPlans: {
        select: {
          id: true,
          title: true,
        },
      },
      payments: {
        where: { deletedAt: null, isRefund: false },
        select: {
          id: true,
          amount: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = patients
    .filter((patient) => (!query.doctorId ? true : patient.primaryDoctor?.user?.id === query.doctorId))
    .filter((patient) =>
      matchesSearch(
        query,
        getPatientName(patient),
        patient.phone,
        patient.primaryDoctor?.user?.name
      )
    )
    .map((patient) => ({
      id: patient.id,
      createdAt: patient.createdAt,
      patientName: getPatientName(patient),
      phone: patient.phone || "—",
      primaryDoctorName: patient.primaryDoctor?.user?.name || "—",
      firstAppointmentAt: patient.appointments[0]?.startAt || null,
      appointmentCount: patient.appointments.length,
      treatmentPlanCount: patient.treatmentPlans.length,
      collectedAmount: sumBy(patient.payments || [], (payment) => payment.amount),
      rowLink: `/patients/${patient.id}`,
    }));

  return {
    stats: [
      { id: "new-patient-count", label: "Yeni Hasta", value: rows.length, format: "number", tone: "success" },
      {
        id: "new-patient-conversion",
        label: "İlk Randevu Dönüşümü",
        value: safePercentage(rows.filter((row) => row.firstAppointmentAt).length, rows.length),
        format: "percent",
        tone: "info",
      },
      {
        id: "new-patient-plan-conversion",
        label: "Plan Dönüşümü",
        value: safePercentage(rows.filter((row) => row.treatmentPlanCount > 0).length, rows.length),
        format: "percent",
        tone: "warning",
      },
      {
        id: "new-patient-collections",
        label: "Tahsilat",
        value: sumBy(rows, (row) => row.collectedAmount),
        format: "currency",
        tone: "success",
      },
    ],
    charts: [
      {
        id: "new-patient-doctors",
        title: "Hekim Bazlı Yeni Hasta",
        description: "Yeni hasta kaydı en yüksek hekimler.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              acc[row.primaryDoctorName] = (acc[row.primaryDoctorName] || 0) + 1;
              return acc;
            }, {})
          )
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
          "number"
        ),
      },
      {
        id: "new-patient-daily",
        title: "Günlük Yeni Hasta",
        description: "Seçili aralıkta günlük kayıt trendi.",
        items: buildBarChartItems(
          Object.entries(
            rows.reduce((acc, row) => {
              const key = new Date(row.createdAt).toLocaleDateString("tr-TR");
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {})
          ).map(([label, value]) => ({ label, value })),
          "number"
        ),
      },
    ],
    rows,
  };
}

async function getStaffWorkingHoursReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const [users, blocks, appointments, payments, treatments, activities] = await Promise.all([
    getUserDimension(organizationId),
    prisma.scheduleBlock.findMany({
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
        startAt: true,
        endAt: true,
        type: true,
      },
    }),
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
      },
    }),
    prisma.payment.findMany({
      where: {
        organizationId,
        deletedAt: null,
        paidAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      },
      select: {
        id: true,
        doctorId: true,
      },
    }),
    prisma.treatmentItem.findMany({
      where: {
        organizationId,
        status: "COMPLETED",
        OR: [
          { parentItemId: { not: null } },
          {
            parentItemId: null,
            children: { none: {} },
          },
        ],
        completedAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      },
      select: {
        id: true,
        assignedDoctorId: true,
        plan: {
          select: {
            doctorUserId: true,
          },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: {
        organizationId,
        createdAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      },
      select: {
        id: true,
        actorUserId: true,
      },
    }),
  ]);

  const rows = users
    .filter((user) => (!query.branchId ? true : user.branchId === query.branchId))
    .filter((user) => (!query.doctorId ? true : user.id === query.doctorId))
    .filter((user) => matchesSearch(query, user.name, user.roleLabel))
    .map((user) => {
      const workingMinutes = sumBy(
        blocks.filter((block) => block.doctorUserId === user.id && block.type === "WORKING"),
        (block) => Math.max(0, Math.round((new Date(block.endAt) - new Date(block.startAt)) / 60000))
      );
      const breakMinutes = sumBy(
        blocks.filter((block) => block.doctorUserId === user.id && block.type === "BREAK"),
        (block) => Math.max(0, Math.round((new Date(block.endAt) - new Date(block.startAt)) / 60000))
      );

      return {
        id: user.id,
        staffName: user.name,
        role: user.roleLabel,
        workingHours: roundHours(workingMinutes),
        breakHours: roundHours(breakMinutes),
        appointmentCount: appointments.filter((appointment) => appointment.doctorUserId === user.id).length,
        treatmentCount: treatments.filter(
          (item) => (item.assignedDoctorId || item.plan?.doctorUserId) === user.id
        ).length,
        paymentCount: payments.filter((payment) => payment.doctorId === user.id).length,
        activityCount: activities.filter((activity) => activity.actorUserId === user.id).length,
      };
    });

  return {
    stats: [
      { id: "staff-hours-total", label: "Çalışma Saati", value: sumBy(rows, (row) => row.workingHours), format: "number", tone: "info" },
      { id: "staff-break-total", label: "Mola Saati", value: sumBy(rows, (row) => row.breakHours), format: "number", tone: "warning" },
      { id: "staff-appointments", label: "Randevu", value: sumBy(rows, (row) => row.appointmentCount), format: "number", tone: "success" },
      { id: "staff-activities", label: "Aktivite", value: sumBy(rows, (row) => row.activityCount), format: "number", tone: "info" },
    ],
    charts: [
      {
        id: "staff-working-hours",
        title: "Personel Çalışma Saati",
        description: "Toplam çalışma süresine göre sıralama.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.workingHours - a.workingHours)
            .slice(0, 8)
            .map((row) => ({ label: row.staffName, value: row.workingHours })),
          "number"
        ),
      },
      {
        id: "staff-activity-load",
        title: "Aktivite Yoğunluğu",
        description: "Log ve iş akışı bazlı etkileşim hacmi.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.activityCount - a.activityCount)
            .slice(0, 8)
            .map((row) => ({ label: row.staffName, value: row.activityCount })),
          "number"
        ),
      },
    ],
    rows,
  };
}

module.exports = {
  getLostPatientsReport,
  getNewPatientsReport,
  getStaffWorkingHoursReport,
};
