"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, ChevronLeft, ChevronRight, List, Calendar as CalendarIcon,
  Search, X, User, Clock, Phone, Stethoscope, Check
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { format, addDays, addMonths, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameMonth, isSameDay } from "date-fns";
import { tr } from "date-fns/locale";

// ── Constants ──────────────────────────────────────────────────────────────
const DAY_START_HOUR = 8;   // 08:00
const DAY_END_HOUR   = 20;  // 20:00
const SLOT_MINUTES   = 30;
const TOTAL_SLOTS    = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES; // 24

const STATUS_LABELS = {
  SCHEDULED:   "Planlandı",
  CONFIRMED:   "Onaylandı",
  ARRIVED:     "Geldi",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED:   "Tamamlandı",
  CANCELLED:   "İptal",
  NOSHOW:      "Gelmedi",
};

const STATUS_COLORS = {
  SCHEDULED:   "bg-blue-100 text-blue-900 border-blue-300 border-l-blue-500",
  CONFIRMED:   "bg-emerald-100 text-emerald-900 border-emerald-300 border-l-emerald-600",
  ARRIVED:     "bg-teal-100 text-teal-900 border-teal-300 border-l-teal-500",
  IN_PROGRESS: "bg-purple-100 text-purple-900 border-purple-300 border-l-purple-500",
  COMPLETED:   "bg-slate-100 text-slate-600 border-slate-300 border-l-slate-400",
  CANCELLED:   "bg-red-50 text-red-400 border-red-200 border-l-red-400 line-through decoration-red-300",
  NOSHOW:      "bg-orange-100 text-orange-900 border-orange-300 border-l-orange-500",
};

const APPT_TYPE_LABELS = {
  CONSULTATION: "Konsültasyon",
  ORTHODONTICS: "Ortodonti",
  TREATMENT:    "Tedavi",
  SURGERY:      "Cerrahi",
  ROOT_CANAL:   "Kanal",
  CONTROL:      "Kontrol",
  TRYON:        "Prova",
  IMPLANT:      "İmplant",
  OTHER:        "Diğer",
};

