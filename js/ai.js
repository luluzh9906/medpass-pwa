/**
 * Client-side Gemini Vision & Clinical Autofill Engine (gemini-2.5-flash).
 * API Key is stored strictly in local browser storage (never included in backups or QR shares).
 * Every autofill prompt strictly forbids hallucinating or fabricating missing medical facts.
 */

const API_KEY_STORAGE = 'medpass_gemini_api_key_v1';
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export function getGeminiApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setGeminiApiKey(key) {
  try {
    const clean = String(key || '').trim();
    if (!clean) localStorage.removeItem(API_KEY_STORAGE);
    else localStorage.setItem(API_KEY_STORAGE, clean);
  } catch {
    // Ignore storage restriction
  }
}

export function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+)(?:;[^,]+)*;base64,(.+)$/);
  if (!m) throw new Error('媒体文件格式无效');
  return { mimeType: m[1], base64: m[2] };
}

function extractJsonObject(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(cleaned);
}

export function buildPatientContextForAi(state) {
  if (!state) return {};
  return {
    profile: {
      name: state.profile?.name,
      nameEn: state.profile?.nameEn,
      gender: state.profile?.gender,
      dob: state.profile?.dob,
      bloodType: state.profile?.bloodType,
      heightCm: state.profile?.heightCm,
      allergies: state.profile?.allergies || [],
      allergiesEn: state.profile?.allergiesEn || [],
      specialAlerts: state.profile?.specialAlerts || [],
      emergencyContact: state.profile?.emergencyContact || ''
    },
    careTeam: state.careTeam || {},
    visit: state.visit || {},
    symptoms: (state.symptoms || []).map((s) => ({
      name: s.name,
      nameEn: s.nameEn,
      durationText: s.durationText,
      severity: s.severity,
      trend: s.trend,
      notes: s.notes
    })),
    rosNegatives: (state.rosNegatives || []).map((r) => r.textEn || r.text),
    medications: (state.medications || []).map((m) => ({
      name: m.name,
      nameEn: m.nameEn,
      category: m.category,
      dosage: m.dosage,
      frequency: m.frequency,
      timing: m.timing,
      status: m.status,
      startDate: m.startDate,
      endDate: m.endDate,
      stopReason: m.stopReason,
      lastTaken: m.lastTaken
    })),
    weights: (state.weights || []).slice(-8),
    vitals: (state.vitals || []).slice(-10),
    history: state.history || {},
    socialHistory: state.socialHistory || {},
    attachments: (state.attachments || []).map((a) => ({
      date: a.date,
      title: a.title,
      titleEn: a.titleEn,
      isAbnormal: a.isAbnormal,
      summaryHighlight: a.summaryHighlight,
      summaryHighlightEn: a.summaryHighlightEn
    })),
    examHistory: (state.examHistory || []).map((ex) => ({
      date: ex.date,
      category: ex.category,
      name: ex.name,
      nameEn: ex.nameEn,
      facility: ex.facility,
      resultSummary: ex.resultSummary,
      resultSummaryEn: ex.resultSummaryEn,
      isAbnormal: ex.isAbnormal
    })),
    visitHistory: (state.visitHistory || []).slice(0, 3)
  };
}

async function callGemini({ apiKey, prompt, imageDataUrl = null, mediaDataUrl = null }) {
  if (!apiKey) {
    throw new Error('请先在「安全与备份」中填写你的 Gemini API Key');
  }

  const parts = [{ text: prompt }];
  const attachmentUrl = mediaDataUrl || imageDataUrl;
  if (attachmentUrl) {
    const { mimeType, base64 } = parseDataUrl(attachmentUrl);
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64
      }
    });
  }

  const resp = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!resp.ok) {
    let errMsg = `AI 请求失败 (HTTP ${resp.status})`;
    try {
      const errJson = await resp.json();
      if (errJson?.error?.message) errMsg = errJson.error.message;
    } catch {
      // Ignore parse error
    }
    throw new Error(errMsg);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('AI 未返回有效识别结果，请换一张更清晰的图片重试');
  return extractJsonObject(text);
}

/**
 * 1. Extract structured fields from a lab report / imaging photo
 */
export async function aiExtractLabReport(imageDataUrl, apiKey) {
  const prompt = `You are a careful clinical data extractor. Read the uploaded medical lab report or diagnostic imaging report photo.
Extract ONLY what is clearly visible on the image. Never guess missing numbers.
Return strict JSON with this schema:
{
  "date": "YYYY-MM-DD (or empty string if unreadable)",
  "title": "Concise Chinese report title",
  "titleEn": "Concise English report title",
  "isAbnormal": true/false (true if any flag like ↑, ↓, HIGH, LOW, POS, 偏高, 偏低, 阳性, H, L appears),
  "summaryHighlight": "Chinese summary of key/abnormal values with units and arrows, <= 120 chars",
  "summaryHighlightEn": "English summary of key/abnormal values with units and flags, <= 140 chars"
}`;
  return callGemini({ apiKey, prompt, imageDataUrl });
}

/**
 * 2. Extract medication fields from a pillbox or US Rx bottle label photo
 */
