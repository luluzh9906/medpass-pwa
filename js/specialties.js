/**
 * Specialty & Physician Scoping Engine.
 * Filters clinical records by attending doctor / specialty while keeping
 * critical safety guardrails (Allergies + Other Active Meds interaction check) always accessible.
 */

export const SPECIALTY_CATALOG = [
  {
    id: 'endo',
    zh: '内分泌科',
    en: 'Endocrinology',
    vitals: ['bp', 'hr', 'glucose', 'temp'],
    showWeight: true,
    keywords: ['甲状', 'tsh', 'ft4', 'ft3', 'tpo', '优甲乐', '左甲状腺素', '血糖', '糖化', 'a1c', '胰岛', '糖尿病', '心悸', '手抖', '手部微颤', '怕热', '体重下降', 'thyroid', 'levothyroxine', 'synthroid', 'hashimoto', 'diabetes', 'glucose', 'endocrin', 'palpitation', 'tremor', 'weight']
  },
  {
    id: 'cardio',
    zh: '心血管内科',
    en: 'Cardiology',
    vitals: ['bp', 'hr', 'spo2'],
    showWeight: true,
    keywords: ['血压', '高血压', '心率', '心动', '心悸', '胸痛', '胸闷', '心电图', '血脂', '胆固醇', '他汀', '阿司匹林', '抗凝', '支架', 'cardio', 'bp', 'hypertension', 'heart', 'ecg', 'ekg', 'lipid', 'ldl', 'statin', 'palpitation', 'chest']
  },
  {
    id: 'derm',
    zh: '皮肤科',
    en: 'Dermatology',
    vitals: ['temp', 'pain'],
    showWeight: false,
    keywords: ['皮', '疹', '湿疹', '荨麻疹', '瘙痒', '痘', '痤疮', '药膏', '软膏', '莫匹罗星', '卤米松', '他克莫司', 'derm', 'skin', 'rash', 'eczema', 'urticaria', 'hives', 'itch', 'acne', 'cream', 'ointment', 'topical']
  },
  {
    id: 'gi',
    zh: '消化内科',
    en: 'Gastroenterology',
    vitals: ['bp', 'hr', 'temp', 'pain'],
    showWeight: true,
    keywords: ['胃', '肠', '肝', '胆', '反流', '烧心', '腹痛', '腹泻', '恶心', '呕吐', '胃镜', '肠镜', '奥美拉唑', '雷贝拉唑', 'gi', 'gastro', 'gerd', 'reflux', 'stomach', 'bowel', 'liver', 'alt', 'ast', 'colonoscopy']
  },
  {
    id: 'neuro',
    zh: '神经内科',
    en: 'Neurology',
    vitals: ['bp', 'hr', 'temp', 'pain'],
    showWeight: false,
    keywords: ['头痛', '偏头痛', '头晕', '眩晕', '失眠', '睡眠', '入睡', '麻木', '手颤', '脑', '神经', 'neuro', 'headache', 'migraine', 'dizziness', 'insomnia', 'sleep', 'tremor', 'numbness', 'mri']
  },
  {
    id: 'obgyn',
    zh: '妇产科',
    en: 'OB-GYN',
    vitals: ['bp', 'hr', 'temp', 'pain'],
    showWeight: true,
    keywords: ['月经', 'lmp', '妊娠', '怀孕', '孕', '哺乳', '妇科', '子宫', '卵巢', '铁蛋白', '贫血', 'ob', 'gyn', 'pregnan', 'lactat', 'ferritin', 'anemia']
  },
  {
    id: 'ortho',
    zh: '骨科 / 运动医学',
    en: 'Orthopedics',
    vitals: ['bp', 'pain'],
    showWeight: false,
    keywords: ['骨', '关节', '膝', '腰', '颈椎', '肩', '扭伤', '韧带', 'x光', '布洛芬', 'ortho', 'joint', 'knee', 'back', 'spine', 'fracture', 'sprain', 'x-ray', 'pain']
  },
  {
    id: 'ent_eye',
    zh: '耳鼻喉 / 眼科',
    en: 'ENT & Ophthalmology',
    vitals: ['temp', 'pain'],
    showWeight: false,
    keywords: ['眼', '视力', '干眼', '耳', '鼻', '鼻炎', '咽', '喉', '扁桃体', 'ent', 'eye', 'vision', 'sinus', 'rhinitis', 'allergic', 'throat', 'ear', '氯雷他定', 'loratadine']
  },
  {
    id: 'pcp',
    zh: '全科 / 家庭医生',
    en: 'Primary Care (PCP)',
    vitals: ['bp', 'hr', 'glucose', 'temp', 'spo2', 'pain'],
    showWeight: true,
    keywords: []
  },
  {
    id: 'other',
    zh: '其他专科',
    en: 'Other Specialty',
    vitals: ['bp', 'hr', 'temp', 'spo2', 'pain'],
    showWeight: true,
    keywords: []
  }
];

