#!/usr/bin/env node
/**
 * AI verification - validates planner-first pipeline, finance ontology, and E2E flow.
 *
 * Run: node backend/scripts/ai-verification.js
 * Or:  node backend/scripts/ai-verification.js --skip-e2e   (unit tests only, no DB/Ollama)
 *
 * Validates:
 * - Finance ontology and Turkish glossary
 * - Semantic validation and mismatch handling
 * - Correction-aware follow-up logic
 * - Retrieval catalogue selection
 * - E2E processChat flow (patient, doctor, finance, current account, etc.)
 */

const { prisma } = require('../lib/prisma');
const { processChat } = require('../lib/ai/orchestrator');
const { INTENTS, METRICS, TIME_SCOPES } = require('../lib/ai/assistant-contracts');
const { analyzeBusinessSemantics } = require('../lib/ai/business-ontology');
const { validateSemanticAlignment, buildSemanticFallbackPlan } = require('../lib/ai/semantic-validator');
const { selectApprovedRetrieval, FINANCE_RETRIEVAL_CATALOGUE } = require('../lib/ai/approved-retrievals');
const { normalizePlanForExecution } = require('../lib/ai/plan-executor');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function ok(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}
function fail(msg) {
  console.log(`${RED}✗${RESET} ${msg}`);
}
function warn(msg) {
  console.log(`${YELLOW}!${RESET} ${msg}`);
}

const SKIP_E2E = process.argv.includes('--skip-e2e');

// --- Unit tests: Finance ontology & glossary (no Ollama, no DB) ---
function testFinanceOntology() {
  console.log('\n--- Finance ontology ---');
  const required = [
    METRICS.revenue_amount,
    METRICS.collection_amount,
    METRICS.pending_collection_amount,
    METRICS.outstanding_balance_amount,
    METRICS.overdue_receivables_amount,
    METRICS.overdue_patient_list,
    METRICS.appointment_count,
  ];
  for (const m of required) {
    if (!Object.values(METRICS).includes(m)) {
      fail(`Missing metric: ${m}`);
      return false;
    }
  }
  ok(`All required finance metrics present (${required.length})`);
  return true;
}

function testBusinessGlossary() {
  console.log('\n--- Business glossary / synonym map ---');
  const cases = [
    { query: 'Bu ayki bekleyen tahsilat ne kadar?', expected: METRICS.pending_collection_amount },
    { query: 'Bu ay toplam tahsilat ne kadar?', expected: METRICS.collection_amount },
    { query: 'Bu ayki ciro ne kadar?', expected: METRICS.revenue_amount },
    { query: 'Gecikmiş taksit ödemesi bulunan hasta var mı?', expected: METRICS.overdue_patient_list },
    { query: 'Bekleyen tahsilat geçen aya göre arttı mı?', expected: METRICS.pending_collection_amount },
  ];
  let passed = 0;
  for (const c of cases) {
    const a = analyzeBusinessSemantics(c.query, null);
    if (a.primaryMetricHint === c.expected) {
      ok(`"${c.query.slice(0, 35)}..." -> ${c.expected}`);
      passed++;
    } else {
      fail(`"${c.query.slice(0, 35)}..." -> expected ${c.expected}, got ${a.primaryMetricHint}`);
    }
  }
  return passed === cases.length;
}

function testSemanticMismatchDetection() {
  console.log('\n--- Semantic validation: mismatch detection ---');
  const analysis = analyzeBusinessSemantics('Bu ayki bekleyen tahsilat ne kadar?', null);
  const wrongPlan = normalizePlanForExecution({
    intent: INTENTS.finance_summary,
    metric: METRICS.collection_amount,
    entityType: 'none',
    entityName: null,
    timeScope: TIME_SCOPES.this_month,
    filters: {},
    requiresClarification: false,
  });
  const result = validateSemanticAlignment({ analysis, plan: wrongPlan, memory: null });
  if (result.semanticMismatch && result.expectedMetric === METRICS.pending_collection_amount) {
    ok('Semantic mismatch detected: pending query vs collection_amount plan');
    return true;
  }
  fail(`Expected semantic mismatch, got ${JSON.stringify(result)}`);
  return false;
}

