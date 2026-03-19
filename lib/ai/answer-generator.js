/**
 * @deprecated Use answer-synthesizer instead. Pipeline uses answer-synthesizer for LLM synthesis.
 * Answer Generator - Metric-aware strict templates. No LLM improvisation.
 * When structured data exists, use deterministic template only.
 * LLM only for list/summary formatting when explicitly enabled.
 */

const { chat, isAvailable } = require('./ollama');
const { METRICS } = require('./query-interpretation');

const USE_LLM_FORMATTING = process.env.USE_LLM_FORMATTING === 'true';

function formatShortDate(d) {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short' }).format(date);
}

/**
 * Strict metric-only answers. No mixing, no LLM.
 */
function formatByMetric(metric, data) {
  if (data?.error) return data.error;

  switch (metric) {
    case METRICS.collection_amount: {
      const amt = data.collectionAmount ?? data.summary?.totalPayments ?? 0;
      const period = data.period?.label || data.date || 'Bu ay';
      if (amt === 0) return `${period} tahsilat bulunmuyor.`;
      return `${period} toplam tahsilat: ₺${(amt / 100).toFixed(0)}.`;
    }
    case METRICS.appointment_count: {
      const count = data.count ?? data.appointments?.length ?? 0;
      const period = data.period?.label || data.date || 'Bugün';
      if (data.doctor) {
        const docName = data.doctor.name?.startsWith('Dr.') ? data.doctor.name : `Dr. ${data.doctor.name}`;
        return `${docName} ${period} ${count} randevu yaptı.`;
      }
      return `${period} toplam ${count} randevu vardı.`;
    }
    case METRICS.completion_percentage: {
      const { patient, completionPercentage } = data;
      if (!patient) return 'Hasta bulunamadı.';
      return `${patient.fullName} tedavisinin %${completionPercentage ?? 0} tamamlandı.`;
    }
    case METRICS.completed_value: {
      const { patient, completedTotal } = data;
      if (!patient) return 'Hasta bulunamadı.';
      return `${patient.fullName} tedavisinin ₺${((completedTotal || 0) / 100).toFixed(0)} tutarında kısmı tamamlandı.`;
    }
    case METRICS.completed_item_count: {
      const { doctor, period, count } = data;
      if (!doctor) return 'Doktor bulunamadı.';
      return `Dr. ${doctor.name} ${period?.label || 'bu ay'} ${count} tedavi kalemi tamamladı.`;
    }
    case METRICS.patient_count: {
      const count = data.patientCount ?? data.count ?? 0;
      return `Bugün ${count} hasta randevuya geldi.`;
    }
    case METRICS.outstanding_balance: {
      const { patient, currentAccount, totals, summary } = data;
      if (currentAccount && summary != null) {
        const bal = summary.balance ?? (summary.totalDebit - summary.totalCredit) ?? 0;
        return `${currentAccount.name} cari bakiyesi: ₺${(Math.abs(bal) / 100).toFixed(0)}.`;
      }
      if (!patient) return 'Hasta bulunamadı.';
      const bal = totals?.remainingBalance ?? 0;
      return `${patient.fullName} kalan borcu: ₺${(bal / 100).toFixed(0)}.`;
    }
    default:
      return null;
  }
}

/**
 * Deterministic Turkish answer from template. No LLM.
 */