export async function aiExtractMedBox(imageDataUrl, apiKey) {
  const prompt = `You are a clinical pharmacist assistant. Read the uploaded pillbox or prescription bottle label.
Extract ONLY what is clearly visible. Return strict JSON:
{
  "name": "Chinese drug name (include brand/generic if visible, or English name if US bottle)",
  "nameEn": "English drug name",
  "category": "rx" or "otc",
  "dosage": "Strength/dose per intake, e.g. 50 μg / 20 mg",
  "frequency": "Chinese frequency e.g. 每日 1 次",
  "frequencyEn": "English frequency e.g. Once daily (PO)",
  "timing": "Chinese timing/instructions e.g. 晨起空腹",
  "timingEn": "English timing/instructions e.g. Empty stomach in AM",
  "notes": "Any important printed warning or instruction"
}`;
  return callGemini({ apiKey, prompt, imageDataUrl });
}

/**
 * 3. Extract physician/clinic business card or appointment reminder card
 */
export async function aiExtractBusinessCard(imageDataUrl, apiKey) {
  const prompt = `Read this physician/clinic business card or medical appointment reminder card.
Extract ONLY information visible on the card. Return strict JSON:
{
  "doctorName": "Physician or provider full name + credentials if shown (e.g. Dr. Sarah Miller, MD)",
  "department": "Chinese specialty/department name (e.g. 内分泌科)",
  "departmentEn": "English specialty/department name (e.g. Endocrinology)",
  "clinicName": "Clinic or hospital name",
  "phone": "Phone number",
  "address": "Street address",
  "appointmentDate": "YYYY-MM-DD if an appointment date is written, else empty string",
  "appointmentTime": "HH:MM (24-hour format) if time is written, else empty string",
  "notes": "Any visit prep instructions written on card (e.g. fasting lab before visit)"
}`;
  return callGemini({ apiKey, prompt, imageDataUrl });
}

/**
 * 4. Match a blank clinic Intake Form / 就诊卡 photo against ALL saved patient records
 */
export async function aiMatchIntakeForm(imageDataUrl, patientState, lang, apiKey) {
  const context = buildPatientContextForAi(patientState);
  const prompt = `You are a clinical intake assistant helping a patient fill out the photographed clinic registration / intake form ("就诊卡 / Patient Intake Form").
First, read every field, checkbox, or question printed on the uploaded form image.
Second, fill each field STRICTLY using ONLY the patient's saved JSON records below.
CRITICAL ACCURACY RULE: If a field on the form is NOT present in the patient JSON, DO NOT guess or invent it—set status to "missing" and value to "${lang === 'en' ? 'Not recorded in profile — please fill manually' : '档案未记录，请现场手动填写'}".

Patient Saved Records JSON:
${JSON.stringify(context)}

Return strict JSON:
{
  "formTitle": "Detected form title",
  "fields": [
    {
      "label": "Field/Question name on the form (bilingual or in ${lang === 'en' ? 'English' : 'Chinese'})",
      "value": "Exact filled answer from patient records, or missing notice",
      "source": "Which patient record section provided it (e.g. Profile / Allergies / Meds / Social Hx / Missing)",
      "status": "matched" or "missing"
    }
  ]
}`;
  return callGemini({ apiKey, prompt, imageDataUrl });
}

/**
 * 5. Synthesize/Autofill the patient's Current Visit Card (CC/HPI & Top Questions)
 * strictly from all stored profile, symptoms, meds, weights, vitals, and lab reports.
 */
export async function aiAutofillVisitCard(patientState, apiKey) {
  const context = buildPatientContextForAi(patientState);
  const prompt = `You are a bilingual clinical intake assistant preparing a concise 30-second Visit Card (CC/HPI & top patient questions) for an upcoming clinic appointment.
Synthesize ONLY from the patient's saved JSON records below (symptoms, weight trend, vitals, medications, and abnormal lab reports). NEVER invent symptoms, diagnoses, or lab values not in the JSON.

Patient Saved Records JSON:
${JSON.stringify(context)}

Return strict JSON:
{
  "purpose": "Clear 1-2 sentence Chinese Chief Complaint & Reason for Visit",
  "purposeEn": "Clear 1-2 sentence US-clinic English Chief Complaint & Reason for Visit",
  "onsetSummary": "Concise 1-line Chinese HPI & key trend summary",
  "onsetSummaryEn": "Concise 1-line English HPI & key trend summary",
  "questions": ["1-3 practical Chinese questions the patient should ask the doctor based on their meds/labs/symptoms"],
  "questionsEn": ["Same 1-3 questions in natural US-clinic English"]
}`;
  return callGemini({ apiKey, prompt });
}

/**
 * 6. Summarize physician voice dictation (live audio OR transcript) into a structured After-Visit Summary.
 * Strictly prohibits fabricating anything the physician did not explicitly state.
 */