const EMPTY_FORM = {
  // patient
  patientSearch: "",
  selectedPatientId: "",
  firstName: "",
  lastName: "",
  phone: "",
  // appointment
  doctorUserId: "",
  date: "",
  startTime: "",
  endTime: "",
  appointmentType: "CONSULTATION",
  status: "SCHEDULED",
  isUrgent: false,
  reason: "",
  notes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function slotToTime(slotIndex) {
  const totalMinutes = DAY_START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToSlot(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return ((h - DAY_START_HOUR) * 60 + m) / SLOT_MINUTES;
}

function dateTimeToSlot(dt) {
  const d = new Date(dt);
  return ((d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes()) / SLOT_MINUTES;
}

function slotToDateTime(date, slotIndex) {
  const totalMinutes = DAY_START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const d = new Date(date);
  d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return d;
}

function getPatientDisplay(apt) {
  if (apt.patient) return `${apt.patient.firstName} ${apt.patient.lastName}`;
  if (apt.guestFirstName) return `${apt.guestFirstName} ${apt.guestLastName || ""}`.trim();
  return "İsimsiz";
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const navigate = useNavigate();

  // ── View / date state
  const [view, setView]               = useState("day");
  const [selectedDate, setSelectedDate] = useState(new Date());

  // ── Data
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors]           = useState([]);
  const [loading, setLoading]           = useState(false);

  // ── Drag selection state
  const [dragState, setDragState] = useState({
    active: false,
    doctorUserId: null,
    startSlot: null,
    endSlot: null,
  });
  const isDraggingRef = useRef(false);

  // ── Appointment modal state
  const [showModal, setShowModal]       = useState(false);
  const [editingAppt, setEditingAppt]  = useState(null);  // null = create, obj = edit
  const [form, setForm]                = useState(EMPTY_FORM);

  // ── Patient search
  const [patientResults, setPatientResults] = useState([]);
  const searchTimerRef                      = useRef(null);

  // ── Single vs double click (appointment cards)
  const clickTimerRef = useRef(null);

  // ── Data fetching ──────────────────────────────────────────────────────
  const fetchDoctors = useCallback(async () => {
    try {
      const res  = await fetch("/api/schedule/doctors");
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchAppointments = useCallback(async (date, viewMode) => {
    try {
      setLoading(true);
      const dayStart = viewMode === "month"
        ? startOfMonth(date)
        : startOfDay(date);
      const dayEnd = viewMode === "month"
        ? endOfMonth(date)
        : endOfDay(date);
      const res  = await fetch(`/api/appointments?startDate=${dayStart.toISOString()}&endDate=${dayEnd.toISOString()}`);
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);
  useEffect(() => { fetchAppointments(selectedDate, view); }, [selectedDate, view, fetchAppointments]);

  // ── Global mouseup for drag finalization ─────────────────────────────
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setDragState((prev) => {
        if (!prev.active || prev.startSlot === null) return { active: false, doctorUserId: null, startSlot: null, endSlot: null };
        const start = Math.min(prev.startSlot, prev.endSlot ?? prev.startSlot);
        const end   = Math.max(prev.startSlot, prev.endSlot ?? prev.startSlot) + 1;
        openCreateModal({
          doctorUserId: prev.doctorUserId,
          startSlot: start,
          endSlot: end,
        });
        return { active: false, doctorUserId: null, startSlot: null, endSlot: null };
      });
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ─────────────────────────────────────────────────────────
  const goToPrevDay   = () => setSelectedDate((d) => addDays(d, -1));
  const goToNextDay   = () => setSelectedDate((d) => addDays(d, 1));
  const goToPrevMonth = () => setSelectedDate((d) => addMonths(d, -1));
  const goToNextMonth = () => setSelectedDate((d) => addMonths(d, 1));
  const goToToday     = () => setSelectedDate(new Date());

  const goToDayFromMonth = (day) => {
    setSelectedDate(day);
    setView("day");
  };

  // ── Single click = appointment detail, double click = patient page ───────
  const handleAppointmentClick = (apt, e) => {
    e.stopPropagation();
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      openEditModal(apt);
    }, 280);
  };

  const handleAppointmentDoubleClick = (apt, e) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (apt.patientId) {
      navigate(`/patients/${apt.patientId}`);
    }
  };

  // ── Modal helpers ──────────────────────────────────────────────────────
  function openCreateModal({ doctorUserId = "", startSlot = null, endSlot = null } = {}) {
    const dateStr  = format(selectedDate, "yyyy-MM-dd");
    const startStr = startSlot !== null ? slotToTime(startSlot) : "";
    const endStr   = endSlot   !== null ? slotToTime(endSlot)   : "";
    setEditingAppt(null);
    setForm({
      ...EMPTY_FORM,
      doctorUserId: doctorUserId || "",
      date:         dateStr,
      startTime:    startStr,
      endTime:      endStr,
    });
    setPatientResults([]);
    setShowModal(true);
  }

  function openEditModal(apt) {
    const startD = new Date(apt.startAt);
    const endD   = new Date(apt.endAt);
    setEditingAppt(apt);
    setForm({
      patientSearch:     apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : (apt.guestFirstName || ""),
      selectedPatientId: apt.patientId || "",
      firstName:         apt.patient?.firstName || apt.guestFirstName || "",
      lastName:          apt.patient?.lastName  || apt.guestLastName  || "",
      phone:             apt.patient?.phone     || apt.guestPhone     || "",
      doctorUserId:      apt.doctorUserId || "",
      date:              format(startD, "yyyy-MM-dd"),
      startTime:         format(startD, "HH:mm"),
      endTime:           format(endD,   "HH:mm"),
      appointmentType:   apt.appointmentType || "CONSULTATION",
      status:            apt.status || "SCHEDULED",
      isUrgent:          apt.isUrgent ?? false,
      reason:            apt.reason || "",
      notes:             apt.notes  || "",
    });
    setPatientResults([]);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingAppt(null);
    setForm(EMPTY_FORM);
    setPatientResults([]);
  }

  // ── Patient search ─────────────────────────────────────────────────────
  const handlePatientSearchChange = (val) => {
    setForm((f) => ({ ...f, patientSearch: val, selectedPatientId: "" }));
    clearTimeout(searchTimerRef.current);
    if (!val.trim()) { setPatientResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/patients?search=${encodeURIComponent(val)}&limit=8`);
        const data = await res.json();
        setPatientResults(data.patients || []);
      } catch { /* silent */ }
    }, 300);
  };

  const selectPatient = (patient) => {
    setForm((f) => ({
      ...f,
      patientSearch:     `${patient.firstName} ${patient.lastName}`,
      selectedPatientId: patient.id,
      firstName:         patient.firstName,
      lastName:          patient.lastName,
      phone:             patient.phone || "",
    }));
    setPatientResults([]);
  };

  const clearPatient = () => {
    setForm((f) => ({
      ...f,
      patientSearch:     "",
      selectedPatientId: "",
      firstName:         "",
      lastName:          "",
      phone:             "",
    }));
    setPatientResults([]);
  };

  // ── Save appointment ───────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    const startAt = new Date(`${form.date}T${form.startTime}`).toISOString();
    const endAt   = new Date(`${form.date}T${form.endTime}`).toISOString();

    const payload = {
      doctorUserId:    form.doctorUserId || undefined,
      startAt,
      endAt,
      appointmentType: form.appointmentType || "CONSULTATION",
      status:          form.status || "SCHEDULED",
      isUrgent:        form.isUrgent ?? false,
      reason:          form.reason  || undefined,
      notes:           form.notes   || undefined,
      ...(form.selectedPatientId
        ? { patientId: form.selectedPatientId }
        : {
            guestFirstName: form.firstName || undefined,
            guestLastName:  form.lastName  || undefined,
            guestPhone:     form.phone     || undefined,
          }),
    };

    try {
      const url    = editingAppt ? `/api/appointments/${editingAppt.id}` : "/api/appointments";
      const method = editingAppt ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Kayıt hatası");
        return;
      }
      closeModal();
      fetchAppointments(selectedDate);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Delete appointment ─────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!editingAppt || !confirm("Randevu silinsin mi?")) return;
    await fetch(`/api/appointments/${editingAppt.id}`, { method: "DELETE" });
    closeModal();
    fetchAppointments(selectedDate);
  };

  // ── Status update (list view) ──────────────────────────────────────────
  const handleStatusChange = async (id, status) => {
    await fetch(`/api/appointments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchAppointments(selectedDate);
  };

  // ── Drag event handlers ────────────────────────────────────────────────
  const handleCellMouseDown = (e, doctorUserId, slotIndex) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setDragState({ active: true, doctorUserId, startSlot: slotIndex, endSlot: slotIndex });
  };

  const handleCellMouseEnter = (doctorUserId, slotIndex) => {
    if (!isDraggingRef.current) return;
    setDragState((prev) => {
      if (!prev.active || prev.doctorUserId !== doctorUserId) return prev;
      return { ...prev, endSlot: slotIndex };
    });
  };

  const isCellSelected = (doctorUserId, slotIndex) => {
    if (!dragState.active || dragState.doctorUserId !== doctorUserId) return false;
    const lo = Math.min(dragState.startSlot, dragState.endSlot ?? dragState.startSlot);
    const hi = Math.max(dragState.startSlot, dragState.endSlot ?? dragState.startSlot);
    return slotIndex >= lo && slotIndex <= hi;
  };

  // ── Build per-doctor appointment map ──────────────────────────────────
  const apptsByDoctor = {};
  // "no doctor" bucket
  const NO_DOCTOR = "__none__";
  appointments.forEach((apt) => {
    const key = apt.doctorUserId || NO_DOCTOR;
    if (!apptsByDoctor[key]) apptsByDoctor[key] = [];
    apptsByDoctor[key].push(apt);
  });

  // Columns = doctors who have appointments today + all loaded doctors
  const columnDoctors = (() => {
    const seen = new Set();
    const cols = [];
    doctors.forEach((d) => {
      const uid = d.user?.id;
      if (uid && !seen.has(uid)) { seen.add(uid); cols.push({ id: uid, name: d.user?.name || "Doktor" }); }
    });
    // Add a column for appointments not linked to any doctor
    if (apptsByDoctor[NO_DOCTOR]?.length) {
      cols.push({ id: NO_DOCTOR, name: "Hekim Atanmamış" });
    }
    if (cols.length === 0) {
      cols.push({ id: NO_DOCTOR, name: "Randevular" });
    }
    return cols;
  })();

  // ── Time slots list ────────────────────────────────────────────────────
  const timeSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => slotToTime(i));

  // ── Overlap layout: assign lanes so overlapping cards render side-by-side ─
  function computeOverlapLayout(appts) {
    if (!appts.length) return {};
    const sorted = [...appts].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    const layouts = {};
    const placed = []; // { id, start, end, lane }

    for (const apt of sorted) {
      const start = new Date(apt.startAt).getTime();
      const end   = new Date(apt.endAt).getTime();
      const overlapping = placed.filter((p) => p.start < end && p.end > start);
      const usedLanes = new Set(overlapping.map((p) => p.lane));
      let lane = 0;
      while (usedLanes.has(lane)) lane++;
      placed.push({ id: apt.id, start, end, lane });
      layouts[apt.id] = { lane };
    }

    // Second pass: compute totalLanes per overlap cluster
    for (const apt of sorted) {
      const start = new Date(apt.startAt).getTime();
      const end   = new Date(apt.endAt).getTime();
      const cluster = placed.filter((p) => p.start < end && p.end > start);
      const maxLane = Math.max(...cluster.map((p) => p.lane));
      for (const member of cluster) {
        const prev = layouts[member.id].totalLanes || 0;
        layouts[member.id].totalLanes = Math.max(prev, maxLane + 1);
      }
    }

    return layouts;
  }

  // ── Compute appointment position in grid ───────────────────────────────
  function apptStyle(apt, layout) {
    const startSlot = Math.max(0, dateTimeToSlot(apt.startAt));
    const endSlot   = Math.min(TOTAL_SLOTS, dateTimeToSlot(apt.endAt));
    const top       = (startSlot / TOTAL_SLOTS) * 100;
    const height    = Math.max(((endSlot - startSlot) / TOTAL_SLOTS) * 100, 100 / TOTAL_SLOTS);

    const totalLanes = layout?.totalLanes || 1;
    const laneIndex  = layout?.lane || 0;
    const widthPct   = (1 / totalLanes) * 100;
    const leftPct    = laneIndex * widthPct;

    return {
      top:    `${top}%`,
      height: `${height}%`,
      left:   `${leftPct}%`,
      width:  `${widthPct}%`,
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full space-y-0 select-none">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 py-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Randevular</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(selectedDate, "d MMMM yyyy, EEEE", { locale: tr })}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setView("day")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "day" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarIcon className="h-3 w-3" /> Gün
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "month" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarIcon className="h-3 w-3" /> Ay
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-3 w-3" /> Liste
            </button>
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background px-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={view === "month" ? goToPrevMonth : goToPrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-1 min-w-[120px] text-center">
              {view === "month" ? format(selectedDate, "MMMM yyyy", { locale: tr }) : format(selectedDate, "d MMM", { locale: tr })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={view === "month" ? goToNextMonth : goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className={`h-8 text-xs ${isToday(selectedDate) ? "border-primary text-primary" : ""}`}
            onClick={goToToday}
          >
            Bugün
          </Button>

          <Button size="sm" className="btn-primary-gradient h-8" onClick={() => openCreateModal()}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Yeni Randevu
          </Button>
        </div>
      </div>

      {/* ── Day Scheduler View ───────────────────────────────────────── */}
      {view === "day" && (
        <div className="glass-effect rounded-xl overflow-hidden border border-border/50 flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Yükleniyor...
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
              {/* Header row: Time + Doctor columns */}
              <div
                className="grid sticky top-0 z-20 bg-background/95 border-b border-border/40"
                style={{ gridTemplateColumns: `64px repeat(${columnDoctors.length}, 1fr)` }}
              >
                <div className="py-2.5 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-r border-border/30" />
                {columnDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="py-2.5 px-3 text-xs font-semibold text-center border-r border-border/30 last:border-r-0 flex items-center justify-center gap-1.5"
                  >
                    <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {(doc.name || "?")[0]}
                    </div>
                    <span className="truncate">{doc.name}</span>
                  </div>
                ))}
              </div>

              {/* Grid body */}
              <div
                className="grid"
                style={{ gridTemplateColumns: `64px repeat(${columnDoctors.length}, 1fr)` }}
              >
                {/* Time labels column */}
                <div className="border-r border-border/30">
                  {timeSlots.map((t, i) => (
                    <div
                      key={t}
                      className="h-10 flex items-start justify-end pr-2 pt-0.5 border-b border-border/20 last:border-b-0"
                    >
                      {i % 2 === 0 && (
                        <span className="text-[10px] text-muted-foreground font-medium">{t}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Doctor columns */}
                {columnDoctors.map((doc) => {
                  const colAppts = apptsByDoctor[doc.id] || [];
                  return (
                    <div key={doc.id} className="relative border-r border-border/30 last:border-r-0">
                      {/* Time slot cells (for drag target) */}
                      {timeSlots.map((t, slotIdx) => (
                        <div
                          key={t}
                          className={`h-10 border-b border-border/15 last:border-b-0 cursor-crosshair transition-colors
                            ${slotIdx % 2 === 0 ? "" : "bg-muted/10"}
                            ${isCellSelected(doc.id, slotIdx) ? "bg-primary/20 border-primary/30" : "hover:bg-primary/5"}`}
                          onMouseDown={(e) => handleCellMouseDown(e, doc.id, slotIdx)}
                          onMouseEnter={() => handleCellMouseEnter(doc.id, slotIdx)}
                        />
                      ))}

                      {/* Appointment cards (absolutely positioned, overlap-aware) */}
                      {(() => {
                        const overlapMap = computeOverlapLayout(colAppts);
                        return colAppts.map((apt) => {
                          const layout = overlapMap[apt.id];
                          const style = apptStyle(apt, layout);
                          const statusClass = STATUS_COLORS[apt.status] || STATUS_COLORS.SCHEDULED;
                          const isUrgent = apt.isUrgent;
                          const procedureLabel = APPT_TYPE_LABELS[apt.appointmentType] || apt.appointmentType;
                          return (
                            <div
                              key={apt.id}
                              className={`absolute rounded-r-md border border-l-[3px] px-1.5 py-1 cursor-pointer shadow-sm hover:shadow-lg transition-shadow z-10 overflow-hidden ${statusClass} ${isUrgent ? "!border-l-destructive ring-1 ring-destructive/30" : ""}`}
                              style={style}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => handleAppointmentClick(apt, e)}
                              onDoubleClick={(e) => handleAppointmentDoubleClick(apt, e)}
                            >
                              <div className="flex items-start justify-between gap-0.5">
                                <div className="text-xs font-bold leading-tight truncate min-w-0">
                                  {getPatientDisplay(apt)}
                                </div>
                                {isUrgent && (
                                  <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-destructive text-white flex-shrink-0">ACİL</span>
                                )}
                              </div>
                              <div className="text-[11px] font-medium opacity-80 truncate leading-tight mt-0.5">
                                {procedureLabel}
                              </div>
                              <div className="text-[10px] opacity-60 leading-tight">
                                {format(new Date(apt.startAt), "HH:mm")}–{format(new Date(apt.endAt), "HH:mm")}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drag hint */}
          <div className="px-4 py-2 border-t border-border/30 bg-muted/5 text-[10px] text-muted-foreground">
            Boş alana tıklayıp sürükleyerek randevu oluşturun · Randevu kartına tıklayarak düzenleyin
          </div>
        </div>
      )}

      {/* ── Month View ───────────────────────────────────────────────── */}
      {view === "month" && (
        <div className="glass-effect rounded-xl overflow-hidden border border-border/50 flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Yükleniyor...
            </div>
          ) : (
            <div className="p-4">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
                  <div key={d} className="py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase">
                    {d}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px border border-border/40 rounded-lg overflow-hidden">
                {(() => {
                  const monthStart = startOfMonth(selectedDate);
                  const monthEnd = endOfMonth(selectedDate);
                  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
                  return days.map((day) => {
                    const dayAppts = appointments.filter((a) => isSameDay(new Date(a.startAt), day));
                    const inMonth = isSameMonth(day, selectedDate);
                    const today = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => goToDayFromMonth(day)}
                        className={`min-h-[80px] p-1.5 cursor-pointer transition-colors border-b border-r border-border/20 last:border-r-0
                          ${inMonth ? "bg-background" : "bg-muted/20"}
                          ${today ? "ring-1 ring-primary/40 ring-inset" : ""}
                          hover:bg-primary/5`}
                      >
                        <div className={`text-[11px] font-semibold mb-1 ${inMonth ? "text-foreground" : "text-muted-foreground"}`}>
                          {format(day, "d")}
                        </div>
                        <div className="space-y-0.5">
                          {dayAppts.slice(0, 3).map((apt) => {
                            const sc = STATUS_COLORS[apt.status] || STATUS_COLORS.SCHEDULED;
                            return (
                              <div
                                key={apt.id}
                                className={`text-[9px] truncate px-1 py-0.5 rounded border cursor-pointer ${sc}`}
                                onClick={(e) => { e.stopPropagation(); handleAppointmentClick(apt, e); }}
                                onDoubleClick={(e) => { e.stopPropagation(); handleAppointmentDoubleClick(apt, e); }}
                              >
                                {format(new Date(apt.startAt), "HH:mm")} {getPatientDisplay(apt)}
                              </div>
                            );
                          })}
                          {dayAppts.length > 3 && (
                            <div className="text-[9px] text-muted-foreground px-1">+{dayAppts.length - 3}</div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── List View ───────────────────────────────────────────────── */}
      {view === "list" && (
        <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Yükleniyor...
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <CalendarIcon className="h-8 w-8 opacity-30" />
              <p className="text-sm">Bu gün için randevu yok</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-border/40 bg-muted/10">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {format(selectedDate, "d MMMM yyyy", { locale: tr })} — {appointments.length} randevu
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hasta</th>
                      <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hekim</th>
                      <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Saat</th>
                      <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Sebep</th>
                      <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tür</th>
                      <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Durum</th>
                      <th className="py-2.5 px-4 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {appointments.map((apt) => (
                      <tr
                        key={apt.id}
                        className="hover:bg-muted/5 transition-colors cursor-pointer"
                        onClick={(e) => { if (!e.target.closest('select') && !e.target.closest('button')) handleAppointmentClick(apt, e); }}
                        onDoubleClick={(e) => { if (!e.target.closest('select') && !e.target.closest('button')) handleAppointmentDoubleClick(apt, e); }}
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                              {getPatientDisplay(apt)[0] || "?"}
                            </div>
                            <div>
                              <div className="font-medium text-sm flex items-center gap-1.5">
                                {getPatientDisplay(apt)}
                                {apt.isUrgent && (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">Acil</span>
                                )}
                              </div>
                              {(apt.patient?.phone || apt.guestPhone) && (
                                <div className="text-xs text-muted-foreground">{apt.patient?.phone || apt.guestPhone}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-sm text-muted-foreground">
                          {apt.doctor?.name ? `Dr. ${apt.doctor.name}` : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="py-2.5 px-4 text-sm font-medium whitespace-nowrap">
                          {format(new Date(apt.startAt), "HH:mm")}–{format(new Date(apt.endAt), "HH:mm")}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground max-w-[160px] truncate">
                          {apt.reason || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground font-medium">
                            {APPT_TYPE_LABELS[apt.appointmentType] || apt.appointmentType}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={apt.status}
                            onChange={(e) => handleStatusChange(apt.id, e.target.value)}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full border cursor-pointer focus:outline-none ${STATUS_COLORS[apt.status] || ""}`}
                          >
                            {Object.entries(STATUS_LABELS).map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openEditModal(apt)}
                          >
                            Düzenle
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Appointment Modal ────────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {editingAppt ? "Randevu Düzenle" : "Yeni Randevu"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave}>
            <div className="flex gap-0 divide-x divide-border/40 px-0">
              {/* ── Left panel: Patient ────────────────────────────── */}
              <div className="flex-1 px-6 py-4 space-y-3 min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Hasta Bilgisi
                </div>

                {/* Patient search */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Kayıtlı Hasta Ara</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8 pr-8 h-8 text-xs"
                      placeholder="İsim veya telefon..."
                      value={form.patientSearch}
                      onChange={(e) => handlePatientSearchChange(e.target.value)}
                      autoComplete="off"
                    />
                    {form.patientSearch && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={clearPatient}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Selected patient indicator */}
                  {form.selectedPatientId && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="text-xs text-emerald-700 font-medium flex-1 truncate">
                        {form.firstName} {form.lastName} seçildi
                      </span>
                      <button type="button" onClick={clearPatient} className="text-emerald-600 hover:text-emerald-800">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Search results dropdown */}
                  {patientResults.length > 0 && !form.selectedPatientId && (
                    <div className="rounded-lg border border-border/60 bg-background shadow-lg overflow-hidden z-50">
                      {patientResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40 text-left transition-colors border-b border-border/20 last:border-b-0"
                          onClick={() => selectPatient(p)}
                        >
                          <div className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {p.firstName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate">{p.firstName} {p.lastName}</div>
                            {p.phone && <div className="text-[10px] text-muted-foreground">{p.phone}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-dashed border-border/40 pt-3 space-y-2.5">
                  <div className="text-[10px] text-muted-foreground font-medium">
                    {form.selectedPatientId ? "Kayıtlı hasta bilgileri" : "Ya da yeni hasta bilgileri girin"}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Ad *</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Ad"
                        value={form.firstName}
                        onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        required={!form.selectedPatientId}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Soyad</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Soyad"
                        value={form.lastName}
                        onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Telefon
                    </Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="05XX XXX XX XX"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* ── Right panel: Appointment details ──────────────── */}
              <div className="flex-1 px-6 py-4 space-y-3 min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Stethoscope className="h-3 w-3" /> Randevu Detayları
                </div>

                {/* Doctor */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Hekim</Label>
                  <Select
                    value={form.doctorUserId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, doctorUserId: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Hekim seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Seçilmedi —</SelectItem>
                      {doctors.map((d) => (
                        <SelectItem key={d.user?.id} value={d.user?.id || ""}>{d.user?.name || "—"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Tarih *</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>

                {/* Start / End time */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Başlangıç *</Label>
                    <Input
                      type="time"
                      className="h-8 text-xs"
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Bitiş *</Label>
                    <Input
                      type="time"
                      className="h-8 text-xs"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* İşlem / Procedure — mandatory */}
                <div className="space-y-1.5">
                  <Label className="text-xs">İşlem *</Label>
                  <Select
                    value={form.appointmentType}
                    onValueChange={(v) => setForm((f) => ({ ...f, appointmentType: v }))}
                    required
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="İşlem seçin" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPT_TYPE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Randevu Durumu</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Urgency */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isUrgent}
                      onChange={(e) => setForm((f) => ({ ...f, isUrgent: e.target.checked }))}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-xs font-medium">Aciliyet (Acil randevu)</span>
                  </label>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Sebep / Not</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Kontrol, diş çekimi vb."
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 pb-4 pt-3 border-t border-border/40 gap-2">
              {editingAppt && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/30 mr-auto"
                  onClick={handleDelete}
                >
                  Sil
                </Button>
              )}
              <Button type="button" variant="outline" onClick={closeModal}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">
                {editingAppt ? "Güncelle" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
