/**
 * Zero-Hallucination Local Clinical Q&A Engine.
 * Strictly answers ONLY from documented patient state with source attribution.
 * Explicitly returns "Unclear / Not documented" when information is missing—never guesses or fabricates.
 */
import { computeBmi, filterWeightsByRange, summarizeWeightStats } from './charts.js';
import {
  computeAge,
  formatDisplayDate,
  formatHeight,
  formatVitalReading,
  formatWeightValue,
  pickText
} from './i18n.js';

function hasPositiveMention(text, terms) {
  const lower = String(text || '').toLowerCase();
  return terms.some((term) => {
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      const clauseBefore = lower.slice(0, idx).split(/[.;,。；，]/).pop() || '';
      const isNegated = /\b(no|denies|without|negative|not)\b|(无|否认|未见|没有)/.test(clauseBefore);
      if (!isNegated) return true;
      idx = lower.indexOf(term, idx + term.length);
    }
    return false;
  });
}

function includesAny(q, terms) {
  return terms.some((term) => q.includes(term));
}

function stripDenyPrefix(txt) {
  return String(txt || '')
    .replace(/^(明确否认|否认|Denies\s+|denies\s+)/, '')
    .trim();
}
function getAllTextVariants(obj, fields) {
  return fields
    .flatMap((f) => [obj?.[f], obj?.[`${f}En`]])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function answerDoctorQuery(rawQuestion, state, lang = 'zh', unitSystem = 'metric') {
  const qRaw = String(rawQuestion || '').trim();
  if (!qRaw) return null;
  const q = qRaw.toLowerCase();
  const isEn = lang === 'en';

  const facts = [];
  const unknowns = [];

  // 1. Allergies / Contraindications (also triggers when MD asks "can I give penicillin/amoxicillin/contrast?")
  const drugAllergyCrossTerms = ['penicillin', 'amoxicillin', 'augmentin', 'sulfa', 'iodine', 'contrast', 'latex', '青霉素', '阿莫西林', '磺胺', '造影剂', '乳胶', '头孢'];
  if (includesAny(q, ['allerg', 'react', 'nkda', 'contraindic', '过敏', '禁忌', ...drugAllergyCrossTerms])) {
    const allergies = pickText(state.profile, 'allergies', lang) || [];
    const alerts = pickText(state.profile, 'specialAlerts', lang) || [];
    const askedDrug = drugAllergyCrossTerms.find((t) => q.includes(t));
    if (allergies.length) {
      const matchedAllergy = askedDrug
        ? allergies.find((a) => a.toLowerCase().includes(askedDrug) || (askedDrug === 'amoxicillin' || askedDrug === 'augmentin' || askedDrug === '阿莫西林' ? a.toLowerCase().includes('penicillin') || a.includes('青霉素') : false))
        : null;
      facts.push({
        source: isEn ? 'Allergies & Safety' : '过敏史与用药安全',
        text: matchedAllergy
          ? isEn
            ? `⚠️ CONTRAINDICATED / ALLERGY MATCH: "${matchedAllergy}". (All documented allergies: ${allergies.join('; ')})`
            : `⚠️ 存在过敏禁忌匹配：“${matchedAllergy}”。（全部已记录过敏史：${allergies.join('；')}）`
          : isEn
            ? `Documented allergies: ${allergies.join('; ')}.${alerts.length ? ` Additional safety notes: ${alerts.join('; ')}.` : ''}`
            : `已记录过敏史：${allergies.join('；')}。${alerts.length ? `其他安全提示：${alerts.join('；')}。` : ''}`
      });
    } else {
      unknowns.push(
        isEn
          ? 'No allergies are entered in the current file (cannot confirm NKDA unless verified directly with patient).'
          : '档案中暂未填写过敏史（请当面与患者确认是否真正无药物/食物过敏）。'
      );
    }
  }

  // 2. Specific medication or general med reconciliation
  const medKeywords = [
    'med', 'drug', 'rx', 'otc', 'pill', 'dose', 'dosage', 'taking', 'take', 'stopped', 'discontinu',
    'levothyroxine', 'synthroid', 'vitamin', 'iron', 'amoxicillin', 'last dose', 'today', 'adheren',
    '药', '服药', '剂量', '优甲乐', '左甲状腺素', '停药', '维生素', '补铁', '阿莫西林', '今天吃', '末次'
  ];
  // Also match any specific medication name directly present in patient's med list
  const matchedSpecificMeds = (state.medications || []).filter((m) => {
    const tokens = getAllTextVariants(m, ['name', 'genericName'])
      .split(/[\s（）()\/,，]+/)
      .filter((w) => w.length >= 2);
    return tokens.some((tok) => q.includes(tok));
  });

  if (includesAny(q, medKeywords) || matchedSpecificMeds.length > 0) {
    const active = (state.medications || []).filter((m) => m.status === 'active');
    const recent = (state.medications || []).filter((m) => m.status === 'recent');

    if (matchedSpecificMeds.length > 0) {
      for (const m of matchedSpecificMeds) {
        const name = pickText(m, 'name', lang);
        const dosage = pickText(m, 'dosage', lang);
        const freq = pickText(m, 'frequency', lang);
        const timing = pickText(m, 'timing', lang);
        const lastTaken = pickText(m, 'lastTaken', lang);
        const stopReason = pickText(m, 'stopReason', lang);
        facts.push({
          source: m.status === 'active' ? (isEn ? 'Active Meds' : '当前在服药物') : (isEn ? 'Past/Stopped Meds' : '近期曾服药物'),
          text:
            m.status === 'active'
              ? isEn
                ? `${name}: ${dosage || 'dose unspecified'}, ${freq || ''} ${timing ? `(${timing})` : ''}, started ${formatDisplayDate(m.startDate, lang)}.${lastTaken ? ` Last dose: ${lastTaken}.` : ''}`
                : `${name}：${dosage || '剂量未填'}，${freq || ''} ${timing ? `（${timing}）` : ''}，自 ${m.startDate || '未知日期'} 起服用。${lastTaken ? `末次服药：${lastTaken}。` : ''}`
              : isEn
                ? `${name} (DISCONTINUED ${formatDisplayDate(m.endDate, lang)}): ${stopReason || 'Stop reason not recorded'}.`
                : `${name}（已停药，停于 ${m.endDate || '近期'}）：停药原因——${stopReason || '未注明'}。`
        });
      }
    } else {
      if (active.length) {
        const lines = active.map((m) => {
          const lt = pickText(m, 'lastTaken', lang);
          return `${pickText(m, 'name', lang)} (${pickText(m, 'dosage', lang)}, ${pickText(m, 'frequency', lang)}${lt ? ` · ${isEn ? 'Last dose' : '末次'}: ${lt}` : ''})`;
        });
        facts.push({
          source: isEn ? 'Active Medications' : '当前正在服用药物',
          text: lines.join('; ')
        });
      } else {
        unknowns.push(isEn ? 'No active medications documented.' : '档案中未记录当前正在服用的药物。');
      }
      if (recent.length) {
        const lines = recent.map((m) => `${pickText(m, 'name', lang)} (${pickText(m, 'stopReason', lang) || (isEn ? 'stopped' : '已停药')})`);
        facts.push({
          source: isEn ? 'Recently Discontinued' : '近期曾服药物',
          text: lines.join('; ')
        });
      }
    }
  }

  // 3. Visit purpose / CC / HPI / Appointment Time & Clinic
  if (includesAny(q, ['why', 'visit', 'purpose', 'chief', 'complaint', 'hpi', 'goal', 'question', 'appoint', 'time', 'when', 'clinic', '就诊', '目的', '来看', '主诉', '问题', '预约', '几点', '时间', '诊所', '医生'])) {
    const purpose = pickText(state.visit, 'purpose', lang);
    const onset = pickText(state.visit, 'onsetSummary', lang);
    const qs = pickText(state.visit, 'questions', lang) || [];
    const apptMeta = [
      state.visit?.visitDate ? `${formatDisplayDate(state.visit.visitDate, lang)}${state.visit.visitTime ? ' ' + state.visit.visitTime : ''}` : '',
      state.visit?.doctorName || '',
      state.visit?.clinicName || ''
    ]
      .filter(Boolean)
      .join(' · ');
    if (purpose || onset || apptMeta) {
      facts.push({
        source: isEn ? 'Chief Complaint & Appointment' : '本次就诊与预约',
        text: `${apptMeta ? `[${apptMeta}] ` : ''}${purpose}${onset ? ` (${onset})` : ''}${qs.length ? ` | ${isEn ? 'Patient questions' : '患者重点问题'}: ${qs.join(' / ')}` : ''}`
      });
    } else {
      unknowns.push(isEn ? 'Visit purpose / appointment details not filled in.' : '尚未填写本次就诊目的或预约信息。');
    }
  }

  // 4. Symptoms & Pertinent Negatives (ROS)
  const redFlagChecks = [
    { terms: ['chest pain', 'chest tightness', 'angina', '胸痛', '胸闷'], labelEn: 'chest pain', labelZh: '胸痛/胸闷' },
    { terms: ['shortness of breath', 'sob', 'dyspnea', 'breathing', '呼吸困难', '气短', '气喘'], labelEn: 'shortness of breath', labelZh: '呼吸困难/气短' },
    { terms: ['syncope', 'faint', 'dizzy', 'dizziness', '晕厥', '头晕'], labelEn: 'syncope / dizziness', labelZh: '晕厥/头晕' },
    { terms: ['fever', 'chills', 'febrile', '发烧', '发热', '寒战'], labelEn: 'fever / chills', labelZh: '发热/寒战' },
    { terms: ['palpitation', 'racing heart', 'tremor', '心悸', '心慌', '手抖', '微颤'], labelEn: 'palpitations / tremor', labelZh: '心悸/手微颤' },
    { terms: ['sleep', 'insomnia', 'sweat', '失眠', '入睡', '出汗'], labelEn: 'insomnia / sweating', labelZh: '失眠/出汗' },
    { terms: ['cough', 'sputum', '咳嗽', '咳痰'], labelEn: 'cough', labelZh: '咳嗽' },
    { terms: ['nausea', 'vomit', 'diarrhea', 'abdominal', '恶心', '呕吐', '腹泻', '腹痛'], labelEn: 'GI symptoms', labelZh: '消化道症状' }
  ];

  const askedRedFlags = redFlagChecks.filter((rf) => includesAny(q, rf.terms));
  const askedSymptomsGeneral = includesAny(q, ['symptom', 'ros', 'negative', 'deny', 'denies', 'feeling', '症状', '不舒服', '否认', '伴随']);

  if (askedRedFlags.length > 0) {
    for (const rf of askedRedFlags) {
      const posMatch = (state.symptoms || []).find(
        (s) =>
          hasPositiveMention(getAllTextVariants(s, ['name']), rf.terms) ||
          hasPositiveMention(getAllTextVariants(s, ['notes']), rf.terms)
      );
      const negMatch = (state.rosNegatives || []).find((n) =>
        includesAny(getAllTextVariants(n, ['text']), rf.terms)
      );

      if (posMatch) {
        facts.push({
          source: isEn ? 'Documented Symptoms' : '当前症状记录',
          text: isEn
            ? `YES — ${pickText(posMatch, 'name', lang)} (${pickText(posMatch, 'durationText', lang)}, ${posMatch.severity}, ${posMatch.trend}). ${pickText(posMatch, 'notes', lang)}`
            : `有记录：${pickText(posMatch, 'name', lang)}（持续 ${pickText(posMatch, 'durationText', lang)}）。${pickText(posMatch, 'notes', lang)}`
        });
      } else if (negMatch) {
        const cleanDeny = stripDenyPrefix(pickText(negMatch, 'text', lang));
        let extraTemp = '';
        if (rf.labelEn === 'fever / chills') {
          const latestTemp = (state.vitals || []).filter((v) => v.type === 'temp').sort((a, b) => b.date.localeCompare(a.date))[0];
          if (latestTemp) {
            const fmt = formatVitalReading(latestTemp, unitSystem);
            extraTemp = isEn
              ? ` Latest temp: ${fmt.display} ${fmt.unit} (${formatDisplayDate(latestTemp.date, lang)}).`
              : ` 最近体温：${latestTemp.date} 测得 ${fmt.display} ${fmt.unit}。`;
          }
        }
        facts.push({
          source: isEn ? 'Pertinent Negatives (ROS)' : '阴性鉴别清单',
          text: isEn
            ? `NO — Patient explicitly denies ${cleanDeny}.${extraTemp}`
            : `患者明确否认：${cleanDeny}。${extraTemp}`
        });
      } else if (rf.labelEn === 'fever / chills') {
        const latestTemp = (state.vitals || []).filter((v) => v.type === 'temp').sort((a, b) => b.date.localeCompare(a.date))[0];
        if (latestTemp) {
          const fmt = formatVitalReading(latestTemp, unitSystem);
          facts.push({
            source: isEn ? 'Vital Signs (Temp)' : '体征记录（体温）',
            text: isEn
              ? `No fever symptom listed; latest temperature is ${fmt.display} ${fmt.unit} on ${formatDisplayDate(latestTemp.date, lang)}.`
              : `未记录发热症状；最近一次体温为 ${latestTemp.date} 测得 ${fmt.display} ${fmt.unit}。`
          });
        } else {
          unknowns.push(isEn ? `Unclear regarding ${rf.labelEn} — not documented in symptoms, ROS negatives, or vitals.` : `不清楚是否有“${rf.labelZh}”：档案中既未记录该症状，也未在否认清单或体温中体现。`);
        }
      } else {
        unknowns.push(
          isEn
            ? `Unclear regarding ${rf.labelEn} — neither documented as a symptom nor explicitly denied in ROS. Please ask patient directly.`
            : `不清楚是否有“${rf.labelZh}”：档案中既未记录该症状，也未在明确否认清单中排除，请当面询问患者。`
        );
      }
    }
  } else if (askedSymptomsGeneral) {
    if (state.symptoms?.length) {
      facts.push({
        source: isEn ? 'Current Symptoms' : '当前症状',
        text: state.symptoms.map((s) => `${pickText(s, 'name', lang)} (${pickText(s, 'durationText', lang)})`).join('; ')
      });
    } else {
      unknowns.push(isEn ? 'No active symptoms documented.' : '未记录当前症状。');
    }
    if (state.rosNegatives?.length) {
      facts.push({
        source: isEn ? 'Pertinent Negatives' : '明确否认症状',
        text: state.rosNegatives.map((n) => pickText(n, 'text', lang)).join('; ')
      });
    }
  }

  // 5. Weight & BMI
  if (includesAny(q, ['weight', 'bmi', 'loss', 'gain', 'kg', 'lb', 'height', '体重', '瘦', '胖', '身高'])) {
    const ranged = filterWeightsByRange(state.weights, 90);
    const stats = summarizeWeightStats(ranged, state.profile.heightCm);
    if (stats) {
      const latestFmt = formatWeightValue(stats.latest.weightKg, unitSystem);
      const firstFmt = formatWeightValue(stats.first.weightKg, unitSystem);
      const deltaFmt = formatWeightValue(Math.abs(stats.deltaKg), unitSystem);
      const sign = stats.deltaKg < 0 ? '-' : stats.deltaKg > 0 ? '+' : '';
      const bmi = computeBmi(stats.latest.weightKg, state.profile.heightCm);
      facts.push({
        source: isEn ? 'Weight Log (90-Day Trend)' : '体重记录（近90天趋势）',
        text: isEn
          ? `Latest weight: ${latestFmt.val} ${latestFmt.unit} (${formatDisplayDate(stats.latest.date, lang)}). Height: ${formatHeight(state.profile.heightCm, unitSystem) || 'N/A'}. BMI: ${bmi ? bmi.value : 'N/A'}. Change since ${formatDisplayDate(stats.first.date, lang)} (${firstFmt.val} ${firstFmt.unit}): ${sign}${deltaFmt.val} ${deltaFmt.unit} (${stats.deltaPct > 0 ? '+' : ''}${stats.deltaPct}%).`
          : `最新体重：${latestFmt.val} ${latestFmt.unit}（${stats.latest.date}），身高 ${formatHeight(state.profile.heightCm, unitSystem) || '未填'}，BMI ${bmi ? bmi.value : '—'}。自 ${stats.first.date}（${firstFmt.val} ${firstFmt.unit}）起变化：${sign}${deltaFmt.val} ${deltaFmt.unit}（${stats.deltaPct > 0 ? '+' : ''}${stats.deltaPct}%）。`
      });
    } else {
      unknowns.push(isEn ? 'No weight measurements documented.' : '暂无体重记录。');
    }
  }

  // 6. Vitals (BP, HR, Glucose, Temp, SpO2, Pain)
  const painScoreAsked = includesAny(q, ['pain score', 'pain scale', 'pain level', '疼痛评分']) || (/\bpain\b/.test(q) && !includesAny(q, ['chest pain', 'eye pain', 'abdominal pain', 'back pain']));
  if (includesAny(q, ['vital', 'bp', 'blood pressure', 'hr', 'heart rate', 'pulse', 'glucose', 'sugar', 'a1c', 'temp', 'spo2', 'oxygen', '血压', '心率', '脉搏', '血糖', '体温', '血氧']) || painScoreAsked) {
    const requestedTypes = [];
    if (includesAny(q, ['bp', 'blood pressure', '血压'])) requestedTypes.push('bp');
    if (includesAny(q, ['hr', 'heart rate', 'pulse', '心率', '脉搏'])) requestedTypes.push('hr');
    if (includesAny(q, ['glucose', 'sugar', 'a1c', '血糖'])) requestedTypes.push('glucose');
    if (includesAny(q, ['temp', '体温'])) requestedTypes.push('temp');
    if (includesAny(q, ['spo2', 'oxygen', '血氧'])) requestedTypes.push('spo2');
    if (painScoreAsked) requestedTypes.push('pain');
    const typesToRead = requestedTypes.length ? requestedTypes : ['bp', 'hr', 'glucose', 'temp', 'spo2', 'pain'];

    for (const tp of typesToRead) {
      const list = (state.vitals || []).filter((v) => v.type === tp).sort((a, b) => b.date.localeCompare(a.date));
      if (list.length) {
        const latest = list[0];
        const fmt = formatVitalReading(latest, unitSystem);
        const label = tp.toUpperCase();
        facts.push({
          source: isEn ? `Vitals (${label})` : `体征记录 (${label})`,
          text: `${fmt.display} ${fmt.unit} (${formatDisplayDate(latest.date, lang)}${latest.context ? ` · ${latest.context}` : ''})`
        });
      } else if (requestedTypes.includes(tp)) {
        unknowns.push(isEn ? `No ${tp.toUpperCase()} reading recorded in the current file.` : `档案中暂未记录 ${tp.toUpperCase()} 测量数据。`);
      }
    }
  }

  // 7. Labs, Imaging & Past Diagnostic Exam History
  if (includesAny(q, ['lab', 'tsh', 'ft4', 'ft3', 'thyroid', 'tpo', 'cbc', 'hemoglobin', 'ferritin', 'cmp', 'lipid', 'imaging', 'xray', 'x-ray', 'mri', 'ct', 'ultrasound', 'ekg', 'ecg', 'exam', 'dexa', 'endoscop', 'colonoscop', '化验', '报告', '甲功', '血常规', '铁蛋白', '检查', '影像', 'b超', '彩超', '心电图', '胃镜', '肠镜', 'ct', '核磁'])) {
    const atts = state.attachments || [];
    const exams = state.examHistory || [];
    const specificImgOrLab = [
      { terms: ['ecg', 'ekg', 'electrocardiogram', '心电图'], name: isEn ? 'ECG/EKG' : '心电图' },
      { terms: ['ultrasound', 'sonogram', 'b超', '彩超', '超声'], name: isEn ? 'Ultrasound' : '超声检查' },
      { terms: ['xray', 'x-ray', 'ct', 'mri', '胸片', 'ct', '核磁'], name: isEn ? 'Imaging (X-ray/CT/MRI)' : 'CT/MRI/X线影像检查' },
      { terms: ['lipid', 'cholesterol', 'ldl', 'hdl', '血脂'], name: isEn ? 'Lipid panel' : '血脂检查' },
      { terms: ['cmp', 'liver', 'kidney', 'creatinine', 'alt', 'ast', '肝功', '肾功'], name: isEn ? 'CMP / Liver & Kidney panel' : '肝肾功能/电解质' },
      { terms: ['a1c', 'hba1c', '糖化'], name: 'HbA1c' },
      { terms: ['colonoscop', 'endoscop', 'egd', '肠镜', '胃镜'], name: isEn ? 'Endoscopy / Colonoscopy' : '胃镜/肠镜' }
    ];
    for (const sp of specificImgOrLab) {
      if (includesAny(q, sp.terms)) {
        const hitAtt = atts.find((a) => includesAny(getAllTextVariants(a, ['title', 'summaryHighlight']), sp.terms));
        const hitExam = exams.find((ex) => includesAny(getAllTextVariants(ex, ['name', 'resultSummary']), sp.terms));
        if (!hitAtt && !hitExam) {
          unknowns.push(isEn ? `No ${sp.name} report found in uploaded labs or past exam history.` : `近期报告与既往检查历史中均未找到“${sp.name}”记录，不清楚其结果。`);
        }
      }
    }

    if (atts.length) {
      facts.push({
        source: isEn ? 'Uploaded Labs/Reports' : '近期检验报告',
        text: atts
          .map((a) => `${formatDisplayDate(a.date, lang)} ${pickText(a, 'title', lang)}${pickText(a, 'summaryHighlight', lang) ? `: ${pickText(a, 'summaryHighlight', lang)}` : ''}`)
          .join(' | ')
      });
    }
    if (exams.length) {
      facts.push({
        source: isEn ? 'Past Diagnostic Exams' : '既往检查历史',
        text: exams
          .map((ex) => `${formatDisplayDate(ex.date, lang)} ${pickText(ex, 'name', lang)}${pickText(ex, 'resultSummary', lang) ? `: ${pickText(ex, 'resultSummary', lang)}` : ''}`)
          .join(' | ')
      });
    }
    if (!atts.length && !exams.length) {
      unknowns.push(isEn ? 'No lab or past diagnostic exam history documented.' : '暂未上传化验单或填写既往检查历史。');
    }
  }

  // 8. Social History (Smoking, Alcohol, Drugs, Pregnancy/LMP, Occupation)
  if (includesAny(q, ['smok', 'tobacco', 'vape', 'alcohol', 'drink', 'drug', 'pregnan', 'lmp', 'lactat', 'breastfeed', 'occupat', 'job', 'work', 'social', '抽烟', '吸烟', '喝酒', '饮酒', '怀孕', '妊娠', '哺乳', '月经', '职业', '社会史'])) {
    const sh = state.socialHistory || {};
    const checks = [
      { match: ['smok', 'tobacco', 'vape', 'social', '抽烟', '吸烟', '社会史'], val: pickText(sh, 'smoking', lang), name: isEn ? 'Tobacco/Smoking' : '吸烟史' },
      { match: ['alcohol', 'drink', 'social', '喝酒', '饮酒', '社会史'], val: pickText(sh, 'alcohol', lang), name: isEn ? 'Alcohol' : '饮酒史' },
      { match: ['pregnan', 'lmp', 'lactat', 'breastfeed', 'social', '怀孕', '妊娠', '哺乳', '月经', '社会史'], val: pickText(sh, 'pregnancy', lang), name: isEn ? 'Pregnancy/LMP' : '妊娠与末次月经' },
      { match: ['occupat', 'job', 'work', 'social', '职业', '社会史'], val: pickText(sh, 'occupation', lang), name: isEn ? 'Occupation' : '职业情况' },
      { match: ['recreational', 'illicit', 'substance', '毒品'], val: pickText(sh, 'substances', lang), name: isEn ? 'Substance use' : '违禁药物史' }
    ];
    for (const c of checks) {
      if (includesAny(q, c.match)) {
        if (c.val) {
          facts.push({ source: isEn ? `Social History (${c.name})` : `社会史（${c.name}）`, text: c.val });
        } else {
          unknowns.push(isEn ? `${c.name}: Unclear / Not documented in Social History.` : `${c.name}：不清楚（社会史中未填写，请当面询问）。`);
        }
      }
    }
  }

  // 9. PMH / PSH / FH
  if (includesAny(q, ['history', 'pmh', 'psh', 'fh', 'surger', 'operation', 'family', 'chronic', 'diagnos', '病史', '慢性病', '手术', '家族', '遗传'])) {
    const conds = (state.history?.conditions || []).map((c) => `${pickText(c, 'name', lang)} (${c.diagnosedYear || '?'} · ${pickText(c, 'status', lang)})`);
    const surgs = pickText(state.history, 'surgeries', lang) || [];
    const fh = pickText(state.history, 'familyHistory', lang) || [];
    if (conds.length) facts.push({ source: 'PMH', text: conds.join('; ') });
    if (surgs.length) facts.push({ source: 'PSH', text: surgs.join('; ') });
    if (fh.length) facts.push({ source: 'Family Hx', text: fh.join('; ') });
    if (!conds.length && !surgs.length && !fh.length) {
      unknowns.push(isEn ? 'No PMH, surgical history, or family history recorded.' : '未填写既往病史、手术史或家族史。');
    }
  }

  // 10. Care Team / Pharmacy / PCP / Insurance / DOB / Age
  if (includesAny(q, ['pharmacy', 'pcp', 'primary care', 'doctor', 'insurance', 'emergency', 'dob', 'birth', 'age', '药房', '主治', '家庭医生', '医保', '保险', '紧急', '出生', '年龄'])) {
    const ct = state.careTeam || {};
    const age = computeAge(state.profile);
    if (includesAny(q, ['dob', 'birth', 'age', '出生', '年龄'])) {
      facts.push({
        source: isEn ? 'Demographics' : '基础信息',
        text: isEn
          ? `DOB: ${formatDisplayDate(state.profile.dob, lang) || state.profile.birthYear || 'Not set'} (Age ${age ?? 'N/A'})`
          : `出生日期：${state.profile.dob || state.profile.birthYear || '未填'}（${age ?? '—'} 岁）`
      });
    }
    if (includesAny(q, ['pharmacy', '药房'])) {
      const ph = pickText(ct, 'pharmacy', lang);
      if (ph) facts.push({ source: isEn ? 'Preferred Pharmacy' : '常用药房', text: ph });
      else unknowns.push(isEn ? 'Preferred pharmacy not documented.' : '未填写常用药房信息。');
    }
    if (includesAny(q, ['pcp', 'primary care', 'doctor', '主治', '家庭医生'])) {
      const pcp = pickText(ct, 'pcp', lang);
      if (pcp) facts.push({ source: isEn ? 'PCP' : '主治/家庭医生', text: pcp });
      else unknowns.push(isEn ? 'PCP not documented.' : '未填写家庭/主治医生。');
    }
    if (includesAny(q, ['insurance', '医保', '保险'])) {
      const ins = pickText(ct, 'insurance', lang);
      if (ins) facts.push({ source: isEn ? 'Insurance' : '保险信息', text: ins });
      else unknowns.push(isEn ? 'Insurance info not documented.' : '未填写医保/商业保险信息。');
    }
    if (includesAny(q, ['emergency', '紧急'])) {
      const ec = pickText(state.profile, 'emergencyContact', lang);
      if (ec) facts.push({ source: isEn ? 'Emergency Contact' : '紧急联系人', text: ec });
      else unknowns.push(isEn ? 'Emergency contact not documented.' : '未填写紧急联系人。');
    }
  }

  // 11. Current Visit Report & Prior Visit History
  if (includesAny(q, ['last visit', 'prior visit', 'previous visit', 'follow-up', 'plan', 'diagnosis', 'assessment', 'summary', 'report', 'doctor say', '上次', '过往就诊', '医嘱', '之前看病', '诊断', '就诊总结', '就医报告', '医生怎么说', '复诊'])) {
    const vr = state.visit?.visitReport;
    if (vr) {
      const vrParts = [
        pickText(vr, 'diagnosis', lang) ? `${isEn ? 'Assessment' : '诊断评估'}: ${pickText(vr, 'diagnosis', lang)}` : '',
        pickText(vr, 'medPlan', lang) ? `${isEn ? 'Med Plan' : '用药方案'}: ${pickText(vr, 'medPlan', lang)}` : '',
        pickText(vr, 'testsPlan', lang) ? `${isEn ? 'Tests' : '检查安排'}: ${pickText(vr, 'testsPlan', lang)}` : '',
        pickText(vr, 'followUp', lang) ? `${isEn ? 'Follow-up' : '复诊注意'}: ${pickText(vr, 'followUp', lang)}` : ''
      ].filter(Boolean);
      if (vrParts.length) {
        facts.push({
          source: isEn ? 'Current After-Visit Summary' : '本次医生就诊总结报告',
          text: vrParts.join(' | ')
        });
      }
    }
    const vh = state.visitHistory || [];
    if (vh.length) {
      facts.push({
        source: isEn ? 'Prior Visits' : '过往就诊记录',
        text: vh
          .map(
            (v) =>
              `${formatDisplayDate(v.date, lang)} (${pickText(v, 'department', lang) || '—'}): ${pickText(v, 'purpose', lang)} — ${pickText(v, 'doctorNotes', lang)}`
          )
          .join(' | ')
      });
    } else if (!vr) {
      unknowns.push(isEn ? 'No visit summary report or prior visits recorded yet.' : '暂未录入本次医生就诊总结或过往就诊记录。');
    }
  }

  // 12. Unrecorded common medical topics asked alongside other queries (e.g. vaccines, mammogram, mental health)
  const unrecordedTopics = [
    { terms: ['vaccin', 'immuniz', 'flu shot', 'covid shot', '疫苗', '接种'], labelEn: 'Vaccination / immunization history', labelZh: '疫苗接种史' },
    { terms: ['mammogram', 'pap smear', 'dexa', '钼靶', '骨密度'], labelEn: 'Preventive screening', labelZh: '防癌筛查/骨密度检查史' },
    { terms: ['depression', 'anxiety', 'phq', 'gad', '抑郁', '焦虑', '心理'], labelEn: 'Behavioral health screening (PHQ/GAD)', labelZh: '心理情绪评估记录' }
  ];
  for (const ut of unrecordedTopics) {
    if (includesAny(q, ut.terms)) {
      unknowns.push(
        isEn
          ? `${ut.labelEn}: Unclear / Not documented in patient's current file.`
          : `${ut.labelZh}：不清楚（当前档案中未记录此项，请当面询问）。`
      );
    }
  }

  // Fallback when nothing in patient records matches the question!
  if (facts.length === 0 && unknowns.length === 0) {
    unknowns.push(
      isEn
        ? `Unclear / Not documented in current patient records: "${qRaw}" does not match any recorded information in this profile. To ensure clinical accuracy, no answer is guessed—please ask the patient directly.`
        : `不清楚（当前档案中无此信息）：针对“${qRaw}”，患者已录入的病历、体征、用药和检查单中均未包含对应内容。为保证医疗严谨性，系统不会猜测回答，请直接向患者询问确认。`
    );
  }

  return {
    question: qRaw,
    status: facts.length > 0 && unknowns.length === 0 ? 'answered' : facts.length > 0 ? 'partial' : 'unknown',
    facts,
    unknowns
  };
}
