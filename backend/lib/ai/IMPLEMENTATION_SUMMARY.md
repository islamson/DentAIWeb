# Deterministic Fallback AI Layer - Implementation Summary

## Overview

Comprehensive deterministic fallback AI layer for ERP/CRM dental clinic system. System works **without LLM**; LLM is an enhancement layer only.

---

## File-by-File Changes

### New Tools (backend/lib/ai/tools/)

| File | Purpose |
|------|---------|
| `get-patient-financial-history.js` | Patient financial movements (ledger) |
| `get-patient-upcoming-appointments.js` | Patient upcoming appointments |
| `get-patient-contact.js` | Patient phone/email |
| `get-patient-last-treatment.js` | Last TREATMENT_COST movement |
| `get-appointments-noshow.js` | No-show appointments summary |
| `get-appointments-cancelled.js` | Cancelled appointments summary |
| `get-payments-today.js` | Payments received today |
| `get-weekly-finance-summary.js` | Weekly revenue/tahsilat |
| `get-critical-stock.js` | Stock at critical level (0 or < minLevel/2) |
| `get-stock-movement-summary.js` | Recent stock IN/OUT movements |
| `get-last-stock-entry.js` | Last stock IN movement |
| `get-product-quantity.js` | Product stock by name |
| `get-lab-materials.js` | Lab materials list |
| `get-current-account-summary.js` | Current account balance + last tx |
| `premium-stub.js` | 11 premium model stubs (read-only fallback) |

### Modified Tools

| File | Change |
|------|--------|
| `get-debtors-summary.js` | **Uses FinancialMovement** (not invoices). remaining = totalTreatmentCost - totalPaid per patient |

### Modified Core

| File | Change |
|------|--------|
| `planner.js` | Added extractDateHint, extractProductQuery; 20+ new intents; PATIENT_FOLLOWUP_KEYWORDS extended |
| `tools/index.js` | Registered all new tools |
| `response-formatter.js` | Formatters for all new tools; premium stub handling |
| `orchestrator.js` | Added resolveDurationMs to log summary |

---

## Intent → Tool Mapping Table

| Intent ID | Tool | Keywords (sample) |
|-----------|------|-------------------|
| patient_search | search_patient | hasta ara, hasta bul |
| patient_summary | get_patient_summary | hasta özeti, son randevusu |
| patient_last_payment | get_patient_last_payment | son ödeme, ödemesi ne zaman |
| patient_balance | get_patient_balance | kalan bakiye, borcu var |
| patient_financial_history | get_patient_financial_history | finansal geçmiş, hareket geçmişi |
| patient_upcoming_appointments | get_patient_upcoming_appointments | gelecek randevular |
| patient_contact | get_patient_contact | telefon numarası, e-posta |
| patient_last_treatment | get_patient_last_treatment | son tedavi |
| monthly_finance | get_monthly_finance_summary | bu ay, aylık gelir |
| weekly_finance | get_weekly_finance_summary | bu hafta, haftalık ciro |
| payments_today | get_payments_today | bugün ne kadar ödeme, bugün tahsilat |
| today_appointments | get_today_appointments | bugünkü randevular |
| appointments_noshow | get_appointments_noshow | gelmedi, noshow |
| appointments_cancelled | get_appointments_cancelled | iptal edilen |
| doctor_schedule | get_doctor_schedule | doktor programı, yarın programı |
| debtors_summary | get_debtors_summary | borçlular, borçlu hastalar |
| current_account_last_payment | get_current_account_last_payment | firmasına son ödeme |
| current_account_balance | get_current_account_balance | firmasına borcumuz |
| current_account_summary | get_current_account_summary | cari hesap özeti |
| low_stock | get_low_stock_products | düşük stok |
| critical_stock | get_critical_stock | kritik stok |
| stock_movement_summary | get_stock_movement_summary | stok hareketi |
| last_stock_entry | get_last_stock_entry | son stok girişi |
| product_quantity | get_product_quantity | ürün miktarı, kaç adet |
| lab_materials | get_lab_materials | lab malzemeleri |

---

## Test Prompts (Turkish)

### Patient
- "Arif Talha Çoban'ın kalan bakiyesi ne kadar?"
- "Ahmet Yılmaz'ın son ödemesi ne zaman?"
- "Deneme Ökkeş'in finansal geçmişi"
- "Can Sok'un gelecek randevuları"
- "Zeynep'in telefonu ne?"
- "Peki ne kadar borcu var?" (follow-up)

### Doctor & Appointments
- "Bugünkü randevular neler?"
- "Dr. Ayşe Demir yarın programı"
- "Gelmeyen randevular"
- "İptal edilen randevular"

### Financial
- "Bu ay toplam tahsilat ne kadar?"
- "Bu hafta toplam tahsilat"
- "Bugün ne kadar ödeme aldık?"
- "Borçlu hastalar kimler?"

### Current Account
- "ABS Medikal firmasına yapılan son ödeme ne zaman?"
- "ABS Medikal firmasına ne kadar borcumuz var?"

### Inventory
- "Düşük stoklu ürünler"
- "Kritik stok var mı?"
- "Son stok girişi ne zaman?"
- "Deneme ürünü kaç adet?"

### Clarification
- "Son ödemesi ne zaman?" (no patient)
- "Doktorun programı nedir?" (no doctor)

---

## Premium Schema Status

**NOT merged.** `schema-premium.prisma` exists separately. Created 11 stub tools that return:
"Bu özellik premium modülde mevcut. Şu an için veri bulunamadı."

When merged: implement read-only tools using actual Prisma models.

---

## Logging

Structured logs include:
- plannerMode, selectedIntent, toolName
- entityType, entitySource, resolvedEntityName, resolvedEntityId
- planningDurationMs, resolveDurationMs, toolDurationMs, totalDurationMs
- fallbackReason

---

## Entity Resolution Rules

- **Explicit entity > memory** – message entity overrides conversation memory
- **Separate memory** – lastPatientId, lastDoctorId, lastCurrentAccountId (no mixing)
- **Supplier/firm/lab** → current account flow, NOT patient
- **Dr. / doctor** → doctor resolution

---

## Verification

Run: `AI_MODE=fallback node backend/scripts/ai-verification.js`

Covers: patient, institution, inventory, financial, memory follow-up, explicit override, RBAC denial, LLM unavailable.
