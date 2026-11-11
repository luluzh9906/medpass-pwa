/**
 * Bilingual UI dictionary (zh / en) + clinical unit conversion helpers (Metric <-> US Customary).
 */

export const I18N = {
  zh: {
    appTitle: '医览通 MedPass',
    modeDocLocked: '医生只读视图（已锁定）',
    modeSnapshot: '二维码只读快照',
    modeManage: '个人录入端（已解锁）',
    updatedAt: '更新于',
    btnQr: '二维码',
    btnPrint: '打印',
    btnUnlock: '解锁编辑',
    btnLock: '锁定医生视图',
    demoBadge: '示例数据',
    dobLabel: '出生日期',
    ageUnit: '岁',
    allergyTitle: '过敏史与用药禁忌（重要警示）',
    noAllergyTitle: '过敏史记录',
    noAllergyDesc: '暂无已知药物或食物过敏史 (NKDA)',
    careLogisticsTitle: '就医联络与药房信息',
    pharmacyLabel: '常用药房',
    pcpLabel: '家庭/主治医生',
    insuranceLabel: '医保/保险',
    qaTitle: '医生快速问询（基于已有档案作答）',
    qaBadge: '仅据实回答 · 未知明示',
    qaPlaceholder: '输入您想核实的问题，例如：是否抽烟喝酒？有没有发烧或胸痛？目前优甲乐怎么吃？',
    qaAskBtn: '查询档案',
    qaClearBtn: '清空',
    qaDisclaimer: '严格依据患者已录入档案作答；未记录的信息将明确提示“不清楚”，绝不猜测编造。',
    qaChips: [
      { label: '过敏史？', q: '患者对什么药物或食物过敏？' },
      { label: '当前用药与末次服药？', q: '目前在吃什么药？今天吃了吗？' },
      { label: '体重变化？', q: '近期体重下降了多少？BMI是多少？' },
      { label: '否认哪些伴随症状？', q: '有没有胸痛、呼吸困难或发烧？' },
      { label: '烟酒/妊娠/手术史？', q: '是否抽烟、喝酒、怀孕或有手术史？' },
      { label: '药房与主治医生？', q: '常用药房和主治医生是谁？' }
    ],
    sec1Title: '本次就诊目的 (CC / HPI)',
    visitReportTitle: '医生就诊总结与就医报告 (After-Visit Summary)',
    voiceInputBtn: '医生语音总结',
    voiceEmptyTip: '就诊结束时，可请医生点击右侧「🎙️ 医生语音总结」口述诊断与医嘱，系统将自动整理成结构化就医报告。',
    vrDiagnosis: '诊断与评估',
    vrMedPlan: '用药调整方案',
    vrTestsPlan: '检查 / 化验安排',
    vrFollowUp: '复诊计划与注意事项',
    vrTakeaway: '给患者的通俗要点',
    vrRawTranscript: '查看医生口述原文',
    onsetSummaryLabel: '核心概览：',
    questionsLabel: '本次最想向医生确认的问题：',
    sec2Title: '当前症状与阴性鉴别 (ROS)',
    itemsCount: '项',
    durationLabel: '持续：',
    onsetLabel: '起病：',
    selfCareLabel: '自救/缓解：',
    rosTitle: '明确否认的伴随症状（阴性鉴别）',
    noSymptoms: '暂无记录当前不适症状',
    sec3Title: '服药核对 (Medication Reconciliation)',
    medTabAll: '全部',
    medTabActive: '在服',
    medTabRecent: '近期曾用',
    medActiveHeading: '当前正在服用',
    medRecentHeading: '近期曾服过的药物',
    medRxTag: '处方药 Rx',
    medOtcTag: '非处方/保健品 OTC',
    lastTakenLabel: '末次服药：',
    startLabel: '开始服用：',
    cycleLabel: '服用周期：',
    stopReasonLabel: '停药原因：',
    medBoxLabel: '药盒图',
    noActiveMeds: '当前无正在服用的药物',
    noRecentMeds: '近期无已停用药物记录',
    sec4Title: '体重发展趋势与 BMI',
    range30: '30天',
    range90: '90天',
    rangeAll: '全部',
    latestWeight: '最新体重',
    currentBmi: '当前 BMI',
    rangeChange: '区间变化',
    recordsUnit: '次记录',
    heightLabel: '身高',
    weightAlertPrefix: '临床关注：区间内体重下降达',
    weightAlertSuffix: '，请结合本次症状评估。',
    sec5Title: '生命体征、报告与既往检查历史',
    reportsTitle: '近期检验化验单（含图片）',
    examHistoryTitle: '既往检查历史（影像 / 超声 / 心电图 / 内镜等）',
    noExamHistory: '暂无既往检查历史记录',
    examCategories: {
      imaging: '影像 / 超声',
      cardiac: '心电 / 功能',
      endoscopy: '内镜 / 病理',
      lab: '既往化验',
      screening: '体检 / 筛查',
      other: '其他检查'
    },
    abnormalFlag: '有异常指标',
    normalFlag: '已复查',
    zoomLabel: '放大',
    noReports: '暂无上传检查报告',
    sec6Title: '既往史、手术史与社会史 (PMH / PSH / FH / SH)',
    pmhLabel: '慢性病与现病史',
    pshLabel: '手术 / 住院外伤史',
    fhLabel: '家族史',
    shLabel: '社会史与生活习惯（美国门诊常规核对项）',
    smokingLabel: '吸烟史',
    alcoholLabel: '饮酒史',
    pregnancyLabel: '妊娠/末次月经',
    occupationLabel: '职业与作息',
    visitHistoryTitle: '过往就诊记录与医嘱小结',
    emergencyLabel: '紧急联系人：',
    lockedFooterTip: '当前处于医生只读锁定状态，所有编辑入口已隐藏防误触。',
    snapFooterTip: '此页面通过患者分享的二维码在您手机本地解码展示，未向任何服务器上传或留存病历。',
    exitSnapBtn: '返回本地 PWA 首页',
    vitalsMeta: {
      bp: { title: '血压', icon: '🩺', hintMetric: '参考 < 120/80', hintUs: '参考 < 120/80' },
      hr: { title: '静息心率', icon: '❤️', hintMetric: '参考 60~100', hintUs: '参考 60~100' },
      glucose: { title: '血糖', icon: '🩸', hintMetric: '空腹 3.9~6.1', hintUs: '空腹 70~110' },
      temp: { title: '体温', icon: '🌡️', hintMetric: '参考 36.0~37.3', hintUs: '参考 96.8~99.1' },
      spo2: { title: '血氧饱和度', icon: '🫁', hintMetric: '参考 95~100%', hintUs: '参考 95~100%' },
      pain: { title: '疼痛评分', icon: '📊', hintMetric: '0 无痛 ~ 10 剧痛', hintUs: '0~10 分' }
    },
    severity: { mild: '轻度', moderate: '中度', severe: '重度' },
    trend: { worsening: '↗ 有所加重', stable: '→ 总体持平', improving: '↘ 逐步好转' },
    bmiLabels: { under: '偏轻', normal: '正常', over: '超重', obese: '肥胖' }
  },
  en: {
    appTitle: 'MedPass',
    modeDocLocked: 'Physician Read-Only (Locked)',
    modeSnapshot: 'QR Snapshot (Read-Only)',
    modeManage: 'Patient Edit Mode (Unlocked)',
    updatedAt: 'Updated',
    btnQr: 'QR Share',
    btnPrint: 'Print / PDF',
    btnUnlock: 'Unlock Edit',
    btnLock: 'Lock to Physician View',
    demoBadge: 'Sample Data',
    dobLabel: 'DOB',
    ageUnit: 'yo',
    allergyTitle: 'ALLERGIES & CONTRAINDICATIONS',
    noAllergyTitle: 'ALLERGIES',
    noAllergyDesc: 'No Known Drug Allergies (NKDA)',
    careLogisticsTitle: 'CARE TEAM & PREFERRED PHARMACY',
    pharmacyLabel: 'Preferred Pharmacy',
    pcpLabel: 'Primary Care (PCP)',
    insuranceLabel: 'Insurance',
    qaTitle: 'Ask Patient Record (Zero-Hallucination Q&A)',
    qaBadge: 'Fact-Grounded · Says "Unclear" if Missing',
    qaPlaceholder: 'Ask a clinical question, e.g.: Smoking/alcohol? Pregnant? Chest pain or fever? Current meds & last dose?',
    qaAskBtn: 'Ask',
    qaClearBtn: 'Clear',
    qaDisclaimer: 'Answers strictly from documented patient data with source tags. Unrecorded items explicitly return "Unclear / Not documented".',
    qaChips: [
      { label: 'Allergies?', q: 'What allergies or drug reactions does the patient have?' },
      { label: 'Active meds & last dose?', q: 'What medications is the patient taking and when was the last dose?' },
      { label: 'Weight loss / BMI?', q: 'How much weight has the patient lost and what is the BMI?' },
      { label: 'Chest pain / SOB / Fever?', q: 'Does the patient have chest pain, shortness of breath, or fever?' },
      { label: 'Social Hx / Pregnancy?', q: 'Does the patient smoke, drink alcohol, or is pregnant?' },
      { label: 'Pharmacy & PCP?', q: 'What is the preferred pharmacy and PCP?' }
    ],
    sec1Title: 'Chief Complaint (CC) & HPI',
    visitReportTitle: 'Physician Visit Summary / After-Visit Report',
    voiceInputBtn: 'MD Voice Summary',
    voiceEmptyTip: 'At wrap-up, tap "🎙️ MD Voice Summary" so the physician can dictate assessment & plan directly into a structured visit report.',
    vrDiagnosis: 'Assessment / Diagnosis',
    vrMedPlan: 'Medication Plan',
    vrTestsPlan: 'Ordered Labs / Workup',
    vrFollowUp: 'Follow-Up & Return Precautions',
    vrTakeaway: 'Patient Key Takeaway',
    vrRawTranscript: 'View Raw Dictation Transcript',
    onsetSummaryLabel: 'HPI Summary: ',
    questionsLabel: 'Patient’s Top Questions for Visit:',
    sec2Title: 'Current Symptoms & Pertinent Negatives (ROS)',
    itemsCount: 'items',
    durationLabel: 'Duration: ',
    onsetLabel: 'Onset: ',
    selfCareLabel: 'Self-care / Modifying: ',
    rosTitle: 'Pertinent Negatives (Explicitly Denied by Patient)',
    noSymptoms: 'No active symptoms documented',
    sec3Title: 'Medication Reconciliation',
    medTabAll: 'All',
    medTabActive: 'Active',
    medTabRecent: 'Past/Stopped',
    medActiveHeading: 'Active Medications',
    medRecentHeading: 'Recently Discontinued / Past Meds',
    medRxTag: 'Rx',
    medOtcTag: 'OTC / Supp',
    lastTakenLabel: 'Last dose: ',
    startLabel: 'Started: ',
    cycleLabel: 'Dates: ',
    stopReasonLabel: 'Stop reason: ',
    medBoxLabel: 'Box Photo',
    noActiveMeds: 'No active medications listed',
    noRecentMeds: 'No recently discontinued medications',
    sec4Title: 'Weight Trend & BMI',
    range30: '30D',
    range90: '90D',
    rangeAll: 'All',
    latestWeight: 'Latest Weight',
    currentBmi: 'Current BMI',
    rangeChange: 'Period Change',
    recordsUnit: 'entries',
    heightLabel: 'Height',
    weightAlertPrefix: 'Clinical Flag: Unintentional weight loss of',
    weightAlertSuffix: ' in selected period.',
    sec5Title: 'Vitals, Labs & Past Diagnostic History',
    reportsTitle: 'Recent Lab Reports (With Scans)',
    examHistoryTitle: 'Past Diagnostic & Imaging History',
    noExamHistory: 'No past diagnostic exams documented',
    examCategories: {
      imaging: 'Imaging / US',
      cardiac: 'EKG / Cardiac',
      endoscopy: 'Endoscopy / Biopsy',
      lab: 'Past Lab',
      screening: 'Screening',
      other: 'Other Exam'
    },
    abnormalFlag: 'Abnormal',
    normalFlag: 'Within Range',
    zoomLabel: 'Zoom',
    noReports: 'No diagnostic reports uploaded',
    sec6Title: 'PMH, PSH, Family & Social History',
    pmhLabel: 'Past Medical History (PMH)',
    pshLabel: 'Surgical History (PSH)',
    fhLabel: 'Family History (FH)',
    shLabel: 'Social History (SH)',
    smokingLabel: 'Tobacco',
    alcoholLabel: 'Alcohol',
    pregnancyLabel: 'Pregnancy / LMP',
    occupationLabel: 'Occupation',
    visitHistoryTitle: 'Prior Visits & MD Notes',
    emergencyLabel: 'Emergency Contact: ',
    lockedFooterTip: 'Physician Read-Only Lock active. All edit controls are hidden to prevent accidental changes.',
    snapFooterTip: 'Decoded locally in your browser from patient QR code. No patient data is sent to any server.',
    exitSnapBtn: 'Back to Local PWA Home',
    vitalsMeta: {
      bp: { title: 'Blood Pressure', icon: '🩺', hintMetric: 'Goal < 120/80', hintUs: 'Goal < 120/80' },
      hr: { title: 'Resting HR', icon: '❤️', hintMetric: 'Ref 60–100', hintUs: 'Ref 60–100' },
      glucose: { title: 'Blood Glucose', icon: '🩸', hintMetric: 'Fasting 3.9–6.1', hintUs: 'Fasting 70–110' },
      temp: { title: 'Temperature', icon: '🌡️', hintMetric: 'Ref 36.0–37.3', hintUs: 'Ref 96.8–99.1' },
      spo2: { title: 'SpO2', icon: '🫁', hintMetric: 'Ref 95–100%', hintUs: 'Ref 95–100%' },
      pain: { title: 'Pain Score', icon: '📊', hintMetric: '0–10 scale', hintUs: '0–10 scale' }
    },
    severity: { mild: 'Mild', moderate: 'Moderate', severe: 'Severe' },
    trend: { worsening: '↗ Worsening', stable: '→ Stable', improving: '↘ Improving' },
    bmiLabels: { under: 'Underweight', normal: 'Normal', over: 'Overweight', obese: 'Obese' }
  }
};

