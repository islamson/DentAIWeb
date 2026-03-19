"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  Plus, Search, GripVertical, Settings2, Trash2, Edit2, History, MessageSquare,
  CheckCircle2, Circle, AlertCircle, Printer, FileText, Upload, Save, X, Phone,
  Mail, MessageCircle, CalendarPlus, ShieldCheck, CreditCard, User, MoreVertical,
  Stethoscope, Activity, ChevronDown, ChevronRight, Calendar, Edit, MoreHorizontal,
  Eye, Trash, ArrowLeft, Clock, AlignLeft, Table as TableIcon
} from "lucide-react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Progress } from "../../components/ui/progress";
import { Skeleton } from "../../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import Odontogram from "../../components/Odontogram";
import { formatDate, formatDateTime, formatCurrency, generateInvoiceNumber } from "../../lib/utils";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const PLAN_STATUS_LABELS = {
  DRAFT: "Taslak", PROPOSED: "Önerildi", APPROVED: "Onaylandı",
  REJECTED: "Reddedildi", IN_PROGRESS: "Devam Ediyor", COMPLETED: "Tamamlandı", CANCELLED: "İptal",
};
const PLAN_STATUS_COLORS = {
  DRAFT: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  PROPOSED: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  REJECTED: "bg-red-500/15 text-red-600 border-red-500/30",
  IN_PROGRESS: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  COMPLETED: "bg-teal-500/15 text-teal-600 border-teal-500/30",
  CANCELLED: "bg-red-500/15 text-red-600 border-red-500/30",
};
const ITEM_STATUS_LABELS = {
  PLANNED: "Bekliyor", IN_PROGRESS: "Devam", COMPLETED: "Tamamlandı", CANCELLED: "İptal",
};
const ITEM_STATUS_COLORS = {
  PLANNED: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  IN_PROGRESS: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  COMPLETED: "bg-teal-500/15 text-teal-600 border-teal-500/30",
  CANCELLED: "bg-red-500/15 text-red-600 border-red-500/30",
};
const SESSION_STATUS_LABELS = { PLANNED: "Planlandı", COMPLETED: "Tamamlandı", CANCELLED: "İptal" };
const SESSION_STATUS_COLORS = {
  PLANNED: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  COMPLETED: "bg-teal-500/15 text-teal-600 border-teal-500/30",
  CANCELLED: "bg-red-500/15 text-red-600 border-red-500/30",
};
const PAYMENT_METHOD_LABELS = { CASH: "Nakit", CARD: "Kredi Kartı", BANK_TRANSFER: "Banka Transferi", ONLINE: "Online", OTHER: "Diğer" };
const COMM_TYPE_ICONS = { phone: Phone, sms: MessageSquare, whatsapp: MessageSquare, email: Mail };
const COMM_TYPE_LABELS = { phone: "Telefon", sms: "SMS", whatsapp: "WhatsApp", email: "E-posta" };
const FINANCE_TYPE_LABELS = { PAYMENT: "Ödeme", TREATMENT_COST: "Tedavi" };
const FINANCE_TYPE_STYLES = {
  PAYMENT: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  TREATMENT_COST: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

const LAB_REQUIRED_KEYWORDS = [
  "implant", "İmplant",
  "zirkonyum", "zirconium", "zirkon",
  "porselen", "porcelain",
  "kron", "crown",
  "köprü", "bridge",
  "protez", "denture", "prosthesis", "prosthetic",
  "laminate", "veneer",
  "onlay", "inlay",
  "splint",
  "plak", "aligner",
  "night guard", "gece plağı",
  "ortodontik", "orthodontic",
  "cerrahi kılavuz", "surgical guide",
  "abutment", "dayanak",
  "wax-up", "mock-up", "mockup",
  "metal destekli", "metal-supported",
];

function isLabRequired(itemName, catalogItem) {
  if (catalogItem?.requiresLab) return true;
  const lower = (itemName || "").toLocaleLowerCase("tr-TR");
  return LAB_REQUIRED_KEYWORDS.some(k => lower.includes(k.toLocaleLowerCase("tr-TR")));
}

const EMPTY_PAYMENT_FORM = {
  amount: "",
  method: "CASH",
  doctorId: "",
  vatRate: "0",
  notes: "",
  reference: "",
  paidAt: "",
};

function toDateInputValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function openPrintWindow(title, html) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=760");
  if (!printWindow) return;

  printWindow.document.write(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
        h1, h2, h3, p { margin: 0; }
        .stack { display: flex; flex-direction: column; gap: 16px; }
        .row { display: flex; justify-content: space-between; gap: 16px; }
        .muted { color: #64748b; }
        .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
        .badge { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        .table th { font-size: 12px; text-transform: uppercase; color: #64748b; }
        .positive { color: #047857; font-weight: 700; }
        .negative { color: #b45309; font-weight: 700; }
        .summaryGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        @media print { body { margin: 16px; } }
      </style>
    </head>
    <body>${html}</body>
  </html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 200);
}

// ─── DND DRAGGABLE TOOTH ITEM ────────────────────────────────────────────────

function DraggableToothItem({ item, onStatusChange }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-background transition-colors group ${isDragging ? "shadow-lg ring-2 ring-primary/30 border-primary/30" : "border-border/50 hover:border-border hover:bg-muted/20"}`}
    >
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing flex-shrink-0 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
        {item.teeth?.[0]?.toothCode || "?"}
      </span>
      <span className="text-xs font-medium flex-1 truncate min-w-0">{item.name}</span>
      <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
        {formatCurrency(item.price)}
      </span>
      <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-0.5 hover:opacity-80 transition-opacity ${ITEM_STATUS_COLORS[item.status] || ""}`}>
              {ITEM_STATUS_LABELS[item.status] || item.status}
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => (
              <DropdownMenuItem key={v} onClick={() => onStatusChange(item.id, v)} className="text-xs">
                <span className={`mr-2 w-2 h-2 rounded-full inline-block ${v === "COMPLETED" ? "bg-teal-500" : v === "IN_PROGRESS" ? "bg-purple-500" : v === "CANCELLED" ? "bg-red-500" : "bg-slate-400"}`} />
                {l}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function DraggableGroupItem({
  item,
  expanded,
  onToggleExpand,
  onBulkStatusChange,
  onChildStatusChange,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `group:${item.id}` });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };
  const doneCount = item.children?.filter((c) => c.status === "COMPLETED").length || 0;
  const inProgressCount = item.children?.filter((c) => c.status === "IN_PROGRESS").length || 0;
  const cancelledCount = item.children?.filter((c) => c.status === "CANCELLED").length || 0;
  const total = item.children?.length || 0;
  const pct = Number.isFinite(item.progress) ? item.progress : total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const progressText =
    item.status === "CANCELLED" || cancelledCount === total
      ? "İptal"
      : doneCount === total
        ? "Tamamlandı"
        : doneCount === 0 && inProgressCount > 0
          ? "Devam Ediyor"
          : doneCount > 0
            ? `${doneCount}/${total}`
            : "Bekleniyor";
  const teethCodes = (item.children || []).map((c) => c.teeth?.[0]?.toothCode).filter(Boolean);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-background transition-colors ${isDragging ? "ring-2 ring-primary/30 border-primary/30 shadow-lg" : "border-border/50"}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{item.name}</div>
          <div className="text-[10px] text-muted-foreground font-mono truncate">
            {teethCodes.slice(0, 6).join(" · ")}{teethCodes.length > 6 ? ` +${teethCodes.length - 6}` : ""}
          </div>
        </div>
        <div className="w-20">
          <Progress value={pct} className="h-1.5" />
          <div className="text-[10px] text-muted-foreground mt-0.5 text-right">{progressText}</div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-0.5 hover:opacity-80 ${ITEM_STATUS_COLORS[item.status] || ""}`}>
                Toplu Durum
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => (
                <DropdownMenuItem key={v} onClick={() => onBulkStatusChange(item.id, v)} className="text-xs">
                  {l}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/30 px-3 py-2 space-y-1.5 bg-muted/10">
          {item.children?.map((child) => (
            <DraggableToothItem key={child.id} item={child} onStatusChange={onChildStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DND SESSION DROP ZONE ────────────────────────────────────────────────────

function SessionDropZone({ session, children, doctors }) {
  const { setNodeRef, isOver } = useDroppable({ id: session.id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border transition-colors ${isOver ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border/50 bg-card"}`}
    >
      {children}
    </div>
  );
}

function UnassignedDropZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({ id: "__unassigned__" });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed transition-colors min-h-[80px] ${isOver ? "border-primary bg-primary/5" : "border-border/40 bg-muted/10"}`}
    >
      {children}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function PatientDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [doctors, setDoctors] = useState([]);
  const [catalog, setCatalog] = useState([]);

  // Plan/item state
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedTeeth, setSelectedTeeth] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});

  // Dialog states
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showPlanSessionDialog, setShowPlanSessionDialog] = useState(false);
  const [showItemSessionDialog, setShowItemSessionDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showFinancePrintDialog, setShowFinancePrintDialog] = useState(false);
  const [showInvoicePreviewDialog, setShowInvoicePreviewDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Form state
  const [currentItem, setCurrentItem] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [editingPlanSession, setEditingPlanSession] = useState(null);
  const [itemForm, setItemForm] = useState({ name: "", price: "", quantity: "1", notes: "", catalogServiceId: "", assignedDoctorId: "" });
  const [planSessionForm, setPlanSessionForm] = useState({ doctorId: "", sessionDate: "", notes: "", status: "PLANNED" });
  const [itemSessionForm, setItemSessionForm] = useState({ sessionDate: "", status: "PLANNED", amount: "", notes: "", doctorId: "" });
  const [planForm, setPlanForm] = useState({ title: "", notes: "" });
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);
  const [selectedFinanceRowIds, setSelectedFinanceRowIds] = useState([]);
  const [invoicePreviewNumber, setInvoicePreviewNumber] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [commForm, setCommForm] = useState({ type: "phone", content: "" });
  const [formRecord, setFormRecord] = useState({ formType: "", status: "PENDING" });

  // Payment Plan State
  const [paymentPlanForm, setPaymentPlanForm] = useState({ totalAmount: "", installmentCount: "1" });
  const [installments, setInstallments] = useState([]);
  const [isInstallmentsDirty, setIsInstallmentsDirty] = useState(false);
  const [pendingCloseAction, setPendingCloseAction] = useState(false);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  // Finance view mode: 'list' | 'table'
  const [financeView, setFinanceView] = useState("list");

  // Laboratory modal state
  const [showLabModal, setShowLabModal] = useState(false);
  const [labPendingItem, setLabPendingItem] = useState(null);
  const [labSuppliers, setLabSuppliers] = useState([]);
  const [labMaterials, setLabMaterials] = useState([]);
  const [labForm, setLabForm] = useState({ labSupplierId: "", labMaterialId: "", color: "", quantity: "1", price: "", description: "" });

  // Edit Plan State
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editPlanData, setEditPlanData] = useState([]);
  const [isEditPlanDirty, setIsEditPlanDirty] = useState(false);
  const [showEditUnsavedDialog, setShowEditUnsavedDialog] = useState(false);
  const [pendingExpandedPlanId, setPendingExpandedPlanId] = useState(null);

  // Media
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const financePrintRef = useRef(null);
  const receiptPrintRef = useRef(null);
  const invoicePrintRef = useRef(null);

  // DnD
  const [activeDragId, setActiveDragId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ─── DATA FETCHING ──────────────────────────────────────────────────────────

  const fetchPatient = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/patients/${id}`);
      const data = await res.json();
      setPatient(data.patient);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPaymentPlans = useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/payment-plans/patient/${id}`);
      const data = await res.json();
      setPaymentPlans(data.paymentPlans || []);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/service-catalog");
      const data = await res.json();
      setCatalog(data.items || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/doctors");
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const planParam = searchParams.get("plan");
    if (tabParam) setActiveTab(tabParam);
    if (planParam) setSelectedPlanId(planParam);
  }, [searchParams]);

  useEffect(() => {
    fetchPatient();
    fetchPaymentPlans();
    fetchCatalog();
    fetchDoctors();
  }, [id, fetchPatient, fetchPaymentPlans, fetchCatalog, fetchDoctors]);

  useEffect(() => {
    if (patient?.treatmentPlans?.length > 0 && !selectedPlanId) {
      setSelectedPlanId(patient.treatmentPlans[0].id);
    }
  }, [patient]);

  useEffect(() => {
    setSelectedFinanceRowIds([]);
  }, [patient?.id, patient?.financeLedger?.length]);

  useEffect(() => {
    if (showItemDialog && selectedTeeth.length > 0) {
      setItemForm((f) => ({ ...f, quantity: String(selectedTeeth.length) }));
    }
  }, [selectedTeeth, showItemDialog]);

  // ─── COMPUTED ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="glass-effect rounded-xl p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Hasta bulunamadı</p>
        <Link to="/patients"><Button variant="outline" className="mt-4">Hastalara Dön</Button></Link>
      </div>
    );
  }

  const fs = patient.financeSummary || { totalTreatmentCost: 0, totalBilled: 0, totalPaid: 0, remaining: 0, treatmentMovementCount: 0, paymentCount: 0 };
  const financeLedger = patient.financeLedger || [];
  const allPlans = patient.treatmentPlans || [];
  const activePlans = allPlans.filter((p) => p.isActive && p.status !== "CANCELLED");
  const selectedPlan = allPlans.find((p) => p.id === selectedPlanId);
  const upcomingAppointments = patient.appointments?.filter((a) => ["SCHEDULED", "CONFIRMED"].includes(a.status)) || [];
  const getInitials = () => `${patient.firstName?.[0] || ""}${patient.lastName?.[0] || ""}`.toUpperCase();
  const selectedFinanceRows = financeLedger.filter((movement) => selectedFinanceRowIds.includes(movement.id));
  const selectedTreatmentFinanceRows = selectedFinanceRows.filter((movement) => movement.type === "TREATMENT_COST");

  // ─── PLAN NAVIGATION ─────────────────────────────────────────────────────────

  const navigateToPlan = (planId) => {
    setSelectedPlanId(planId);
    setActiveTab("items");
  };

  // ─── TREATMENT PLAN CRUD ─────────────────────────────────────────────────────

  const createPlan = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/treatment-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...planForm, patientId: id }),
    });
    if (res.ok) {
      const data = await res.json();
      setShowPlanDialog(false);
      setPlanForm({ title: "", notes: "" });
      fetchPatient();
      if (data.plan?.id) setSelectedPlanId(data.plan.id);
    }
  };

  const updatePlanStatus = async (planId, status) => {
    await fetch(`/api/treatment-plans/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchPatient();
  };

  const togglePlanActive = async (plan) => {
    await fetch(`/api/treatment-plans/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !plan.isActive }),
    });
    fetchPatient();
  };

  // ─── TREATMENT ITEM CRUD ─────────────────────────────────────────────────────

  const selectCatalogItem = (catalogItem) => {
    const qty = selectedTeeth.length > 0 ? String(selectedTeeth.length) : "1";
    setItemForm({ name: catalogItem.name, price: String(catalogItem.defaultPrice / 100), quantity: qty, notes: "", catalogServiceId: catalogItem.id, assignedDoctorId: "" });
    setShowItemDialog(true);
  };

  const createItem = async (e) => {
    e.preventDefault();
    if (!selectedPlanId) return;

    const teethToSend = [...selectedTeeth];
    const qty = teethToSend.length > 0 ? teethToSend.length : (parseInt(itemForm.quantity) || 1);

    const res = await fetch("/api/treatment-plans/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: itemForm.name,
        price: Math.round(parseFloat(itemForm.price) * 100),
        quantity: qty,
        notes: itemForm.notes || undefined,
        catalogServiceId: itemForm.catalogServiceId || undefined,
        treatmentPlanId: selectedPlanId,
        toothCodes: teethToSend,
        assignedDoctorId: itemForm.assignedDoctorId || undefined,
      }),
    });
    const result = await res.json();
    setShowItemDialog(false);

    const catalogItem = catalog.find(c => c.id === itemForm.catalogServiceId);
    const needsLab = isLabRequired(itemForm.name, catalogItem);

    setItemForm({ name: "", price: "", quantity: "1", notes: "", catalogServiceId: "", assignedDoctorId: "" });
    setSelectedTeeth([]);

    if (needsLab && result.item) {
      setLabPendingItem(result.item);
      setLabForm({ labSupplierId: "", labMaterialId: "", color: "", quantity: "1", price: "", description: "" });
      fetchLabData();
      setShowLabModal(true);
    } else {
      fetchPatient();
    }
  };

  const fetchLabData = async () => {
    try {
      const [supRes, matRes] = await Promise.all([
        fetch("/api/laboratory/suppliers").then(r => r.json()),
        fetch("/api/laboratory/materials?activeOnly=true").then(r => r.json()),
      ]);
      setLabSuppliers(supRes.items || []);
      setLabMaterials(matRes.items || []);
    } catch (err) {
      console.error(err);
    }
  };

  const submitLabRelation = async (e) => {
    e.preventDefault();
    if (!labPendingItem) return;

    const selectedMaterial = labMaterials.find(m => m.id === labForm.labMaterialId);
    const price = labForm.price ? Math.round(parseFloat(labForm.price) * 100) : (selectedMaterial?.unitPrice || 0);

    const plan = patient?.treatmentPlans?.find(p => p.id === labPendingItem.treatmentPlanId);
    const patientId = plan?.patientId || patient?.id;

    await fetch("/api/laboratory/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treatmentItemId: labPendingItem.id,
        patientId,
        labSupplierId: labForm.labSupplierId,
        labMaterialId: labForm.labMaterialId,
        price,
        quantity: parseInt(labForm.quantity) || 1,
        color: labForm.color || null,
        description: labForm.description || null,
        doctorId: labPendingItem.assignedDoctorId || null,
      }),
    });
    setShowLabModal(false);
    setLabPendingItem(null);
    fetchPatient();
  };

  const skipLabRelation = () => {
    setShowLabModal(false);
    setLabPendingItem(null);
    fetchPatient();
  };

  const updateItemStatus = async (itemId, status) => {
    await fetch(`/api/treatment-plans/items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchPatient();
  };

  const bulkUpdateGroupStatus = async (groupId, status) => {
    const applyAll = confirm("Bu grup durumunu tüm alt diş kalemlerine uygulamak istiyor musunuz?");
    if (!applyAll) return;
    await fetch(`/api/treatment-plans/items/${groupId}/bulk-status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchPatient();
  };

  const deleteItem = async (itemId) => {
    if (!confirm("Tedavi kalemi silinsin mi?")) return;
    await fetch(`/api/treatment-plans/items/${itemId}`, { method: "DELETE" });
    fetchPatient();
  };

  // ─── ITEM-LEVEL SESSIONS ──────────────────────────────────────────────────────

  const createItemSession = async (e) => {
    e.preventDefault();
    await fetch("/api/treatment-plans/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...itemSessionForm,
        treatmentItemId: currentItem.id,
        amount: Math.round(parseFloat(itemSessionForm.amount || "0") * 100),
        doctorId: itemSessionForm.doctorId || undefined,
      }),
    });
    setShowItemSessionDialog(false);
    setItemSessionForm({ sessionDate: "", status: "PLANNED", amount: "", notes: "", doctorId: "" });
    fetchPatient();
  };

  // ─── PLAN-LEVEL SESSIONS ─────────────────────────────────────────────────────

  const createOrUpdatePlanSession = async (e) => {
    e.preventDefault();
    const url = editingPlanSession
      ? `/api/treatment-plans/plan-sessions/${editingPlanSession.id}`
      : "/api/treatment-plans/plan-sessions";
    const method = editingPlanSession ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...planSessionForm,
        treatmentPlanId: selectedPlanId,
        doctorId: planSessionForm.doctorId || undefined,
      }),
    });
    setShowPlanSessionDialog(false);
    setPlanSessionForm({ doctorId: "", sessionDate: "", notes: "", status: "PLANNED" });
    setEditingPlanSession(null);
    fetchPatient();
  };

  const deletePlanSession = async (sessionId) => {
    if (!confirm("Seans silinsin mi?")) return;
    await fetch(`/api/treatment-plans/plan-sessions/${sessionId}`, { method: "DELETE" });
    fetchPatient();
  };

  // ─── DRAG & DROP ─────────────────────────────────────────────────────────────

  const handleDragStart = (event) => setActiveDragId(event.active.id);

  const handleDragEnd = async (event) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const itemId = activeId.includes(":") ? activeId.split(":")[1] : activeId;
    const targetSessionId = over.id === "__unassigned__" ? null : over.id;

    // Optimistic update
    setPatient((prev) => {
      if (!prev) return prev;
      const updatedPlans = prev.treatmentPlans.map((plan) => {
        if (plan.id !== selectedPlanId) return plan;
        const updatedItems = plan.items.map((item) => {
          // group move
          if (item.id === itemId) {
            return {
              ...item,
              sessionId: targetSessionId,
              children: (item.children || []).map((child) => ({ ...child, sessionId: targetSessionId })),
            };
          }
          const updatedChildren = item.children?.map((child) =>
            child.id === itemId ? { ...child, sessionId: targetSessionId } : child
          ) || [];
          return { ...item, children: updatedChildren };
        });
        return { ...plan, items: updatedItems };
      });
      return { ...prev, treatmentPlans: updatedPlans };
    });

    await fetch(`/api/treatment-plans/items/${itemId}/assign-session`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: targetSessionId }),
    });
    fetchPatient();
  };

  // ─── PAYMENTS ────────────────────────────────────────────────────────────────

  const openNewPaymentDialog = () => {
    setEditingPayment(null);
    setPaymentForm({
      ...EMPTY_PAYMENT_FORM,
      paidAt: toDateInputValue(new Date()),
    });
    setShowPaymentDialog(true);
  };

  const openPaymentDetail = (movement) => {
    if (!movement?.rawPayment) return;

    setEditingPayment(movement.rawPayment);
    setPaymentForm({
      amount: String((movement.rawPayment.amount || 0) / 100),
      method: movement.rawPayment.method || "CASH",
      doctorId: movement.rawPayment.doctorId || "",
      vatRate: String(movement.rawPayment.vatRate ?? 0),
      notes: movement.rawPayment.notes || "",
      reference: movement.rawPayment.reference || "",
      paidAt: toDateInputValue(movement.rawPayment.paidAt),
    });
    setShowPaymentDialog(true);
  };

  const recordPayment = async (e) => {
    e.preventDefault();
    const url = editingPayment ? `/api/billing/payments/${editingPayment.id}` : "/api/billing/payments";
    const method = editingPayment ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editingPayment ? {} : { patientId: id }),
        amount: Math.round(parseFloat(paymentForm.amount) * 100),
        method: paymentForm.method,
        doctorId: paymentForm.doctorId || undefined,
        vatRate: parseInt(paymentForm.vatRate, 10) || 0,
        notes: paymentForm.notes || undefined,
        reference: paymentForm.reference || undefined,
        paidAt: paymentForm.paidAt || undefined,
        ...(editingPayment?.invoiceId ? { invoiceId: editingPayment.invoiceId } : {}),
        ...(editingPayment?.treatmentPlanId ? { treatmentPlanId: editingPayment.treatmentPlanId } : {}),
      }),
    });
    setShowPaymentDialog(false);
    setEditingPayment(null);
    setPaymentForm(EMPTY_PAYMENT_FORM);
    fetchPatient();
  };

  const deletePayment = async () => {
    if (!editingPayment) return;
    if (!confirm("Bu ödeme kaydı iptal edilsin mi?")) return;

    await fetch(`/api/billing/payments/${editingPayment.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    setShowPaymentDialog(false);
    setEditingPayment(null);
    setReceiptPayment(null);
    setPaymentForm(EMPTY_PAYMENT_FORM);
    fetchPatient();
  };

  // ─── PAYMENT PLAN LOGIC ──────────────────────────────────────────────────────

  const handleGenerateInstallments = () => {
    const total = parseFloat(paymentPlanForm.totalAmount);
    const count = parseInt(paymentPlanForm.installmentCount, 10);

    if (isNaN(total) || total <= 0 || isNaN(count) || count <= 0) {
      alert("Lütfen geçerli bir tutar ve taksit sayısı giriniz.");
      return;
    }

    const baseAmount = Math.floor((total / count) * 100) / 100;
    const remainder = total - (baseAmount * count);

    const newInstallments = Array.from({ length: count }).map((_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() + i + 1); // Future dates spaced by 1 month

      let amount = baseAmount;
      if (i === 0) amount += remainder; // Add remainder to first installment

      return {
        id: `inst-${Date.now()}-${i}`,
        amount: amount.toFixed(2),
        dueDate: date.toISOString().split("T")[0],
        status: "PENDING",
      };
    });

    setInstallments(newInstallments);
    setIsInstallmentsDirty(false); // Just generated, not manually modified yet
  };

  const handleInstallmentChange = (id, field, value) => {
    setInstallments(prev => prev.map(inst =>
      inst.id === id ? { ...inst, [field]: value } : inst
    ));
    setIsInstallmentsDirty(true);
  };

  const handlePaymentPlanDialogChange = (open) => {
    if (!open && isInstallmentsDirty) {
      setPendingCloseAction(true);
      setShowUnsavedDialog(true);
      return;
    }

    setShowPaymentPlanDialog(open);
    if (!open) {
      setPaymentPlanForm({ totalAmount: "", installmentCount: "1" });
      setInstallments([]);
      setIsInstallmentsDirty(false);
    }
  };

  const savePaymentPlan = async (e) => {
    e?.preventDefault();
    if (installments.length === 0) return;

    try {
      const res = await fetch("/api/billing/payment-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: id,
          totalAmount: parseInt(parseFloat(paymentPlanForm.totalAmount) * 100, 10), // convert to kuruş
          installments: installments.map(inst => ({
            amount: parseInt(parseFloat(inst.amount) * 100, 10), // convert to kuruş
            dueDate: inst.dueDate,
          })),
        }),
      });

      if (!res.ok) throw new Error("Ödeme planı kaydedilemedi");

      setIsInstallmentsDirty(false);
      setShowPaymentPlanDialog(false);
      setShowUnsavedDialog(false);
      setPaymentPlanForm({ totalAmount: "", installmentCount: "1" });
      setInstallments([]);

      fetchPaymentPlans(); // Refresh plans
    } catch (err) {
      console.error(err);
      alert("Ödeme planı kaydedilirken bir hata oluştu.");
    }
  };

  const discardPaymentPlanChanges = () => {
    setIsInstallmentsDirty(false);
    setShowUnsavedDialog(false);

    if (pendingCloseAction) {
      setShowPaymentPlanDialog(false);
      setPaymentPlanForm({ totalAmount: "", installmentCount: "1" });
      setInstallments([]);
    }
    setPendingCloseAction(false);
  };

  const cancelUnsavedPrompt = () => {
    setShowUnsavedDialog(false);
    setPendingCloseAction(false);
  };

  // ─── EDIT PAYMENT PLAN LOGIC ─────────────────────────────────────────────────

  const handleAccordionChange = (planId) => {
    if (editingPlanId && isEditPlanDirty && planId !== expandedPlanId) {
      setPendingExpandedPlanId(planId);
      setShowEditUnsavedDialog(true);
      return;
    }

    if (editingPlanId && planId !== expandedPlanId) {
      setEditingPlanId(null);
      setEditPlanData([]);
    }

    setExpandedPlanId(planId === expandedPlanId ? null : planId);
  };

  const startEditingPlan = (plan) => {
    setEditingPlanId(plan.id);
    // Normalize amounts kuruş → TL so saveEditedPlan's *100 conversion is always correct
    setEditPlanData(
      JSON.parse(JSON.stringify(plan.installments)).map((inst) => ({
        ...inst,
        amount: inst.amount / 100,
      }))
    );
    setIsEditPlanDirty(false);
  };

  const cancelEditingPlan = () => {
    if (isEditPlanDirty) {
      setPendingExpandedPlanId(expandedPlanId); // Just cancel edit mode without collapsing
      setShowEditUnsavedDialog(true);
      return;
    }
    setEditingPlanId(null);
    setEditPlanData([]);
    setIsEditPlanDirty(false);
  };

  const handleEditInstallmentChange = (instId, field, value) => {
    setEditPlanData(prev => prev.map(inst => {
      if (inst.id === instId) {
        if (field === 'amount' && inst.status === 'PAID') {
          alert('Uyarı: Önceden "Ödendi" olarak işaretlenmiş bir taksitin tutarını değiştiriyorsunuz. Bu finansal tutarsızlığa yol açabilir.');
        }
        return { ...inst, [field]: value };
      }
      return inst;
    }));
    setIsEditPlanDirty(true);
  };

  const removeEditInstallment = (instId) => {
    setEditPlanData(prev => prev.filter(inst => inst.id !== instId));
    setIsEditPlanDirty(true);
  };

  const addEditInstallment = () => {
    setEditPlanData(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        amount: 0,
        dueDate: null,
        status: "PENDING"
      }
    ]);
    setIsEditPlanDirty(true);
  };

  const saveEditedPlan = async () => {
    if (!editingPlanId) return;

    try {
      const res = await fetch(`/api/billing/payment-plans/${editingPlanId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installments: editPlanData.map(inst => ({
            id: String(inst.id).startsWith("temp-") ? undefined : inst.id,
            amount: parseInt(parseFloat(inst.amount) * 100, 10) || 0,
            dueDate: inst.dueDate ? new Date(inst.dueDate).toISOString() : null,
            status: inst.status
          }))
        })
      });

      if (!res.ok) throw new Error("Plan güncellenemedi");

      setIsEditPlanDirty(false);
      setEditingPlanId(null);
      setEditPlanData([]);
      setShowEditUnsavedDialog(false);
      setPendingExpandedPlanId(null);
      fetchPaymentPlans();
    } catch (err) {
      console.error(err);
      alert("Ödeme planı güncellenirken hata oluştu.");
    }
  };

  const discardEditPlanChanges = () => {
    setIsEditPlanDirty(false);
    setShowEditUnsavedDialog(false);

    setEditingPlanId(null);
    setEditPlanData([]);

    if (pendingExpandedPlanId !== undefined) {
      setExpandedPlanId(pendingExpandedPlanId === expandedPlanId ? null : pendingExpandedPlanId);
      setPendingExpandedPlanId(null);
    }
  };

  const cancelEditPlanPrompt = () => {
    setShowEditUnsavedDialog(false);
    setPendingExpandedPlanId(null);
  };

  const toggleFinanceSelection = (movementId) => {
    setSelectedFinanceRowIds((prev) =>
      prev.includes(movementId) ? prev.filter((id) => id !== movementId) : [...prev, movementId]
    );
  };

  const toggleAllFinanceSelection = () => {
    if (selectedFinanceRowIds.length === financeLedger.length) {
      setSelectedFinanceRowIds([]);
      return;
    }
    setSelectedFinanceRowIds(financeLedger.map((movement) => movement.id));
  };

  const selectedFinanceSummary = selectedFinanceRows.reduce((acc, movement) => {
    if (movement.type === "PAYMENT") acc.totalPaid += movement.amount;
    if (movement.type === "TREATMENT_COST") acc.totalTreatmentCost += Math.abs(movement.amount);
    acc.remaining = acc.totalTreatmentCost - acc.totalPaid;
    return acc;
  }, { totalPaid: 0, totalTreatmentCost: 0, remaining: 0 });

  const printFinanceSelection = () => {
    if (!financePrintRef.current) return;
    openPrintWindow("DentAI Finans Ozeti", financePrintRef.current.innerHTML);
  };

  const printReceiptPreview = () => {
    if (!receiptPrintRef.current) return;
    openPrintWindow("DentAI Makbuz", receiptPrintRef.current.innerHTML);
  };

  const printInvoicePreview = () => {
    if (!invoicePrintRef.current) return;
    openPrintWindow("DentAI Fatura Taslagi", invoicePrintRef.current.innerHTML);
  };

  const openInvoicePreview = () => {
    if (!selectedFinanceRows.length) return;
    setInvoicePreviewNumber(generateInvoiceNumber("INV"));
    setShowInvoicePreviewDialog(true);
  };

  const treatmentInvoiceTotal = selectedFinanceRows.reduce(
    (sum, movement) => {
      // Treat treatment costs as positive and payments as negative in the invoice
      if (movement.type === "PAYMENT") return sum - movement.amount;
      return sum + Math.abs(movement.amount);
    },
    0
  );

  // ─── NOTES ───────────────────────────────────────────────────────────────────

  const saveNote = async (e) => {
    e.preventDefault();
    const url = editingNote ? `/api/patients/${id}/notes/${editingNote.id}` : `/api/patients/${id}/notes`;
    await fetch(url, {
      method: editingNote ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteContent }),
    });
    setShowNoteDialog(false);
    setNoteContent("");
    setEditingNote(null);
    fetchPatient();
  };

  const deleteNote = async (noteId) => {
    if (!confirm("Not silinsin mi?")) return;
    await fetch(`/api/patients/${id}/notes/${noteId}`, { method: "DELETE" });
    fetchPatient();
  };

  // ─── COMMUNICATIONS ──────────────────────────────────────────────────────────

  const saveComm = async (e) => {
    e.preventDefault();
    await fetch(`/api/patients/${id}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commForm),
    });
    setShowCommDialog(false);
    setCommForm({ type: "phone", content: "" });
    fetchPatient();
  };

  // ─── FORMS ───────────────────────────────────────────────────────────────────

  const saveFormRecord = async (e) => {
    e.preventDefault();
    await fetch(`/api/patients/${id}/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formRecord),
    });
    setShowFormDialog(false);
    setFormRecord({ formType: "", status: "PENDING" });
    fetchPatient();
  };

  // ─── MEDIA ───────────────────────────────────────────────────────────────────

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const res = await fetch(`/api/patients/${id}/documents`, { method: "POST", body: form });
      if (res.ok) fetchPatient();
      else { const err = await res.json(); alert(err.error || "Yükleme başarısız"); }
    } catch (err) { alert("Yükleme başarısız"); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteDocument = async (docId) => {
    if (!confirm("Belge silinsin mi?")) return;
    await fetch(`/api/patients/${id}/documents/${docId}`, { method: "DELETE" });
    fetchPatient();
  };

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  const handleToothToggle = (toothCode) => {
    setSelectedTeeth((prev) =>
      prev.includes(toothCode) ? prev.filter((t) => t !== toothCode) : [...prev, toothCode]
    );
  };

  const toggleItemExpand = (itemId) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const getGroupProgress = (item) => {
    if (!item.children?.length) {
      // Standalone item — derive from item-level sessions
      const total = item.sessions?.length || 0;
      if (total === 0) return { text: "Bekleniyor", pct: 0 };
      const done = item.sessions?.filter((s) => s.status === "COMPLETED").length || 0;
      if (done === total) return { text: "Tamamlandı", pct: 100 };
      if (done === 0) return { text: "Bekleniyor", pct: item.progress };
      return { text: `${done}/${total}`, pct: item.progress };
    }
    // Group item — derive from child statuses
    const total = item.children.length;
    const done = item.children.filter((c) => c.status === "COMPLETED").length;
    const inProg = item.children.filter((c) => c.status === "IN_PROGRESS").length;
    const cancelled = item.children.filter((c) => c.status === "CANCELLED").length;
    const pct = Number.isFinite(item.progress) ? item.progress : total > 0 ? Math.round((done / total) * 100) : 0;
    if (item.status === "CANCELLED" || cancelled === total) return { text: "İptal", pct: 0 };
    if (done === total) return { text: "Tamamlandı", pct: 100 };
    if (done === 0 && inProg === 0) return { text: "Bekleniyor", pct: 0 };
    if (done === 0 && inProg > 0) return { text: "Devam Ediyor", pct };
    return { text: `${done}/${total}`, pct };
  };

  // Get items for a given session (assigned to it)
  const getSessionItems = (sessionId, planItems) => {
    const all = [];
    for (const item of (planItems || [])) {
      if (item.children?.length) {
        const derivedGroupSession = item.sessionId ?? (
          item.children.every((c) => c.sessionId === item.children[0]?.sessionId)
            ? item.children[0]?.sessionId
            : null
        );
        if (derivedGroupSession === sessionId) all.push(item);
      } else {
        if (item.sessionId === sessionId) all.push(item);
      }
    }
    return all;
  };

  const getUnassignedItems = (planItems) => {
    const all = [];
    for (const item of (planItems || [])) {
      if (item.children?.length) {
        const derivedGroupSession = item.sessionId ?? (
          item.children.every((c) => c.sessionId === item.children[0]?.sessionId)
            ? item.children[0]?.sessionId
            : null
        );
        if (!derivedGroupSession) all.push(item);
      } else {
        if (!item.sessionId) all.push(item);
      }
    }
    return all;
  };

  // Find dragged item for overlay
  const findDraggedItem = (dragId) => {
    const normalizedId = String(dragId).includes(":") ? String(dragId).split(":")[1] : String(dragId);
    for (const plan of allPlans) {
      for (const item of (plan.items || [])) {
        if (item.id === normalizedId) return item;
        for (const child of (item.children || [])) {
          if (child.id === normalizedId) return child;
        }
      }
    }
    return null;
  };

  const draggedItem = activeDragId ? findDraggedItem(activeDragId) : null;

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <Link to="/patients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />Hastalara Dön
      </Link>

      {/* Patient Header */}
      <div className="glass-effect rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {getInitials()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold">{patient.firstName} {patient.lastName}</h1>
              {patient.gender && <Badge variant="secondary">{patient.gender}</Badge>}
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-sm text-muted-foreground">
              {patient.phone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{patient.phone}</div>}
              {patient.email && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{patient.email}</div>}
              {patient.primaryDoctor?.user?.name && <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{patient.primaryDoctor.user.name}</div>}
              {patient.birthDate && <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(patient.birthDate)}</div>}
              {patient.nationalId && <div className="flex items-center gap-1.5 font-mono text-xs">TC: {patient.nationalId}</div>}
            </div>
          </div>
          <Button variant="outline" size="sm"><Edit2 className="h-4 w-4 mr-2" />Düzenle</Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="h-auto p-1 flex-nowrap">
            {[
              { value: "overview", label: "Genel Bakış" },
              { value: "plans", label: "Tedavi Planları" },
              { value: "items", label: "Tedavi Kalemleri" },
              { value: "perio", label: "Perio" },
              { value: "payments", label: "Ödemeler" },
              { value: "notes", label: "Notlar" },
              { value: "media", label: "Medya" },
              { value: "forms", label: "Formlar" },
              { value: "communications", label: "İletişim" },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm whitespace-nowrap">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ══════ OVERVIEW ══════ */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Toplam Ödenen", value: formatCurrency(fs.totalPaid), icon: CreditCard, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "Kalan Bakiye", value: formatCurrency(fs.remaining), icon: CreditCard, color: "text-orange-500", bg: "bg-orange-500/10" },
              { label: "Aktif Tedavi", value: activePlans.length, icon: Stethoscope, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Yaklaşan Randevu", value: upcomingAppointments.length, icon: CalendarPlus, color: "text-purple-500", bg: "bg-purple-500/10" },
            ].map((s) => (
              <div key={s.label} className="glass-effect rounded-xl p-4">
                <div className={`inline-flex p-2 rounded-lg ${s.bg} ${s.color} mb-2`}><s.icon className="h-4 w-4" /></div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recent Appointments */}
          <div className="glass-effect rounded-xl p-5">
            <h3 className="font-semibold mb-3">Son Randevular</h3>
            {!patient.appointments?.length ? (
              <p className="text-sm text-muted-foreground">Randevu kaydı yok</p>
            ) : (
              <div className="space-y-2">
                {patient.appointments.slice(0, 5).map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{appt.reason || "Randevu"}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(appt.startAt)}</div>
                    </div>
                    <Badge variant={["COMPLETED"].includes(appt.status) ? "default" : ["CANCELLED", "NOSHOW"].includes(appt.status) ? "destructive" : "secondary"}>
                      {appt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Treatment Plans — clickable cards */}
          {activePlans.length > 0 && (
            <div className="glass-effect rounded-xl p-5">
              <h3 className="font-semibold mb-3">Aktif Tedavi Planları</h3>
              <div className="space-y-3">
                {activePlans.map((plan) => {
                  const pct = plan.plannedTotal > 0 ? Math.round((plan.completedTotal / plan.plannedTotal) * 100) : 0;
                  return (
                    /* FULLY CLICKABLE CARD */
                    <div
                      key={plan.id}
                      onClick={() => navigateToPlan(plan.id)}
                      className="glass-effect rounded-xl p-4 cursor-pointer hover:ring-1 hover:ring-primary/30 hover:bg-muted/20 transition-all group relative"
                    >
                      <div className="flex items-start gap-3">
                        {/* Left: name + progress */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm group-hover:text-primary transition-colors">{plan.title}</span>
                            {plan.isActive ? (
                              <Badge variant="default" className="text-[10px] h-4">Aktif</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] h-4">Pasif</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{plan.items?.length || 0} kalem</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Progress value={pct} className="h-1.5 flex-1 max-w-[160px]" />
                            <span className="text-xs text-muted-foreground">%{pct}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                            <span>Planlanan: <span className="text-foreground font-medium">{formatCurrency(plan.plannedTotal)}</span></span>
                            <span>Tamamlanan: <span className="text-emerald-600 font-medium">{formatCurrency(plan.completedTotal)}</span></span>
                          </div>
                        </div>
                        {/* Right: status select + actions */}
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Select value={plan.status} onValueChange={(v) => updatePlanStatus(plan.id, v)}>
                            <SelectTrigger className="h-7 text-[11px] border-0 bg-transparent p-0 focus:ring-0 w-auto gap-1">
                              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${PLAN_STATUS_COLORS[plan.status] || ""}`}>
                                {PLAN_STATUS_LABELS[plan.status] || plan.status}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(PLAN_STATUS_LABELS).map(([v, l]) => (
                                <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigateToPlan(plan.id)}>Kalemleri Görüntüle</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => togglePlanActive(plan)}>
                                {plan.isActive ? "Pasif Yap" : "Aktif Yap"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══════ TREATMENT PLANS ══════ */}
        <TabsContent value="plans" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Tedavi Planları</h3>
            <Button size="sm" onClick={() => setShowPlanDialog(true)} className="btn-primary-gradient">
              <Plus className="h-4 w-4 mr-2" />Yeni Plan
            </Button>
          </div>

          {!allPlans.length ? (
            <div className="glass-effect rounded-xl p-10 text-center text-muted-foreground">Tedavi planı yok</div>
          ) : (
            <div className="space-y-3">
              {allPlans.map((plan) => {
                const pct = plan.plannedTotal > 0 ? Math.round((plan.completedTotal / plan.plannedTotal) * 100) : 0;
                return (
                  /* FULLY CLICKABLE CARD */
                  <div
                    key={plan.id}
                    onClick={() => navigateToPlan(plan.id)}
                    className="glass-effect rounded-xl p-4 cursor-pointer hover:ring-1 hover:ring-primary/30 hover:bg-muted/20 transition-all group relative"
                  >
                    <div className="flex items-start gap-3">
                      {/* Left: name + progress */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm group-hover:text-primary transition-colors">{plan.title}</span>
                          {plan.isActive ? (
                            <Badge variant="default" className="text-[10px] h-4">Aktif</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] h-4">Pasif</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{plan.items?.length || 0} kalem</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={pct} className="h-1.5 flex-1 max-w-[160px]" />
                          <span className="text-xs text-muted-foreground">%{pct}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                          <span>Planlanan: <span className="text-foreground font-medium">{formatCurrency(plan.plannedTotal)}</span></span>
                          <span>Tamamlanan: <span className="text-emerald-600 font-medium">{formatCurrency(plan.completedTotal)}</span></span>
                        </div>
                      </div>
                      {/* Right: status select + actions */}
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Select value={plan.status} onValueChange={(v) => updatePlanStatus(plan.id, v)}>
                          <SelectTrigger className="h-7 text-[11px] border-0 bg-transparent p-0 focus:ring-0 w-auto gap-1">
                            <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${PLAN_STATUS_COLORS[plan.status] || ""}`}>
                              {PLAN_STATUS_LABELS[plan.status] || plan.status}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PLAN_STATUS_LABELS).map(([v, l]) => (
                              <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigateToPlan(plan.id)}>Kalemleri Görüntüle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => togglePlanActive(plan)}>
                              {plan.isActive ? "Pasif Yap" : "Aktif Yap"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ══════ TREATMENT ITEMS ══════ */}
        <TabsContent value="items" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* LEFT PANEL */}
            <div className="space-y-4">
              {/* Plan Selector */}
              <div className="glass-effect rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm">Tedavi Planı</h3>
                <Select value={selectedPlanId || ""} onValueChange={setSelectedPlanId}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Plan seçin..." /></SelectTrigger>
                  <SelectContent>
                    {allPlans.map((p) => (<SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>))}
                  </SelectContent>
                </Select>
                {selectedPlan && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Durum:</span>
                    <Select value={selectedPlan.status} onValueChange={(v) => updatePlanStatus(selectedPlan.id, v)}>
                      <SelectTrigger className="h-6 text-[11px] border-0 bg-transparent p-0 focus:ring-0 w-auto">
                        <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${PLAN_STATUS_COLORS[selectedPlan.status] || ""}`}>
                          {PLAN_STATUS_LABELS[selectedPlan.status] || selectedPlan.status}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PLAN_STATUS_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!allPlans.length && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setShowPlanDialog(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />Plan Oluştur
                  </Button>
                )}
              </div>

              {/* Service Catalog */}
              <div className="glass-effect rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-sm">Hizmet Kataloğu</h3>
                <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {Object.entries(catalog.reduce((acc, item) => {
                    const cat = item.category || "Diğer";
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                  }, {})).map(([category, items]) => (
                    <div key={category}>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1 mt-2 first:mt-0">{category}</div>
                      {items.map((item) => (
                        <button key={item.id} onClick={() => selectCatalogItem(item)}
                          className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-primary/10 hover:text-primary transition-colors flex justify-between items-center group">
                          <span className="truncate mr-2">{item.name}</span>
                          <span className="text-muted-foreground group-hover:text-primary whitespace-nowrap">{formatCurrency(item.defaultPrice)}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="space-y-4">
              {/* Odontogram */}
              <div className="glass-effect rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-sm">Diş Seçimi (FDI)</h3>
                  {selectedTeeth.length > 0 && (
                    <Button size="sm" onClick={() => setShowItemDialog(true)} className="btn-primary-gradient h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />Kalem Ekle ({selectedTeeth.length} diş)
                    </Button>
                  )}
                </div>
                <Odontogram selected={selectedTeeth} onToggle={handleToothToggle} />
              </div>

              {selectedPlan ? (
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <div className="space-y-4">
                    {/* ── PLAN SESSIONS AREA ── */}
                    <div className="glass-effect rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold text-sm">Seans Planlaması</h3>
                          {selectedPlan.planSessions?.length > 0 && (
                            <Badge variant="secondary" className="text-[10px]">{selectedPlan.planSessions.length}</Badge>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => { setEditingPlanSession(null); setPlanSessionForm({ doctorId: "", sessionDate: "", notes: "", status: "PLANNED" }); setShowPlanSessionDialog(true); }}>
                          <Plus className="h-3 w-3 mr-1" />Yeni Seans
                        </Button>
                      </div>

                      {!selectedPlan.planSessions?.length ? (
                        <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                          Henüz seans planlanmamış.<br />
                          <span className="text-xs">Seans oluşturun ve tedavi kalemlerini sürükleyerek atayın.</span>
                        </div>
                      ) : (
                        <div className="p-4 space-y-3">
                          {selectedPlan.planSessions.map((session) => {
                            const sessionItems = getSessionItems(session.id, selectedPlan.items);
                            const doneCount = sessionItems.filter((i) => i.status === "COMPLETED").length;
                            return (
                              <SessionDropZone key={session.id} session={session}>
                                <div className="p-3">
                                  {/* Session Header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${SESSION_STATUS_COLORS[session.status] || ""}`}>
                                        {SESSION_STATUS_LABELS[session.status] || session.status}
                                      </span>
                                      <span className="text-sm font-semibold">{formatDate(session.sessionDate)}</span>
                                      {session.doctor?.name && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <User className="h-3 w-3" />{session.doctor.name}
                                        </span>
                                      )}
                                      {sessionItems.length > 0 && (
                                        <span className="text-xs text-muted-foreground">{doneCount}/{sessionItems.length} tamamlandı</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="icon" className="h-6 w-6"
                                        onClick={() => { setEditingPlanSession(session); setPlanSessionForm({ doctorId: session.doctorId || "", sessionDate: session.sessionDate?.split("T")[0] || "", notes: session.notes || "", status: session.status }); setShowPlanSessionDialog(true); }}>
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                        onClick={() => deletePlanSession(session.id)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  {/* Droppable item list */}
                                  <div className="space-y-1.5 min-h-[48px]">
                                    {sessionItems.length === 0 ? (
                                      <div className="text-center text-xs text-muted-foreground py-2 border border-dashed border-border/40 rounded-lg">
                                        Kalem sürükleyerek atayın
                                      </div>
                                    ) : (
                                      sessionItems.map((it) => (
                                        it.children?.length ? (
                                          <DraggableGroupItem
                                            key={it.id}
                                            item={it}
                                            expanded={expandedItems[it.id] === true}
                                            onToggleExpand={() => toggleItemExpand(it.id)}
                                            onBulkStatusChange={bulkUpdateGroupStatus}
                                            onChildStatusChange={updateItemStatus}
                                          />
                                        ) : (
                                          <DraggableToothItem key={it.id} item={it} onStatusChange={updateItemStatus} />
                                        )
                                      ))
                                    )}
                                  </div>
                                </div>
                              </SessionDropZone>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── TREATMENT ITEMS (parent/child hierarchy) ── */}
                    <div className="glass-effect rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                        <h3 className="font-semibold text-sm">{selectedPlan.title} — Tedavi Kalemleri</h3>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowItemDialog(true)}>
                          <Plus className="h-3 w-3 mr-1" />Kalem Ekle
                        </Button>
                      </div>

                      {!selectedPlan.items?.length ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                          <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          Tedavi kalemi yok
                        </div>
                      ) : (
                        <div className="p-3 space-y-2">
                          {selectedPlan.items.map((item) => {
                            const isGroup = item.children?.length > 0;
                            // COLLAPSED BY DEFAULT — only expanded if explicitly toggled
                            const isExpanded = expandedItems[item.id] === true;
                            const { text: progressText, pct: progressPct } = getGroupProgress(item);

                            if (isGroup) {
                              // ── GROUP ITEM (multi-tooth) ──────────────────────
                              const teethCodes = item.children
                                .map((c) => c.teeth?.[0]?.toothCode)
                                .filter(Boolean);
                              const progressColor =
                                progressPct === 100 ? "text-teal-600" :
                                  progressPct > 0 ? "text-purple-600" : "text-slate-500";

                              return (
                                <div key={item.id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                                  {/* Clickable group header */}
                                  <div
                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                                    onClick={() => toggleItemExpand(item.id)}
                                  >
                                    {/* Chevron */}
                                    <div className="flex-shrink-0 text-muted-foreground">
                                      {isExpanded
                                        ? <ChevronDown className="h-4 w-4" />
                                        : <ChevronRight className="h-4 w-4" />}
                                    </div>

                                    {/* Name + teeth + progress */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm">{item.name}</span>
                                        {teethCodes.length > 0 && (
                                          <span className="text-[11px] text-muted-foreground font-mono">
                                            {teethCodes.slice(0, 6).join(" · ")}
                                            {teethCodes.length > 6 && ` +${teethCodes.length - 6}`}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <Progress value={progressPct} className="h-1.5 w-24 flex-shrink-0" />
                                        <span className={`text-[11px] font-semibold ${progressColor}`}>
                                          {progressText}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Right side: total price + derived status badge + delete */}
                                    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <span className="text-sm font-semibold tabular-nums">
                                        {formatCurrency(item.price * item.quantity)}
                                      </span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ITEM_STATUS_COLORS[item.status] || ""}`}>
                                        {ITEM_STATUS_LABELS[item.status] || item.status}
                                      </span>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 font-medium flex items-center gap-0.5 hover:bg-muted/40">
                                            Toplu Durum
                                            <ChevronDown className="h-2.5 w-2.5" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                          {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => (
                                            <DropdownMenuItem key={v} onClick={() => bulkUpdateGroupStatus(item.id, v)} className="text-xs">
                                              {l}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      <Button
                                        variant="ghost" size="icon"
                                        className="h-6 w-6 text-muted-foreground/50 hover:text-destructive transition-colors"
                                        onClick={() => deleteItem(item.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Expanded child list */}
                                  {isExpanded && (
                                    <div className="border-t border-border/40 bg-muted/5">
                                      {/* Child header row */}
                                      <div className="grid grid-cols-[24px_40px_1fr_80px_110px_56px] gap-2 px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/30">
                                        <div />
                                        <div>Diş</div>
                                        <div>İşlem</div>
                                        <div className="text-right">Fiyat</div>
                                        <div className="text-center">Durum</div>
                                        <div />
                                      </div>
                                      <div className="divide-y divide-border/25">
                                        {item.children.map((child) => {
                                          const toothCode = child.teeth?.[0]?.toothCode;
                                          const sessionDate = child.planSession
                                            ? formatDate(child.planSession.sessionDate)
                                            : null;
                                          return (
                                            <div
                                              key={child.id}
                                              className="grid grid-cols-[24px_40px_1fr_80px_110px_56px] gap-2 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors group/child"
                                            >
                                              {/* Status dot */}
                                              <div className="flex items-center justify-center">
                                                <div className={`w-2 h-2 rounded-full ${child.status === "COMPLETED" ? "bg-teal-500" :
                                                  child.status === "IN_PROGRESS" ? "bg-purple-500" :
                                                    child.status === "CANCELLED" ? "bg-red-400" :
                                                      "bg-slate-300 dark:bg-slate-600"
                                                  }`} />
                                              </div>

                                              {/* Tooth code */}
                                              <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-1 py-0.5 rounded text-center">
                                                {toothCode || "?"}
                                              </span>

                                              {/* Name + session context */}
                                              <div className="min-w-0">
                                                <div className="text-xs font-medium truncate">{child.name}</div>
                                                {sessionDate && (
                                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Clock className="h-2.5 w-2.5" />{sessionDate}
                                                    {child.planSession?.doctor?.name && (
                                                      <span>· {child.planSession.doctor.name}</span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>

                                              {/* Per-tooth price */}
                                              <span className="text-xs font-medium text-right tabular-nums">
                                                {formatCurrency(child.price)}
                                              </span>

                                              {/* Status — visible dropdown trigger */}
                                              <div onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <button className={`w-full text-[10px] px-2 py-1 rounded-md border font-medium flex items-center justify-between gap-1 hover:opacity-80 transition-opacity ${ITEM_STATUS_COLORS[child.status] || ""}`}>
                                                      {ITEM_STATUS_LABELS[child.status] || child.status}
                                                      <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" />
                                                    </button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end" className="w-36">
                                                    {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => (
                                                      <DropdownMenuItem
                                                        key={v}
                                                        onClick={() => updateItemStatus(child.id, v)}
                                                        className="text-xs"
                                                      >
                                                        <span className={`mr-2 w-2 h-2 rounded-full inline-block ${v === "COMPLETED" ? "bg-teal-500" : v === "IN_PROGRESS" ? "bg-purple-500" : v === "CANCELLED" ? "bg-red-400" : "bg-slate-400"}`} />
                                                        {l}
                                                      </DropdownMenuItem>
                                                    ))}
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </div>

                                              {/* Actions */}
                                              <div className="flex items-center justify-end gap-0.5">
                                                <Button
                                                  variant="ghost" size="icon"
                                                  className="h-6 w-6 opacity-0 group-hover/child:opacity-100 transition-opacity"
                                                  title="Seans Ekle"
                                                  onClick={() => {
                                                    setCurrentItem(child);
                                                    setItemSessionForm({ sessionDate: "", status: "PLANNED", amount: "", notes: "", doctorId: "" });
                                                    setShowItemSessionDialog(true);
                                                  }}
                                                >
                                                  <Plus className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                  variant="ghost" size="icon"
                                                  className="h-6 w-6 opacity-0 group-hover/child:opacity-100 transition-opacity text-destructive/60 hover:text-destructive"
                                                  onClick={() => deleteItem(child.id)}
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {/* Group footer: totals */}
                                      <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 bg-muted/20">
                                        <span className="text-[11px] text-muted-foreground">
                                          {item.children.filter((c) => c.status === "COMPLETED").length} / {item.children.length} tamamlandı
                                        </span>
                                        <span className="text-xs font-semibold">
                                          Toplam: {formatCurrency(item.price * item.quantity)}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // ── STANDALONE ITEM (single tooth or non-tooth) ───────
                            const toothCode = item.teeth?.[0]?.toothCode;
                            const progressColor =
                              progressPct === 100 ? "text-teal-600" :
                                progressPct > 0 ? "text-purple-600" : "text-slate-500";

                            return (
                              <div key={item.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                                {/* Standalone header */}
                                <div className="flex items-center gap-3 px-4 py-3">
                                  {/* Status dot */}
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === "COMPLETED" ? "bg-teal-500" :
                                    item.status === "IN_PROGRESS" ? "bg-purple-500" :
                                      item.status === "CANCELLED" ? "bg-red-400" :
                                        "bg-slate-300 dark:bg-slate-600"
                                    }`} />

                                  {/* Name + tooth code */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-sm">{item.name}</span>
                                      {toothCode && (
                                        <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                          Diş {toothCode}
                                        </span>
                                      )}
                                    </div>
                                    {item.sessions?.length > 0 && (
                                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                        <span className={progressColor}>{progressText}</span>
                                        <span>·</span>
                                        <span>{item.sessions.length} seans</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Price */}
                                  <span className="text-sm font-semibold tabular-nums flex-shrink-0">
                                    {formatCurrency(item.price)}
                                  </span>

                                  {/* Status dropdown */}
                                  <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className={`text-[10px] px-2 py-1 rounded-md border font-medium flex items-center gap-1 hover:opacity-80 transition-opacity ${ITEM_STATUS_COLORS[item.status] || ""}`}>
                                          {ITEM_STATUS_LABELS[item.status] || item.status}
                                          <ChevronDown className="h-2.5 w-2.5" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-36">
                                        {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => (
                                          <DropdownMenuItem
                                            key={v}
                                            onClick={() => updateItemStatus(item.id, v)}
                                            className="text-xs"
                                          >
                                            <span className={`mr-2 w-2 h-2 rounded-full inline-block ${v === "COMPLETED" ? "bg-teal-500" : v === "IN_PROGRESS" ? "bg-purple-500" : v === "CANCELLED" ? "bg-red-400" : "bg-slate-400"}`} />
                                            {l}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>

                                  {/* Add session + delete */}
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-6 text-[11px] flex-shrink-0 gap-0.5"
                                    onClick={() => {
                                      setCurrentItem(item);
                                      setItemSessionForm({ sessionDate: "", status: "PLANNED", amount: "", notes: "", doctorId: "" });
                                      setShowItemSessionDialog(true);
                                    }}
                                  >
                                    <Plus className="h-3 w-3" />Seans
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-6 w-6 flex-shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
                                    onClick={() => deleteItem(item.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>

                                {/* Item-level sessions */}
                                {item.sessions?.length > 0 && (
                                  <div className="border-t border-border/30 divide-y divide-border/20">
                                    {item.sessions.map((s) => (
                                      <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.status === "COMPLETED" ? "bg-teal-500" : s.status === "CANCELLED" ? "bg-red-400" : "bg-blue-400"}`} />
                                        <span className={`font-medium flex-shrink-0 ${s.status === "COMPLETED" ? "text-teal-600" : s.status === "CANCELLED" ? "text-destructive" : "text-blue-600"}`}>
                                          {SESSION_STATUS_LABELS[s.status] || s.status}
                                        </span>
                                        <span className="text-muted-foreground">{formatDate(s.sessionDate)}</span>
                                        {s.doctor?.name && (
                                          <span className="text-primary flex items-center gap-1">
                                            <User className="h-3 w-3" />{s.doctor.name}
                                          </span>
                                        )}
                                        {s.amount > 0 && (
                                          <span className="text-emerald-600 font-medium ml-auto">{formatCurrency(s.amount)}</span>
                                        )}
                                        {s.notes && <span className="text-muted-foreground truncate max-w-[100px]">{s.notes}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── UNASSIGNED ITEMS (DnD target) ── */}
                    {selectedPlan.planSessions?.length > 0 && (() => {
                      const unassigned = getUnassignedItems(selectedPlan.items);
                      return unassigned.length > 0 ? (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                            Seansa Atanmamış Kalemler
                          </div>
                          <UnassignedDropZone>
                            <div className="p-3 space-y-1.5">
                              {unassigned.map((it) => (
                                it.children?.length ? (
                                  <DraggableGroupItem
                                    key={it.id}
                                    item={it}
                                    expanded={expandedItems[it.id] === true}
                                    onToggleExpand={() => toggleItemExpand(it.id)}
                                    onBulkStatusChange={bulkUpdateGroupStatus}
                                    onChildStatusChange={updateItemStatus}
                                  />
                                ) : (
                                  <DraggableToothItem key={it.id} item={it} onStatusChange={updateItemStatus} />
                                )
                              ))}
                            </div>
                          </UnassignedDropZone>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* DnD Overlay */}
                  <DragOverlay>
                    {draggedItem && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary bg-background shadow-xl opacity-90">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        {draggedItem.children?.length ? (
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            Grup · {draggedItem.children.length} diş
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {draggedItem.teeth?.[0]?.toothCode || "?"}
                          </span>
                        )}
                        <span className="text-xs font-medium">{draggedItem.name}</span>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              ) : (
                <div className="glass-effect rounded-xl p-10 text-center text-muted-foreground text-sm">
                  Tedavi kalemlerini görmek için bir plan seçin
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══════ PERIO ══════ */}
        <TabsContent value="perio" className="mt-4">
          <div className="glass-effect rounded-xl p-5">
            <h3 className="font-semibold mb-4">Periodontal Grafik</h3>
            {!patient.perioChartEntries?.length ? (
              <p className="text-sm text-muted-foreground">Perio ölçümü kaydı yok</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50">
                      {["Diş", "Cep Derinliği", "Kanama", "Mobilite", "Tarih", "Notlar"].map((h) => (
                        <th key={h} className="text-left py-2 px-3 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {patient.perioChartEntries.slice(0, 30).map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono font-semibold">{entry.toothNumber}</td>
                        <td className="py-2 px-3">
                          <span className={entry.pocketDepth >= 5 ? "text-destructive font-semibold" : entry.pocketDepth >= 4 ? "text-orange-500" : "text-muted-foreground"}>
                            {entry.pocketDepth != null ? `${entry.pocketDepth}mm` : "—"}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {entry.bleeding ? <Badge variant="destructive" className="text-[10px] h-4">Evet</Badge> : <Badge variant="secondary" className="text-[10px] h-4">Yok</Badge>}
                        </td>
                        <td className="py-2 px-3">{entry.mobility ?? "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{formatDate(entry.recordedAt)}</td>
                        <td className="py-2 px-3 text-muted-foreground">{entry.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════ PAYMENTS ══════ */}
        <TabsContent value="payments" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-semibold">Finans & Ödemeler</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Hasta finans hareketleri, tahsilatlar ve uygulanan tedavi maliyetleri</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={openNewPaymentDialog} className="btn-primary-gradient">
                <Plus className="h-4 w-4 mr-2" />Ödeme Al
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                onClick={() => setShowPaymentPlanDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />Ödeme Planı Ekle
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedFinanceRows.length}
                onClick={() => setShowFinancePrintDialog(true)}
              >
                <Printer className="h-4 w-4 mr-2" />Yazdır
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedFinanceRows.length}
                onClick={openInvoicePreview}
              >
                <FileText className="h-4 w-4 mr-2" />Fatura Kes
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="glass-effect rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Toplam Uygulanan Tedavi</div>
              <div className="text-xl font-bold">{formatCurrency(fs.totalTreatmentCost ?? fs.totalBilled ?? 0)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{fs.treatmentMovementCount || 0} maliyet hareketi</div>
            </div>
            <div className="glass-effect rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Ödenen</div>
              <div className="text-xl font-bold text-emerald-500">{formatCurrency(fs.totalPaid)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{fs.paymentCount || 0} ödeme hareketi</div>
            </div>
            <div className="glass-effect rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Kalan Bakiye</div>
              <div className={`text-xl font-bold ${fs.remaining > 0 ? "text-orange-500" : fs.remaining < 0 ? "text-blue-600" : "text-emerald-500"}`}>
                {formatCurrency(fs.remaining)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {fs.remaining > 0 ? "Tahsilat bekleniyor" : fs.remaining < 0 ? "Hasta alacaklı" : "Hesap kapatıldı"}
              </div>
            </div>
          </div>

          {paymentPlans.length > 0 && (
            <div className="glass-effect rounded-xl overflow-hidden mt-6 border border-primary/20 bg-primary/5">
              <div className="px-5 py-3 border-b border-primary/20 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-primary">Kayıtlı Ödeme Planları</div>
                  <div className="text-xs text-muted-foreground">Aktif taksitlendirme planları</div>
                </div>
                <div className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full">
                  {paymentPlans.length} Plan
                </div>
              </div>
              <div className="divide-y divide-primary/10">
                {paymentPlans.map(plan => (
                  <div key={plan.id} className="flex flex-col">
                    <div
                      className="px-5 py-3 flex items-center justify-between hover:bg-white/40 cursor-pointer transition-colors"
                      onClick={() => handleAccordionChange(plan.id)}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{plan.installments.length} Taksitli Ödeme Planı</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(plan.createdAt).toLocaleDateString("tr-TR")} tarihinde oluşturuldu
                        </span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col text-right">
                          <span className="font-bold text-sm">{formatCurrency(plan.totalAmount)}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${plan.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {plan.status === 'COMPLETED' ? 'Tamamlandı' : 'Aktif'}
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleAccordionChange(plan.id); }}>
                          <span className="sr-only">İzle</span>
                          {expandedPlanId === plan.id ? '▲' : '▼'}
                        </Button>
                      </div>
                    </div>

                    {expandedPlanId === plan.id && (
                      <div className="bg-white/50 p-4 border-t border-primary/10">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Taksit Detayları</h4>
                          {editingPlanId !== plan.id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => startEditingPlan(plan)}
                            >
                              <Edit2 className="h-3 w-3 mr-1.5" /> Düzenle
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={cancelEditingPlan}
                              >
                                İptal
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs btn-primary-gradient"
                                onClick={saveEditedPlan}
                              >
                                <Save className="h-3 w-3 mr-1.5" /> Kaydet
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="border border-border/60 rounded-xl overflow-hidden bg-white">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-muted/30 text-muted-foreground">
                              <tr>
                                <th className="py-2 px-4 font-medium">Sıra</th>
                                <th className="py-2 px-4 font-medium min-w-[140px]">Vade Tarihi</th>
                                <th className="py-2 px-4 font-medium text-right min-w-[120px]">Tutar</th>
                                <th className="py-2 px-4 font-medium pl-6 min-w-[120px]">Durum</th>
                                {editingPlanId === plan.id && <th className="py-2 px-4 font-medium w-10"></th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                              {(editingPlanId === plan.id ? editPlanData : plan.installments).map((inst, idx) => (
                                <tr key={inst.id} className="hover:bg-muted/5 transition-colors">
                                  <td className="py-2 px-4 text-muted-foreground">{idx + 1}. Taksit</td>

                                  {/* Due Date Column */}
                                  <td className="py-1.5 px-4 font-medium">
                                    {editingPlanId === plan.id ? (
                                      <Input
                                        type="date"
                                        className="h-8 max-w-[150px] text-xs"
                                        value={inst.dueDate ? new Date(inst.dueDate).toISOString().split('T')[0] : ''}
                                        onChange={(e) => handleEditInstallmentChange(inst.id, 'dueDate', e.target.value)}
                                      />
                                    ) : (
                                      inst.dueDate ? new Date(inst.dueDate).toLocaleDateString("tr-TR") : "-"
                                    )}
                                  </td>

                                  {/* Amount Column */}
                                  <td className="py-1.5 px-4 text-right font-semibold">
                    {editingPlanId === plan.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 w-24 text-right text-xs ml-auto"
                        value={inst.amount}
                        onChange={(e) => handleEditInstallmentChange(inst.id, 'amount', parseFloat(e.target.value))}
                      />
                                    ) : (
                                      formatCurrency(inst.amount)
                                    )}
                                  </td>

                                  {/* Status Column */}
                                  <td className="py-1.5 px-4 pl-6">
                                    {editingPlanId === plan.id ? (
                                      <select
                                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={inst.status}
                                        onChange={(e) => handleEditInstallmentChange(inst.id, 'status', e.target.value)}
                                      >
                                        <option value="PENDING">Bekliyor</option>
                                        <option value="PAID">Ödendi</option>
                                        <option value="CANCELLED">İptal</option>
                                      </select>
                                    ) : (
                                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${inst.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600' : inst.status === 'CANCELLED' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600'}`}>
                                        {inst.status === 'PAID' ? 'Ödendi' : inst.status === 'CANCELLED' ? 'İptal' : 'Bekliyor'}
                                      </span>
                                    )}
                                  </td>

                                  {/* Delete Column (Edit Mode Only) */}
                                  {editingPlanId === plan.id && (
                                    <td className="py-1.5 px-2 text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                        onClick={() => removeEditInstallment(inst.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                              ))}

                              {editingPlanId === plan.id && (
                                <tr>
                                  <td colSpan={5} className="py-2 px-4">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs w-full border border-dashed border-border/60 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                                      onClick={addEditInstallment}
                                    >
                                      <Plus className="h-3 w-3 mr-1" /> Taksit Ekle
                                    </Button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit Unsaved Changes Prompt */}
          <Dialog open={showEditUnsavedDialog} onOpenChange={(open) => {
            if (!open) cancelEditPlanPrompt();
          }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-warning">
                  <AlertCircle className="h-5 w-5" />
                  Kaydedilmemiş Değişiklikler
                </DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground py-2">
                Ödeme planı düzenlemeleriniz henüz kaydedilmedi. Çıkmadan önce n'apalım?
              </p>
              <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                <Button type="button" variant="ghost" onClick={discardEditPlanChanges}>
                  Değişiklikleri Sil
                </Button>
                <div className="flex-1"></div>
                <Button type="button" variant="outline" onClick={() => setShowEditUnsavedDialog(false)}>
                  İptal
                </Button>
                <Button type="button" className="btn-primary-gradient" onClick={saveEditedPlan}>
                  Kaydet & Kapat
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="glass-effect rounded-xl overflow-hidden mt-6">
            <div className="px-5 py-3 border-b border-border/50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Hasta Finans Defteri</div>
                <div className="text-xs text-muted-foreground">Tedavi maliyetleri ve tahsilatlar tek akışta gösterilir</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">
                  {selectedFinanceRows.length > 0 ? `${selectedFinanceRows.length} satır seçili` : `${financeLedger.length} toplam hareket`}
                </div>
                {/* View toggle */}
                <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setFinanceView("list")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${financeView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <AlignLeft className="h-3 w-3" /> Liste
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanceView("table")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${financeView === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <TableIcon className="h-3 w-3" /> Tablo
                  </button>
                </div>
              </div>
            </div>

            {!financeLedger.length ? (
              <div className="py-12 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Finans hareketi yok</p>
              </div>
            ) : financeView === "list" ? (
              <>
                <div className="px-5 py-2 border-b border-border/40 bg-muted/10 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={financeLedger.length > 0 && selectedFinanceRowIds.length === financeLedger.length}
                      onChange={toggleAllFinanceSelection}
                    />
                    Tümünü Seç
                  </label>
                  {selectedFinanceRows.length > 0 && (
                    <span className="text-primary normal-case tracking-normal font-medium">
                      Seçili toplam: {formatCurrency(selectedFinanceSummary.totalPaid - selectedFinanceSummary.totalTreatmentCost)}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border/30 max-h-[620px] overflow-y-auto">
                  {financeLedger.map((movement) => {
                    const isSelected = selectedFinanceRowIds.includes(movement.id);
                    const isPayment = movement.type === "PAYMENT";
                    const amountClass = isPayment ? "text-emerald-600" : "text-amber-700";
                    return (
                      <div
                        key={movement.id}
                        className={`px-5 py-3 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/10"} ${isPayment ? "cursor-pointer" : ""}`}
                        onClick={() => { if (isPayment) openPaymentDetail(movement); }}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-border"
                            checked={isSelected}
                            onChange={() => toggleFinanceSelection(movement.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isPayment ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-700"}`}>
                            {isPayment ? <CreditCard className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{movement.title}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${FINANCE_TYPE_STYLES[movement.type] || ""}`}>
                                {FINANCE_TYPE_LABELS[movement.type] || movement.type}
                              </span>
                              {movement.invoiceRef?.number && (
                                <span className="text-[10px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground">
                                  Fatura: {movement.invoiceRef.number}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5">{movement.description}</div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {movement.doctorName && <span>Dr. {movement.doctorName}</span>}
                              {movement.treatmentPlanTitle && <span>• {movement.treatmentPlanTitle}</span>}
                              {movement.toothCodes?.length > 0 && <span>• Diş {movement.toothCodes.join(", ")}</span>}
                              {movement.paymentMethod && <span>• {PAYMENT_METHOD_LABELS[movement.paymentMethod] || movement.paymentMethod}</span>}
                              {movement.vatRate > 0 && <span>• KDV %{movement.vatRate}</span>}
                              {movement.reference && <span>• Ref: {movement.reference}</span>}
                              <span>• {formatDate(movement.occurredAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="text-right min-w-[120px]">
                              <div className={`text-sm font-bold ${amountClass}`}>
                                {isPayment ? "+" : "-"}{formatCurrency(Math.abs(movement.amount))}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">{formatDateTime(movement.occurredAt)}</div>
                            </div>
                            {isPayment && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openPaymentDetail(movement)}>
                                    <Edit className="h-3.5 w-3.5 mr-2" />Detay / Düzenle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setReceiptPayment(movement.rawPayment)}>
                                    <FileText className="h-3.5 w-3.5 mr-2" />Makbuz Oluştur
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-3 border-t border-border/50 bg-muted/10 flex items-center gap-4">
                  <div className="flex-1 text-xs font-semibold text-muted-foreground">
                    {financeLedger.length} hareket • {selectedFinanceRows.length ? `${selectedFinanceRows.length} seçili` : "Seçim yok"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Seçili tahsilat: <span className="font-semibold text-emerald-600">{formatCurrency(selectedFinanceSummary.totalPaid)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Seçili maliyet: <span className="font-semibold text-amber-700">{formatCurrency(selectedFinanceSummary.totalTreatmentCost)}</span>
                  </div>
                </div>
              </>
            ) : (
              /* ── TABLE VIEW ── */
              <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 text-muted-foreground sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide w-10">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-border"
                          checked={financeLedger.length > 0 && selectedFinanceRowIds.length === financeLedger.length}
                          onChange={toggleAllFinanceSelection}
                        />
                      </th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">Tür</th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">Tarih</th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide text-right">Tutar</th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">Yöntem</th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">Hekim</th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">KDV</th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">Açıklama</th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">Ref No</th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide">Fatura</th>
                      <th className="py-2.5 px-4 font-medium text-[11px] uppercase tracking-wide w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {financeLedger.map((movement) => {
                      const isSelected = selectedFinanceRowIds.includes(movement.id);
                      const isPayment = movement.type === "PAYMENT";
                      return (
                        <tr
                          key={movement.id}
                          className={`transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/5"} ${isPayment ? "cursor-pointer" : ""}`}
                          onClick={() => { if (isPayment) openPaymentDetail(movement); }}
                        >
                          <td className="py-2 px-4">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-border"
                              checked={isSelected}
                              onChange={() => toggleFinanceSelection(movement.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="py-2 px-4">
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${FINANCE_TYPE_STYLES[movement.type] || ""}`}>
                              {FINANCE_TYPE_LABELS[movement.type] || movement.type}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(movement.occurredAt)}
                          </td>
                          <td className="py-2 px-4 text-right font-semibold whitespace-nowrap">
                            <span className={isPayment ? "text-emerald-600" : "text-amber-700"}>
                              {isPayment ? "+" : "-"}{formatCurrency(Math.abs(movement.amount))}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-xs">
                            {movement.paymentMethod
                              ? <span className="px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground font-medium">{PAYMENT_METHOD_LABELS[movement.paymentMethod] || movement.paymentMethod}</span>
                              : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="py-2 px-4 text-xs">
                            {movement.doctorName
                              ? <span className="text-foreground">Dr. {movement.doctorName}</span>
                              : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="py-2 px-4 text-xs">
                            {movement.vatRate > 0
                              ? <span className="px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground font-medium">%{movement.vatRate}</span>
                              : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="py-2 px-4 text-xs text-muted-foreground max-w-[160px] truncate">
                            {movement.description || movement.note || <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="py-2 px-4 text-xs font-mono text-muted-foreground">
                            {movement.reference || <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="py-2 px-4 text-xs text-muted-foreground">
                            {movement.invoiceRef?.number
                              ? <span className="px-1.5 py-0.5 rounded bg-muted/40 font-medium">{movement.invoiceRef.number}</span>
                              : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {isPayment && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openPaymentDetail(movement)}>
                                    <Edit className="h-3.5 w-3.5 mr-2" />Detay / Düzenle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setReceiptPayment(movement.rawPayment)}>
                                    <FileText className="h-3.5 w-3.5 mr-2" />Makbuz Oluştur
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-5 py-3 border-t border-border/50 bg-muted/10 flex items-center gap-4">
                  <div className="flex-1 text-xs font-semibold text-muted-foreground">
                    {financeLedger.length} hareket
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Toplam tahsilat: <span className="font-semibold text-emerald-600">{formatCurrency(financeLedger.filter(m => m.type === "PAYMENT").reduce((s, m) => s + m.amount, 0))}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Toplam maliyet: <span className="font-semibold text-amber-700">{formatCurrency(financeLedger.filter(m => m.type === "TREATMENT_COST").reduce((s, m) => s + Math.abs(m.amount), 0))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════ NOTES ══════ */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Klinik Notlar</h3>
            <Button size="sm" onClick={() => { setEditingNote(null); setNoteContent(""); setShowNoteDialog(true); }} className="btn-primary-gradient">
              <Plus className="h-4 w-4 mr-2" />Not Ekle
            </Button>
          </div>
          {!patient.patientNotes?.length ? (
            <div className="glass-effect rounded-xl p-10 text-center text-muted-foreground">Not kaydı yok</div>
          ) : (
            <div className="space-y-3">
              {patient.patientNotes.map((note) => (
                <div key={note.id} className="glass-effect rounded-xl p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
                          {note.author?.name?.[0] || "?"}
                        </div>
                        <span className="text-sm font-medium">{note.author?.name || "Bilinmiyor"}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingNote(note); setNoteContent(note.content); setShowNoteDialog(true); }}>
                          <Edit className="h-3.5 w-3.5 mr-2" />Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteNote(note.id)} className="text-destructive">
                          <Trash className="h-3.5 w-3.5 mr-2" />Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════ MEDIA ══════ */}
        <TabsContent value="media" className="mt-4">
          <div className="glass-effect rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Medya ve Belgeler</h3>
              <div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,video/mp4" onChange={handleFileUpload} />
                <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />{uploading ? "Yükleniyor..." : "Dosya Yükle"}
                </Button>
              </div>
            </div>
            {!patient.documents?.length ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
                <FileText className="h-10 w-10 opacity-30" />
                <p className="text-sm">Medya veya belge yok</p>
                <p className="text-xs">X-ışınları, fotoğraflar ve belgeler burada görünecek</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {patient.documents.map((doc) => (
                  <div key={doc.id} className="border border-border/50 rounded-lg p-2 hover:bg-muted/20 transition-colors group relative">
                    {doc.mimeType?.startsWith("image/") ? (
                      <img src={`/uploads/${doc.storageKey}`} alt={doc.title} className="w-full h-24 object-cover rounded mb-2"
                        onError={(e) => { e.target.style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-24 bg-muted/30 rounded mb-2 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="text-xs font-medium truncate">{doc.title}</div>
                    <div className="text-xs text-muted-foreground">{doc.type} · {formatDate(doc.createdAt)}</div>
                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                      <a href={`/uploads/${doc.storageKey}`} target="_blank" rel="noreferrer"
                        className="h-6 w-6 rounded bg-background border border-border flex items-center justify-center hover:bg-muted">
                        <Eye className="h-3 w-3" />
                      </a>
                      <button onClick={() => deleteDocument(doc.id)}
                        className="h-6 w-6 rounded bg-background border border-destructive/50 flex items-center justify-center hover:bg-destructive/10 text-destructive">
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════ FORMS ══════ */}
        <TabsContent value="forms" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Form ve Onaylar</h3>
            <Button size="sm" onClick={() => setShowFormDialog(true)} className="btn-primary-gradient">
              <Plus className="h-4 w-4 mr-2" />Form Ekle
            </Button>
          </div>
          {!patient.patientForms?.length ? (
            <div className="glass-effect rounded-xl p-10 text-center text-muted-foreground">Form kaydı yok</div>
          ) : (
            <div className="glass-effect rounded-xl overflow-hidden divide-y divide-border/40">
              {patient.patientForms.map((form) => (
                <div key={form.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{form.formType}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(form.createdAt)}</div>
                  </div>
                  <Badge variant={form.status === "SIGNED" ? "default" : form.status === "REJECTED" ? "destructive" : "secondary"} className="text-xs">
                    {form.status === "SIGNED" ? "İmzalandı" : form.status === "REJECTED" ? "Reddedildi" : "Bekliyor"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════ COMMUNICATIONS ══════ */}
        <TabsContent value="communications" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">İletişim Geçmişi</h3>
            <Button size="sm" onClick={() => setShowCommDialog(true)} className="btn-primary-gradient">
              <Plus className="h-4 w-4 mr-2" />İletişim Ekle
            </Button>
          </div>
          {!patient.patientCommunications?.length ? (
            <div className="glass-effect rounded-xl p-10 text-center text-muted-foreground">İletişim kaydı yok</div>
          ) : (
            <div className="space-y-2">
              {patient.patientCommunications.map((comm) => {
                const Icon = COMM_TYPE_ICONS[comm.type] || MessageSquare;
                return (
                  <div key={comm.id} className="glass-effect rounded-xl p-4 flex gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-xs h-4">{COMM_TYPE_LABELS[comm.type] || comm.type}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(comm.createdAt)}</span>
                        {comm.createdByUser?.name && <span className="text-xs text-muted-foreground">· {comm.createdByUser.name}</span>}
                      </div>
                      <p className="text-sm">{comm.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ══════════ DIALOGS ══════════ */}

      {/* Plan Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Tedavi Planı</DialogTitle></DialogHeader>
          <form onSubmit={createPlan} className="space-y-4">
            <div className="space-y-1.5"><Label>Plan Adı *</Label>
              <Input value={planForm.title} onChange={(e) => setPlanForm((f) => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="space-y-1.5"><Label>Notlar</Label>
              <Textarea value={planForm.notes} onChange={(e) => setPlanForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPlanDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">Oluştur</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Treatment Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Tedavi Kalemi Ekle</DialogTitle></DialogHeader>
          <form onSubmit={createItem} className="space-y-4">
            <div className="space-y-1.5"><Label>Hizmet Adı *</Label>
              <Input value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Birim Fiyat (TL) *</Label>
                <Input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Adet {selectedTeeth.length > 0 && <span className="text-xs text-primary">(diş sayısına göre)</span>}</Label>
                <Input type="number" value={itemForm.quantity} onChange={(e) => setItemForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            {itemForm.price && itemForm.quantity && (
              <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                <span className="text-muted-foreground">Toplam: </span>
                <span className="font-semibold text-primary">
                  {formatCurrency(Math.round(parseFloat(itemForm.price || "0") * 100) * (parseInt(itemForm.quantity) || 1))}
                </span>
                {parseInt(itemForm.quantity) > 1 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({formatCurrency(Math.round(parseFloat(itemForm.price || "0") * 100))} × {itemForm.quantity} diş)
                  </span>
                )}
              </div>
            )}
            <div className="space-y-1.5"><Label>Hekim</Label>
              <Select value={itemForm.assignedDoctorId || "__none__"} onValueChange={(v) => setItemForm((f) => ({ ...f, assignedDoctorId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Hekim seçin (opsiyonel)..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Atanmamış</SelectItem>
                  {doctors.map((d) => (<SelectItem key={d.user?.id} value={d.user?.id}>{d.user?.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Seçili Dişler</Label>
                {selectedTeeth.length > 0 && (
                  <span className="text-xs font-semibold text-primary">
                    {selectedTeeth.length} diş seçili → {selectedTeeth.length > 1 ? `${selectedTeeth.length} ayrı kalem oluşturulacak` : "1 kalem"}
                  </span>
                )}
              </div>
              <div className="p-3 border rounded-lg bg-muted/20">
                <Odontogram selected={selectedTeeth} onToggle={handleToothToggle} />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notlar</Label>
              <Input value={itemForm.notes} onChange={(e) => setItemForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowItemDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">Ekle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Laboratory Material Selection Modal */}
      <Dialog open={showLabModal} onOpenChange={(open) => { if (!open) skipLabRelation(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Laboratuvar Malzemesi Seçin</DialogTitle></DialogHeader>
          <form onSubmit={submitLabRelation} className="space-y-4">
            <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
              <span className="text-muted-foreground">Tedavi: </span>
              <span className="font-semibold">{labPendingItem?.name}</span>
            </div>
            <div className="space-y-1.5"><Label>Laboratuvar Tedarikçisi *</Label>
              <Select value={labForm.labSupplierId || "__none__"} onValueChange={(v) => {
                const sid = v === "__none__" ? "" : v;
                setLabForm(f => ({ ...f, labSupplierId: sid, labMaterialId: "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Tedarikçi seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Seçin...</SelectItem>
                  {labSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Malzeme Tipi *</Label>
              <Select value={labForm.labMaterialId || "__none__"} onValueChange={(v) => {
                const mid = v === "__none__" ? "" : v;
                const mat = labMaterials.find(m => m.id === mid);
                setLabForm(f => ({ ...f, labMaterialId: mid, price: mat ? String(mat.unitPrice / 100) : f.price }));
              }}>
                <SelectTrigger><SelectValue placeholder="Malzeme seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Seçin...</SelectItem>
                  {labMaterials.filter(m => !labForm.labSupplierId || m.labSupplierId === labForm.labSupplierId).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name} — {m.supplier?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Renk / Shade</Label>
                <Input value={labForm.color} onChange={(e) => setLabForm(f => ({ ...f, color: e.target.value }))} placeholder="ör: A2" />
              </div>
              <div className="space-y-1.5"><Label>Adet</Label>
                <Input type="number" min="1" value={labForm.quantity} onChange={(e) => setLabForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label>Birim Fiyat</Label>
                <Input type="number" step="0.01" value={labForm.price} onChange={(e) => setLabForm(f => ({ ...f, price: e.target.value }))} placeholder="Otomatik" />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Açıklama (opsiyonel)</Label>
              <Input value={labForm.description} onChange={(e) => setLabForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={skipLabRelation}>Atla</Button>
              <Button type="submit" className="btn-primary-gradient" disabled={!labForm.labSupplierId || !labForm.labMaterialId}>Onayla</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Plan Session Dialog */}
      <Dialog open={showPlanSessionDialog} onOpenChange={setShowPlanSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlanSession ? "Seansı Düzenle" : "Yeni Seans Oluştur"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createOrUpdatePlanSession} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Seans Tarihi *</Label>
                <Input type="date" value={planSessionForm.sessionDate}
                  onChange={(e) => setPlanSessionForm((f) => ({ ...f, sessionDate: e.target.value }))} required />
              </div>
              <div className="space-y-1.5"><Label>Durum</Label>
                <Select value={planSessionForm.status} onValueChange={(v) => setPlanSessionForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANNED">Planlandı</SelectItem>
                    <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                    <SelectItem value="CANCELLED">İptal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Seansı Yapan Hekim</Label>
              <Select value={planSessionForm.doctorId || "__none__"} onValueChange={(v) => setPlanSessionForm((f) => ({ ...f, doctorId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Hekim seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Atanmamış</SelectItem>
                  {doctors.map((d) => (<SelectItem key={d.user?.id} value={d.user?.id}>{d.user?.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notlar</Label>
              <Textarea value={planSessionForm.notes} onChange={(e) => setPlanSessionForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPlanSessionDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">{editingPlanSession ? "Güncelle" : "Oluştur"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Item-Level Session Dialog */}
      <Dialog open={showItemSessionDialog} onOpenChange={setShowItemSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seans Ekle{currentItem ? ` — ${currentItem.name}${currentItem.teeth?.[0]?.toothCode ? ` (Diş ${currentItem.teeth[0].toothCode})` : ""}` : ""}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createItemSession} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Seans Tarihi *</Label>
                <Input type="date" value={itemSessionForm.sessionDate}
                  onChange={(e) => setItemSessionForm((f) => ({ ...f, sessionDate: e.target.value }))} required />
              </div>
              <div className="space-y-1.5"><Label>Durum</Label>
                <Select value={itemSessionForm.status} onValueChange={(v) => setItemSessionForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANNED">Planlandı</SelectItem>
                    <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                    <SelectItem value="CANCELLED">İptal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Hekim</Label>
              <Select value={itemSessionForm.doctorId || "__none__"} onValueChange={(v) => setItemSessionForm((f) => ({ ...f, doctorId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Hekim seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Atanmamış</SelectItem>
                  {doctors.map((d) => (<SelectItem key={d.user?.id} value={d.user?.id}>{d.user?.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Tutar (TL)</Label>
              <Input type="number" step="0.01" value={itemSessionForm.amount}
                onChange={(e) => setItemSessionForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Notlar</Label>
              <Textarea value={itemSessionForm.notes} onChange={(e) => setItemSessionForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowItemSessionDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">Ekle</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => {
        setShowPaymentDialog(open);
        if (!open) {
          setEditingPayment(null);
          setPaymentForm(EMPTY_PAYMENT_FORM);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              {editingPayment ? "Ödeme Detayı" : "Ödeme Al"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {editingPayment ? "Ödeme kaydını düzenleyin" : "Yeni tahsilat kaydı oluşturun"}
            </p>
          </DialogHeader>
          <form onSubmit={recordPayment} className="space-y-4 pt-1">
            {/* Row 1: Amount + Method */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tutar (TL) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ödeme Yöntemi</Label>
                <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Nakit</SelectItem>
                    <SelectItem value="CARD">Kredi Kartı</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Banka Transferi</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                    <SelectItem value="OTHER">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Date + Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ödeme Tarihi</Label>
                <Input
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Referans / Makbuz No</Label>
                <Input
                  placeholder="İsteğe bağlı"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                />
              </div>
            </div>

            {/* Row 3: Doctor + VAT */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hekim</Label>
                <Select
                  value={paymentForm.doctorId || "__none__"}
                  onValueChange={(v) => setPaymentForm((f) => ({ ...f, doctorId: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Hekim seçin (isteğe bağlı)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Seçilmedi —</SelectItem>
                    {doctors.map((doc) => (
                      <SelectItem key={doc.user?.id} value={doc.user?.id}>{doc.user?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>KDV Oranı (%)</Label>
                <Select
                  value={paymentForm.vatRate}
                  onValueChange={(v) => setPaymentForm((f) => ({ ...f, vatRate: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">KDV Yok (%0)</SelectItem>
                    <SelectItem value="1">%1 KDV</SelectItem>
                    <SelectItem value="10">%10 KDV</SelectItem>
                    <SelectItem value="20">%20 KDV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* KDV breakdown — only shown when vatRate > 0 and amount is entered */}
            {parseInt(paymentForm.vatRate, 10) > 0 && parseFloat(paymentForm.amount) > 0 && (
              <div className="rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5 text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>KDV Hariç Tutar</span>
                  <span className="font-medium text-foreground">
                    {(parseFloat(paymentForm.amount) / (1 + parseInt(paymentForm.vatRate, 10) / 100)).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>KDV ({paymentForm.vatRate}%)</span>
                  <span className="font-medium text-foreground">
                    {(parseFloat(paymentForm.amount) - parseFloat(paymentForm.amount) / (1 + parseInt(paymentForm.vatRate, 10) / 100)).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t border-border/40 pt-1 mt-1">
                  <span>Toplam (KDV Dahil)</span>
                  <span className="text-primary">{parseFloat(paymentForm.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <Textarea
                placeholder="Ödeme açıklaması, not..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <DialogFooter className="gap-2 pt-1">
              {editingPayment ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setReceiptPayment(editingPayment)}>
                    <FileText className="h-4 w-4 mr-2" />Makbuz
                  </Button>
                  <Button type="button" variant="outline" className="text-destructive" onClick={deletePayment}>
                    <Trash className="h-4 w-4 mr-2" />Sil
                  </Button>
                </>
              ) : null}
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">{editingPayment ? "Güncelle" : "Kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiptPayment} onOpenChange={(open) => !open && setReceiptPayment(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Makbuz Önizleme</DialogTitle></DialogHeader>
          <div ref={receiptPrintRef} className="space-y-4 text-sm">
            <div className="rounded-xl border border-border/60 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{patient.branch?.name || patient.organization?.name || "DentAI Klinik"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{patient.branch?.address || "Klinik adresi tanımlı değil"}</p>
                  {patient.branch?.phone && <p className="text-xs text-muted-foreground">{patient.branch.phone}</p>}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Makbuz</div>
                  <div className="font-semibold">{receiptPayment?.reference || receiptPayment?.id}</div>
                  <div className="text-xs text-muted-foreground mt-1">{receiptPayment?.paidAt ? formatDateTime(receiptPayment.paidAt) : "—"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Hasta</div>
                  <div className="font-medium mt-1">{patient.firstName} {patient.lastName}</div>
                  {patient.phone && <div className="text-xs text-muted-foreground mt-1">{patient.phone}</div>}
                </div>
                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Tahsilat Bilgisi</div>
                  <div className="font-medium mt-1">{formatCurrency(receiptPayment?.amount || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{PAYMENT_METHOD_LABELS[receiptPayment?.method] || receiptPayment?.method || "—"}</div>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">Açıklama</div>
                <div className="mt-1">{receiptPayment?.notes || "Hasta finans kaydı için tahsilat makbuzu."}</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceiptPayment(null)}>Kapat</Button>
            <Button type="button" className="btn-primary-gradient" onClick={printReceiptPreview}>
              <Printer className="h-4 w-4 mr-2" />Yazdır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFinancePrintDialog} onOpenChange={setShowFinancePrintDialog}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>Seçili Finans Hareketleri</DialogTitle></DialogHeader>
          <div ref={financePrintRef} className="space-y-4 text-sm">
            <div className="rounded-xl border border-border/60 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Finans Hareket Özeti</h3>
                  <p className="text-xs text-muted-foreground mt-1">{patient.firstName} {patient.lastName}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{formatDateTime(new Date())}</div>
                  <div>{selectedFinanceRows.length} satır</div>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium text-muted-foreground">Tür</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Açıklama</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Tarih</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFinanceRows.map((movement) => (
                      <tr key={movement.id} className="border-t border-border/40">
                        <td className="px-3 py-2">{FINANCE_TYPE_LABELS[movement.type] || movement.type}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{movement.description}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {[movement.doctorName, movement.treatmentPlanTitle, movement.toothCodes?.length ? `Diş ${movement.toothCodes.join(", ")}` : null].filter(Boolean).join(" • ") || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2">{formatDate(movement.occurredAt)}</td>
                        <td className={`px-3 py-2 font-semibold ${movement.type === "PAYMENT" ? "text-emerald-600" : "text-amber-700"}`}>
                          {movement.type === "PAYMENT" ? "+" : "-"}{formatCurrency(Math.abs(movement.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Seçili Tedavi</div>
                  <div className="font-semibold mt-1">{formatCurrency(selectedFinanceSummary.totalTreatmentCost)}</div>
                </div>
                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Seçili Ödeme</div>
                  <div className="font-semibold mt-1 text-emerald-600">{formatCurrency(selectedFinanceSummary.totalPaid)}</div>
                </div>
                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Seçili Bakiye</div>
                  <div className="font-semibold mt-1">{formatCurrency(selectedFinanceSummary.remaining)}</div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowFinancePrintDialog(false)}>Kapat</Button>
            <Button type="button" className="btn-primary-gradient" onClick={printFinanceSelection}>
              <Printer className="h-4 w-4 mr-2" />Yazdır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInvoicePreviewDialog} onOpenChange={setShowInvoicePreviewDialog}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>Fatura Taslağı</DialogTitle></DialogHeader>
          <div ref={invoicePrintRef} className="space-y-4 text-sm">
            <div className="rounded-xl border border-border/60 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{patient.organization?.name || "DentAI Klinik"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{patient.branch?.address || "Klinik adresi tanımlı değil"}</p>
                  {patient.organization?.taxNo && <p className="text-xs text-muted-foreground">Vergi No: {patient.organization.taxNo}</p>}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Taslak Fatura</div>
                  <div className="font-semibold">{invoicePreviewNumber}</div>
                  <div className="text-xs text-muted-foreground mt-1">{formatDate(new Date())}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Hasta</div>
                  <div className="font-medium mt-1">{patient.firstName} {patient.lastName}</div>
                  {patient.phone && <div className="text-xs text-muted-foreground mt-1">{patient.phone}</div>}
                </div>
                <div className="rounded-lg bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Kapsam</div>
                  <div className="font-medium mt-1">{selectedFinanceRows.length} satır seçildi</div>
                  <div className="text-xs text-muted-foreground mt-1">Bu görünüm yalnızca taslak önizlemedir, henüz kaydedilmez.</div>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium text-muted-foreground">Tedavi</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Plan / Diş</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Tarih</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFinanceRows.map((movement) => (
                      <tr key={movement.id} className="border-t border-border/40">
                        <td className="px-3 py-2">
                          <div className="font-medium">{movement.description}</div>
                          {movement.doctorName && <div className="text-xs text-muted-foreground mt-1">Dr. {movement.doctorName}</div>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {[movement.treatmentPlanTitle, movement.toothCodes?.length ? `Diş ${movement.toothCodes.join(", ")}` : null].filter(Boolean).join(" • ") || "—"}
                        </td>
                        <td className="px-3 py-2">{formatDate(movement.occurredAt)}</td>
                        <td className={`px-3 py-2 font-semibold ${movement.type === "PAYMENT" ? "text-emerald-600" : "text-amber-700"}`}>
                          {movement.type === "PAYMENT" ? "-" : ""}{formatCurrency(Math.abs(movement.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <div className="w-full max-w-xs rounded-lg bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ara Toplam</span>
                    <span className="font-medium">{formatCurrency(treatmentInvoiceTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>Genel Toplam</span>
                    <span>{formatCurrency(treatmentInvoiceTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowInvoicePreviewDialog(false)}>Kapat</Button>
            <Button type="button" className="btn-primary-gradient" onClick={printInvoicePreview}>
              <Printer className="h-4 w-4 mr-2" />Yazdır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingNote ? "Notu Düzenle" : "Not Ekle"}</DialogTitle></DialogHeader>
          <form onSubmit={saveNote} className="space-y-4">
            <div className="space-y-1.5"><Label>Not *</Label>
              <Textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={4} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNoteDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">Kaydet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Communication Dialog */}
      <Dialog open={showCommDialog} onOpenChange={setShowCommDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>İletişim Kaydı Ekle</DialogTitle></DialogHeader>
          <form onSubmit={saveComm} className="space-y-4">
            <div className="space-y-1.5"><Label>İletişim Türü</Label>
              <Select value={commForm.type} onValueChange={(v) => setCommForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Telefon</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-posta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>İçerik *</Label>
              <Textarea value={commForm.content} onChange={(e) => setCommForm((f) => ({ ...f, content: e.target.value }))} rows={3} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCommDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">Kaydet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Plan Dialog */}
      <Dialog open={showPaymentPlanDialog} onOpenChange={handlePaymentPlanDialogChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ödeme Planı Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/20 border border-border/40">
              <div className="space-y-1.5">
                <Label>Toplam Tutar (TL)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentPlanForm.totalAmount}
                  onChange={(e) => setPaymentPlanForm(f => ({ ...f, totalAmount: e.target.value }))}
                  placeholder="Örn. 50000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Taksit Sayısı (Ay)</Label>
                <Input
                  type="number"
                  min="1"
                  max="48"
                  value={paymentPlanForm.installmentCount}
                  onChange={(e) => setPaymentPlanForm(f => ({ ...f, installmentCount: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" className="w-full btn-primary-gradient" onClick={handleGenerateInstallments}>
                  Taksitlendir
                </Button>
              </div>
            </div>

            {installments.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Taksit Tablosu</h3>
                <div className="border border-border/60 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/30 text-muted-foreground">
                      <tr>
                        <th className="py-2 px-4 font-medium">Taksit</th>
                        <th className="py-2 px-4 font-medium">Tutar (TL)</th>
                        <th className="py-2 px-4 font-medium">Vade Tarihi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((inst, index) => (
                        <tr key={inst.id} className="border-t border-border/40 hover:bg-muted/10 transition-colors">
                          <td className="py-2 px-4 font-medium">{index + 1}. Taksit</td>
                          <td className="py-2 px-4">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 max-w-[120px]"
                              value={inst.amount}
                              onChange={(e) => handleInstallmentChange(inst.id, "amount", e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-4">
                            <Input
                              type="date"
                              className="h-8 max-w-[150px]"
                              value={inst.dueDate}
                              onChange={(e) => handleInstallmentChange(inst.id, "dueDate", e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => handlePaymentPlanDialogChange(false)}>
              İptal
            </Button>
            <Button
              type="button"
              className="btn-primary-gradient"
              onClick={savePaymentPlan}
              disabled={installments.length === 0}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Prompt */}
      <Dialog open={showUnsavedDialog} onOpenChange={(open) => {
        if (!open) cancelUnsavedPrompt();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              Kaydedilmemiş Değişiklikler
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-2">
            Taksit tablosunda yaptığınız manuely değişiklikler henüz kaydedilmedi. Çıkmadan önce kaydetmek ister misiniz?
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={discardPaymentPlanChanges}>
              Değişiklikleri Sil
            </Button>
            <div className="flex-1"></div>
            <Button type="button" variant="outline" onClick={cancelUnsavedPrompt}>
              İptal
            </Button>
            <Button type="button" className="btn-primary-gradient" onClick={savePaymentPlan}>
              Kaydet & Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Record Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Form / Onay Ekle</DialogTitle></DialogHeader>
          <form onSubmit={saveFormRecord} className="space-y-4">
            <div className="space-y-1.5"><Label>Form Türü *</Label>
              <Select value={formRecord.formType} onValueChange={(v) => setFormRecord((f) => ({ ...f, formType: v }))}>
                <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KVKK Onayı">KVKK Onayı</SelectItem>
                  <SelectItem value="Tedavi Onam Formu">Tedavi Onam Formu</SelectItem>
                  <SelectItem value="Anamnez Formu">Anamnez Formu</SelectItem>
                  <SelectItem value="İmplant Onam">İmplant Onam</SelectItem>
                  <SelectItem value="Ortodonti Onam">Ortodonti Onam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Durum</Label>
              <Select value={formRecord.status} onValueChange={(v) => setFormRecord((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Bekliyor</SelectItem>
                  <SelectItem value="SIGNED">İmzalandı</SelectItem>
                  <SelectItem value="REJECTED">Reddedildi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowFormDialog(false)}>İptal</Button>
              <Button type="submit" className="btn-primary-gradient">Kaydet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
