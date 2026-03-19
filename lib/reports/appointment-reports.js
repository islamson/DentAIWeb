const { prisma } = require("../prisma");
const {
  buildBarChartItems,
  buildDateRange,
  roundHours,
  safePercentage,
  sumBy,
} = require("./base-filters");
const { getDoctorDimension } = require("./doctor-dimension");

function matchesSearch(query, ...values) {
  if (!query?.search) return true;
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.search.trim().toLowerCase());
}

function getAppointmentDuration(appointment) {
  if (appointment.durationMinutes) return appointment.durationMinutes;
  if (appointment.startAt && appointment.endAt) {
    return Math.max(0, Math.round((new Date(appointment.endAt) - new Date(appointment.startAt)) / 60000));
  }
  return 0;
}

async function fetchAppointmentDatasets(organizationId, range) {
  const [appointments, blocks, doctors] = await Promise.all([
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
        branchId: true,
        patientId: true,
        doctorUserId: true,
        startAt: true,
        endAt: true,
        durationMinutes: true,
        status: true,
        appointmentType: true,
      },
    }),
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
    getDoctorDimension(organizationId),
  ]);

  return { appointments, blocks, doctors };
}

async function getAppointmentOccupancyReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const { appointments, blocks, doctors } = await fetchAppointmentDatasets(organizationId, range);

  const rows = doctors
    .map((doctor) => {
      const doctorAppointments = appointments.filter((appointment) => {
        if (appointment.doctorUserId !== doctor.id) return false;
        if (query.branchId && appointment.branchId !== query.branchId) return false;
        if (query.appointmentStatus && appointment.status !== query.appointmentStatus) return false;
        return matchesSearch(query, doctor.label, appointment.appointmentType);
      });
      const doctorBlocks = blocks.filter((block) => block.doctorUserId === doctor.id);

      const workingMinutesRaw = sumBy(
        doctorBlocks.filter((block) => block.type === "WORKING"),
        (block) => Math.max(0, Math.round((new Date(block.endAt) - new Date(block.startAt)) / 60000))
      );
      const estimatedWorkingMinutes =
        workingMinutesRaw ||
        new Set(
          doctorAppointments.map((appointment) => new Date(appointment.startAt).toISOString().slice(0, 10))
        ).size *
          540;

      const bookedAppointments = doctorAppointments.filter(
        (appointment) => !["CANCELLED"].includes(appointment.status)
      );
      const bookedMinutes = sumBy(bookedAppointments, getAppointmentDuration);
      const noshowCount = doctorAppointments.filter((appointment) => appointment.status === "NOSHOW").length;

      return {
        id: doctor.id,
        doctorName: doctor.label,
        workingHours: roundHours(estimatedWorkingMinutes),
        bookedHours: roundHours(bookedMinutes),
        appointmentCount: doctorAppointments.length,
        occupiedMinutes: bookedMinutes,
        occupancyRate: safePercentage(bookedMinutes, estimatedWorkingMinutes),
        noshowRate: safePercentage(noshowCount, doctorAppointments.length),
      };
    })
    .filter((row) => (!query.doctorId ? true : row.id === query.doctorId))
    .filter((row) => matchesSearch(query, row.doctorName));

  return {
    stats: [
      { id: "occupancy-working", label: "Çalışma Saati", value: sumBy(rows, (row) => row.workingHours), format: "number", tone: "info" },
      { id: "occupancy-booked", label: "Dolu Saat", value: sumBy(rows, (row) => row.bookedHours), format: "number", tone: "warning" },
      {
        id: "occupancy-rate",
        label: "Genel Doluluk",
        value: safePercentage(sumBy(rows, (row) => row.occupiedMinutes), sumBy(rows, (row) => row.workingHours) * 60),
        format: "percent",
        tone: "success",
      },
      { id: "occupancy-appointments", label: "Randevu", value: sumBy(rows, (row) => row.appointmentCount), format: "number", tone: "info" },
    ],
    charts: [
      {
        id: "occupancy-ranking",
        title: "Doluluk Oranı",
        description: "Takvim kapasitesine göre doluluk yüzdesi.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.occupancyRate - a.occupancyRate)
            .slice(0, 8)
            .map((row) => ({ label: row.doctorName, value: row.occupancyRate })),
          "percent"
        ),
      },
      {
        id: "occupancy-booked-hours",
        title: "Dolu Saat",
        description: "Hekim bazında booked hours.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.bookedHours - a.bookedHours)
            .slice(0, 8)
            .map((row) => ({ label: row.doctorName, value: row.bookedHours })),
          "number"
        ),
      },
    ],
    rows,
  };
}

