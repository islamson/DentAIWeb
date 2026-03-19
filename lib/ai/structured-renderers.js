/**
 * Structured renderers - schema-safe formatters for exact data types.
 * Raw content must be grounded in structured fields only.
 * LLM can polish wording, but these provide deterministic fallbacks.
 */

const { METRICS } = require('./assistant-contracts');

function formatCurrency(amount) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function renderCount(structuredContext) {
  const count = structuredContext?.count ?? structuredContext?.totalAppointmentPatients;
  if (typeof count !== 'number') return null;
  const period = structuredContext?.period?.label || structuredContext?.period || structuredContext?.date;
  if (period) return `${period} için toplam ${count}.`;
  return `Toplam ${count}.`;
}

function renderAmount(structuredContext) {
  const amount =
    structuredContext?.revenueAmount ??
    structuredContext?.collectionAmount ??
    structuredContext?.pendingCollectionAmount ??
    structuredContext?.outstandingBalanceAmount ??
    structuredContext?.overdueReceivablesAmount ??
    structuredContext?.totalValue ??
    structuredContext?.totals?.remainingBalance;
  if (amount == null) return null;
  const period = structuredContext?.period?.label || structuredContext?.period;
  if (period) return `${period} için ${formatCurrency(amount)}.`;
  return formatCurrency(amount);
}

function renderPercentage(structuredContext) {
  const pct =
    structuredContext?.completionPercentage ??
    structuredContext?.femalePercentage ??
    structuredContext?.malePercentage ??
    structuredContext?.percentageChange;
  if (typeof pct !== 'number') return null;
  return `%${pct}`;
}

function renderGenderDemographics(structuredContext) {
  const total = structuredContext?.totalAppointmentPatients ?? 0;
  const female = structuredContext?.femaleCount ?? 0;
  const male = structuredContext?.maleCount ?? 0;
  const femalePct = structuredContext?.femalePercentage ?? (total > 0 ? Math.round((female / total) * 10000) / 100 : 0);
  const malePct = structuredContext?.malePercentage ?? (total > 0 ? Math.round((male / total) * 10000) / 100 : 0);
  const period = structuredContext?.period?.label || '';

  if (total === 0) return `${period} için randevu alan hasta bulunmuyor.`;

  const parts = [];
  if (female > 0) parts.push(`${female} kadın hasta (%${femalePct})`);
  if (male > 0) parts.push(`${male} erkek hasta (%${malePct})`);
  return `${period} için toplam ${total} hasta randevu aldı. ${parts.join(', ')}.`;
}