export function t(lang) {
  return I18N[lang === 'en' ? 'en' : 'zh'];
}

/**
 * Picks translated field when UI is in English and an explicit En field exists,
 * otherwise cleanly falls back to the primary entered value.
 */
export function pickText(obj, field, lang) {
  if (!obj) return '';
  if (lang === 'en') {
    const enVal = obj[`${field}En`];
    if (Array.isArray(enVal) ? enVal.length > 0 : Boolean(enVal)) {
      return enVal;
    }
  }
  return obj[field] ?? '';
}

export function formatWeightValue(kg, unitSystem) {
  if (kg == null || Number.isNaN(Number(kg))) return { val: '—', unit: '' };
  if (unitSystem === 'us') {
    return { val: (Number(kg) * 2.20462).toFixed(1), unit: 'lbs', rawNum: Number((Number(kg) * 2.20462).toFixed(1)) };
  }
  return { val: Number(kg).toFixed(1), unit: 'kg', rawNum: Number(Number(kg).toFixed(1)) };
}

export function formatHeight(cm, unitSystem) {
  if (!cm) return '';
  if (unitSystem === 'us') {
    const totalIn = Math.round(Number(cm) / 2.54);
    const ft = Math.floor(totalIn / 12);
    const inches = totalIn % 12;
    return `${ft}'${inches}"`;
  }
  return `${cm} cm`;
}

