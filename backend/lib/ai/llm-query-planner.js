const { chat, isAvailable, getConfig } = require('./ollama');
const {
  INTENTS,
  ENTITY_TYPES,
  METRICS,
  TIME_SCOPES,
  INTENT_HELP,
  METRIC_HELP,
  normalizePlannerOutput,
} = require('./assistant-contracts');

function extractJsonObject(str) {
  let raw = String(str || '');
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  raw = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i += 1) {
    if (raw[i] === '{') depth += 1;
    if (raw[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        let jsonCandidate = raw.slice(start, i + 1);
        // Remove trailing commas before closing braces/brackets
        jsonCandidate = jsonCandidate.replace(/,\s*([}\]])/g, '$1');
        return jsonCandidate;
      }
    }
  }
  return null;
}

function createLlmUnavailableError(innerMessage) {
  const model = getConfig().model;
  const err = new Error(
    `Ollama LLM kullanılamıyor: ${innerMessage || 'Bağlantı hatası'}. ` +
    `Ollama çalışıyor mu? (ollama serve) Model yüklü mü? (ollama pull ${model})`
  );
  err.code = 'AI_LLM_UNAVAILABLE';
  return err;
}

function summarizeMemory(memory = null) {
  if (!memory) return null;
  return {
    lastPatient: memory.lastResolvedPatient?.name || null,
    lastDoctor: memory.lastResolvedDoctor?.name || null,
    lastCurrentAccount: memory.lastResolvedCurrentAccount?.name || null,
    lastTreatmentPlan: memory.lastResolvedTreatmentPlan?.name || null,
    lastIntent: memory.lastQueryState?.intent || memory.lastDomain || null,
    lastMetric: memory.lastQueryState?.metric || null,
    lastTimeScope: memory.lastQueryState?.timeScope || null,
  };
}

function inferOverdueInstallmentMetricFromText(text, previousContext = null) {
  const q = String(text || '').toLocaleLowerCase('tr-TR');

  const overdueLike =
    /gecikmiş|gecikmis|vadesi geçmiş|vadesi gecmis|overdue/.test(q);

  const installmentLike =
    /taksit|taksiti|taksitin|taksitli|taksitlerin|odeme|ödeme|odemesi|ödemesi/.test(q);

  const patientLike =
    /hasta|hastasi|hastası|hastalar|hastalari|hastaları|hastalarin|hastaların|hastalarinin|hastalarının/.test(q);

  const doctorLike =
    /\bdr\b|dr\.|doktor|hekim/.test(q);

  const ratioLike =
    /oran|orani|oranı|yuzde|yüzde|payi|payı/.test(q);

  const listLike =
    /liste|listeler|goster|göster|kimler|hangileri/.test(q);

  const countLike =
    /kac|kaç|sayi|sayı|adet|var mi|var mı/.test(q);

  const amountLike =
    /tutar|toplam|ne kadar|miktar|borc|borç|alacak/.test(q);

  if (!(overdueLike && installmentLike)) {
    if (
      previousContext &&
      /kastediyorum|demek istiyorum|onu soruyorum|bundan bahsediyorum|ondan bahsediyorum|onu kastediyorum|sayisini kastediyorum|sayısını kastediyorum|tutarini kastediyorum|tutarını kastediyorum|oranini kastediyorum|oranını kastediyorum/.test(q)
    ) {
      const prevMetric = previousContext.lastMetric || null;
      const overdueMetrics = new Set([
        'overdue_installment_amount',
        'overdue_installment_count',
        'overdue_installment_patient_count',
        'overdue_installment_patient_list',
        'overdue_installment_ratio',
        'doctor_overdue_installment_ratio',
      ]);
      if (overdueMetrics.has(prevMetric)) {
        if (ratioLike) return 'overdue_installment_ratio';
        if (listLike) return 'overdue_installment_patient_list';
        if (amountLike) return 'overdue_installment_amount';
        if (countLike) {
          if (patientLike) return 'overdue_installment_patient_count';
          return 'overdue_installment_count';
        }
        return prevMetric;
      }
    }

    return null;
  }

  if (doctorLike && ratioLike) return 'doctor_overdue_installment_ratio';
  if (ratioLike) return 'overdue_installment_ratio';
  if (listLike) return 'overdue_installment_patient_list';
  if (amountLike) return 'overdue_installment_amount';
  if (countLike) {
    if (patientLike) return 'overdue_installment_patient_count';
    return 'overdue_installment_count';
  }

  if (patientLike) return 'overdue_installment_patient_count';
  return 'overdue_installment_count';
}