export function getSpecialtyMeta(id) {
  return SPECIALTY_CATALOG.find((s) => s.id === id) || null;
}

export function inferSpecialtyId(departmentStr = '') {
  const s = String(departmentStr || '').toLowerCase();
  if (!s) return '';
  for (const spec of SPECIALTY_CATALOG) {
    if (s.includes(spec.zh.toLowerCase()) || s.includes(spec.en.toLowerCase())) {
      return spec.id;
    }
    if (spec.id === 'endo' && (s.includes('内分泌') || s.includes('endocrin'))) return 'endo';
    if (spec.id === 'cardio' && (s.includes('心') || s.includes('cardio'))) return 'cardio';
    if (spec.id === 'derm' && (s.includes('皮肤') || s.includes('derm'))) return 'derm';
    if (spec.id === 'gi' && (s.includes('消化') || s.includes('gastro'))) return 'gi';
    if (spec.id === 'neuro' && (s.includes('神经') || s.includes('neuro'))) return 'neuro';
    if (spec.id === 'obgyn' && (s.includes('妇') || s.includes('产') || s.includes('ob'))) return 'obgyn';
    if (spec.id === 'ortho' && (s.includes('骨') || s.includes('ortho'))) return 'ortho';
    if (spec.id === 'ent_eye' && (s.includes('耳') || s.includes('鼻') || s.includes('眼') || s.includes('ent') || s.includes('ophth'))) return 'ent_eye';
    if (spec.id === 'pcp' && (s.includes('全科') || s.includes('家庭') || s.includes('内科') || s.includes('primary') || s.includes('pcp') || s.includes('internal'))) return 'pcp';
  }
  return '';
}