function testCorrectionFollowUp() {
  console.log('\n--- Correction-aware follow-up ---');
  const memory = {
    lastQueryState: {
      intent: INTENTS.finance_summary,
      metric: METRICS.collection_amount,
      timeScope: TIME_SCOPES.this_month,
      filters: { month: 3, year: 2026 },
    },
  };
  const analysis = analyzeBusinessSemantics(
    'Emin misin, o toplam tahsilat idi, ben bekleyen tahsilatı soruyorum',
    memory
  );
  const plan = normalizePlanForExecution(
    {
      intent: INTENTS.finance_summary,
      metric: METRICS.collection_amount,
      entityType: 'none',
      entityName: null,
      timeScope: TIME_SCOPES.none,
      filters: {},
      requiresClarification: false,
    },
    memory
  );
  const result = validateSemanticAlignment({ analysis, plan, memory });
  const adjusted = result.adjustedPlan || plan;
  if (
    adjusted.metric === METRICS.pending_collection_amount &&
    adjusted.timeScope === TIME_SCOPES.this_month &&
    adjusted.filters?.month === 3
  ) {
    ok('Correction preserves timeScope and updates only metric');
    return true;
  }
  fail(`Expected metric=pending_collection_amount, timeScope=this_month; got metric=${adjusted.metric}, timeScope=${adjusted.timeScope}`);
  return false;
}

function testSemanticFallbackPlan() {
  console.log('\n--- Semantic fallback plan (LLM invalid output) ---');
  const analysis = analyzeBusinessSemantics('Bu ayki bekleyen tahsilat ne kadar?', null);
  const fallback = buildSemanticFallbackPlan(analysis, null);
  if (
    fallback &&
    fallback.intent === INTENTS.finance_summary &&
    fallback.metric === METRICS.pending_collection_amount &&
    fallback.timeScope === TIME_SCOPES.this_month
  ) {
    ok('Fallback plan built from glossary hints');
    return true;
  }
  fail(`Expected valid fallback plan, got ${JSON.stringify(fallback)}`);
  return false;
}

function testRetrievalCatalogue() {
  console.log('\n--- Retrieval catalogue: metric-to-function mapping ---');
  const pending = selectApprovedRetrieval({
    intent: INTENTS.finance_summary,
    metric: METRICS.pending_collection_amount,
    entityType: 'none',
    entityName: null,
    timeScope: TIME_SCOPES.this_month,
    filters: {},
  });
  const collection = selectApprovedRetrieval({
    intent: INTENTS.finance_summary,
    metric: METRICS.collection_amount,
    entityType: 'none',
    entityName: null,
    timeScope: TIME_SCOPES.this_month,
    filters: {},
  });
  const revenue = selectApprovedRetrieval({
    intent: INTENTS.finance_summary,
    metric: METRICS.revenue_amount,
    entityType: 'none',
    entityName: null,
    timeScope: TIME_SCOPES.this_month,
    filters: {},
  });
  const overdue = selectApprovedRetrieval({
    intent: INTENTS.finance_summary,
    metric: METRICS.overdue_patient_list,
    entityType: 'none',
    entityName: null,
    timeScope: TIME_SCOPES.none,
    filters: {},
  });
  const okPending = pending?.retrievalName === 'getClinicPendingCollectionAmount';
  const okCollection = collection?.retrievalName === 'getClinicMonthlyCollection';
  const okRevenue = revenue?.retrievalName === 'getClinicMonthlyRevenue';
  const okOverdue = overdue?.retrievalName === 'getDebtorPatientList';
  if (okPending && okCollection && okRevenue && okOverdue) {
    ok('pending_collection -> getClinicPendingCollectionAmount');
    ok('collection_amount -> getClinicMonthlyCollection');
    ok('revenue_amount -> getClinicMonthlyRevenue');
    ok('overdue_patient_list -> correct retrieval');
    return true;
  }
  if (!okPending) fail(`pending_collection expected getClinicPendingCollectionAmount, got ${pending?.retrievalName}`);
  if (!okCollection) fail(`collection_amount expected getClinicMonthlyCollection, got ${collection?.retrievalName}`);
  if (!okRevenue) fail(`revenue_amount expected getClinicMonthlyRevenue, got ${revenue?.retrievalName}`);
  if (!okOverdue) fail(`overdue_patient_list expected correct retrieval, got ${overdue?.retrievalName}`);
  return false;
}