function inferShapeFromMetric(metric) {
  if (!metric) return null;

  if (
    [
      'overdue_installment_amount',
      'revenue_amount',
      'collection_amount',
      'pending_collection_amount',
      'outstanding_balance_amount',
      'overdue_receivables_amount',
    ].includes(metric)
  ) {
    return 'amount';
  }

  if (
    [
      'overdue_installment_count',
      'overdue_installment_patient_count',
      'patient_count',
      'appointment_count',
      'payment_count',
      'invoice_count',
    ].includes(metric)
  ) {
    return 'count';
  }

  if (
    [
      'overdue_installment_patient_list',
      'overdue_patient_list',
      'debtor_patient_list',
      'appointment_list',
      'schedule_list',
    ].includes(metric)
  ) {
    return 'list';
  }

  if (
    [
      'overdue_installment_ratio',
      'doctor_overdue_installment_ratio',
      'overdue_ratio',
      'collection_rate',
      'payment_invoice_ratio',
      'no_show_rate',
      'cancellation_rate',
    ].includes(metric)
  ) {
    return 'ratio';
  }

  return null;
}

function buildSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  const intentLines = Object.entries(INTENT_HELP)
    .map(([intent, desc]) => `- ${intent}: ${desc}`)
    .join('\n');
  const metricLines = Object.entries(METRIC_HELP)
    .map(([metric, desc]) => `- ${metric}: ${desc}`)
    .join('\n');

  return [
    'Sen DentAI için çalışan bir sorgu planlayıcısısın.',
    'Görevin, kullanıcı mesajını YALNIZCA doğrulanabilir bir yapılandırılmış sorgu planına dönüştürmek.',
    'Veritabanına erişemezsin. SQL üretemezsin. Araç çağrısı yapamazsın.',
    'Sadece JSON döndür. Markdown, açıklama, kod bloğu, önsöz yazma.',
    `Bugünün tarihi: ${today}.`,
    '',
    'Kurallar:',
    '1. Kullanıcının gerçek iş sorusunu anlamaya çalış. Anlamlı iş sorularında unsupported seçimini çok nadir kullan.',
    '2. Doktor, hasta, firma/cari gibi varlık isimlerini entities alanına koy.',
    '3. Doktor ifadesi varsa entity type doctor olmalı. Klinik geneli ise entity ekleme.',
    '4. Zaman kapsamı açıkça belirtilmişse timeScope alanına yaz. Belirli ay/yıl varsa custom + filters.month/year kullan.',
    '5. Eğer soru anlamlı ama eksikse requiresClarification=true yap ve clarificationQuestion üret.',
    '6. Kullanıcının sorduğu metriği doğru seç. Tahsilat ile ciroyu karıştırma. Bekleyen tahsilat ile toplam tahsilatı asla karıştırma.',
    '7. Sadece izin verilen intent, entity type, metric ve timeScope değerlerini kullan.',
    '8. Finans sorularında intent çoğunlukla finance_summary olmalı; ayrımı metric belirler.',
    '9. "bekleyen tahsilat" -> pending_collection_amount, "toplam tahsilat" -> collection_amount, "ciro" -> revenue_amount, "gecikmiş taksit" -> overdue_receivables_amount veya overdue_patient_list.',
    '10. Kullanıcı önceki yanıtı düzeltiyorsa ("ben bekleyen tahsilatı soruyorum"), mümkünse aynı kapsamı koruyup sadece metric düzelt.',
    '',
    'İzin verilen intentler:',
    intentLines,
    '',
    'İzin verilen entity type değerleri:',
    Object.values(ENTITY_TYPES).join(', '),
    '',
    'İzin verilen metric değerleri:',
    metricLines,
    '',
    'İzin verilen timeScope değerleri:',
    Object.values(TIME_SCOPES).join(', '),
    '',
    'JSON şeması:',
    '{',
    '  "intent": "...",',
    '  "metric": "...",',
    '  "entityType": "patient|doctor|current_account|inventory_item|clinic|none",',
    '  "entityName": "..." veya null,',
    '  "timeScope": "today|this_week|this_month|last_3_months|custom|none",',
    '  "filters": {"month": 3, "year": 2026},',
    '  "outputShape": "count|amount|ratio|list|summary",',
    '  "requiresClarification": false,',    '  "clarificationQuestion": null,',
    '  "unsupportedReason": null,',
    '  "confidence": 0.0',
    '}',
    '',
    'Örnekler:',
    '{"intent":"finance_summary","metric":"collection_amount","entityType":"none","entityName":null,"timeScope":"this_month","filters":{},"outputShape":"amount","requiresClarification":false,"clarificationQuestion":null,"unsupportedReason":null,"confidence":0.96}',
    '{"intent":"finance_summary","metric":"pending_collection_amount","entityType":"none","entityName":null,"timeScope":"this_month","filters":{},"outputShape":"amount","requiresClarification":false,"clarificationQuestion":null,"unsupportedReason":null,"confidence":0.96}',
    '{"intent":"finance_summary","metric":"pending_collection_amount","entityType":"none","entityName":null,"timeScope":"this_month","filters":{"compareToPrevious":true,"comparisonPeriod":"previous_month"},"outputShape":"amount","requiresClarification":false,"clarificationQuestion":null,"unsupportedReason":null,"confidence":0.93}',
    '{"intent":"finance_summary","metric":"overdue_patient_list","entityType":"none","entityName":null,"timeScope":"none","filters":{},"outputShape":"list","requiresClarification":false,"clarificationQuestion":null,"unsupportedReason":null,"confidence":0.92}',
    '{"intent":"doctor_appointment_analysis","metric":"appointment_count","entityType":"doctor","entityName":"Ayşe Demir","timeScope":"this_month","filters":{},"outputShape":"count","requiresClarification":false,"clarificationQuestion":null,"unsupportedReason":null,"confidence":0.95}',
    '{"intent":"clinic_appointment_analysis","metric":"appointment_list","entityType":"none","entityName":null,"timeScope":"this_month","filters":{},"outputShape":"list","requiresClarification":false,"clarificationQuestion":null,"unsupportedReason":null,"confidence":0.95}',
    '{"intent":"patient_treatment_progress","metric":"completion_percentage","entityType":"patient","entityName":"Mehmet Demir","timeScope":"none","filters":{},"outputShape":"ratio","requiresClarification":false,"clarificationQuestion":null,"unsupportedReason":null,"confidence":0.94}',
    '{"intent":"clinic_patient_analysis","metric":"patient_count","entityType":"none","entityName":null,"timeScope":"none","filters":{},"outputShape":"count","requiresClarification":false,"clarificationQuestion":null,"unsupportedReason":null,"confidence":0.95}',
    '{"intent":"unsupported","metric":"summary","entityType":"none","entityName":null,"timeScope":"none","filters":{},"outputShape":"summary","requiresClarification":false,"clarificationQuestion":null,"unsupportedReason":"ERP kapsamı dışı bir istek","confidence":0.25}',
  ].join('\n');
}