function formatFromTemplate(aggregatorKey, data, metric = null) {
  if (data?.error) return data.error;

  const metricAnswer = metric && formatByMetric(metric, data);
  if (metricAnswer) return metricAnswer;

  switch (aggregatorKey) {
    case 'patient_balance': {
      const { patient, totals } = data;
      if (!patient) return 'Hasta bulunamadı.';
      const { totalTreatmentCost, totalPaid, remainingBalance } = totals || {};
      if (remainingBalance === 0 && totalTreatmentCost === 0 && totalPaid === 0) {
        return `${patient.fullName} için henüz finansal hareket bulunmuyor.`;
      }
      return `${patient.fullName} kalan bakiyesi: ₺${(remainingBalance / 100).toFixed(0)}. Toplam tedavi: ₺${((totalTreatmentCost || 0) / 100).toFixed(0)}, toplam ödeme: ₺${((totalPaid || 0) / 100).toFixed(0)}.`;
    }

    case 'patient_last_payment': {
      const { patient, payment } = data;
      if (!patient) return 'Hasta bulunamadı.';
      if (!payment) return `${patient.fullName} için kayıtlı ödeme bulunamadı.`;
      return `${patient.fullName} son ödemesi: ₺${(payment.amount / 100).toFixed(0)} - ${formatShortDate(payment.paidAt)} (${payment.method || '-'}).`;
    }

    case 'patient_summary': {
      const { patient } = data;
      if (!patient) return 'Hasta bulunamadı.';
      const parts = [patient.fullName];
      if (patient.primaryDoctor) parts.push(`Hekim: ${patient.primaryDoctor}`);
      if (patient.lastAppointment) {
        parts.push(`Son randevu: ${formatShortDate(patient.lastAppointment.startAt)} (${patient.lastAppointment.status})`);
      }
      if (patient.activePlan) {
        parts.push(`Aktif plan: ${patient.activePlan.title} - ${patient.activePlan.status}`);
      }
      return parts.join('. ');
    }

    case 'patient_appointments': {
      const { patient, lastAppointment, appointments } = data;
      if (!patient) return 'Hasta bulunamadı.';
      if (!lastAppointment && (!appointments || appointments.length === 0)) {
        return `${patient.fullName} için kayıtlı randevu bulunamadı.`;
      }
      const last = lastAppointment || appointments?.[0];
      return `${patient.fullName} son randevusu: ${formatShortDate(last?.startAt)} (${last?.status}).`;
    }

    case 'patient_treatment_plans': {
      const { patient, plans } = data;
      if (!patient) return 'Hasta bulunamadı.';
      if (!plans?.length) return `${patient.fullName} için tedavi planı bulunamadı.`;
      const list = plans.map((p) => `- ${p.title} (${p.status}): ₺${(p.totalPrice / 100).toFixed(0)}`).join('\n');
      return `${patient.fullName} tedavi planları:\n${list}`;
    }

    case 'patient_treatment_plan_details': {
      const { treatmentPlan, patient, totals, items } = data;
      if (!treatmentPlan) return 'Tedavi planı bulunamadı.';
      if (!items?.length) return `${treatmentPlan.title} planında tedavi kalemi bulunmuyor.`;
      const lines = items.map((i) => {
        const status = i.status === 'COMPLETED' ? 'Tamamlandı' : i.status === 'IN_PROGRESS' ? 'Devam ediyor' : 'Planlandı';
        return `- ${i.name}: ₺${((i.plannedAmount || i.price * i.quantity) / 100).toFixed(0)} (${status})${i.responsibleDoctor ? ` - ${i.responsibleDoctor}` : ''}`;
      });
      let out = `${treatmentPlan.title} tedavi planı - ${patient?.fullName || ''}:\n${lines.join('\n')}`;
      if (totals) {
        out += `\n\nToplam planlanan: ₺${(totals.totalPrice / 100).toFixed(0)}, tamamlanan: ₺${((totals.completedTotal || 0) / 100).toFixed(0)}.`;
      }
      return out;
    }

    case 'patient_treatment_progress':
      return (metric && formatByMetric(metric, data)) || formatByMetric(METRICS.completion_percentage, data) || formatByMetric(METRICS.completed_value, data) || 'Veri bulunamadı.';

    case 'doctor_treatment_item_count':
      return formatByMetric(METRICS.completed_item_count, data) || 'Veri bulunamadı.';

    case 'doctor_schedule': {
      const { doctor, date, appointments, blocks } = data;
      if (!doctor) return 'Doktor bulunamadı.';
      if (!appointments?.length && !blocks?.length) {
        return `${doctor.name} için ${date} tarihinde randevu veya blok bulunmuyor.`;
      }
      const apptList = appointments?.length
        ? appointments.map((a) => `${formatShortDate(a.startAt)} - ${a.patientName || '-'}`).join('\n')
        : 'Randevu yok';
      const blockList = blocks?.length
        ? blocks.map((b) => `${formatShortDate(b.startAt)} - ${b.type}: ${b.title || '-'}`).join('\n')
        : '';
      return `${doctor.name} ${date} programı:\nRandevular:\n${apptList}${blockList ? `\nBloklar:\n${blockList}` : ''}`;
    }

    case 'monthly_finance_summary':
      return formatByMetric(METRICS.collection_amount, data) || 'Veri bulunamadı.';

    case 'monthly_appointment_count':
      return formatByMetric(METRICS.appointment_count, data) || 'Veri bulunamadı.';

    case 'monthly_appointment_count_for_doctor':
    case 'today_appointment_count_for_doctor':
      return formatByMetric(METRICS.appointment_count, data) || 'Veri bulunamadı.';

    case 'overdue_installment_patients': {
      const { patients, count } = data;
      if (!patients?.length) return 'Gecikmiş taksit ödemesi bulunan hasta yok.';
      const list = patients.slice(0, 10).map((p) => {
        const amt = p.totalOverdueAmount ? ` (₺${(p.totalOverdueAmount / 100).toFixed(0)} gecikmiş)` : '';
        return `- ${p.fullName}${amt}`;
      }).join('\n');
      return `${count} hastada gecikmiş taksit var:\n${list}`;
    }

    case 'today_collection_summary': {
      const amt = data.summary?.totalPayments ?? 0;
      const count = data.summary?.count ?? 0;
      const date = data.date || 'Bugün';
      if (count === 0) return `${date} tahsilat bulunmuyor.`;
      return `${date} tahsilat: ₺${(amt / 100).toFixed(0)} (${count} işlem).`;
    }

    case 'today_appointment_count':
      return formatByMetric(METRICS.appointment_count, { ...data, date: data.date || 'Bugün' }) || 'Veri bulunamadı.';

    case 'today_patient_count':
      return formatByMetric(METRICS.patient_count, data) || 'Veri bulunamadı.';

    case 'clinic_overview': {
      const { date, appointments, count } = data;
      if (!appointments?.length) return `Bugün (${date}) randevu bulunmuyor. Toplam: 0 randevu.`;
      const list = appointments.map((a) => `${formatShortDate(a.startAt)} - ${a.patientName || 'Misafir'} - ${a.doctorName || '-'}`).join('\n');
      return `Bugün ${count} randevu var.\n${list}`;
    }

    case 'current_account_balance': {
      const { currentAccount, summary } = data;
      if (!currentAccount) return 'Cari hesap bulunamadı.';
      const { totalDebit, totalCredit, balance } = summary || {};
      if (totalDebit === 0 && totalCredit === 0) {
        return `${currentAccount.name} cari hesabında henüz işlem bulunmuyor.`;
      }
      return `${currentAccount.name} cari bakiyesi: ₺${(Math.abs(balance || 0) / 100).toFixed(0)}. Toplam borç: ₺${((totalDebit || 0) / 100).toFixed(0)}, toplam alacak: ₺${((totalCredit || 0) / 100).toFixed(0)}.`;
    }

    case 'current_account_transactions': {
      const { currentAccount, transactions } = data;
      if (!currentAccount) return 'Cari hesap bulunamadı.';
      if (!transactions?.length) return `${currentAccount.name} için işlem bulunmuyor.`;
      const list = transactions.slice(0, 5).map((t) => {
        const amt = t.debit > 0 ? t.debit : t.credit;
        const typ = t.debit > 0 ? 'borç' : 'alacak';
        return `${formatShortDate(t.date)}: ₺${(amt / 100).toFixed(0)} ${typ}${t.description ? ` - ${t.description}` : ''}`;
      }).join('\n');
      return `${currentAccount.name} cari işlemleri:\n${list}`;
    }

    case 'low_stock_products': {
      const { items, count } = data;
      if (!items?.length) return 'Minimum stokun altında ürün bulunmuyor.';
      const list = items.map((i) => `${i.name}: ${i.currentStock}/${i.minLevel} ${i.unit || ''}`).join('\n');
      return `${count} ürün minimum stokun altında:\n${list}`;
    }

    default:
      return 'Bu sorgu için yanıt hazırlanamadı.';
  }
}