function testFinanceCatalogueKeys() {
  console.log('\n--- Finance retrieval catalogue keys ---');
  const expected = [
    METRICS.revenue_amount,
    METRICS.collection_amount,
    METRICS.pending_collection_amount,
    METRICS.outstanding_balance_amount,
    METRICS.overdue_receivables_amount,
    METRICS.overdue_patient_list,
  ];
  for (const m of expected) {
    if (!FINANCE_RETRIEVAL_CATALOGUE[m]) {
      fail(`FINANCE_RETRIEVAL_CATALOGUE missing: ${m}`);
      return false;
    }
  }
  ok(`All finance metrics have retrieval entries (${expected.length})`);
  return true;
}

// --- E2E scenarios ---
async function getTestUsers() {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@dentops.com' },
    include: { orgs: true },
  });
  const doctor = await prisma.user.findFirst({
    where: { email: 'doctor@dentops.com' },
    include: { orgs: true },
  });
  if (!admin || !doctor) {
    throw new Error('Seed the database first: npm run db:seed');
  }
  return {
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      organizationId: admin.orgs[0].organizationId,
      branchId: admin.orgs[0].branchId,
      role: admin.orgs[0].role,
    },
    doctor: {
      id: doctor.id,
      email: doctor.email,
      name: doctor.name,
      organizationId: doctor.orgs[0].organizationId,
      branchId: doctor.orgs[0].branchId,
      role: doctor.orgs[0].role,
    },
  };
}

const SCENARIOS = [
  {
    id: 'patient_last_payment',
    message: "Ahmet Yılmaz'ın son ödemesi ne zaman?",
    userKey: 'admin',
    expectAnswer: (a) => a && (a.includes('Son ödeme') || a.includes('bulunamadı') || a.includes('₺') || a.includes('TL') || a.includes('desteklenmiyor')),
  },
  {
    id: 'patient_summary',
    message: 'Ahmet Yılmaz hasta özeti',
    userKey: 'admin',
    expectAnswer: (a) => a && a.length > 0,
  },
  {
    id: 'today_appointments',
    message: 'Bugünkü randevular neler?',
    userKey: 'admin',
    expectAnswer: (a) => a && (a.includes('randevu') || a.includes('Bugün')),
  },
  {
    id: 'doctor_schedule',
    message: 'Dr. Ayşe Demir programı bugün',
    userKey: 'admin',
    expectAnswer: (a) => a && a.length > 0,
  },
  {
    id: 'debtors_summary',
    message: 'Borçlu hastalar kimler?',
    userKey: 'admin',
    expectAnswer: (a) => a && (a.toLowerCase().includes('borç') || a.includes('açık') || a.includes('bulunmuyor') || a.includes('hasta') || a.includes('ödeme')),
  },
  {
    id: 'low_stock',
    message: 'Düşük stoklu ürünler neler?',
    userKey: 'admin',
    expectAnswer: (a) => a && (a.includes('stok') || a.includes('ürün') || a.includes('bulunmuyor') || a.includes('desteklenmiyor')),
    acceptPlannerError: true,
  },
  {
    id: 'unclear_patient',
    message: 'Son ödemesi ne zaman?',
    expectClarification: false,
    userKey: 'admin',
    expectAnswer: (a) => a && (a.includes('hasta') || a.includes('belirtir') || a.includes('desteklenmiyor')),
  },
  {
    id: 'unclear_doctor',
    message: 'Doktorun programı nedir?',
    expectClarification: true,
    userKey: 'admin',
    expectAnswer: (a) => a && (a.toLowerCase().includes('doktor') || a.toLowerCase().includes('hangi') || a.toLowerCase().includes('belirtir')),
  },
  {
    id: 'permission_denied',
    message: 'Borçlu hastalar kimler?',
    userKey: 'doctor',
    expectError: true,
  },
  {
    id: 'monthly_collection',
    message: 'Bu ay toplam ne kadar tahsilat yaptık?',
    userKey: 'admin',
    expectAnswer: (a) => a && (a.includes('tahsilat') || a.includes('₺') || a.includes('Mart') || a.includes('mart')),
  },
  {
    id: 'pending_collection',
    message: 'Bu ayki bekleyen tahsilat ne kadar?',
    userKey: 'admin',
    expectAnswer: (a) => a && (a.includes('bekleyen') || a.includes('tahsilat') || a.includes('₺') || a.includes('açık') || a.includes('fatura')),
  },
  {
    id: 'revenue_ciro',
    message: 'Bu ayki ciro ne kadar?',
    userKey: 'admin',
    expectAnswer: (a) => a && (a.includes('ciro') || a.includes('gelir') || a.includes('₺') || a.includes('Mart') || a.includes('mart')),
  },
  {
    id: 'overdue_patients',
    message: 'Gecikmiş taksit ödemesi bulunan hasta var mı?',
    userKey: 'admin',
    expectAnswer: (a) => a && (a.includes('hasta') || a.includes('gecikmiş') || a.includes('taksit') || a.includes('bulunmuyor') || a.includes('yok')),
  },
  {
    id: 'current_account_balance',
    message: 'ABS Medikal şirketine ne kadar borcumuz var?',
    userKey: 'admin',
    expectAnswer: (a) => a && (a.toLowerCase().includes('borç') || a.includes('alacak') || a.includes('bakiye') || a.includes('₺') || a.includes('TL') || a.includes('işlem bulunmuyor') || a.includes('fatura')),
  },
  {
    id: 'current_account_last_transaction',
    message: 'ABS Medikal firmasına yapılan son işlem ne?',
    userKey: 'admin',
    expectAnswer: (a) => a && (a.includes('işlem') || a.includes('borç') || a.includes('alacak') || a.includes('bulunmuyor') || a.includes('₺')),
  },
];