export function formatVitalReading(vital, unitSystem) {
  if (!vital) return { display: '—', unit: '' };
  if (vital.type === 'bp') {
    return { display: `${vital.value1}/${vital.value2}`, unit: 'mmHg' };
  }
  if (vital.type === 'temp') {
    if (unitSystem === 'us') {
      const f = (Number(vital.value1) * 9) / 5 + 32;
      return { display: f.toFixed(1), unit: '°F' };
    }
    return { display: Number(vital.value1).toFixed(1), unit: '°C' };
  }
  if (vital.type === 'glucose') {
    if (unitSystem === 'us') {
      const mgdl = Math.round(Number(vital.value1) * 18.0182);
      return { display: String(mgdl), unit: 'mg/dL' };
    }
    return { display: Number(vital.value1).toFixed(1), unit: 'mmol/L' };
  }
  if (vital.type === 'spo2') {
    return { display: String(vital.value1), unit: '%' };
  }
  if (vital.type === 'pain') {
    return { display: `${vital.value1}/10`, unit: '' };
  }
  return { display: String(vital.value1), unit: vital.unit || 'bpm' };
}

export function formatDisplayDate(isoDate, lang) {
  if (!isoDate) return '';
  if (lang === 'en' && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split('-');
    return `${m}/${d}/${y}`;
  }
  return isoDate;
}