function itemTextBlob(item, fields) {
  return fields
    .flatMap((f) => [item?.[f], item?.[`${f}En`]])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesScope(item, textFields, specialtyId, doctorName) {
  // Explicit "all" (cross-specialty essential) or matching specialty tag
  if (Array.isArray(item.specialties) && item.specialties.length > 0) {
    if (item.specialties.includes('all') || item.specialties.includes(specialtyId)) {
      return true;
    }
    // If explicitly tagged to OTHER specialties, also allow doctorName direct match
    if (doctorName && item.doctorName && item.doctorName.toLowerCase() === doctorName.toLowerCase()) {
      return true;
    }
    return false;
  }

  // Fallback for untagged items: check doctorName match or clinical specialty keywords
  if (doctorName && item.doctorName && item.doctorName.toLowerCase() === doctorName.toLowerCase()) {
    return true;
  }
  const spec = getSpecialtyMeta(specialtyId);
  if (!spec || !spec.keywords.length) return true;
  const blob = itemTextBlob(item, textFields);
  return spec.keywords.some((kw) => blob.includes(kw));
}

export function buildAvailableScopes(state) {
  const scopes = [];
  const seenKey = new Set();

  const addScope = (doctorName, specialtyId, labelZh, labelEn, isCurrentVisit = false) => {
    const cleanDoc = String(doctorName || '').trim();
    const specId = specialtyId || inferSpecialtyId(labelZh) || 'pcp';
    const key = `${cleanDoc.toLowerCase()}::${specId}`;
    if (seenKey.has(key)) return;
    seenKey.add(key);
    const specMeta = getSpecialtyMeta(specId);
    scopes.push({
      key,
      doctorName: cleanDoc,
      specialtyId: specId,
      isCurrentVisit,
      labelZh: cleanDoc
        ? `${cleanDoc}${specMeta ? ` (${specMeta.zh})` : ''}`
        : specMeta?.zh || labelZh || '当前专科',
      labelEn: cleanDoc
        ? `${cleanDoc}${specMeta ? ` (${specMeta.en})` : ''}`
        : specMeta?.en || labelEn || 'Current Specialty'
    });
  };

  if (state.visit?.doctorName || state.visit?.department || state.visit?.specialtyId) {
    addScope(
      state.visit.doctorName,
      state.visit.specialtyId || inferSpecialtyId(state.visit.department || state.visit.departmentEn),
      state.visit.department,
      state.visit.departmentEn,
      true
    );
  }

  for (const c of state.careTeam?.savedContacts || []) {
    addScope(c.doctorName, c.specialtyId || inferSpecialtyId(c.department || c.departmentEn), c.department, c.departmentEn);
  }

  for (const vh of state.visitHistory || []) {
    addScope(vh.doctorName, vh.specialtyId || inferSpecialtyId(vh.department || vh.departmentEn), vh.department, vh.departmentEn);
  }

  return scopes;
}

/**
 * Filter state cleanly for a chosen doctor/specialty scope.
 * Always keeps allergies, specialAlerts, and exposes non-specialty active meds separately
 * as a drug-interaction safety net.
 */
export function filterStateByScope(state, scopeKey, availableScopes) {
  if (!scopeKey || scopeKey === 'all') {
    return {
      isFiltered: false,
      activeScope: null,
      scopedState: state,
      otherActiveMeds: [],
      hiddenSummary: null
    };
  }

  const activeScope = availableScopes.find((s) => s.key === scopeKey);
  if (!activeScope || activeScope.specialtyId === 'pcp') {
    // PCP / Primary Care sees full chart by default while still highlighting doctor visits if matching
    return {
      isFiltered: false,
      activeScope,
      scopedState: state,
      otherActiveMeds: [],
      hiddenSummary: null
    };
  }

  const { specialtyId, doctorName } = activeScope;

  const matchedSymptoms = (state.symptoms || []).filter((s) =>
    matchesScope(s, ['name', 'notes', 'selfCare'], specialtyId, doctorName)
  );
  const matchedConditions = (state.history?.conditions || []).filter((c) =>
    matchesScope(c, ['name', 'note', 'status'], specialtyId, doctorName)
  );

  const matchedMeds = [];
  const otherActiveMeds = [];
  for (const m of state.medications || []) {
    if (matchesScope(m, ['name', 'genericName', 'notes', 'stopReason'], specialtyId, doctorName)) {
      matchedMeds.push(m);
    } else if (m.status === 'active') {
      otherActiveMeds.push(m);
    }
  }

  const matchedReports = (state.attachments || []).filter((a) =>
    matchesScope(a, ['title', 'summaryHighlight'], specialtyId, doctorName)
  );
  const matchedExams = (state.examHistory || []).filter((ex) =>
    matchesScope(ex, ['name', 'resultSummary', 'facility'], specialtyId, doctorName)
  );

  // For visit history: prioritize matching the exact doctor if doctorName is present, OR matching specialtyId/department
  const matchedVisits = (state.visitHistory || []).filter((vh) => {
    if (doctorName && vh.doctorName) {
      if (vh.doctorName.toLowerCase() === doctorName.toLowerCase()) return true;
    }
    const vhSpec = vh.specialtyId || inferSpecialtyId(vh.department || vh.departmentEn);
    if (vhSpec && vhSpec === specialtyId) return true;
    return matchesScope(vh, ['department', 'purpose', 'doctorNotes'], specialtyId, doctorName);
  });

  // Check if current visit matches this scope; if doctor opened another specialty scope, hide unrelated current visit purpose unless matching
  const currentVisitSpec = state.visit?.specialtyId || inferSpecialtyId(state.visit?.department || state.visit?.departmentEn);
  const currentVisitMatches =
    (!currentVisitSpec && !state.visit?.doctorName) ||
    currentVisitSpec === specialtyId ||
    (doctorName && state.visit?.doctorName && state.visit.doctorName.toLowerCase() === doctorName.toLowerCase());

  const specMeta = getSpecialtyMeta(specialtyId);
  const allowedVitalTypes = specMeta?.vitals || ['bp', 'hr', 'glucose', 'temp', 'spo2', 'pain'];
  const matchedVitals = (state.vitals || []).filter((v) => allowedVitalTypes.includes(v.type));

  const hiddenCounts = {
    symptoms: (state.symptoms || []).length - matchedSymptoms.length,
    conditions: (state.history?.conditions || []).length - matchedConditions.length,
    meds: (state.medications || []).length - matchedMeds.length,
    reports: (state.attachments || []).length - matchedReports.length,
    exams: (state.examHistory || []).length - matchedExams.length,
    visits: (state.visitHistory || []).length - matchedVisits.length
  };
  const totalHidden =
    hiddenCounts.symptoms +
    hiddenCounts.conditions +
    hiddenCounts.meds +
    hiddenCounts.reports +
    hiddenCounts.exams +
    hiddenCounts.visits;

  return {
    isFiltered: true,
    activeScope,
    otherActiveMeds,
    showWeightSection: specMeta ? specMeta.showWeight : true,
    allowedVitalTypes,
    currentVisitMatches,
    hiddenSummary: {
      totalHidden,
      ...hiddenCounts
    },
    scopedState: {
      ...state,
      visit: currentVisitMatches
        ? state.visit
        : {
            purpose: '',
            purposeEn: '',
            department: specMeta?.zh || '',
            departmentEn: specMeta?.en || '',
            visitDate: '',
            visitTime: '',
            doctorName: activeScope.doctorName || '',
            onsetSummary: '',
            questions: [],
            visitReport: null
          },
      symptoms: matchedSymptoms,
      history: {
        ...(state.history || {}),
        conditions: matchedConditions
      },
      medications: matchedMeds,
      vitals: matchedVitals,
      attachments: matchedReports,
      examHistory: matchedExams,
      visitHistory: matchedVisits
    }
  };
}