async function buildQueryPlan(message, opts = {}) {
  const { history = [], memory = null, semanticContext = null } = opts;
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return {
      plan: {
        intent: INTENTS.unsupported,
        metric: METRICS.summary,
        entityType: ENTITY_TYPES.none,
        entityName: null,
        timeScope: TIME_SCOPES.none,
        filters: {},
        requiresClarification: true,
        clarificationQuestion: 'Lütfen bir soru veya istek yazın.',
        unsupportedReason: null,
        confidence: 0,
      },
      modelUsed: null,
      rawPlannerResponse: null,
    };
  }

  const available = await isAvailable();
  if (!available) {
    throw createLlmUnavailableError('Ollama erişilemiyor (isAvailable=false)');
  }

  const messages = [{ role: 'system', content: buildSystemPrompt() }];
  const memorySummary = summarizeMemory(memory);
  if (memorySummary) {
    messages.push({
      role: 'system',
      content: `Kısa dönem konuşma hafızası: ${JSON.stringify(memorySummary)}`,
    });
  }
  if (semanticContext) {
    const semanticPayload = {
      normalizedQuery: semanticContext.normalizedQuery,
      glossaryMatches: semanticContext.glossaryMatches?.map((match) => ({
        metric: match.metric,
        matchedText: match.matchedText,
      })),
      primaryMetricHint: semanticContext.primaryMetricHint || null,
      timeScopeHint: semanticContext.timeScopeHint || null,
      filtersHint: semanticContext.filtersHint || {},
      correctionContext: semanticContext.replanContext?.correctionContext || semanticContext.correctionContext || null,
      forcedIntent: semanticContext.forcedIntent || null,
      forcedMetric: semanticContext.forcedMetric || null,
      forceTimeScope: semanticContext.forceTimeScope || null,
      inheritanceHint: semanticContext.inheritanceHint || false,
      inheritedMetric: semanticContext.inheritedMetric || null,
      inheritedIntent: semanticContext.inheritedIntent || null,
      inheritedEntityType: semanticContext.inheritedEntityType || null,
      inheritedTimeScope: semanticContext.inheritedTimeScope || null,
    };
    messages.push({
      role: 'system',
      content: [
        'Backend semantic hints are authoritative.',
        'If forcedMetric is present, metric must be compatible with it unless requiresClarification=true.',
        'If forcedIntent is present, intent must be compatible with it unless requiresClarification=true.',
        'If user is correcting a previous answer and no new period is given, preserve previous scope.',
        'If inheritanceHint is true, reuse inheritedMetric, inheritedIntent, inheritedEntityType, inheritedTimeScope for short follow-ups like "peki geçen aya göre ne kadar arttı?".',
        JSON.stringify(semanticPayload),
      ].join('\n'),
    });
  }

  const recentHistory = (history || []).slice(-8);
  for (const item of recentHistory) {
    if (item?.role === 'user' || item?.role === 'assistant') {
      messages.push({
        role: item.role,
        content: String(item.content || '').slice(0, 1500),
      });
    }
  }

  messages.push({ role: 'user', content: trimmed });

  let content;
  try {
    ({ content } = await chat(messages));
  } catch (err) {
    throw createLlmUnavailableError(err.message);
  }

  let jsonStr = extractJsonObject(content);
  let rawPlan = null;
  let plannerRetryUsed = false;

  const tryParse = () => {
    if (!jsonStr) return false;
    try {
      rawPlan = JSON.parse(jsonStr);
      return true;
    } catch {
      return false;
    }
  };

  if (!tryParse()) {
    try {
      ({ content } = await chat(messages));
      plannerRetryUsed = true;
      jsonStr = extractJsonObject(content);
      tryParse();
    } catch {
      // retry failed, rawPlan stays null
    }
  }

  if (!rawPlan) {
    const parseErr = new Error('Planner returned invalid or malformed JSON');
    parseErr.code = 'AI_PLANNER_INVALID_OUTPUT';
    parseErr.plannerRetryUsed = plannerRetryUsed;
    throw parseErr;
  }

  function sanitizeRawPlannerOutput(rawPlan, text, previousContext = null) {
    const next = { ...(rawPlan || {}) };

    const inferredMetric = inferOverdueInstallmentMetricFromText(text, previousContext);

    if (inferredMetric) {
      next.metric = inferredMetric;
      next.intent = INTENTS.finance_summary;

      const inferredShape = inferShapeFromMetric(inferredMetric);
      if (inferredShape) {
        next.outputShape = inferredShape;
      }
    }

    // LLM yanlış alias üretirse burada düzelt
    if (next.metric === 'overdue_installment_patient_ratio') {
      const q = String(text || '').toLocaleLowerCase('tr-TR');
      if (/\bdr\b|dr\.|doktor|hekim/.test(q)) {
        next.metric = METRICS.doctor_overdue_installment_ratio;
        next.intent = INTENTS.finance_summary;
        next.outputShape = OUTPUT_SHAPES.ratio;
      } else {
        next.metric = METRICS.overdue_installment_ratio;
        next.intent = INTENTS.finance_summary;
        next.outputShape = OUTPUT_SHAPES.ratio;
      }
    }

    return next;
  }

  const sanitizedRawPlan = sanitizeRawPlannerOutput(
    rawPlan,
    trimmed,
    memorySummary || null
  );

  let plan;
  try {
    plan = normalizePlannerOutput(sanitizedRawPlan);
  } catch (err) {
    const parseErr = new Error(`Planner output failed validation: ${err.message}`);
    parseErr.code = 'AI_PLANNER_INVALID_OUTPUT';
    throw parseErr;
  }

  const protectedOverdueMetrics = new Set([
    METRICS.overdue_installment_amount,
    METRICS.overdue_installment_count,
    METRICS.overdue_installment_patient_count,
    METRICS.overdue_installment_patient_list,
    METRICS.overdue_installment_ratio,
    METRICS.doctor_overdue_installment_ratio,
  ]);

  const overdueMetricOverride = inferOverdueInstallmentMetricFromText(
    trimmed,
    memorySummary || null
  );

  if (overdueMetricOverride && protectedOverdueMetrics.has(overdueMetricOverride)) {
    plan.metric = overdueMetricOverride;
    plan.intent = INTENTS.finance_summary;

    const inferredShape = inferShapeFromMetric(overdueMetricOverride);
    if (inferredShape) {
      plan.outputShape = inferredShape;
    }
  }

  return {
    plan,
    modelUsed: getConfig().model,
    rawPlannerResponse: content,
  };
}

module.exports = {
  buildQueryPlan,
  createLlmUnavailableError,
  summarizeMemory,
};