async function getAppointmentEfficiencyReport({ organizationId, query }) {
  const range = buildDateRange(query, 30);
  const { appointments, doctors } = await fetchAppointmentDatasets(organizationId, range);

  const rows = doctors
    .map((doctor) => {
      const doctorAppointments = appointments.filter((appointment) => {
        if (appointment.doctorUserId !== doctor.id) return false;
        if (query.branchId && appointment.branchId !== query.branchId) return false;
        if (query.appointmentStatus && appointment.status !== query.appointmentStatus) return false;
        return true;
      });

      const appointmentCount = doctorAppointments.length;
      const completedCount = doctorAppointments.filter((appointment) => appointment.status === "COMPLETED").length;
      const cancelledCount = doctorAppointments.filter((appointment) => appointment.status === "CANCELLED").length;
      const noshowCount = doctorAppointments.filter((appointment) => appointment.status === "NOSHOW").length;
      const avgDuration = appointmentCount
        ? Math.round(sumBy(doctorAppointments, getAppointmentDuration) / appointmentCount)
        : 0;
      const completionRate = safePercentage(completedCount, appointmentCount);
      const noshowRate = safePercentage(noshowCount, appointmentCount);
      const availabilityRate = safePercentage(
        appointmentCount - cancelledCount - noshowCount,
        appointmentCount
      );
      const efficiencyScore = Number((completionRate * 0.7 + availabilityRate * 0.3).toFixed(1));

      return {
        id: doctor.id,
        doctorName: doctor.label,
        appointmentCount,
        completedCount,
        cancelledCount,
        noshowCount,
        noshowRate,
        completionRate,
        efficiencyScore,
        avgDuration,
      };
    })
    .filter((row) => (!query.doctorId ? true : row.id === query.doctorId))
    .filter((row) => matchesSearch(query, row.doctorName));

  return {
    stats: [
      { id: "efficiency-total", label: "Toplam Randevu", value: sumBy(rows, (row) => row.appointmentCount), format: "number", tone: "info" },
      { id: "efficiency-completion", label: "Tamamlama", value: safePercentage(sumBy(rows, (row) => row.completedCount), sumBy(rows, (row) => row.appointmentCount)), format: "percent", tone: "success" },
      { id: "efficiency-noshow", label: "No-Show", value: safePercentage(sumBy(rows, (row) => row.noshowCount), sumBy(rows, (row) => row.appointmentCount)), format: "percent", tone: "danger" },
      { id: "efficiency-duration", label: "Ort. Süre", value: rows.length ? Math.round(sumBy(rows, (row) => row.avgDuration) / rows.length) : 0, format: "number", tone: "warning" },
    ],
    charts: [
      {
        id: "efficiency-ranking",
        title: "Verim Skoru",
        description: "Tamamlama ve erişilebilirlik bazlı skor.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.efficiencyScore - a.efficiencyScore)
            .slice(0, 8)
            .map((row) => ({ label: row.doctorName, value: row.efficiencyScore })),
          "percent"
        ),
      },
      {
        id: "efficiency-noshow-ranking",
        title: "No-Show Oranı",
        description: "Riskli randevu davranışının hekim bazlı görünümü.",
        items: buildBarChartItems(
          rows
            .slice()
            .sort((a, b) => b.noshowRate - a.noshowRate)
            .slice(0, 8)
            .map((row) => ({
              label: row.doctorName,
              value: safePercentage(row.noshowCount, row.appointmentCount),
            })),
          "percent"
        ),
      },
    ],
    rows,
  };
}

module.exports = {
  getAppointmentOccupancyReport,
  getAppointmentEfficiencyReport,
};