function renderAppointmentList(structuredContext) {
  const appointments = structuredContext?.appointments;
  if (!Array.isArray(appointments) || appointments.length === 0) return null;

  const period = structuredContext?.period?.label || structuredContext?.date || '';
  const lines = appointments.slice(0, 20).map((a) => {
    const date = a.startAt ? new Date(a.startAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const patient = a.patientName || '-';
    const doctor = a.doctorName || '-';
    const status = a.status || '';
    return `• ${date} - ${patient} (${doctor}) ${status}`;
  });
  const more = appointments.length > 20 ? `\n... ve ${appointments.length - 20} randevu daha.` : '';
  return `${period} randevuları:\n${lines.join('\n')}${more}`;
}

// ─── Phase 4: New structured renderers ───────────────────────────

function renderTreatmentList(structuredContext) {
  const items = structuredContext?.treatmentItems;
  if (!Array.isArray(items) || items.length === 0) return 'Tamamlanan tedavi bulunmuyor.';

  const period = structuredContext?.period?.label || '';
  const doctor = structuredContext?.doctor?.name || '';
  const header = doctor
    ? `${doctor} - ${period} tamamlanan tedaviler:`
    : `${period} tamamlanan tedaviler:`;
  const lines = items.slice(0, 20).map((i) => {
    const date = i.completedAt ? new Date(i.completedAt).toLocaleDateString('tr-TR') : '-';
    const patient = i.patientName || '-';
    const price = i.price != null ? formatCurrency(i.price) : '';
    const tooth = i.tooth ? ` (Diş: ${i.tooth})` : '';
    return `• ${i.name}${tooth} - ${patient} - ${date} ${price}`;
  });
  const more = items.length > 20 ? `\n... ve ${items.length - 20} tedavi daha.` : '';
  return `${header}\n${lines.join('\n')}${more}`;
}

function renderComparisonSummary(structuredContext) {
  const current = structuredContext?.currentAmount ?? structuredContext?.currentCount;
  const previous = structuredContext?.previousAmount ?? structuredContext?.previousCount;
  const diff = structuredContext?.difference;
  const pctChange = structuredContext?.percentageChange;
  if (current == null || previous == null) return null;

  const isAmount = structuredContext?.currency === 'TRY';
  const currentStr = isAmount ? formatCurrency(current) : String(current);
  const previousStr = isAmount ? formatCurrency(previous) : String(previous);
  const direction = diff > 0 ? '↑ artış' : diff < 0 ? '↓ düşüş' : '→ değişim yok';
  const pctStr = typeof pctChange === 'number' ? ` (%${Math.abs(pctChange)})` : '';
  return `Bu dönem: ${currentStr}  |  Önceki dönem: ${previousStr}  |  ${direction}${pctStr}`;
}

function renderDoctorPerformanceSummary(structuredContext) {
  const doctor = structuredContext?.doctor?.name || '';
  const parts = [];
  if (structuredContext?.revenueAmount != null) {
    parts.push(`Gelir: ${formatCurrency(structuredContext.revenueAmount)}`);
  }
  if (structuredContext?.collectionAmount != null) {
    parts.push(`Tahsilat: ${formatCurrency(structuredContext.collectionAmount)}`);
  }
  if (typeof structuredContext?.count === 'number') {
    parts.push(`Hasta sayısı: ${structuredContext.count}`);
  }
  if (parts.length === 0) return null;
  const period = structuredContext?.period?.label || '';
  return `${doctor} ${period} performans özeti:\n${parts.join('\n')}`;
}

function renderFinancialSummary(structuredContext) {
  if (structuredContext?.type !== 'clinic_financial_summary') return null;
  const parts = [];
  parts.push(`Gelir: ${formatCurrency(structuredContext.revenueAmount)}`);
  parts.push(`Tahsilat: ${formatCurrency(structuredContext.collectionAmount)}`);
  parts.push(`Bekleyen: ${formatCurrency(structuredContext.pendingCollectionAmount)}`);
  if (typeof structuredContext.collectionRate === 'number') {
    parts.push(`Tahsilat Oranı: %${structuredContext.collectionRate}`);
  }
  const period = structuredContext?.period?.label || structuredContext?.period || '';
  return `${period} Finansal Özet:\n${parts.join('\n')}`;
}

function renderOperationalSummary(structuredContext) {
  if (structuredContext?.type !== 'clinic_operational_summary') return null;
  const parts = [];
  parts.push(`Toplam Randevu: ${structuredContext.appointmentCount}`);
  parts.push(`Gelmeme Oranı: %${structuredContext.noShowRate} (${structuredContext.noShowCount})`);
  parts.push(`İptal Oranı: %${structuredContext.cancellationRate} (${structuredContext.cancelledCount})`);
  parts.push(`Tamamlanan Tedavi: ${structuredContext.completedTreatmentCount}`);
  const period = structuredContext?.period?.label || '';
  return `${period} Operasyonel Özet:\n${parts.join('\n')}`;
}

function renderCancelledAppointmentList(structuredContext) {
  const appointments = structuredContext?.appointments;
  if (!Array.isArray(appointments) || appointments.length === 0) return 'İptal edilen randevu bulunmuyor.';
  const period = structuredContext?.period?.label || '';
  const lines = appointments.slice(0, 20).map((a) => {
    const date = a.startAt ? new Date(a.startAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const patient = a.patientName || '-';
    const doctor = a.doctorName || '-';
    return `• ${date} - ${patient} (${doctor})`;
  });
  const more = appointments.length > 20 ? `\n... ve ${appointments.length - 20} iptal daha.` : '';
  return `${period} iptal edilen randevular:\n${lines.join('\n')}${more}`;
}

function renderNoShowList(structuredContext) {
  const appointments = structuredContext?.appointments;
  if (!Array.isArray(appointments) || appointments.length === 0) return 'Gelmeyen hasta bulunmuyor.';
  const period = structuredContext?.period?.label || '';
  const lines = appointments.slice(0, 20).map((a) => {
    const date = a.startAt ? new Date(a.startAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const patient = a.patientName || '-';
    return `• ${date} - ${patient}`;
  });
  const more = appointments.length > 20 ? `\n... ve ${appointments.length - 20} hasta daha.` : '';
  return `${period} gelmeyen hastalar:\n${lines.join('\n')}${more}`;
}

function renderInventoryList(structuredContext) {
  const items = structuredContext?.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  if (structuredContext?.type === 'clinic_expiring_stock') {
    const lines = items.slice(0, 20).map((i) => {
      const expiry = i.expiryDate ? new Date(i.expiryDate).toLocaleDateString('tr-TR') : '-';
      return `• ${i.name}: ${i.quantity} ${i.unit || ''} (son kullanma: ${expiry})`;
    });
    return `Son kullanma tarihi yaklaşan ürünler:\n${lines.join('\n')}`;
  }
  // Low stock fallback
  const lines = items.slice(0, 20).map((i) => {
    return `• ${i.name}: ${i.currentStock}/${i.minLevel} ${i.unit || ''}`;
  });
  const more = items.length > 20 ? `\n... ve ${items.length - 20} ürün daha.` : '';
  return `Stok seviyesi düşük ürünler:\n${lines.join('\n')}${more}`;
}

function renderDebtorList(structuredContext) {
  const patients = structuredContext?.patients;
  if (!Array.isArray(patients) || patients.length === 0) return 'Borçlu hasta bulunmuyor.';
  const lines = patients.slice(0, 20).map((p) => {
    const name = p.fullName || '-';
    const amount = p.totalDebt != null ? formatCurrency(p.totalDebt) : '';
    const invoices = p.invoiceCount ? ` (${p.invoiceCount} fatura)` : '';
    return `• ${name} ${amount}${invoices}`;
  });
  const more = patients.length > 20 ? `\n... ve ${patients.length - 20} hasta daha.` : '';
  return `Borçlu hastalar:\n${lines.join('\n')}${more}`;
}

/**
 * Select the appropriate deterministic renderer based on plan metric and context shape.
 * Returns null if no deterministic renderer applies (fall back to LLM).
 */
function renderStructured(plan, structuredContext) {
  if (!structuredContext || structuredContext.error) return null;

  const metric = plan?.metric;
  const type = structuredContext?.type;

  // Composite summaries
  if (type === 'clinic_financial_summary') return renderFinancialSummary(structuredContext);
  if (type === 'clinic_operational_summary') return renderOperationalSummary(structuredContext);

  // Comparison types
  if (type === 'clinic_collection_comparison' || type === 'clinic_appointment_count_comparison' ||
      type === 'clinic_revenue_comparison' || type === 'clinic_pending_collection_comparison') {
    return renderComparisonSummary(structuredContext);
  }

  // Doctor performance
  if (type === 'doctor_revenue' || type === 'doctor_collection' || type === 'doctor_patient_count') {
    return renderDoctorPerformanceSummary(structuredContext);
  }

  // Treatment lists
  if (metric === METRICS.completed_treatment_list || type === 'doctor_completed_treatment_list' ||
      type === 'clinic_completed_treatment_list') {
    return renderTreatmentList(structuredContext);
  }
  if (metric === METRICS.treatment_completion_rate || type === 'clinic_treatment_completion_rate') {
    const rate = structuredContext?.completionRate;
    if (typeof rate === 'number') {
      const period = structuredContext?.period?.label || '';
      return `${period} tedavi tamamlama oranı: %${rate} (${structuredContext.completedItems}/${structuredContext.totalItems}).`;
    }
  }

  // Cancelled / no-show lists
  if (metric === METRICS.cancelled_appointments_list || type === 'cancelled_appointments_list') {
    return renderCancelledAppointmentList(structuredContext);
  }
  if (metric === METRICS.no_show_patients_list || type === 'no_show_patients_list') {
    return renderNoShowList(structuredContext);
  }

  // Debtor patients
  if (metric === METRICS.debtor_patient_list || type === 'debtor_patient_list') {
    return renderDebtorList(structuredContext);
  }

  // Expiring stock
  if (type === 'clinic_expiring_stock') {
    return renderInventoryList(structuredContext);
  }

  // Stock value
  if (type === 'clinic_stock_value_total') {
    return `Toplam stok değeri: ${formatCurrency(structuredContext.totalValue)} (${structuredContext.totalItems} ürün).`;
  }

  // ── Existing renderers ──────────────────────────────────────────
  if (metric === METRICS.appointment_count || metric === METRICS.patient_count ||
      metric === METRICS.cancelled_appointment_count || metric === METRICS.no_show_count ||
      metric === METRICS.inventory_item_count || metric === METRICS.low_stock_item_count ||
      metric === METRICS.doctor_patient_count) {
    return renderCount(structuredContext);
  }

  if (
    metric === METRICS.revenue_amount ||
    metric === METRICS.collection_amount ||
    metric === METRICS.pending_collection_amount ||
    metric === METRICS.outstanding_balance_amount ||
    metric === METRICS.doctor_revenue_amount ||
    metric === METRICS.doctor_collection_amount ||
    metric === METRICS.stock_value_total
  ) {
    return renderAmount(structuredContext);
  }

  if (metric === METRICS.completion_percentage) {
    const pct = renderPercentage(structuredContext);
    if (pct && structuredContext?.patient?.fullName) {
      return `${structuredContext.patient.fullName} için tamamlanma: ${pct}.`;
    }
    return pct;
  }

  if (metric === METRICS.appointment_patient_count_by_gender || metric === METRICS.patient_gender_ratio) {
    return renderGenderDemographics(structuredContext);
  }

  if (metric === METRICS.appointment_list || metric === METRICS.schedule_list) {
    return renderAppointmentList(structuredContext);
  }

  if (metric === METRICS.no_show_rate) {
    return renderRate(structuredContext, 'noShowRate', 'noShowCount', 'Gelmeme oranı');
  }

  if (metric === METRICS.cancellation_rate) {
    return renderRate(structuredContext, 'cancellationRate', 'cancelledCount', 'İptal oranı');
  }

  if (metric === METRICS.collection_rate) {
    const rate = structuredContext?.collectionRate;
    if (typeof rate === 'number') {
      return `Tahsilat oranı: %${rate}.`;
    }
  }

  if (metric === METRICS.new_patient_count || metric === METRICS.completed_treatment_count) {
    return renderCount(structuredContext);
  }

  if (metric === METRICS.overdue_patient_list) {
    return renderOverduePatientList(structuredContext);
  }

  if (metric === METRICS.low_stock_list) {
    return renderLowStockList(structuredContext);
  }

  return null;
}

function renderRate(structuredContext, rateField, countField, label) {
  const rate = structuredContext?.[rateField];
  const count = structuredContext?.[countField];
  const total = structuredContext?.totalAppointments;
  const period = structuredContext?.period?.label || '';
  if (typeof rate !== 'number') return null;
  if (period) return `${period} için ${label}: %${rate} (${count || 0}/${total || 0}).`;
  return `${label}: %${rate}.`;
}

function renderOverduePatientList(structuredContext) {
  const patients = structuredContext?.patients || structuredContext?.overduePatients;
  if (!Array.isArray(patients) || patients.length === 0) return 'Gecikmiş ödemesi olan hasta bulunmuyor.';
  const lines = patients.slice(0, 20).map((p) => {
    const name = p.fullName || p.patientName || '-';
    const amount = p.totalOverdueAmount != null ? formatCurrency(p.totalOverdueAmount) : '';
    return `• ${name} ${amount}`;
  });
  const more = patients.length > 20 ? `\n... ve ${patients.length - 20} hasta daha.` : '';
  return `Gecikmiş ödemesi olan hastalar:\n${lines.join('\n')}${more}`;
}

function renderLowStockList(structuredContext) {
  const items = structuredContext?.items;
  if (!Array.isArray(items) || items.length === 0) return 'Stok seviyesi düşük ürün bulunmuyor.';
  const lines = items.slice(0, 20).map((i) => {
    return `• ${i.name}: ${i.currentStock}/${i.minLevel} ${i.unit || ''}`;
  });
  const more = items.length > 20 ? `\n... ve ${items.length - 20} ürün daha.` : '';
  return `Stok seviyesi düşük ürünler:\n${lines.join('\n')}${more}`;
}

/**
 * Whether to prefer deterministic render over LLM for this plan/context.
 */
function preferStructuredRender(plan, structuredContext) {
  const rendered = renderStructured(plan, structuredContext);
  return rendered != null;
}

module.exports = {
  renderStructured,
  renderCount,
  renderAmount,
  renderPercentage,
  renderGenderDemographics,
  renderAppointmentList,
  renderRate,
  renderOverduePatientList,
  renderLowStockList,
  renderTreatmentList,
  renderComparisonSummary,
  renderDoctorPerformanceSummary,
  renderFinancialSummary,
  renderOperationalSummary,
  renderCancelledAppointmentList,
  renderNoShowList,
  renderInventoryList,
  renderDebtorList,
  preferStructuredRender,
  formatCurrency,
};