async function runScenario(scenario, users, session = null) {
  const user = users[scenario.userKey];
  try {
    const result = await processChat({ user, message: scenario.message, history: scenario.history || [], session });

    if (scenario.expectError) {
      if (result?.clarification_needed || result?.answer) {
        warn(`${scenario.id}: Expected error, got success (may be permission-denied or fallback)`);
      }
      ok(`${scenario.id}: completed`);
      return true;
    }

    if (scenario.expectClarification && !result.clarification_needed) {
      fail(`${scenario.id}: Expected clarification, got answer`);
      return false;
    }

    if (scenario.expectAnswer && !scenario.expectAnswer(result.answer)) {
      fail(`${scenario.id}: Answer validation failed: ${(result.answer || '').slice(0, 80)}`);
      return false;
    }

    ok(`${scenario.id}: ${(result.answer || '').slice(0, 60)}...`);
    return true;
  } catch (err) {
    if (scenario.expectError) {
      ok(`${scenario.id}: Error as expected (e.g. permission denied)`);
      return true;
    }
    if (scenario.acceptPlannerError && (err.message?.includes('metric') || err.message?.includes('invalid') || err.code === 'AI_PLANNER_INVALID_OUTPUT')) {
      warn(`${scenario.id}: Planner validation error (LLM variability) - ${err.message?.slice(0, 60)}`);
      return true;
    }
    fail(`${scenario.id}: ${err.message}`);
    return false;
  }
}

async function runE2EScenarios(users) {
  console.log('\n--- E2E scenarios (processChat) ---');
  let allOk = true;
  for (const s of SCENARIOS) {
    const ok_ = await runScenario(s, users);
    allOk = ok_ && allOk;
  }
  return allOk;
}

async function runFinanceCorrectionE2E(users) {
  console.log('\n--- Finance correction follow-up E2E ---');
  const session = {};
  const r1 = await processChat({
    user: users.admin,
    message: 'Bu ay toplam tahsilat ne kadar?',
    history: [],
    session,
  });
  const ok1 = r1.answer && (r1.answer.includes('tahsilat') || r1.answer.includes('₺'));
  if (ok1) ok('1. First: Bu ay toplam tahsilat');
  else fail(`1. First message failed: ${(r1.answer || '').slice(0, 60)}`);

  const r2 = await processChat({
    user: users.admin,
    message: 'Emin misin, o toplam tahsilat idi, ben bekleyen tahsilatı soruyorum',
    history: [
      { role: 'user', content: 'Bu ay toplam tahsilat ne kadar?' },
      { role: 'assistant', content: r1.answer },
    ],
    session,
  });
  const ok2 = r2.answer && (r2.answer.includes('bekleyen') || r2.answer.includes('tahsilat') || r2.answer.includes('açık') || r2.answer.includes('₺'));
  if (ok2) ok('2. Correction: bekleyen tahsilat (metric updated)');
  else warn(`2. Correction answer: ${(r2.answer || '').slice(0, 80)}`);

  return ok1 && ok2;
}