/**
 * Generate answer. Prefer strict template when metric is precise. No LLM improvisation.
 */
async function generateAnswer(aggregatorKey, data, interpretation = null) {
  if (data?.error) return formatFromTemplate(aggregatorKey, data);

  const metric = interpretation?.metric;
  const hasPreciseMetric = [
    METRICS.collection_amount,
    METRICS.appointment_count,
    METRICS.completion_percentage,
    METRICS.completed_value,
    METRICS.completed_item_count,
    METRICS.patient_count,
    METRICS.outstanding_balance,
  ].includes(metric);

  if (hasPreciseMetric) {
    return formatFromTemplate(aggregatorKey, data, metric);
  }

  const useLlm = USE_LLM_FORMATTING && (await isAvailable());
  if (!useLlm) {
    return formatFromTemplate(aggregatorKey, data);
  }

  const systemPrompt =
    'Sen bir diş kliniği asistanısın. Verilen yapılandırılmış veriye dayanarak Türkçe cevap ver. ' +
    'Sadece verilen verideki bilgileri kullan, uydurma yapma. Kısa ve net ol. ' +
    'Asla araç adı, TOOL, PARAMS, internal ID veya teknik terim kullanma.';

  const contextStr = JSON.stringify(data, null, 0).slice(0, 4000);
  const userContent = `Veri:\n${contextStr}\n\nBu veriyi özetleyerek doğal Türkçe cevap ver.`;

  try {
    const { content } = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]);
    return (content || '').trim() || formatFromTemplate(aggregatorKey, data);
  } catch {
    return formatFromTemplate(aggregatorKey, data);
  }
}

module.exports = {
  generateAnswer,
  formatFromTemplate,
  formatByMetric,
};
