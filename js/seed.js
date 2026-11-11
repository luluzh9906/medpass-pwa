/**
 * Realistic bilingual (ZH + US Clinical EN) demo data + crisp inline SVG lab/medbox previews.
 * Default PIN for prototype: "1234"
 */
import { hashPin } from './security.js';

function svgToDataUrl(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

const SAMPLE_LAB_REPORT_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="540" viewBox="0 0 760 540">
  <rect width="760" height="540" fill="#FFFFFF"/>
  <rect x="0" y="0" width="760" height="68" fill="#EFF6FF"/>
  <text x="32" y="34" font-family="sans-serif" font-size="21" font-weight="bold" fill="#1E3A8A">Thyroid Panel / 甲状腺功能五项检验报告单 (Sample)</text>
  <text x="32" y="56" font-family="sans-serif" font-size="13" fill="#475569">Collected: 2026-10-28 · Endocrinology · Specimen: Serum</text>
  <line x1="32" y1="88" x2="728" y2="88" stroke="#CBD5E1" stroke-width="2"/>
  <text x="36" y="116" font-family="sans-serif" font-size="14" font-weight="bold" fill="#334155">Test / 检验项目</text>
  <text x="310" y="116" font-family="sans-serif" font-size="14" font-weight="bold" fill="#334155">Result</text>
  <text x="460" y="116" font-family="sans-serif" font-size="14" font-weight="bold" fill="#334155">Flag</text>
  <text x="570" y="116" font-family="sans-serif" font-size="14" font-weight="bold" fill="#334155">Ref. Range</text>
  <line x1="32" y1="130" x2="728" y2="130" stroke="#E2E8F0" stroke-width="1"/>

  <rect x="32" y="142" width="696" height="52" rx="6" fill="#FEF2F2"/>
  <text x="42" y="174" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0F172A">TSH (促甲状腺激素)</text>
  <text x="310" y="174" font-family="monospace" font-size="18" font-weight="bold" fill="#DC2626">0.18 mIU/L</text>
  <text x="465" y="174" font-family="sans-serif" font-size="15" font-weight="bold" fill="#DC2626">↓ LOW</text>
  <text x="570" y="174" font-family="sans-serif" font-size="14" fill="#475569">0.27 - 4.20</text>

  <rect x="32" y="206" width="696" height="52" rx="6" fill="#FEF2F2"/>
  <text x="42" y="238" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0F172A">Free T4 / FT4 (游离T4)</text>
  <text x="310" y="238" font-family="monospace" font-size="18" font-weight="bold" fill="#DC2626">23.4 pmol/L</text>
  <text x="465" y="238" font-family="sans-serif" font-size="15" font-weight="bold" fill="#DC2626">↑ HIGH</text>
  <text x="570" y="238" font-family="sans-serif" font-size="14" fill="#475569">12.0 - 22.0</text>

  <text x="42" y="294" font-family="sans-serif" font-size="16" fill="#0F172A">Free T3 / FT3 (游离T3)</text>
  <text x="310" y="294" font-family="monospace" font-size="16" fill="#0F172A">6.21 pmol/L</text>
  <text x="465" y="294" font-family="sans-serif" font-size="14" fill="#059669">Normal</text>
  <text x="570" y="294" font-family="sans-serif" font-size="14" fill="#475569">3.10 - 6.80</text>
  <line x1="32" y1="314" x2="728" y2="314" stroke="#F1F5F9" stroke-width="1"/>

  <text x="42" y="346" font-family="sans-serif" font-size="16" fill="#0F172A">TPOAb (甲状腺过氧化物酶抗体)</text>
  <text x="310" y="346" font-family="monospace" font-size="16" font-weight="bold" fill="#D97706">184.0 IU/mL</text>
  <text x="465" y="346" font-family="sans-serif" font-size="14" font-weight="bold" fill="#D97706">↑ POS</text>
  <text x="570" y="346" font-family="sans-serif" font-size="14" fill="#475569">&lt; 34.0</text>
  <line x1="32" y1="366" x2="728" y2="366" stroke="#F1F5F9" stroke-width="1"/>

  <text x="42" y="398" font-family="sans-serif" font-size="16" fill="#0F172A">TgAb (甲状腺球蛋白抗体)</text>
  <text x="310" y="398" font-family="monospace" font-size="16" fill="#0F172A">76.5 IU/mL</text>
  <text x="465" y="398" font-family="sans-serif" font-size="14" fill="#059669">Normal</text>
  <text x="570" y="398" font-family="sans-serif" font-size="14" fill="#475569">&lt; 115.0</text>

  <rect x="32" y="438" width="696" height="72" rx="10" fill="#F8FAFC" stroke="#E2E8F0"/>
  <text x="48" y="466" font-family="sans-serif" font-size="14" font-weight="bold" fill="#1E293B">Patient Note / 备注：</text>
  <text x="48" y="492" font-family="sans-serif" font-size="14" fill="#475569">Held morning levothyroxine prior to blood draw. Experiencing palpitations &amp; weight loss.</text>
</svg>
`);

const SAMPLE_MEDBOX_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="380" viewBox="0 0 640 380">
  <rect width="640" height="380" fill="#F8FAFC"/>
  <rect x="44" y="36" width="552" height="308" rx="18" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="3"/>
  <rect x="44" y="36" width="552" height="74" rx="18" fill="#0F62FE"/>
  <rect x="44" y="88" width="552" height="22" fill="#0F62FE"/>
  <text x="76" y="82" font-family="sans-serif" font-size="23" font-weight="bold" fill="#FFFFFF">Levothyroxine Sodium (Synthroid / 优甲乐)</text>
  <text x="76" y="156" font-family="sans-serif" font-size="36" font-weight="bold" fill="#0F172A">50 mcg (μg) Tablets</text>
  <text x="76" y="200" font-family="sans-serif" font-size="18" fill="#475569">左甲状腺素钠片 · Oral Prescription (Rx)</text>
  <rect x="76" y="226" width="320" height="44" rx="8" fill="#EFF6FF" stroke="#BFDBFE"/>
  <text x="94" y="254" font-family="sans-serif" font-size="17" font-weight="bold" fill="#1D4ED8">Take 1 tablet PO daily on empty stomach</text>
  <text x="76" y="308" font-family="sans-serif" font-size="15" fill="#64748B">30–60 min before breakfast · Separate from calcium/iron by 4 hrs</text>
</svg>
`);