export function computeAge(profile) {
  const now = new Date();
  if (profile.dob && /^\d{4}-\d{2}-\d{2}$/.test(profile.dob)) {
    const [y, m, d] = profile.dob.split('-').map(Number);
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) {
      age--;
    }
    return age;
  }
  if (profile.birthYear) {
    return now.getFullYear() - Number(profile.birthYear);
  }
  return null;
}

// Input conversion helpers (canonical storage is metric: kg, cm, °C, mmol/L)
export function lbsToKg(lbs) {
  return Number((Number(lbs) / 2.20462).toFixed(2));
}

export function fahrenheitToCelsius(f) {
  return Number((((Number(f) - 32) * 5) / 9).toFixed(1));
}

export function mgdlToMmol(mgdl) {
  return Number((Number(mgdl) / 18.0182).toFixed(1));
}

export function ftInToCm(ft, inches = 0) {
  return Math.round((Number(ft || 0) * 12 + Number(inches || 0)) * 2.54);
}

/**
 * Built-in bilingual clinical quick-pick presets so users can build accurate
 * Chinese + US-English medical entries with a single tap.
 */
export const CLINICAL_PRESETS = {
  allergies: [
    { label: '无已知过敏 (NKDA)', zh: '', en: '' },
    { label: '青霉素类 (Penicillins)', zh: '青霉素类药物过敏', en: 'Penicillins (Allergic reaction)' },
    { label: '头孢类 (Cephalosporins)', zh: '头孢菌素类过敏', en: 'Cephalosporins' },
    { label: '磺胺类 (Sulfa)', zh: '磺胺类药物过敏', en: 'Sulfa drugs' },
    { label: '碘造影剂 (Iodine Contrast)', zh: '碘造影剂过敏', en: 'Iodinated Contrast' },
    { label: '阿司匹林/NSAIDs', zh: '阿司匹林/非甾体抗炎药过敏', en: 'Aspirin / NSAIDs' },
    { label: '乳胶 (Latex)', zh: '乳胶过敏', en: 'Latex' }
  ],
  ros: [
    { label: '否认胸痛/胸闷', zh: '明确否认胸痛、胸闷或晕厥', en: 'Denies chest pain, tightness, or syncope' },
    { label: '否认呼吸困难', zh: '明确否认呼吸困难或下肢水肿', en: 'Denies shortness of breath (SOB) or leg edema' },
    { label: '否认发热寒战', zh: '明确否认发热、寒战', en: 'Denies fever or chills' },
    { label: '否认恶心呕吐腹泻', zh: '明确否认恶心、呕吐或腹泻', en: 'Denies nausea, vomiting, or diarrhea' },
    { label: '否认头痛视物模糊', zh: '明确否认剧烈头痛或视物模糊', en: 'Denies severe headache or vision changes' }
  ],
  conditions: [
    { label: '高血压 HTN', zh: '原发性高血压', en: 'Essential Hypertension (HTN)' },
    { label: '2型糖尿病 T2DM', zh: '2型糖尿病', en: 'Type 2 Diabetes Mellitus (T2DM)' },
    { label: '高脂血症 Hyperlipidemia', zh: '高脂血症', en: 'Hyperlipidemia' },
    { label: '甲状腺功能减退', zh: '甲状腺功能减退', en: 'Hypothyroidism' },
    { label: '胃食管反流 GERD', zh: '胃食管反流病', en: 'GERD' },
    { label: '哮喘 Asthma', zh: '支气管哮喘', en: 'Asthma' }
  ],
  medFreq: [
    { label: '每日1次 (QD)', zh: '每日 1 次', en: 'Once daily (PO)' },
    { label: '每日2次 (BID)', zh: '每日 2 次', en: 'Twice daily (BID)' },
    { label: '每日3次 (TID)', zh: '每日 3 次', en: 'Three times daily (TID)' },
    { label: '必要时 (PRN)', zh: '必要时服用', en: 'As needed (PRN)' }
  ],
  social: {
    smoking: [
      { label: '从不吸烟', zh: '从不吸烟（含电子烟）', en: 'Never smoker (no tobacco or vaping)' },
      { label: '已戒烟', zh: '既往吸烟，已戒烟', en: 'Former smoker' }
    ],
    alcohol: [
      { label: '不饮酒', zh: '从不饮酒', en: 'None / Non-drinker' },
      { label: '偶尔社交饮酒', zh: '偶尔社交饮酒（<1次/周）', en: 'Occasional social (<1 drink/wk)' }
    ],
    pregnancy: [
      { label: '非妊娠/未哺乳', zh: '非妊娠期 / 未哺乳', en: 'Not pregnant / Not lactating' },
      { label: '不适用 (男性)', zh: '不适用', en: 'N/A' }
    ]
  },
  exams: [
    { label: '甲状腺彩超', category: 'imaging', spec: 'endo', zh: '甲状腺及颈部淋巴结彩超', en: 'Thyroid & Neck Ultrasound' },
    { label: '12导联心电图', category: 'cardiac', spec: 'cardio', zh: '十二导联静息心电图', en: '12-Lead Resting EKG' },
    { label: '胸部CT/胸片', category: 'imaging', spec: 'pcp', zh: '胸部低剂量 CT / 胸片', en: 'Chest CT / Chest X-Ray' },
    { label: '胃肠镜检查', category: 'endoscopy', spec: 'gi', zh: '胃镜 / 结肠镜检查', en: 'EGD / Colonoscopy' },
    { label: '腹部彩超', category: 'imaging', spec: 'gi', zh: '肝胆胰脾肾彩超', en: 'Abdominal Ultrasound' },
    { label: '骨密度 DEXA', category: 'screening', spec: 'ortho', zh: '双能 X 线骨密度检测 (DEXA)', en: 'DEXA Bone Density Scan' }
  ]
};