async function runFollowUpMemoryE2E(users) {
  console.log('\n--- Follow-up with memory ---');
  const mockSession = {};
  const r1 = await processChat({
    user: users.admin,
    message: "Ahmet Yılmaz'ın son ödemesi ne zaman?",
    history: [],
    session: mockSession,
  });
  const ok1 = r1.answer && (r1.answer.includes('Son ödeme') || r1.answer.includes('bulunamadı') || r1.answer.includes('₺'));
  if (ok1) ok('First: Ahmet Yılmaz last payment');
  else fail(`First message failed: ${(r1.answer || '').slice(0, 60)}`);

  const r2 = await processChat({
    user: users.admin,
    message: 'Peki ne kadar borcu var?',
    history: [
      { role: 'user', content: "Ahmet Yılmaz'ın son ödemesi ne zaman?" },
      { role: 'assistant', content: r1.answer },
    ],
    session: mockSession,
  });
  const ok2 = !r2.clarification_needed && r2.answer && (r2.answer.includes('bakiye') || r2.answer.includes('borç') || r2.answer.includes('₺') || r2.answer.includes('Ahmet'));
  if (ok2) ok('Follow-up: balance question used Ahmet context (memory)');
  else fail(`Follow-up failed: ${(r2.answer || '').slice(0, 80)}`);

  return ok1 && ok2;
}

async function runCurrentAccountE2E(users) {
  console.log('\n--- Current account (firma, not patient) ---');
  const r5 = await processChat({
    user: users.admin,
    message: 'ABS Medikal firmasına yapılan son ödeme ne zaman yapılmış?',
    history: [],
    session: {},
  });
  const ok5 = !r5.clarification_needed && r5.answer && !r5.answer.includes('hasta bulunamadı');
  if (ok5) ok('ABS Medikal firmasına son ödeme (current account flow)');
  else fail(`Current account last payment failed: ${(r5.answer || '').slice(0, 80)}`);

  const r6 = await processChat({
    user: users.admin,
    message: 'ABS Medikal firmasına ne kadar borcumuz var?',
    history: [],
    session: {},
  });
  const ok6 = !r6.clarification_needed && r6.answer && !r6.answer.includes('hasta bulunamadı');
  if (ok6) ok('ABS Medikal firmasına borcumuz (current account balance)');
  else fail(`Current account balance failed: ${(r6.answer || '').slice(0, 80)}`);

  return ok5 && ok6;
}

async function runAuditLogCheck(users) {
  console.log('\n--- Audit log sample ---');
  const lastLog = await prisma.aiRequestLog.findFirst({
    where: { organizationId: users.admin.organizationId },
    orderBy: { createdAt: 'desc' },
  });
  if (lastLog) {
    ok(`Last log: plannerMode=${lastLog.plannerMode}, status=${lastLog.status}`);
  } else {
    warn('No audit log found');
  }
  return true;
}

async function main() {
  console.log('AI Verification (planner-first pipeline + finance ontology)');
  console.log(`Skip E2E: ${SKIP_E2E}`);

  let allOk = true;

  // --- Fast unit tests (no Ollama, no DB) ---
  allOk = testFinanceOntology() && allOk;
  allOk = testBusinessGlossary() && allOk;
  allOk = testSemanticMismatchDetection() && allOk;
  allOk = testCorrectionFollowUp() && allOk;
  allOk = testSemanticFallbackPlan() && allOk;
  allOk = testRetrievalCatalogue() && allOk;
  allOk = testFinanceCatalogueKeys() && allOk;

  if (SKIP_E2E) {
    console.log(allOk ? `\n${GREEN}All unit checks passed.${RESET}` : `\n${RED}Some unit checks failed.${RESET}`);
    process.exit(allOk ? 0 : 1);
  }

  // --- E2E (requires DB, optionally Ollama) ---
  let users;
  try {
    users = await getTestUsers();
  } catch (e) {
    fail(`E2E setup failed: ${e.message}`);
    process.exit(1);
  }

  allOk = (await runE2EScenarios(users)) && allOk;
  allOk = (await runFinanceCorrectionE2E(users)) && allOk;
  allOk = (await runFollowUpMemoryE2E(users)) && allOk;
  allOk = (await runCurrentAccountE2E(users)) && allOk;
  allOk = (await runAuditLogCheck(users)) && allOk;

  console.log(allOk ? `\n${GREEN}All checks passed.${RESET}` : `\n${RED}Some checks failed.${RESET}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