const SAMPLE_CBC_REPORT_SVG = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="420" viewBox="0 0 760 420">
  <rect width="760" height="420" fill="#FFFFFF"/>
  <rect x="0" y="0" width="760" height="64" fill="#ECFDF5"/>
  <text x="32" y="34" font-family="sans-serif" font-size="21" font-weight="bold" fill="#065F46">CBC &amp; Ferritin Follow-up / 血常规及铁蛋白复查单</text>
  <text x="32" y="54" font-family="sans-serif" font-size="13" fill="#047857">Collected: 2026-09-14 · All values within reference range</text>
  <text x="42" y="120" font-family="sans-serif" font-size="16" fill="#0F172A">Hemoglobin (HGB / 血红蛋白)</text>
  <text x="350" y="120" font-family="monospace" font-size="17" font-weight="bold" fill="#059669">12.6 g/dL (126 g/L)</text>
  <text x="560" y="120" font-family="sans-serif" font-size="14" fill="#475569">Normal</text>
  <line x1="32" y1="142" x2="728" y2="142" stroke="#E2E8F0"/>
  <text x="42" y="182" font-family="sans-serif" font-size="16" fill="#0F172A">Serum Ferritin (铁蛋白)</text>
  <text x="350" y="182" font-family="monospace" font-size="17" font-weight="bold" fill="#059669">42.5 ng/mL</text>
  <text x="560" y="182" font-family="sans-serif" font-size="14" fill="#475569">Normal</text>
  <line x1="32" y1="204" x2="728" y2="204" stroke="#E2E8F0"/>
  <text x="42" y="244" font-family="sans-serif" font-size="16" fill="#0F172A">WBC (白细胞计数)</text>
  <text x="350" y="244" font-family="monospace" font-size="17" fill="#0F172A">5.82 K/uL</text>
  <text x="560" y="244" font-family="sans-serif" font-size="14" fill="#475569">Normal</text>
  <rect x="32" y="290" width="696" height="84" rx="10" fill="#F8FAFC" stroke="#E2E8F0"/>
  <text x="48" y="324" font-family="sans-serif" font-size="15" font-weight="bold" fill="#0F172A">Clinician Summary / 小结：</text>
  <text x="48" y="352" font-family="sans-serif" font-size="14" fill="#475569">Iron deficiency anemia resolved. Ferrous succinate discontinued per MD.</text>
