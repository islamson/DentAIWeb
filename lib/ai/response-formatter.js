/**
 * Format tool results to natural Turkish responses.
 */

function formatCurrency(amount) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function formatDate(d) {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatShortDate(d) {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short' }).format(date);
}

/**
 * Format tool result to natural Turkish answer.
 */
function formatToolResponse(toolName, result) {
  if (result.error) return result.error;

  switch (toolName) {
    case 'search_patient': {
      const { patients, count } = result;
      if (!patients?.length) return 'Arama kriterlerine uygun hasta bulunamadı.';
      const list = patients
        .slice(0, 5)
        .map((p) => `${p.firstName} ${p.lastName} (${p.phone || p.email || '-'})`)
        .join('\n');
      return count > 5
        ? `${count} hasta bulundu. İlk 5:\n${list}\n... ve ${count - 5} kişi daha.`
        : `Bulunan hastalar:\n${list}`;
    }

    case 'get_patient_summary': {
      const { patient, error } = result;
      if (error) return error;
      if (!patient) return 'Hasta bulunamadı.';
      const parts = [
        `${patient.name}`,
        patient.primaryDoctor ? `Hekim: ${patient.primaryDoctor}` : '',
        patient.lastAppointment
          ? `Son randevu: ${formatDate(patient.lastAppointment.startAt)} (${patient.lastAppointment.status})`
          : '',
        patient.activePlan
          ? `Aktif plan: ${patient.activePlan.title} - ${patient.activePlan.status}`
          : '',
      ].filter(Boolean);
      return parts.join('\n');
    }

    case 'get_patient_last_payment': {
      const { payment } = result;
      if (!payment) return 'Bu hasta için kayıtlı ödeme bulunamadı.';
      return `Son ödeme: ${formatCurrency(payment.amount)} - ${formatDate(payment.paidAt)} (${payment.method})`;
    }

    case 'get_patient_balance': {
      const { patientName, remainingBalance, totalAppliedTreatment, totalPaid } = result;
      if (patientName == null) return 'Hasta bulunamadı.';
      if (remainingBalance === 0 && totalAppliedTreatment === 0 && totalPaid === 0) {
        return `${patientName} için henüz finansal hareket bulunmuyor.`;
      }
      if (remainingBalance === 0) return `${patientName} hesabı kapalı. Kalan bakiye: ₺0.`;
      return `${patientName} kalan bakiyesi: ${formatCurrency(remainingBalance)}.`;
    }

    case 'get_today_appointments': {
      const { appointments, count } = result;
      if (!appointments?.length) return 'Bugün randevu bulunmuyor.';
      const list = appointments
        .map(
          (a) =>
            `${formatDate(a.startAt)} - ${a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Misafir'} - ${a.doctor?.name || '-'}`
        )
        .join('\n');
      return `Bugün ${count} randevu var:\n${list}`;
    }

    case 'get_doctor_schedule': {
      const { appointments, blocks, date } = result;
      const apptList = appointments?.length
        ? appointments
            .map(
              (a) =>
                `${formatDate(a.startAt)} - ${a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '-'}`
            )
            .join('\n')
        : 'Randevu yok';
      const blockList = blocks?.length
        ? blocks.map((b) => `${formatDate(b.startAt)} - ${b.type}: ${b.title || '-'}`).join('\n')
        : '';
      return `${date} programı:\nRandevular:\n${apptList}${blockList ? `\nBloklar:\n${blockList}` : ''}`;
    }

    case 'get_debtors_summary': {
      const { debtors, totalRemaining, count } = result;
      if (!debtors?.length) return 'Açık borcu olan hasta bulunmuyor.';
      const list = debtors
        .slice(0, 5)
        .map((d) => `${d.patientName}: ${formatCurrency(d.remaining)}`)
        .join('\n');
      return `Toplam ${formatCurrency(totalRemaining)} açık borç (${count} hasta). Örnekler:\n${list}`;
    }

    case 'get_monthly_finance_summary': {
      const { month, totalPaymentsThisMonth, totalRevenueThisMonth, currency } = result;
      return `${month} toplam tahsilat: ${formatCurrency(totalPaymentsThisMonth)}.`;
    }

    case 'search_current_account': {
      const { accounts, count } = result;
      if (!accounts?.length) return 'Arama kriterlerine uygun cari hesap bulunamadı.';
      const list = accounts
        .slice(0, 5)
        .map((a) => `${a.name} (${a.type || '-'})`)
        .join('\n');
      return count > 5
        ? `${count} cari hesap bulundu. İlk 5:\n${list}\n... ve ${count - 5} hesap daha.`
        : `Bulunan cari hesaplar:\n${list}`;
    }

    case 'get_current_account_balance': {
      const { accountName, totalDebit, totalCredit, balance, netBalance, balanceDirection, error } = result;
      if (error) return error;
      if (accountName == null) return 'Cari hesap bulunamadı.';
      const bal = balance ?? netBalance ?? 0;
      const debit = totalDebit ?? 0;
      const credit = totalCredit ?? 0;
      if (debit === 0 && credit === 0) return `${accountName} cari hesabında henüz işlem bulunmuyor.`;
      const dir = balanceDirection === 'ALACAK' ? 'alacak' : balanceDirection === 'ZERO' ? 'sıfır' : 'borç';
      return `${accountName} için toplam borç ${formatCurrency(debit)}, toplam alacak ${formatCurrency(credit)}. Net bakiye ${formatCurrency(Math.abs(bal))} ${dir} görünüyor.`;
    }

    case 'get_current_account_last_payment': {
      const { accountName, transaction } = result;
      if (!transaction) return `${accountName || 'Bu cari hesap'} için kayıtlı ödeme bulunamadı.`;
      return `${accountName} firmasına yapılan son ödeme: ${formatCurrency(transaction.amount)} - ${formatDate(transaction.occurredAt)}.`;
    }

    case 'get_low_stock_products': {
      const { items, count } = result;
      if (!items?.length) return 'Minimum stokun altında ürün bulunmuyor.';
      const list = items
        .map((i) => `${i.name}: ${i.currentStock}/${i.minLevel} ${i.unit || ''}`)
        .join('\n');
      return `${count} ürün minimum stokun altında:\n${list}`;
    }

    case 'get_patient_financial_history': {
      const { patientName, movements, summary, error } = result;
      if (error) return error;
      if (!movements?.length) return `${patientName || 'Hasta'} için finansal hareket bulunamadı.`;
      const list = movements.slice(0, 5).map((m) => `${formatDate(m.occurredAt)}: ${m.type} ${formatCurrency(m.amount)}`).join('\n');
      return `${patientName} finansal geçmişi (son ${movements.length} hareket):\n${list}\nÖzet: Toplam tedavi ${formatCurrency(summary?.totalTreatmentCost)} - Ödenen ${formatCurrency(summary?.totalPaid)} - Kalan ${formatCurrency(summary?.remaining)}`;
    }

    case 'get_patient_upcoming_appointments': {
      const { patientName, appointments, error } = result;
      if (error) return error;
      if (!appointments?.length) return `${patientName || 'Hasta'} için gelecek randevu bulunmuyor.`;
      const list = appointments.map((a) => `${formatDate(a.startAt)} - ${a.reason || '-'} (${a.doctor || '-'})`).join('\n');
      return `${patientName} gelecek randevular (${appointments.length}):\n${list}`;
    }

    case 'get_patient_contact': {
      const { patientName, phone, email, error } = result;
      if (error) return error;
      return `${patientName}: Tel ${phone || '-'}, E-posta ${email || '-'}`;
    }

    case 'get_patient_last_treatment': {
      const { patientName, lastTreatment, error } = result;
      if (error) return error;
      if (!lastTreatment) return `${patientName || 'Hasta'} için kayıtlı tedavi bulunamadı.`;
      return `${patientName} son tedavi: ${lastTreatment.description || '-'} - ${formatCurrency(lastTreatment.amount)} (${formatDate(lastTreatment.occurredAt)})`;
    }

    case 'get_appointments_noshow': {
      const { appointments, count, period } = result;
      if (!appointments?.length) return `Seçilen dönemde gelmeyen randevu bulunmuyor.`;
      const list = appointments.map((a) => `${formatDate(a.startAt)} - ${a.patient} - ${a.doctor || '-'}`).join('\n');
      return `${period?.from}-${period?.to} arası ${count} gelmeyen randevu:\n${list}`;
    }

    case 'get_appointments_cancelled': {
      const { appointments, count, period } = result;
      if (!appointments?.length) return `Seçilen dönemde iptal edilen randevu bulunmuyor.`;
      const list = appointments.map((a) => `${formatDate(a.startAt)} - ${a.patient} - ${a.doctor || '-'}`).join('\n');
      return `${period?.from}-${period?.to} arası ${count} iptal:\n${list}`;
    }

    case 'get_payments_today': {
      const { payments, totalAmount, count, date } = result;
      if (!payments?.length) return `Bugün (${date}) tahsilat bulunmuyor.`;
      const list = payments.slice(0, 5).map((p) => `${formatCurrency(p.amount)} - ${p.patient || '-'}`).join('\n');
      return `Bugün ${formatCurrency(totalAmount)} tahsilat (${count} işlem):\n${list}`;
    }

    case 'get_weekly_finance_summary': {
      const { period, totalPaymentsThisWeek } = result;
      return `${period} toplam tahsilat: ${formatCurrency(totalPaymentsThisWeek)}.`;
    }

    case 'get_critical_stock': {
      const { items, count } = result;
      if (!items?.length) return 'Kritik stok seviyesinde ürün bulunmuyor.';
      const list = items.map((i) => `${i.name}: ${i.currentStock}/${i.minLevel} ${i.unit || ''}`).join('\n');
      return `${count} ürün kritik seviyede:\n${list}`;
    }

    case 'get_stock_movement_summary': {
      const { movements, count } = result;
      if (!movements?.length) return 'Stok hareketi bulunamadı.';
      const list = movements.map((m) => `${m.itemName}: ${m.type} ${m.qty} (${formatDate(m.occurredAt)})`).join('\n');
      return `Son ${count} stok hareketi:\n${list}`;
    }

    case 'get_last_stock_entry': {
      const { lastEntry, message } = result;
      if (!lastEntry) return message || 'Stok girişi bulunamadı.';
      return `Son stok girişi: ${lastEntry.itemName} ${lastEntry.qty} adet - ${formatDate(lastEntry.occurredAt)}`;
    }

    case 'get_product_quantity': {
      const { item, items, message } = result;
      if (message) return message;
      if (item) return `${item.name}: ${item.currentStock} ${item.unit || 'adet'} (min: ${item.minLevel})`;
      if (items?.length) return items.map((i) => `${i.name}: ${i.currentStock}/${i.minLevel}`).join('\n');
      return 'Ürün bulunamadı.';
    }

    case 'get_lab_materials': {
      const { materials, count } = result;
      if (!materials?.length) return 'Lab malzemesi bulunamadı.';
      const list = materials.map((m) => `${m.name} - ${formatCurrency(m.unitPrice)} (${m.supplier || '-'})`).join('\n');
      return `${count} lab malzemesi:\n${list}`;
    }

    case 'get_current_account_summary': {
      const { accountName, balance, lastTransaction, error } = result;
      if (error) return error;
      let out = `${accountName} bakiyesi: ${formatCurrency(balance)}.`;
      if (lastTransaction) out += ` Son işlem: ${formatCurrency(lastTransaction.amount)} - ${formatDate(lastTransaction.occurredAt)}`;
      return out;
    }

    case 'get_current_account_last_transaction': {
      const { accountName, transaction } = result;
      if (!transaction) return `${accountName || 'Bu cari hesap'} cari hesabında henüz işlem bulunmuyor.`;
      const desc = transaction.description ? `'${transaction.description}' açıklamasıyla ` : '';
      const amount = transaction.debit > 0 ? transaction.debit : transaction.credit;
      const typeStr = transaction.debit > 0 ? 'borç' : 'alacak';
      return `${accountName} ile son işlem ${formatDate(transaction.date)} tarihinde, ${desc}${formatCurrency(amount)} ${typeStr} olarak kaydedilmiş.`;
    }

    case 'get_current_account_transaction_summary': {
      const { accountName, totalTransactionCount, totalDebit, totalCredit, recentTransactions, error } = result;
      if (error) return error;
      if (totalTransactionCount === 0) return `${accountName || 'Bu cari hesap'} cari hesabında henüz işlem bulunmuyor.`;
      let out = `${accountName} cari hesabında son dönemde ${totalTransactionCount} işlem. Toplam borç ${formatCurrency(totalDebit)}, toplam alacak ${formatCurrency(totalCredit)}.`;
      if (recentTransactions?.length) {
        const list = recentTransactions.slice(0, 3).map((t) => {
          const amt = t.debit > 0 ? t.debit : t.credit;
          const typ = t.debit > 0 ? 'borç' : 'alacak';
          return `${formatShortDate(t.date)}: ${formatCurrency(amt)} ${typ}${t.description ? ` (${t.description})` : ''}`;
        }).join('; ');
        out += ` Son işlemler: ${list}.`;
      }
      return out;
    }

    case 'get_current_account_transactions': {
      const { accountName, transactions, count } = result;
      if (!transactions?.length) return `${accountName || 'Bu cari hesap'} için seçilen dönemde işlem bulunmuyor.`;
      const list = transactions.slice(0, 5).map((t) => {
        const amt = t.debit > 0 ? t.debit : t.credit;
        const typ = t.debit > 0 ? 'borç' : 'alacak';
        return `${formatShortDate(t.date)}: ${formatCurrency(amt)} ${typ}${t.description ? ` - ${t.description}` : ''}`;
      }).join('\n');
      return count > 5 ? `${accountName} işlemleri (son ${count}):\n${list}\n... ve ${count - 5} işlem daha.` : `${accountName} işlemleri:\n${list}`;
    }

    case 'get_current_account_monthly_summary': {
      const { accountName, period, totalDebit, totalCredit, netChange, transactionCount } = result;
      if (transactionCount === 0) return `${accountName} için ${period} döneminde işlem bulunmuyor.`;
      return `${accountName} ${period}: Toplam borç ${formatCurrency(totalDebit)}, alacak ${formatCurrency(totalCredit)}. Net değişim ${formatCurrency(Math.abs(netChange))} (${transactionCount} işlem).`;
    }

    default:
      if (result?.premium && result?.message) return result.message;
      return 'Bu sorgu için yanıt hazırlanamadı. Lütfen farklı bir şekilde sorun.';
  }
}

module.exports = { formatToolResponse, formatCurrency, formatDate, formatShortDate };