export async function aiSummarizeDoctorVoice({ transcript = '', audioDataUrl = null, patientState, apiKey }) {
  const context = buildPatientContextForAi(patientState);
  const prompt = `You are a clinical medical scribe creating an accurate After-Visit Summary (就医报告 / 医生就诊总结) from the physician's spoken dictation.
Use the patient's chart context ONLY to spell medication/lab names accurately.
CRITICAL ACCURACY RULE: Include ONLY diagnoses, medication adjustments, ordered tests, follow-up dates, and precautions that the physician EXPLICITLY dictated in the audio/transcript. If a field was NOT mentioned by the doctor, return an empty string "". NEVER fabricate or extrapolate medical advice.

Patient Context JSON (for terminology spelling only):
${JSON.stringify({ profile: context.profile, meds: context.medications, visit: context.visit })}

${transcript ? `Physician Transcript:\n"""\n${transcript}\n"""` : 'Listen carefully to the attached physician audio recording and transcribe + summarize it.'}

Return strict JSON:
{
  "rawTranscript": "Exact cleaned verbatim transcript of what the doctor said (keep bilingual terms accurately)",
  "diagnosis": "Chinese clinical assessment / diagnosis stated by doctor (or empty string)",
  "diagnosisEn": "English clinical assessment / diagnosis (or empty string)",
  "medPlan": "Chinese medication changes / prescription plan stated by doctor (or empty string)",
  "medPlanEn": "English medication plan (or empty string)",
  "testsPlan": "Chinese ordered labs/imaging/workup stated by doctor (or empty string)",
  "testsPlanEn": "English ordered labs/imaging (or empty string)",
  "followUp": "Chinese follow-up timing & return precautions / red flags stated by doctor (or empty string)",
  "followUpEn": "English follow-up & return precautions (or empty string)",
  "patientTakeaway": "1-2 concise plain-language Chinese takeaways for the patient",
  "patientTakeawayEn": "1-2 concise plain-language English takeaways for the patient",
  "nextFollowUpDate": "YYYY-MM-DD only if a specific date was stated, else empty string"
}`;
  return callGemini({ apiKey, prompt, mediaDataUrl: audioDataUrl });
}

/**
 * Deterministic zero-API fallback summarizer when offline or no Gemini API key is configured.
 * Strictly classifies existing sentences from the doctor's transcript—never invents facts.
 */
export function localSummarizeDoctorTranscript(transcript) {
  const raw = String(transcript || '').trim();
  const clauses = raw
    .split(/[。！？.!?\n；;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const diag = [];
  const meds = [];
  const tests = [];
  const follow = [];

  for (const c of clauses) {
    const lower = c.toLowerCase();
    let matched = false;
    if (/(诊断|考虑|评估|属于|提示|过量|偏低|偏高|问题|diagnos|assess|impression|consistent with|likely|over-replac|subclinical)/i.test(lower)) {
      diag.push(c);
      matched = true;
    }
    if (/(药|优甲乐|微克|毫克|mg|mcg|μg|减量|加量|停药|停用|继续吃|维持|每日|口服|处方|med|dose|levothyroxine|reduce|increase|stop|continue|take|rx)/i.test(lower)) {
      meds.push(c);
      matched = true;
    }
    if (/(检查|化验|复查|抽血|心电图|彩超|b超|ct|mri|ekg|ecg|lab|tsh|ft4|blood|ultrasound|test|order)/i.test(lower)) {
      tests.push(c);
      matched = true;
    }
    if (/(复诊|随访|周后|月后|注意|避免|急诊|如出现|如果|胸痛|心率|follow|week|month|return|precaution|er|urgent|avoid|if )/i.test(lower)) {
      follow.push(c);
      matched = true;
    }
    if (!matched) {
      follow.push(c);
    }
  }

  return {
    rawTranscript: raw,
    diagnosis: diag.join('；'),
    diagnosisEn: '',
    medPlan: meds.join('；'),
    medPlanEn: '',
    testsPlan: tests.join('；'),
    testsPlanEn: '',
    followUp: follow.join('；'),
    followUpEn: '',
    patientTakeaway: raw,
    patientTakeawayEn: '',
    nextFollowUpDate: ''
  };
}

/**
 * Generate standard .ics Calendar file for scanned appointment card
 */
export function downloadAppointmentIcs({ title, date, time = '09:00', location = '', description = '' }) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('缺少有效的预约日期 (YYYY-MM-DD)');
  }
  const cleanTime = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  const [hh, mm] = cleanTime.split(':').map(Number);
  const startDt = `${date.replace(/-/g, '')}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
  const endTotalMin = hh * 60 + mm + 45;
  const endHh = String(Math.floor(endTotalMin / 60) % 24).padStart(2, '0');
  const endMm = String(endTotalMin % 60).padStart(2, '0');
  const endDt = `${date.replace(/-/g, '')}T${endHh}${endMm}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  const esc = (s) => String(s || '').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MedPass PWA//Appointment//EN',
    'BEGIN:VEVENT',
    `UID:medpass-${Date.now()}@local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${startDt}`,
    `DTEND:${endDt}`,
    `SUMMARY:${esc(title || '门诊预约 / Clinic Appointment')}`,
    location ? `LOCATION:${esc(location)}` : '',
    description ? `DESCRIPTION:${esc(description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `就诊预约_${date}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