</svg>
`);

export async function createDemoData() {
  const defaultPinHash = await hashPin('1234');
  const now = new Date().toISOString();

  return {
    schemaVersion: 7,
    isDemo: true,
    updatedAt: now,
    profile: {
      name: '林清（示例档案）',
      nameEn: 'Claire Lin (Sample)',
      gender: '女',
      genderEn: 'Female',
      dob: '1992-05-14',
      birthYear: 1992,
      bloodType: 'A+ (Rh+)',
      heightCm: 165,
      allergies: ['青霉素类（全身荨麻疹、呼吸困难，禁用）', '碘造影剂（轻度皮疹史）'],
      allergiesEn: ['Penicillins (Generalized hives & dyspnea — Contraindicated)', 'Iodinated Contrast (Mild rash)'],
      specialAlerts: ['非妊娠期/未哺乳', '无心脏起搏器或体内植入物'],
      specialAlertsEn: ['Not pregnant / Not lactating', 'No implanted devices / pacemaker'],
      emergencyContact: '林先生（配偶） (415) 555-0148',
      emergencyContactEn: 'Mark Lin (Spouse) · (415) 555-0148',
      pinHash: defaultPinHash,
      autoLockMinutes: 5,
      maskNameOnShare: true,
      preferredLang: 'zh',
      unitSystem: 'metric'
    },
    careTeam: {
      pharmacy: 'CVS Pharmacy #4821 · 1240 Oak Ave (Tel: 415-555-0192)',
      pharmacyEn: 'CVS Pharmacy #4821 · 1240 Oak Ave · (415) 555-0192',
      pcp: 'Dr. Emily Chen, MD (内科/家庭医生)',
      pcpEn: 'Dr. Emily Chen, MD (Internal Medicine / PCP)',
      insurance: 'Blue Shield PPO (示例)',
      insuranceEn: 'Blue Shield of California PPO (Sample)',
      savedContacts: [
        {
          id: 'doc-endo-1',
          doctorName: 'Dr. Sarah Miller, MD',
          department: '内分泌科',
          departmentEn: 'Endocrinology',
          specialtyId: 'endo',
          clinicName: 'UCSF Endocrinology Clinic',
          phone: '(415) 555-0210',
          address: '400 Parnassus Ave'
        },
        {
          id: 'doc-derm-1',
          doctorName: 'Dr. Alex Wang, MD',
          department: '皮肤科',
          departmentEn: 'Dermatology',
          specialtyId: 'derm',
          clinicName: 'Pacific Dermatology Center',
          phone: '(415) 555-0345',
          address: '1500 Sutter St'
        },
        {
          id: 'doc-1',
          doctorName: 'Dr. Emily Chen, MD',
          department: '内科 / 家庭医生',
          departmentEn: 'Internal Medicine (PCP)',
          specialtyId: 'pcp',
          clinicName: 'Bayview Primary Care',
          phone: '(415) 555-0180',
          address: '890 Market St, Suite 400'
        }
      ]
    },
    visit: {
      purpose: '复查甲状腺功能异常（TSH 偏低），评估近期心悸与体重下降原因，确认优甲乐是否需要调量',
      purposeEn: 'Follow-up for suppressed TSH (0.18), resting palpitations, and unintentional weight loss; evaluate levothyroxine dose reduction.',
      department: '内分泌科',
      departmentEn: 'Endocrinology',
      specialtyId: 'endo',
      visitDate: '2026-11-11',
      visitTime: '10:30',
      doctorName: 'Dr. Sarah Miller, MD',
      clinicName: 'UCSF Endocrinology Clinic (示例)',
      clinicPhone: '(415) 555-0210',
      clinicAddress: '400 Parnassus Ave',
      onsetSummary: '近 6 周出现静息心悸、易疲劳，体重非刻意下降 3.4 kg',
      onsetSummaryEn: '6-week progressive resting palpitations, fatigue, and 7.9 lb unintentional weight loss.',
      questions: [
        '目前优甲乐 50μg/天 是否药物过量，需要减量到 25μg 或隔日调整吗？',
        '近 3 周静息心率 88~94 次/分，是否需要加做心电图或临时用控制心率药物？',
        '调整剂量后建议隔几周再复查甲功？'
      ],
      questionsEn: [
        'Is my current Levothyroxine 50 mcg daily dose over-replacing? Should we step down to 25 mcg or 37.5 mcg?',
        'With resting HR around 88–94 bpm, do I need an EKG today or a temporary beta-blocker?',
        'How many weeks after a dose change should we recheck TSH and Free T4?'
      ],
      visitReport: null,
      updatedAt: now
    },
    symptoms: [
      {
        id: 'sym-1',
        name: '静息心悸、偶有手部微颤',
        nameEn: 'Resting palpitations & mild fine hand tremor',
        onsetDate: '2026-10-20',
        durationText: '约 3 周',
        durationTextEn: '~3 weeks',
        severity: 'moderate',
        trend: 'worsening',
        notes: '安静坐姿或夜间躺下时明显，自测心率多在 88-96 次/分，无胸痛或晕厥',
        notesEn: 'Most noticeable at rest or lying down at night; home HR 88–96 bpm. No chest pain or syncope.',
        selfCare: '减少咖啡因摄入，保证休息后略好转',
        selfCareEn: 'Stopped caffeine; mildly improved with rest'
      },
      {
        id: 'sym-2',
        name: '非刻意体重下降、易饥饿',
        nameEn: 'Unintentional weight loss & increased appetite',
        onsetDate: '2026-09-28',
        durationText: '约 6 周',
        durationTextEn: '~6 weeks',
        severity: 'moderate',
        trend: 'worsening',
        notes: '饮食量较前略增，未刻意节食或加大运动量，体重由 59.2 kg 降至 55.8 kg',
        notesEn: 'Appetite slightly increased without dieting or extra exercise; weight dropped from 130.5 lbs to 123.0 lbs.',
        selfCare: '每日晨起空腹称重记录',
        selfCareEn: 'Tracking daily morning fasting weights'
      },
      {
        id: 'sym-3',
        name: '入睡困难、夜间易醒怕热',
        nameEn: 'Sleep-onset insomnia & mild heat intolerance',
        specialties: ['endo', 'neuro'],
        onsetDate: '2026-10-25',
        durationText: '约 2 周',
        durationTextEn: '~2 weeks',
        severity: 'mild',
        trend: 'stable',
        notes: '入睡需 40 分钟以上，凌晨 3-4 点易醒，伴轻微怕热出汗',
        notesEn: 'Takes >40 min to fall asleep; wakes at 3–4 AM feeling warm/sweaty.',
        selfCare: '睡前减少看手机，改善微弱',
        selfCareEn: 'Sleep hygiene adjustments with minimal effect'
      },
      {
        id: 'sym-4',
        name: '前臂内侧干燥性湿疹偶有瘙痒（皮肤科随访）',
        nameEn: 'Mild dry eczema & intermittent pruritus on inner forearm',
        specialties: ['derm'],
        onsetDate: '2026-10-02',
        durationText: '约 1 个月（已基本好转）',
        durationTextEn: '~1 month (mostly resolved)',
        severity: 'mild',
        trend: 'improving',
        notes: '秋冬季换季皮肤干燥引起，涂抹保湿霜及外用药膏后明显好转',
        notesEn: 'Triggered by dry weather; significantly improved with moisturizer & topical ointment.',
        selfCare: '每日使用无香型保湿霜',
        selfCareEn: 'Daily fragrance-free emollient'
      }
    ],
    rosNegatives: [
      { id: 'ros-1', text: '明确否认胸痛、胸闷或晕厥', textEn: 'Denies chest pain, chest pressure, or syncope' },
      { id: 'ros-2', text: '明确否认呼吸困难或下肢水肿', textEn: 'Denies shortness of breath (SOB) or lower extremity edema' },
      { id: 'ros-3', text: '明确否认发热、寒战或腹泻', textEn: 'Denies fever, chills, or diarrhea' },
      { id: 'ros-4', text: '明确否认视物模糊或突眼复视', textEn: 'Denies blurred vision, diplopia, or eye pain' }
    ],
    history: {
      conditions: [
        {
          id: 'cond-1',
          name: '甲状腺功能减退（桥本甲状腺炎）',
          nameEn: 'Hypothyroidism (Hashimoto thyroiditis)',
          diagnosedYear: '2023',
          status: '长期随访用药中',
          statusEn: 'Active / On Rx',
          note: '2025年8月起维持优甲乐 50μg/日',
          noteEn: 'Maintained on Levothyroxine 50 mcg daily since Aug 2025'
        },
        {
          id: 'cond-2',
          name: '轻度缺铁性贫血',
          nameEn: 'Mild Iron Deficiency Anemia',
          specialties: ['pcp', 'obgyn', 'endo'],
          diagnosedYear: '2024',
          status: '已纠正停药',
          statusEn: 'Resolved',
          note: '2026年9月复查血红蛋白及铁蛋白均已达标',
          noteEn: 'HGB & Ferritin normalized on 09/2026 follow-up'
        },
        {
          id: 'cond-3',
          name: '季节性特应性皮炎（轻度湿疹）',
          nameEn: 'Seasonal Atopic Dermatitis (Mild Eczema)',
          specialties: ['derm'],
          diagnosedYear: '2022',
          status: '局部偶发，外用护理控制',
          statusEn: 'Intermittent / Topical care',
          note: '仅换季干燥时轻度发作',
          noteEn: 'Flares mildly during dry winter months'
        }
      ],
      surgeries: ['2019年 腹腔镜阑尾切除术（无并发症，恢复良好）'],
      surgeriesEn: ['2019: Laparoscopic appendectomy (uncomplicated)'],
      familyHistory: ['母亲：2型糖尿病、原发性高血压', '外婆：良性甲状腺结节'],
      familyHistoryEn: ['Mother: Type 2 Diabetes, Hypertension', 'Maternal Grandmother: Benign thyroid nodules']
    },
    socialHistory: {
      smoking: '从不吸烟（电子烟亦无）',
      smokingEn: 'Never smoker (no tobacco or vaping)',
      alcohol: '偶尔社交饮酒（<1杯/月，近期因心悸已完全戒酒）',
      alcoholEn: 'Rare social (<1 drink/mo; abstaining now due to palpitations)',
      pregnancy: '非妊娠期/未哺乳（末次月经 LMP：2026-10-26，规律）',
      pregnancyEn: 'Not pregnant / Not lactating (LMP: 10/26/2026, regular)',
      occupation: '产品经理（远程办公，久坐为主，近期停用含咖啡因饮品）',
      occupationEn: 'Product Manager (desk work; recently stopped all caffeine)',
      substances: '否认任何违禁药物或滥用史',
      substancesEn: 'Denies recreational/illicit substance use'
    },
    medications: [
      {
        id: 'med-1',
        category: 'rx',
        name: '左甲状腺素钠片（优甲乐）',
        nameEn: 'Levothyroxine Sodium (Synthroid)',
        genericName: 'Levothyroxine Sodium',
        dosage: '50 μg（1片）',
        dosageEn: '50 mcg (1 tab)',
        frequency: '每日 1 次',
        frequencyEn: 'Once daily (PO)',
        timing: '晨起空腹（早餐前 30 分钟）',
        timingEn: 'Every morning on empty stomach (30 min pre-breakfast)',
        lastTaken: '今日 07:15 已服（50 μg）',
        lastTakenEn: 'Taken today at 07:15 AM (50 mcg)',
        status: 'active',
        startDate: '2025-08-12',
        endDate: '',
        stopReason: '',
        stopReasonEn: '',
        notes: '规律服用未漏服；本次疑因药量偏高致 TSH 偏低',
        notesEn: '100% adherent; evaluating possible iatrogenic over-replacement',
        photoDataUrl: SAMPLE_MEDBOX_SVG
      },
      {
        id: 'med-2',
        category: 'otc',
        name: '维生素 D3 软胶囊',
        nameEn: 'Vitamin D3 (Cholecalciferol) Softgel',
        genericName: 'Cholecalciferol (OTC)',
        dosage: '800 IU（1粒）',
        dosageEn: '800 IU (20 mcg)',
        frequency: '每日 1 次',
        frequencyEn: 'Once daily',
        timing: '随午餐服用（与优甲乐间隔 >4 小时）',
        timingEn: 'With lunch (>4 hrs apart from levothyroxine)',
        lastTaken: '昨日午餐已服',
        lastTakenEn: 'Taken yesterday with lunch',
        status: 'active',
        startDate: '2026-09-01',
        endDate: '',
        stopReason: '',
        stopReasonEn: '',
        notes: '非处方膳食补充剂',
        notesEn: 'OTC supplement',
        photoDataUrl: ''
      },
      {
        id: 'med-3',
        category: 'rx',
        name: '琥珀酸亚铁片',
        nameEn: 'Ferrous Succinate (Oral Iron)',
        genericName: 'Ferrous Succinate',
        dosage: '0.1 g',
        dosageEn: '100 mg',
        frequency: '每日 2 次',
        frequencyEn: 'BID',
        timing: '餐后服用',
        timingEn: 'After meals',
        lastTaken: '',
        lastTakenEn: '',
        status: 'recent',
        startDate: '2026-06-10',
        endDate: '2026-09-15',
        stopReason: '9月复查血红蛋白 126 g/L、铁蛋白 42.5 均正常，遵医嘱停药',
        stopReasonEn: 'Anemia resolved (HGB 12.6 g/dL, Ferritin 42.5); stopped per MD',
        notes: '无明显胃部不适',
        notesEn: 'Tolerated well without GI distress',
        photoDataUrl: ''
      },
      {
        id: 'med-4',
        category: 'rx',
        name: '阿莫西林克拉维酸钾（过敏警示记录）',
        nameEn: 'Amoxicillin / Clavulanate (Augmentin) — ALLERGY',
        specialties: ['all'],
        genericName: 'Amoxicillin / Clavulanate',
        dosage: '—',
        dosageEn: '—',
        frequency: '曾用 1 次即停',
        frequencyEn: 'Single dose reaction',
        timing: '',
        timingEn: '',
        lastTaken: '',
        lastTakenEn: '',
        status: 'recent',
        startDate: '2024-03-04',
        endDate: '2024-03-04',
        stopReason: '服药后 2 小时全身出现风团样荨麻疹伴胸闷，确诊青霉素过敏',
        stopReasonEn: 'Generalized urticaria + chest tightness 2 hrs post-dose; confirmed PCN allergy',
        notes: '请避免开具青霉素类药物',
        notesEn: 'Avoid all penicillins',
        photoDataUrl: ''
      },
      {
        id: 'med-5',
        category: 'rx',
        name: '氢化可的松 1% 外用乳膏（皮肤科）',
        nameEn: 'Hydrocortisone 1% Topical Cream',
        specialties: ['derm'],
        genericName: 'Hydrocortisone Topical',
        dosage: '薄涂患处',
        dosageEn: 'Apply thin layer topically',
        frequency: '每日 2 次（必要时）',
        frequencyEn: 'BID PRN flare',
        timing: '皮疹瘙痒时短期外用 <= 7 天',
        timingEn: 'Short course <= 7 days for itch',
        lastTaken: '',
        lastTakenEn: '',
        status: 'recent',
        startDate: '2026-10-03',
        endDate: '2026-10-10',
        stopReason: '皮疹消退后已停用',
        stopReasonEn: 'Rash resolved; discontinued',
        notes: '皮肤科 Dr. Alex Wang 开具',
        notesEn: 'Prescribed by Dr. Alex Wang (Derm)',
        photoDataUrl: ''
      }
    ],
    weights: [
      { id: 'w-1', date: '2026-08-15', weightKg: 59.4, note: '晨起空腹', noteEn: 'Fasting AM' },
      { id: 'w-2', date: '2026-08-29', weightKg: 59.2, note: '平稳', noteEn: 'Stable' },
      { id: 'w-3', date: '2026-09-12', weightKg: 58.9, note: '复查贫血期间', noteEn: 'Anemia recheck' },
      { id: 'w-4', date: '2026-09-26', weightKg: 58.3, note: '开始感觉易饿', noteEn: 'Appetite rising' },
      { id: 'w-5', date: '2026-10-05', weightKg: 57.6, note: '', noteEn: '' },
      { id: 'w-6', date: '2026-10-14', weightKg: 57.1, note: '', noteEn: '' },
      { id: 'w-7', date: '2026-10-22', weightKg: 56.5, note: '伴轻微心悸', noteEn: 'Palpitations started' },
      { id: 'w-8', date: '2026-10-29', weightKg: 56.2, note: '甲功复查后', noteEn: 'Post-TSH check' },
      { id: 'w-9', date: '2026-11-05', weightKg: 56.0, note: '', noteEn: '' },
      { id: 'w-10', date: '2026-11-11', weightKg: 55.8, note: '今日就诊前空腹', noteEn: 'Pre-visit fasting AM' }
    ],
    vitals: [
      { id: 'v-1', type: 'bp', date: '2026-10-20', value1: 114, value2: 72, unit: 'mmHg', context: 'Resting', note: '' },
      { id: 'v-2', type: 'bp', date: '2026-11-02', value1: 118, value2: 74, unit: 'mmHg', context: 'AM', note: '' },
      { id: 'v-3', type: 'bp', date: '2026-11-11', value1: 120, value2: 75, unit: 'mmHg', context: 'Today AM', note: '' },
      { id: 'v-4', type: 'hr', date: '2026-10-15', value1: 76, value2: null, unit: 'bpm', context: 'Resting', note: '' },
      { id: 'v-5', type: 'hr', date: '2026-10-24', value1: 88, value2: null, unit: 'bpm', context: 'Resting', note: '' },
      { id: 'v-6', type: 'hr', date: '2026-11-03', value1: 92, value2: null, unit: 'bpm', context: 'Resting', note: '' },
      { id: 'v-7', type: 'hr', date: '2026-11-11', value1: 94, value2: null, unit: 'bpm', context: 'Today AM', note: '' },
      { id: 'v-8', type: 'glucose', date: '2026-10-28', value1: 5.2, value2: null, unit: 'mmol/L', context: 'Fasting', note: '' },
      { id: 'v-9', type: 'glucose', date: '2026-11-10', value1: 5.1, value2: null, unit: 'mmol/L', context: 'Fasting', note: '' },
      { id: 'v-10', type: 'temp', date: '2026-11-06', value1: 36.7, value2: null, unit: '°C', context: 'Oral', note: '' },
      { id: 'v-11', type: 'temp', date: '2026-11-11', value1: 36.6, value2: null, unit: '°C', context: 'Today AM', note: '' },
      { id: 'v-12', type: 'spo2', date: '2026-11-11', value1: 99, value2: null, unit: '%', context: 'Room air', note: '' },
      { id: 'v-13', type: 'pain', date: '2026-11-11', value1: 0, value2: null, unit: '/10', context: 'No pain', note: '' }
    ],
    attachments: [
      {
        id: 'att-1',
        date: '2026-10-28',
        title: '甲状腺功能五项化验单（TSH 0.18 ↓ / FT4 23.4 ↑）',
        titleEn: 'Thyroid Panel (TSH 0.18 ↓ / FT4 23.4 pmol/L ↑)',
        category: 'lab',
        isAbnormal: true,
        summaryHighlight: 'TSH 0.18 mIU/L (偏低) · FT4 23.4 pmol/L (偏高) · TPOAb 184.0 (阳性)',
        summaryHighlightEn: 'TSH 0.18 mIU/L (LOW) · FT4 23.4 pmol/L [1.82 ng/dL] (HIGH) · TPOAb 184.0 IU/mL (+)',
        imageDataUrl: SAMPLE_LAB_REPORT_SVG
      },
      {
        id: 'att-2',
        date: '2026-09-14',
        title: '血常规及血清铁蛋白复查单',
        titleEn: 'CBC & Serum Ferritin Follow-up',
        category: 'lab',
        isAbnormal: false,
        summaryHighlight: 'HGB 126 g/L（正常）· 铁蛋白 42.5 ng/mL（正常）',
        summaryHighlightEn: 'HGB 12.6 g/dL (Normal) · Ferritin 42.5 ng/mL (Normal)',
        imageDataUrl: SAMPLE_CBC_REPORT_SVG
      }
    ],
    visitHistory: [
      {
        id: 'vh-1',
        date: '2026-08-12',
        doctorName: 'Dr. Sarah Miller, MD',
        specialtyId: 'endo',
        department: '内分泌科',
        departmentEn: 'Endocrinology',
        purpose: '年度甲减复诊',
        purposeEn: 'Annual hypothyroidism follow-up',
        doctorNotes: 'TSH 2.15 正常，继续维持优甲乐 50μg qd，3个月后复查；血常规轻度贫血予琥珀酸亚铁补铁。',
        doctorNotesEn: 'TSH 2.15 WNL; continue Levothyroxine 50 mcg daily, recheck in 3 mos. Started oral iron for mild anemia.'
      },
      {
        id: 'vh-2',
        date: '2026-10-03',
        doctorName: 'Dr. Alex Wang, MD',
        specialtyId: 'derm',
        department: '皮肤科',
        departmentEn: 'Dermatology',
        purpose: '秋冬季前臂干性湿疹评估',
        purposeEn: 'Seasonal forearm eczema flare evaluation',
        doctorNotes: '轻度特应性皮炎，外用氢化可的松乳膏 7 天并加强保湿，避免热水烫洗。',
        doctorNotesEn: 'Mild atopic dermatitis flare; 1% hydrocortisone cream x7d + fragrance-free emollient.'
      },
      {
        id: 'vh-3',
        date: '2026-05-10',
        doctorName: 'Dr. Sarah Miller, MD',
        specialtyId: 'endo',
        department: '内分泌科',
        departmentEn: 'Endocrinology',
        purpose: '桥本甲状腺炎常规随访',
        purposeEn: 'Routine Hashimoto thyroiditis follow-up',
        doctorNotes: 'TSH 2.84，维持 50μg/日，体重 59.6 kg 平稳。',
        doctorNotesEn: 'TSH 2.84 WNL; maintain 50 mcg daily, weight stable at 131.4 lbs.'
      }
    ],
    examHistory: [
      {
        id: 'ex-1',
        date: '2025-11-18',
        category: 'imaging',
        name: '甲状腺及颈部淋巴结彩超',
        nameEn: 'Thyroid & Cervical Lymph Node Ultrasound',
        facility: 'UCSF 影像科 (示例)',
        facilityEn: 'UCSF Radiology',
        resultSummary: '双侧甲状腺实质弥漫性回声不均（符合桥本改变），左侧叶微小囊性结节 <4mm（TI-RADS 2类良性），未见异常肿大淋巴结。',
        resultSummaryEn: 'Diffuse heterogeneous parenchyma c/w Hashimoto thyroiditis; benign <4mm left lobe cyst (TI-RADS 2); no suspicious lymphadenopathy.',
        isAbnormal: false,
        specialties: ['endo'],
        imageDataUrl: ''
      },
      {
        id: 'ex-2',
        date: '2024-07-05',
        category: 'cardiac',
        name: '常规十二导联心电图 (EKG)',
        nameEn: '12-Lead Resting Electrocardiogram (EKG)',
        facility: 'Bayview 内科门诊',
        facilityEn: 'Bayview Primary Care',
        resultSummary: '窦性心律，心率 74 bpm，电轴正常，ST-T 段未见明显缺血或异常改变（基线对照正常）。',
        resultSummaryEn: 'Normal sinus rhythm at 74 bpm; normal axis, no ST-T abnormalities (normal baseline prior to recent palpitations).',
        isAbnormal: false,
        specialties: ['cardio', 'endo'],
        imageDataUrl: ''
      },
      {
        id: 'ex-3',
        date: '2025-09-10',
        category: 'lab',
        name: '皮肤镜及真菌镜检（皮肤科）',
        nameEn: 'Dermoscopy & KOH Fungal Prep',
        facility: 'Pacific Dermatology Center',
        facilityEn: 'Pacific Dermatology Center',
        resultSummary: '前臂皮损真菌镜检阴性，符合非感染性特应性皮炎/湿疹改变。',
        resultSummaryEn: 'KOH prep negative for fungal hyphae; c/w non-infectious atopic eczema.',
        isAbnormal: false,
        specialties: ['derm'],
        imageDataUrl: ''
      }
    ]
  };
}

export async function createBlankUserState({
  name,
  nameEn = '',
  dob = '',
  gender = '女',
  heightCm = null,
  bloodType = '',
  allergies = [],
  allergiesEn = [],
  pharmacy = '',
  pcp = '',
  pin = '1234',
  preferredLang = 'zh',
  unitSystem = 'metric'
} = {}) {
  const pinHash = await hashPin(pin);
  const now = new Date().toISOString();
  const genderEn = gender === '男' ? 'Male' : gender === '女' ? 'Female' : 'Other';
  return {
    schemaVersion: 7,
    isDemo: false,
    updatedAt: now,
    profile: {
      name: name || '我的健康档案',
      nameEn,
      gender,
      genderEn,
      dob,
      birthYear: dob ? Number(dob.slice(0, 4)) : null,
      bloodType,
      heightCm: heightCm ? Number(heightCm) : null,
      allergies,
      allergiesEn,
      specialAlerts: [],
      specialAlertsEn: [],
      emergencyContact: '',
      emergencyContactEn: '',
      pinHash,
      autoLockMinutes: 5,
      maskNameOnShare: true,
      preferredLang,
      unitSystem
    },
    careTeam: {
      pharmacy,
      pharmacyEn: pharmacy,
      pcp,
      pcpEn: pcp,
      insurance: '',
      insuranceEn: '',
      savedContacts: []
    },
    visit: {
      purpose: '',
      purposeEn: '',
      department: '',
      departmentEn: '',
      visitDate: now.slice(0, 10),
      visitTime: '',
      doctorName: '',
      clinicName: '',
      clinicPhone: '',
      clinicAddress: '',
      onsetSummary: '',
      onsetSummaryEn: '',
      questions: [],
      questionsEn: [],
      visitReport: null,
      updatedAt: now
    },
    symptoms: [],
    rosNegatives: [],
    history: {
      conditions: [],
      surgeries: [],
      surgeriesEn: [],
      familyHistory: [],
      familyHistoryEn: []
    },
    socialHistory: {
      smoking: '',
      smokingEn: '',
      alcohol: '',
      alcoholEn: '',
      pregnancy: '',
      pregnancyEn: '',
      occupation: '',
      occupationEn: '',
      substances: '',
      substancesEn: ''
    },
    medications: [],
    weights: [],
    vitals: [],
    attachments: [],
    visitHistory: [],
    examHistory: []
  };
}
