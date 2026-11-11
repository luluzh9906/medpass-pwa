/**
 * PIN-unlocked Personal Management & Upload Workbench.
 * Features: Onboarding wizard CTA, US/Metric unit inputs (lbs/kg, °F/°C, mg/dL / mmol/L),
 * bilingual clinical quick-pick presets, full item editing, visit archiving, photo compression & JSON backup.
 */
import { getGeminiApiKey } from './ai.js';
import { escapeHtml } from './charts.js';
import { CLINICAL_PRESETS, pickText, t } from './i18n.js';
import { SPECIALTY_CATALOG } from './specialties.js';

function renderSpecialtySelect(name, currentVal = '', isEn = false, includeAuto = true) {
  return `
    <select name="${name}">
      ${includeAuto ? `<option value="" ${!currentVal ? 'selected' : ''}>${isEn ? 'Auto-match by keywords' : '自动按关键词匹配'}</option>` : ''}
      <option value="all" ${currentVal === 'all' ? 'selected' : ''}>${isEn ? 'All Specialties (Always Show)' : '跨科必看（所有医生可见）'}</option>
      ${SPECIALTY_CATALOG.map((s) => `<option value="${s.id}" ${currentVal === s.id ? 'selected' : ''}>${isEn ? s.en : s.zh}</option>`).join('')}
    </select>
  `;
}

export function renderManageView(state, ui) {
  const lang = ui.lang || state.profile?.preferredLang || 'zh';
  const isEn = lang === 'en';
  const dict = t(lang);
  const activeTab = ui.manageTab || 'visit-vitals';
  const today = new Date().toISOString().slice(0, 10);

  const tabs = [
    { id: 'visit-vitals', label: isEn ? 'Visit & Vitals' : '就诊与体征', icon: '📈' },
    { id: 'symptoms-history', label: isEn ? 'Sx / ROS / Hx' : '症状与病史', icon: '🩺' },
    { id: 'meds-reports', label: isEn ? 'Meds & Labs' : '用药与上传', icon: '💊' },
    { id: 'share-security', label: isEn ? 'Security & Backup' : '安全与备份', icon: '🛡️' }
  ];

  return `
    <div class="manage-shell" id="manage-view">
      <header class="manage-header">
        <div class="manage-header-top">
          <div class="manage-status-pill">
            <span>🔓 ${dict.modeManage}</span>
          </div>
          <div class="manage-header-actions">
            <button class="btn-lang-pill" data-action="toggle-lang">${lang === 'zh' ? '中 / EN' : 'EN / 中'}</button>
            <button class="btn-lock-primary" data-action="lock-to-doctor">🔒 ${dict.btnLock}</button>
          </div>
        </div>
        <div class="manage-sub-tip">
          <span>${isEn ? 'Saved locally to IndexedDB & synced automatically to Physician View.' : '所有修改实时保存至手机本地，并自动同步更新至医生视图。'}</span>
          ${ui.autoLockRemainingText ? `<span class="tabular lock-countdown">${escapeHtml(ui.autoLockRemainingText)}</span>` : ''}
        </div>
      </header>

      <nav class="manage-tabs" aria-label="Manage Navigation">
        ${tabs
          .map(
            (tb) => `
          <button class="manage-tab-btn ${activeTab === tb.id ? 'active' : ''}" data-action="manage-tab" data-tab="${tb.id}">
            <span class="tab-ico">${tb.icon}</span>
            <span>${tb.label}</span>
          </button>
        `
          )
          .join('')}
      </nav>

      <main class="manage-main">
        ${
          state.isDemo
            ? `<section class="onboard-banner">
                <div>
                  <strong>👋 ${isEn ? 'Ready to track your own real health records?' : '当前为示例体验数据，准备好建立你自己的档案了吗？'}</strong>
                  <p>${isEn ? 'Start cleanly in 30 seconds with your own DOB, allergies, pharmacy, and personal PIN.' : '30 秒快速配置姓名、出生日期、过敏史、常用药房与个人 PIN 密码，自动清空示例数据。'}</p>
                </div>
                <button class="btn-primary-sm" data-action="open-setup-wizard">✨ ${isEn ? 'Create My Real Profile' : '创建我的真实档案'}</button>
              </section>`
            : ''
        }

        ${activeTab === 'visit-vitals' ? renderVisitAndVitalsTab(state, ui, today, isEn) : ''}
        ${activeTab === 'symptoms-history' ? renderSymptomsAndHistoryTab(state, ui, today, isEn) : ''}
        ${activeTab === 'meds-reports' ? renderMedsAndReportsTab(state, ui, today, isEn) : ''}
        ${activeTab === 'share-security' ? renderShareAndSecurityTab(state, ui, isEn) : ''}
      </main>
    </div>
  `;
}

function renderVisitAndVitalsTab(state, ui, today, isEn) {
  const { visit, weights, vitals, visitHistory, careTeam } = state;
  const sortedWeights = [...(weights || [])].sort((a, b) => b.date.localeCompare(a.date));
  const sortedVitals = [...(vitals || [])].sort((a, b) => b.date.localeCompare(a.date));
  const selectedVitalType = ui.quickVitalType || 'bp';
  const weightInputUnit = ui.weightInputUnit || (ui.unitSystem === 'us' ? 'lbs' : 'kg');
  const tempInputUnit = ui.tempInputUnit || (ui.unitSystem === 'us' ? 'F' : 'C');
  const glucoseInputUnit = ui.glucoseInputUnit || (ui.unitSystem === 'us' ? 'mgdl' : 'mmol');
  const hasApiKey = !!getGeminiApiKey();
  const aiBusy = ui.aiBusyLabel || '';

  return `
    <section class="edit-card ai-hub-card">
      <div class="edit-card-head">
        <h3>✨ ${isEn ? 'AI Vision & Smart Autofill' : 'AI 识图与自动填就诊卡'}</h3>
        ${
          hasApiKey
            ? `<span class="pill pill-green">${isEn ? 'Gemini Ready' : 'AI 已就绪'}</span>`
            : `<button type="button" class="btn-mini" data-action="goto-api-key">🔑 ${isEn ? 'Set Gemini Key' : '配置 API Key'}</button>`
        }
      </div>
      <p class="help-text" style="margin-bottom: 8px;">
        ${
          isEn
            ? 'Snap a physician business card, appointment slip, or blank clinic intake form—AI extracts dates/times or fills the form strictly from your saved records.'
            : '支持拍名片/预约单保存医生与就诊时间，或拍空白就诊登记表结合你已保存的全部资料自动代填。'
        }
      </p>
      ${aiBusy ? `<div class="ai-busy-bar">⏳ ${escapeHtml(aiBusy)}</div>` : ''}
      <div class="ai-hub-grid">
        <label class="ai-action-tile">
          <span class="ai-tile-ico">🪪</span>
          <span class="ai-tile-title">${isEn ? 'Scan MD Card / Appt' : '名片 / 预约单识别'}</span>
          <span class="ai-tile-sub">${isEn ? 'Save MD, clinic & date/time' : '保存医生、诊所与预约时间'}</span>
          <input type="file" accept="image/*" capture="environment" data-ai-upload="business-card" hidden/>
        </label>
        <label class="ai-action-tile">
          <span class="ai-tile-ico">📝</span>
          <span class="ai-tile-title">${isEn ? 'Auto-Fill Intake Form' : '拍照自动填就诊卡'}</span>
          <span class="ai-tile-sub">${isEn ? 'Fill paper form from saved data' : '结合个人全部信息代填表单'}</span>
          <input type="file" accept="image/*" capture="environment" data-ai-upload="intake-form" hidden/>
        </label>
        <button type="button" class="ai-action-tile" data-action="ai-autofill-visit">
          <span class="ai-tile-ico">🪄</span>
          <span class="ai-tile-title">${isEn ? 'Summarize Visit Card' : '一键生成本次就诊卡'}</span>
          <span class="ai-tile-sub">${isEn ? 'From meds, labs & symptoms' : '综合症状/用药/报告填目的'}</span>
        </button>
        <button type="button" class="ai-action-tile" data-action="open-voice-summary">
          <span class="ai-tile-ico">🎙️</span>
          <span class="ai-tile-title">${isEn ? 'MD Voice Summary' : '医生语音生成就医报告'}</span>
          <span class="ai-tile-sub">${isEn ? 'Dictate plan -> AVS report' : '医生口述自动整理成报告'}</span>
        </button>
      </div>
    </section>
    <section class="edit-card">
      <div class="edit-card-head">
        <h3>⚖️ ${isEn ? 'Quick Log Weight' : '快速记体重'}</h3>
        <span class="muted-xs">${isEn ? 'Supports kg or lbs input' : '支持 kg 或 lbs 录入，自动换算'}</span>
      </div>
      <form class="inline-form" data-form="add-weight">
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Date' : '日期'}</span>
            <input type="date" name="date" value="${today}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'Weight' : '体重'}</span>
            <div class="unit-input-group">
              <input type="number" name="weightVal" step="0.1" min="20" max="550" placeholder="${weightInputUnit === 'lbs' ? '123.0' : '55.6'}" required/>
              <select name="weightUnit" data-action="change-input-unit" data-unit-kind="weight">
                <option value="kg" ${weightInputUnit === 'kg' ? 'selected' : ''}>kg</option>
                <option value="lbs" ${weightInputUnit === 'lbs' ? 'selected' : ''}>lbs</option>
              </select>
            </div>
          </label>
        </div>
        <div class="form-row-btn">
          <input type="text" name="note" placeholder="${isEn ? 'Note (e.g. Fasting AM)' : '备注（如：晨起空腹）'}" class="flex-1"/>
          <button type="submit" class="btn-primary-sm">+ ${isEn ? 'Log' : '记录体重'}</button>
        </div>
      </form>
      <div class="compact-list">
        ${sortedWeights
          .slice(0, 5)
          .map(
            (w) => `
          <div class="compact-item tabular">
            <div><strong>${w.weightKg.toFixed(1)} kg</strong> (${(w.weightKg * 2.20462).toFixed(1)} lbs) · <span class="muted-sm">${w.date}</span></div>
            <button class="btn-del-xs" data-action="del-weight" data-id="${w.id}" title="Delete">✕</button>
          </div>
        `
          )
          .join('')}
      </div>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>🩺 ${isEn ? 'Quick Log Vitals' : '快速记生命体征'}</h3>
      </div>
      <div class="seg-tabs full-width" style="margin-bottom: 10px; flex-wrap: wrap;">
        <button type="button" class="seg-btn ${selectedVitalType === 'bp' ? 'active' : ''}" data-action="quick-vital-type" data-vtype="bp">${isEn ? 'BP' : '血压'}</button>
        <button type="button" class="seg-btn ${selectedVitalType === 'hr' ? 'active' : ''}" data-action="quick-vital-type" data-vtype="hr">${isEn ? 'HR' : '心率'}</button>
        <button type="button" class="seg-btn ${selectedVitalType === 'glucose' ? 'active' : ''}" data-action="quick-vital-type" data-vtype="glucose">${isEn ? 'BG' : '血糖'}</button>
        <button type="button" class="seg-btn ${selectedVitalType === 'temp' ? 'active' : ''}" data-action="quick-vital-type" data-vtype="temp">${isEn ? 'Temp' : '体温'}</button>
        <button type="button" class="seg-btn ${selectedVitalType === 'spo2' ? 'active' : ''}" data-action="quick-vital-type" data-vtype="spo2">SpO2</button>
        <button type="button" class="seg-btn ${selectedVitalType === 'pain' ? 'active' : ''}" data-action="quick-vital-type" data-vtype="pain">${isEn ? 'Pain' : '疼痛'}</button>
      </div>
      <form class="inline-form" data-form="add-vital">
        <input type="hidden" name="type" value="${selectedVitalType}"/>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Date' : '日期'}</span>
            <input type="date" name="date" value="${today}" required/>
          </label>
          ${
            selectedVitalType === 'bp'
              ? `<div class="field">
                  <span>${isEn ? 'SBP / DBP (mmHg)' : '收缩压 / 舒张压 (mmHg)'}</span>
                  <div class="bp-inputs">
                    <input type="number" name="value1" placeholder="120" min="50" max="260" required/>
                    <span>/</span>
                    <input type="number" name="value2" placeholder="78" min="30" max="160" required/>
                  </div>
                </div>`
              : selectedVitalType === 'temp'
                ? `<label class="field">
                    <span>${isEn ? 'Temperature' : '体温'}</span>
                    <div class="unit-input-group">
                      <input type="number" name="value1" step="0.1" placeholder="${tempInputUnit === 'F' ? '98.6' : '36.6'}" required/>
                      <select name="tempUnit" data-action="change-input-unit" data-unit-kind="temp">
                        <option value="C" ${tempInputUnit === 'C' ? 'selected' : ''}>°C</option>
                        <option value="F" ${tempInputUnit === 'F' ? 'selected' : ''}>°F</option>
                      </select>
                    </div>
                  </label>`
                : selectedVitalType === 'glucose'
                  ? `<label class="field">
                      <span>${isEn ? 'Blood Glucose' : '血糖'}</span>
                      <div class="unit-input-group">
                        <input type="number" name="value1" step="${glucoseInputUnit === 'mgdl' ? '1' : '0.1'}" placeholder="${glucoseInputUnit === 'mgdl' ? '95' : '5.2'}" required/>
                        <select name="glucoseUnit" data-action="change-input-unit" data-unit-kind="glucose">
                          <option value="mmol" ${glucoseInputUnit === 'mmol' ? 'selected' : ''}>mmol/L</option>
                          <option value="mgdl" ${glucoseInputUnit === 'mgdl' ? 'selected' : ''}>mg/dL</option>
                        </select>
                      </div>
                    </label>`
                  : `<label class="field">
                      <span>${
                        selectedVitalType === 'hr'
                          ? isEn ? 'Heart Rate (bpm)' : '心率 (bpm)'
                          : selectedVitalType === 'spo2'
                            ? 'SpO2 (%)'
                            : isEn ? 'Pain Score (0-10)' : '疼痛评分 (0-10)'
                      }</span>
                      <input type="number" name="value1" step="1" placeholder="${selectedVitalType === 'spo2' ? '99' : selectedVitalType === 'pain' ? '0' : '82'}" required/>
                    </label>`
          }
        </div>
        <div class="form-row-btn">
          <input type="text" name="context" placeholder="${isEn ? 'Context (e.g. Fasting AM)' : '场景（如：晨起静息 / 餐后2h）'}" class="flex-1"/>
          <button type="submit" class="btn-primary-sm">+ ${isEn ? 'Save' : '保存指标'}</button>
        </div>
      </form>
      <div class="compact-list">
        ${sortedVitals
          .slice(0, 6)
          .map((v) => {
            const val = v.type === 'bp' ? `${v.value1}/${v.value2}` : `${v.value1}`;
            return `
              <div class="compact-item tabular">
                <div><span class="tag-mini">${v.type.toUpperCase()}</span> <strong>${val} ${escapeHtml(v.unit)}</strong> · <span class="muted-sm">${v.date}</span></div>
                <button class="btn-del-xs" data-action="del-vital" data-id="${v.id}">✕</button>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>🎯 ${isEn ? 'Visit Purpose & Appointment Info' : '本次就诊卡（目的、时间与医生信息）'}</h3>
        <div class="item-actions">
          <button type="button" class="btn-mini" data-action="export-ics">📅 ${isEn ? '.ics' : '日历'}</button>
          <button type="button" class="btn-mini" data-action="open-archive-visit">📁 ${isEn ? 'Archive' : '归档'}</button>
        </div>
      </div>
      <form class="stack-form" data-form="save-visit">
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Specialty Scope (Filters View)' : '所属专科（用于医生端精准调取）'}</span>
            ${renderSpecialtySelect('specialtyId', visit.specialtyId || '', isEn, true)}
          </label>
          <label class="field">
            <span>${isEn ? 'Department Label' : '就诊科室名称'}</span>
            <input type="text" name="department" value="${escapeHtml(visit.department || '')}"/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Appt Date' : '预约日期'}</span>
            <input type="date" name="visitDate" value="${escapeHtml(visit.visitDate || today)}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Time' : '预约时间'}</span>
            <input type="time" name="visitTime" value="${escapeHtml(visit.visitTime || '')}"/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Doctor Name' : '接诊医生'}</span>
            <input type="text" name="doctorName" value="${escapeHtml(visit.doctorName || '')}" placeholder="e.g. Dr. Sarah Miller, MD"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Clinic / Phone' : '医院/诊所名称'}</span>
            <input type="text" name="clinicName" value="${escapeHtml(visit.clinicName || '')}"/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Clinic Phone' : '诊所电话'}</span>
            <input type="text" name="clinicPhone" value="${escapeHtml(visit.clinicPhone || '')}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Clinic Address' : '诊所地址'}</span>
            <input type="text" name="clinicAddress" value="${escapeHtml(visit.clinicAddress || '')}"/>
          </label>
        </div>
        <label class="field">
          <span>${isEn ? 'Chief Complaint / Purpose (Primary)' : '本次就诊主要目的'}</span>
          <textarea name="purpose" rows="2" required>${escapeHtml(visit.purpose || '')}</textarea>
        </label>
        <label class="field">
          <span>${isEn ? 'Chief Complaint (English for US MD, optional)' : '英文就诊目的（可选，美国医生英文视图优先展示）'}</span>
          <textarea name="purposeEn" rows="2" placeholder="Optional English summary for US physicians">${escapeHtml(visit.purposeEn || '')}</textarea>
        </label>
        <label class="field">
          <span>${isEn ? 'HPI One-Liner' : '核心概览（1句话总结）'}</span>
          <input type="text" name="onsetSummary" value="${escapeHtml(visit.onsetSummary || '')}"/>
        </label>
        <label class="field">
          <span>${isEn ? 'Top Questions for Doctor (1 per line)' : '本次最想问医生的问题（每行 1 个）'}</span>
          <textarea name="questions" rows="3">${escapeHtml((visit.questions || []).join('\n'))}</textarea>
        </label>
        <label class="field">
          <span>${isEn ? 'Top Questions in English (optional, 1 per line)' : '英文问题清单（可选，每行 1 个）'}</span>
          <textarea name="questionsEn" rows="2" placeholder="Optional English questions for US MD">${escapeHtml((visit.questionsEn || []).join('\n'))}</textarea>
        </label>
        <button type="submit" class="btn-primary">${isEn ? 'Save Visit Card' : '保存本次就诊卡'}</button>
      </form>

      ${
        careTeam?.savedContacts?.length
          ? `<div class="sub-label" style="margin-top: 12px;">🪪 ${isEn ? 'Saved Physician Cards' : '已识别保存的医生名片'} (${careTeam.savedContacts.length})</div>
            <div class="compact-list">
              ${careTeam.savedContacts
                .map(
                  (c) => `
                <div class="compact-item">
                  <div>
                    <strong>${escapeHtml(c.doctorName || c.clinicName)}</strong> · <span class="muted-xs">${escapeHtml(c.department || '')}</span>
                    <div class="muted-xs">${escapeHtml([c.clinicName, c.phone, c.address].filter(Boolean).join(' · '))}</div>
                  </div>
                  <div class="item-actions">
                    <button class="btn-mini" data-action="focus-contact-scope" data-id="${c.id}">🎯 ${isEn ? 'Preview View' : '看此医生视角'}</button>
                    <button class="btn-mini" data-action="apply-contact-to-visit" data-id="${c.id}">${isEn ? 'Use' : '填入就诊'}</button>
                    <button class="btn-del-xs" data-action="del-saved-contact" data-id="${c.id}">✕</button>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>`
          : ''
      }

      ${
        visitHistory?.length
          ? `<div class="sub-label" style="margin-top: 12px;">📁 ${isEn ? 'Archived Visits' : '已归档就诊记录'} (${visitHistory.length})</div>
            <div class="compact-list">
              ${visitHistory
                .map(
                  (vh) => `
                <div class="compact-item">
                  <div>
                    <strong>${escapeHtml(vh.date)} · ${escapeHtml(pickText(vh, 'purpose', isEn ? 'en' : 'zh'))}</strong>
                    <div class="muted-xs">${escapeHtml(pickText(vh, 'doctorNotes', isEn ? 'en' : 'zh'))}</div>
                  </div>
                  <button class="btn-del-xs" data-action="del-visit-history" data-id="${vh.id}">✕</button>
                </div>
              `
                )
                .join('')}
            </div>`
          : ''
      }
    </section>
  `;
}

function renderSymptomsAndHistoryTab(state, _ui, today, isEn) {
  const { profile, careTeam, symptoms, rosNegatives, history, socialHistory } = state;

  return `
    <section class="edit-card">
      <div class="edit-card-head">
        <h3>➕ ${isEn ? 'Current Symptoms' : '当前症状管理'}</h3>
      </div>
      <form class="stack-form" data-form="add-symptom">
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Symptom' : '症状名称'}</span>
            <input type="text" name="name" placeholder="${isEn ? 'e.g. Palpitations' : '例如：午后低热、干咳'}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'English Name (optional)' : '英文名称（可选）'}</span>
            <input type="text" name="nameEn" placeholder="e.g. Low-grade fever"/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Onset Date' : '起病日期'}</span>
            <input type="date" name="onsetDate" value="${today}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Duration' : '持续时间'}</span>
            <input type="text" name="durationText" placeholder="${isEn ? 'e.g. ~5 days' : '例如：约 5 天'}" required/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Severity' : '严重程度'}</span>
            <select name="severity">
              <option value="mild">${isEn ? 'Mild' : '轻度'}</option>
              <option value="moderate" selected>${isEn ? 'Moderate' : '中度'}</option>
              <option value="severe">${isEn ? 'Severe' : '重度'}</option>
            </select>
          </label>
          <label class="field">
            <span>${isEn ? 'Course / Trend' : '变化趋势'}</span>
            <select name="trend">
              <option value="worsening">${isEn ? 'Worsening' : '↗ 有所加重'}</option>
              <option value="stable">${isEn ? 'Stable' : '→ 总体持平'}</option>
              <option value="improving">${isEn ? 'Improving' : '↘ 逐步好转'}</option>
            </select>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Details / Self-care' : '详细特征与已尝试缓解方式'}</span>
            <input type="text" name="notes" placeholder="${isEn ? 'Triggers, frequency...' : '何时明显、伴随表现等'}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Related Specialty' : '关联专科（可选）'}</span>
            ${renderSpecialtySelect('specialtyTag', '', isEn, true)}
          </label>
        </div>
        <button type="submit" class="btn-primary">${isEn ? 'Add Symptom' : '添加症状记录'}</button>
      </form>

      <div class="compact-list" style="margin-top: 12px;">
        ${(symptoms || [])
          .map(
            (s) => `
          <div class="compact-item">
            <div>
              <strong>${escapeHtml(pickText(s, 'name', isEn ? 'en' : 'zh'))}</strong>
              <div class="muted-xs">${escapeHtml(pickText(s, 'durationText', isEn ? 'en' : 'zh'))}</div>
            </div>
            <div class="item-actions">
              <button class="btn-mini" data-action="cycle-symptom-trend" data-id="${s.id}">${isEn ? 'Trend' : '趋势'}</button>
              <button class="btn-mini" data-action="edit-item" data-kind="symptom" data-id="${s.id}">${isEn ? 'Edit' : '编辑'}</button>
              <button class="btn-del-xs" data-action="del-symptom" data-id="${s.id}">✕</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>🛡️ ${isEn ? 'Pertinent Negatives (ROS Denials)' : '明确否认的伴随症状（阴性鉴别）'}</h3>
      </div>
      <div class="preset-chips">
        ${CLINICAL_PRESETS.ros
          .map(
            (p) => `<button type="button" class="preset-chip" data-action="preset-ros" data-zh="${escapeHtml(p.zh)}" data-en="${escapeHtml(p.en)}">+ ${escapeHtml(p.label)}</button>`
          )
          .join('')}
      </div>
      <form class="inline-form" data-form="add-ros" style="margin-top: 8px;">
        <div class="form-row-btn">
          <input type="text" name="text" placeholder="${isEn ? 'Custom denial (e.g. Denies cough)' : '自定义否认项（如：明确否认咳嗽）'}" class="flex-1" required/>
          <button type="submit" class="btn-primary-sm">+ ${isEn ? 'Add' : '添加'}</button>
        </div>
      </form>
      <div class="compact-list">
        ${(rosNegatives || [])
          .map(
            (n) => `
          <div class="compact-item">
            <span>✓ ${escapeHtml(pickText(n, 'text', isEn ? 'en' : 'zh'))}</span>
            <button class="btn-del-xs" data-action="del-ros" data-id="${n.id}">✕</button>
          </div>
        `
          )
          .join('')}
      </div>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>🪪 ${isEn ? 'Demographics, Allergies & US Pharmacy' : '个人档案、过敏史与药房信息'}</h3>
      </div>
      <form class="stack-form" data-form="save-profile">
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Name (Primary)' : '姓名/称呼'}</span>
            <input type="text" name="name" value="${escapeHtml(profile.name || '')}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'English Name (optional)' : '英文名/拼音（供美国医生核对）'}</span>
            <input type="text" name="nameEn" value="${escapeHtml(profile.nameEn || '')}" placeholder="e.g. Claire Lin"/>
          </label>
        </div>
        <div class="form-row-3">
          <label class="field">
            <span>${isEn ? 'DOB' : '出生日期 (DOB)'}</span>
            <input type="date" name="dob" value="${escapeHtml(profile.dob || '')}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Sex' : '性别'}</span>
            <select name="gender">
              <option value="女" ${profile.gender === '女' ? 'selected' : ''}>女 / F</option>
              <option value="男" ${profile.gender === '男' ? 'selected' : ''}>男 / M</option>
              <option value="其他" ${profile.gender === '其他' ? 'selected' : ''}>其他 / X</option>
            </select>
          </label>
          <label class="field">
            <span>${isEn ? 'Height (cm)' : '身高 (cm)'}</span>
            <input type="number" name="heightCm" min="50" max="240" value="${profile.heightCm || ''}"/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Blood Type' : '血型'}</span>
            <input type="text" name="bloodType" value="${escapeHtml(profile.bloodType || '')}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Emergency Contact' : '紧急联系人'}</span>
            <input type="text" name="emergencyContact" value="${escapeHtml(profile.emergencyContact || '')}"/>
          </label>
        </div>
        <div class="field">
          <span>${isEn ? 'Quick-Add Bilingual Allergy Presets:' : '快捷添加双语过敏史：'}</span>
          <div class="preset-chips">
            ${CLINICAL_PRESETS.allergies
              .map(
                (p) => `<button type="button" class="preset-chip" data-action="preset-allergy" data-zh="${escapeHtml(p.zh)}" data-en="${escapeHtml(p.en)}">+ ${escapeHtml(p.label)}</button>`
              )
              .join('')}
          </div>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Allergies (Primary, 1/line)' : '过敏史（每行 1 项）'}</span>
            <textarea name="allergies" rows="2">${escapeHtml((profile.allergies || []).join('\n'))}</textarea>
          </label>
          <label class="field">
            <span>${isEn ? 'Allergies (English, 1/line)' : '英文过敏史（可选，每行 1 项）'}</span>
            <textarea name="allergiesEn" rows="2">${escapeHtml((profile.allergiesEn || []).join('\n'))}</textarea>
          </label>
        </div>
        <label class="field">
          <span>${isEn ? 'Preferred Pharmacy (for e-Rx)' : '常用药房（美国医生电子处方必填）'}</span>
          <input type="text" name="pharmacy" value="${escapeHtml(careTeam?.pharmacy || '')}" placeholder="e.g. CVS #4821 · Address & Tel"/>
        </label>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Primary Care (PCP)' : '家庭/主治医生 (PCP)'}</span>
            <input type="text" name="pcp" value="${escapeHtml(careTeam?.pcp || '')}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Insurance' : '医保/商业保险'}</span>
            <input type="text" name="insurance" value="${escapeHtml(careTeam?.insurance || '')}"/>
          </label>
        </div>
        <button type="submit" class="btn-primary">${isEn ? 'Save Profile & Pharmacy' : '保存档案与药房信息'}</button>
      </form>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>📋 ${isEn ? 'PMH, Surgical, Family & Social History' : '既往史、手术史与社会史'}</h3>
      </div>
      <div class="preset-chips" style="margin-bottom: 8px;">
        ${CLINICAL_PRESETS.conditions
          .map(
            (p) => `<button type="button" class="preset-chip" data-action="preset-condition" data-zh="${escapeHtml(p.zh)}" data-en="${escapeHtml(p.en)}">+ ${escapeHtml(p.label)}</button>`
          )
          .join('')}
      </div>
      <form class="inline-form" data-form="add-condition" style="margin-bottom: 10px;">
        <div class="form-row-2">
          <input type="text" name="name" placeholder="${isEn ? 'Condition (e.g. HTN)' : '疾病名称（如：高血压）'}" required/>
          <input type="text" name="nameEn" placeholder="English name (optional)"/>
        </div>
        <div class="form-row-btn">
          <input type="text" name="diagnosedYear" placeholder="${isEn ? 'Year' : '确诊年份'}" style="width:92px;"/>
          <input type="text" name="status" placeholder="${isEn ? 'Status (e.g. Controlled)' : '状态（如：规律控制中）'}" class="flex-1"/>
          <button type="submit" class="btn-primary-sm">+ ${isEn ? 'Add' : '添加'}</button>
        </div>
      </form>
      <div class="compact-list" style="margin-bottom: 12px;">
        ${(history?.conditions || [])
          .map(
            (c) => `
          <div class="compact-item">
            <div><strong>${escapeHtml(pickText(c, 'name', isEn ? 'en' : 'zh'))}</strong> <span class="muted-xs">${escapeHtml(c.diagnosedYear)} · ${escapeHtml(pickText(c, 'status', isEn ? 'en' : 'zh'))}</span></div>
            <div class="item-actions">
              <button class="btn-mini" data-action="edit-item" data-kind="condition" data-id="${c.id}">${isEn ? 'Edit' : '编辑'}</button>
              <button class="btn-del-xs" data-action="del-condition" data-id="${c.id}">✕</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      <form class="stack-form" data-form="save-history-lists">
        <div class="preset-chips">
          ${CLINICAL_PRESETS.social.smoking.map((p) => `<button type="button" class="preset-chip" data-action="preset-social" data-field="smoking" data-zh="${escapeHtml(p.zh)}" data-en="${escapeHtml(p.en)}">${p.label}</button>`).join('')}
          ${CLINICAL_PRESETS.social.alcohol.map((p) => `<button type="button" class="preset-chip" data-action="preset-social" data-field="alcohol" data-zh="${escapeHtml(p.zh)}" data-en="${escapeHtml(p.en)}">${p.label}</button>`).join('')}
          ${CLINICAL_PRESETS.social.pregnancy.map((p) => `<button type="button" class="preset-chip" data-action="preset-social" data-field="pregnancy" data-zh="${escapeHtml(p.zh)}" data-en="${escapeHtml(p.en)}">${p.label}</button>`).join('')}
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Tobacco / Smoking' : '吸烟史'}</span>
            <input type="text" name="smoking" value="${escapeHtml(socialHistory?.smoking || '')}" placeholder="Never / Former / Active"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Alcohol Use' : '饮酒史'}</span>
            <input type="text" name="alcohol" value="${escapeHtml(socialHistory?.alcohol || '')}"/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Pregnancy / LMP' : '妊娠与末次月经 (LMP)'}</span>
            <input type="text" name="pregnancy" value="${escapeHtml(socialHistory?.pregnancy || '')}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Occupation' : '职业与作息'}</span>
            <input type="text" name="occupation" value="${escapeHtml(socialHistory?.occupation || '')}"/>
          </label>
        </div>
        <label class="field">
          <span>${isEn ? 'Surgical History (1 per line)' : '手术 / 外伤住院史（每行 1 项）'}</span>
          <textarea name="surgeries" rows="2">${escapeHtml((history?.surgeries || []).join('\n'))}</textarea>
        </label>
        <label class="field">
          <span>${isEn ? 'Family History (1 per line)' : '家族病史（每行 1 项）'}</span>
          <textarea name="familyHistory" rows="2">${escapeHtml((history?.familyHistory || []).join('\n'))}</textarea>
        </label>
        <button type="submit" class="btn-secondary">${isEn ? 'Save Histories' : '保存手术、家族与社会史'}</button>
      </form>
    </section>
  `;
}

function renderMedsAndReportsTab(state, _ui, today, isEn) {
  const { medications, attachments } = state;
  const activeMeds = (medications || []).filter((m) => m.status === 'active');
  const recentMeds = (medications || []).filter((m) => m.status === 'recent');

  return `
    <section class="edit-card">
      <div class="edit-card-head">
        <h3>💊 ${isEn ? 'Medication Reconciliation (Rx / OTC)' : '添加与管理用药记录'}</h3>
      </div>
      <form class="stack-form" data-form="add-med">
        <div class="form-row-3">
          <label class="field" style="grid-column: span 2;">
            <span>${isEn ? 'Medication Name' : '药物名称'}</span>
            <input type="text" name="name" placeholder="${isEn ? 'e.g. Lisinopril' : '如：阿托伐他汀钙片'}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'Type' : '类型'}</span>
            <select name="category">
              <option value="rx">${isEn ? 'Rx' : 'Rx 处方药'}</option>
              <option value="otc">${isEn ? 'OTC / Supp' : 'OTC 保健品'}</option>
            </select>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'English Drug Name (optional)' : '英文药名（可选，供美国医生看）'}</span>
            <input type="text" name="nameEn" placeholder="e.g. Atorvastatin"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Dose' : '每次剂量'}</span>
            <input type="text" name="dosage" placeholder="20 mg"/>
          </label>
        </div>
        <div class="preset-chips">
          ${CLINICAL_PRESETS.medFreq
            .map(
              (p) => `<button type="button" class="preset-chip" data-action="preset-med-freq" data-zh="${escapeHtml(p.zh)}" data-en="${escapeHtml(p.en)}">${escapeHtml(p.label)}</button>`
            )
            .join('')}
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Frequency' : '频次'}</span>
            <input type="text" name="frequency" placeholder="每日 1 次 / Daily"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Status' : '状态'}</span>
            <select name="status">
              <option value="active">${isEn ? 'Active' : '当前在服'}</option>
              <option value="recent">${isEn ? 'Stopped' : '近期曾服'}</option>
            </select>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Last Dose Taken (US Clinic)' : '末次服药（美国门诊常问）'}</span>
            <input type="text" name="lastTaken" placeholder="${isEn ? 'e.g. Today 7:30 AM' : '如：今日 07:30 已服'}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Start Date' : '开始日期'}</span>
            <input type="date" name="startDate" value="${today}"/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Stop Reason (if stopped)' : '停药原因（已停药时填）'}</span>
            <input type="text" name="stopReason"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Related Specialty' : '关联专科（可选）'}</span>
            ${renderSpecialtySelect('specialtyTag', '', isEn, true)}
          </label>
        </div>
        <label class="field">
          <span>${isEn ? 'Pill Bottle / Box Photo' : '拍摄或上传药盒/药瓶照片（可 AI 自动填表）'}</span>
          <div class="form-row-btn">
            <input type="file" name="medPhoto" accept="image/*" capture="environment" data-compress-preview="med-photo-preview" class="flex-1"/>
            <button type="button" class="btn-mini" data-action="ai-scan-medbox">✨ ${isEn ? 'AI Scan Med' : 'AI 识别药盒'}</button>
          </div>
          <div id="med-photo-preview" class="upload-preview-note"></div>
        </label>
        <input type="hidden" name="frequencyEn" value=""/>
        <input type="hidden" name="timing" value=""/>
        <input type="hidden" name="timingEn" value=""/>
        <input type="hidden" name="notes" value=""/>
        <button type="submit" class="btn-primary">${isEn ? 'Save Medication' : '保存药物记录'}</button>
      </form>

      <div class="sub-label" style="margin-top: 14px;">${isEn ? 'Active Meds' : '当前在服'} (${activeMeds.length})</div>
      <div class="compact-list">
        ${activeMeds
          .map(
            (m) => `
          <div class="compact-item">
            <div>
              <strong>${escapeHtml(pickText(m, 'name', isEn ? 'en' : 'zh'))}</strong>
              <div class="muted-xs">${escapeHtml(pickText(m, 'dosage', isEn ? 'en' : 'zh'))} · ${escapeHtml(pickText(m, 'lastTaken', isEn ? 'en' : 'zh') || '')}</div>
            </div>
            <div class="item-actions">
              <button class="btn-mini" data-action="mark-med-today" data-id="${m.id}">${isEn ? 'Took Today' : '今日已服'}</button>
              <button class="btn-mini" data-action="edit-item" data-kind="med" data-id="${m.id}">${isEn ? 'Edit' : '编辑'}</button>
              <button class="btn-mini" data-action="move-med-recent" data-id="${m.id}">${isEn ? 'Stop' : '停药'}</button>
              <button class="btn-del-xs" data-action="del-med" data-id="${m.id}">✕</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="sub-label" style="margin-top: 12px;">${isEn ? 'Past / Discontinued' : '近期曾服'} (${recentMeds.length})</div>
      <div class="compact-list">
        ${recentMeds
          .map(
            (m) => `
          <div class="compact-item">
            <div>
              <strong>${escapeHtml(pickText(m, 'name', isEn ? 'en' : 'zh'))}</strong>
              <div class="muted-xs">${escapeHtml(pickText(m, 'stopReason', isEn ? 'en' : 'zh') || 'Stopped')}</div>
            </div>
            <div class="item-actions">
              <button class="btn-mini" data-action="edit-item" data-kind="med" data-id="${m.id}">${isEn ? 'Edit' : '编辑'}</button>
              <button class="btn-del-xs" data-action="del-med" data-id="${m.id}">✕</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>📄 ${isEn ? 'Upload Labs / Imaging' : '上传化验单 / 检查资料'}</h3>
        <button type="button" class="btn-mini" data-action="ai-scan-report">✨ ${isEn ? 'AI Auto-Fill from Photo' : 'AI 识别报告填表'}</button>
      </div>
      <form class="stack-form" data-form="add-report">
        <label class="field">
          <span>${isEn ? '1. Photo / Scan (Auto-compressed; click AI button above to auto-fill)' : '1. 拍照或选择报告照片（选图后点右上角「AI 识别报告填表」自动填写下方内容）'}</span>
          <input type="file" name="reportPhoto" accept="image/*" capture="environment" data-compress-preview="report-photo-preview"/>
          <div id="report-photo-preview" class="upload-preview-note"></div>
        </label>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Date' : '检查日期'}</span>
            <input type="date" name="date" value="${today}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'Flag' : '异常标识'}</span>
            <select name="isAbnormal">
              <option value="true">${isEn ? 'Abnormal (Highlight)' : '有异常指标（标红）'}</option>
              <option value="false">${isEn ? 'Normal / Routine' : '基本正常'}</option>
            </select>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Report Title' : '报告名称'}</span>
            <input type="text" name="title" placeholder="${isEn ? 'e.g. Lipid Panel & CMP' : '如：肝肾功能 + 血脂化验单'}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'English Title (optional)' : '英文报告名（可选）'}</span>
            <input type="text" name="titleEn" placeholder="e.g. Thyroid Panel"/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Key Values / Summary' : '关键指标摘录（医生问询也会读取此栏）'}</span>
            <input type="text" name="summaryHighlight" placeholder="e.g. TSH 0.18 ↓ · FT4 23.4 ↑"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Related Specialty' : '关联专科（可选）'}</span>
            ${renderSpecialtySelect('specialtyTag', '', isEn, true)}
          </label>
        </div>
        <input type="hidden" name="summaryHighlightEn" value=""/>
        <button type="submit" class="btn-primary">${isEn ? 'Upload Report' : '上传检查记录'}</button>
      </form>

      <div class="compact-list" style="margin-top: 12px;">
        ${(attachments || [])
          .map(
            (a) => `
          <div class="compact-item">
            <div>
              <strong>${escapeHtml(pickText(a, 'title', isEn ? 'en' : 'zh'))}</strong>
              <div class="muted-xs tabular">${escapeHtml(a.date)} ${a.isAbnormal ? '· ⚠️' : ''}</div>
            </div>
            <div class="item-actions">
              <button class="btn-mini" data-action="edit-item" data-kind="report" data-id="${a.id}">${isEn ? 'Edit' : '编辑'}</button>
              <button class="btn-del-xs" data-action="del-report" data-id="${a.id}">✕</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>🔬 ${isEn ? 'Past Diagnostic & Imaging History' : '既往检查历史（影像 / 超声 / 心电图 / 内镜 / 体检）'}</h3>
      </div>
      <div class="preset-chips" style="margin-bottom: 8px;">
        ${CLINICAL_PRESETS.exams
          .map(
            (p) => `<button type="button" class="preset-chip" data-action="preset-exam" data-cat="${p.category}" data-spec="${p.spec}" data-zh="${escapeHtml(p.zh)}" data-en="${escapeHtml(p.en)}">+ ${escapeHtml(p.label)}</button>`
          )
          .join('')}
      </div>
      <form class="stack-form" data-form="add-exam">
        <div class="form-row-3">
          <label class="field">
            <span>${isEn ? 'Exam Date' : '检查日期'}</span>
            <input type="date" name="date" value="${today}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'Category' : '检查类型'}</span>
            <select name="category">
              <option value="imaging">${isEn ? 'Imaging / US' : '影像 / 超声'}</option>
              <option value="cardiac">${isEn ? 'EKG / Cardiac' : '心电 / 功能'}</option>
              <option value="endoscopy">${isEn ? 'Endoscopy' : '内镜 / 病理'}</option>
              <option value="lab">${isEn ? 'Past Lab' : '既往化验'}</option>
              <option value="screening">${isEn ? 'Screening' : '体检 / 筛查'}</option>
              <option value="other">${isEn ? 'Other' : '其他检查'}</option>
            </select>
          </label>
          <label class="field">
            <span>${isEn ? 'Result' : '结果标识'}</span>
            <select name="isAbnormal">
              <option value="false">${isEn ? 'Normal / Benign' : '正常 / 良性'}</option>
              <option value="true">${isEn ? 'Abnormal' : '有异常'}</option>
            </select>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Exam Name' : '检查项目名称'}</span>
            <input type="text" name="name" placeholder="${isEn ? 'e.g. Thyroid Ultrasound' : '例如：甲状腺彩超 / 胸部CT'}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'English Name (optional)' : '英文检查名称（可选）'}</span>
            <input type="text" name="nameEn" placeholder="e.g. Thyroid Ultrasound"/>
          </label>
        </div>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Hospital / Facility' : '检查医院 / 机构'}</span>
            <input type="text" name="facility" placeholder="${isEn ? 'e.g. UCSF Radiology' : '例如：三甲医院影像科'}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Related Specialty' : '关联专科（可选）'}</span>
            ${renderSpecialtySelect('specialtyTag', '', isEn, true)}
          </label>
        </div>
        <label class="field">
          <span>${isEn ? 'Findings / Impression Summary' : '检查结论 / 关键发现'}</span>
          <textarea name="resultSummary" rows="2" placeholder="${isEn ? 'e.g. Benign TI-RADS 2 nodules, no suspicious lymph nodes' : '例如：TI-RADS 2类良性结节，未见异常淋巴结'}" required></textarea>
        </label>
        <label class="field">
          <span>${isEn ? 'Optional Photo / Scan' : '可选附带报告照片（自动压缩）'}</span>
          <input type="file" name="examPhoto" accept="image/*" capture="environment" data-compress-preview="exam-photo-preview"/>
          <div id="exam-photo-preview" class="upload-preview-note"></div>
        </label>
        <button type="submit" class="btn-primary">${isEn ? 'Save Past Exam' : '添加既往检查记录'}</button>
      </form>

      <div class="compact-list" style="margin-top: 12px;">
        ${(state.examHistory || [])
          .map(
            (ex) => `
          <div class="compact-item">
            <div>
              <strong>${escapeHtml(pickText(ex, 'name', isEn ? 'en' : 'zh'))}</strong>
              <div class="muted-xs tabular">${escapeHtml(ex.date)} ${ex.isAbnormal ? '· ⚠️' : ''}</div>
            </div>
            <div class="item-actions">
              <button class="btn-mini" data-action="edit-item" data-kind="exam" data-id="${ex.id}">${isEn ? 'Edit' : '编辑'}</button>
              <button class="btn-del-xs" data-action="del-exam" data-id="${ex.id}">✕</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderShareAndSecurityTab(state, ui, isEn) {
  const estKb = ui.storageStats ? Math.round(ui.storageStats.usageBytes / 1024) : 0;
  const persisted = ui.storageStats?.persisted;
  const savedKey = getGeminiApiKey();

  return `
    <section class="edit-card" id="ai-key-section">
      <div class="edit-card-head">
        <h3>✨ ${isEn ? 'Gemini AI Vision API Key' : 'AI 识图密钥设置 (Gemini API Key)'}</h3>
        ${savedKey ? `<span class="pill pill-green">${isEn ? 'Configured' : '已配置'}</span>` : `<span class="pill pill-muted">${isEn ? 'Not Set' : '未配置'}</span>`}
      </div>
      <p class="help-text">
        ${
          isEn
            ? 'Used for scanning lab reports, pill bottles, doctor business cards, and auto-filling intake forms. Stored strictly on this device and never included in backups or QR shares.'
            : '用于化验单识别、药盒识别、医生名片/预约识别及空白就诊卡自动代填。仅保存在你本机浏览器中，导出备份或生成二维码时均不会包含此密钥。'
        }
      </p>
      <form class="inline-form" data-form="save-api-key">
        <div class="form-row-btn">
          <input type="password" name="apiKey" value="${escapeHtml(savedKey)}" placeholder="AIza..." class="flex-1"/>
          <button type="submit" class="btn-primary-sm">${isEn ? 'Save Key' : '保存密钥'}</button>
          ${savedKey ? `<button type="button" class="btn-secondary-sm" data-action="clear-api-key">${isEn ? 'Clear' : '清除'}</button>` : ''}
        </div>
      </form>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>🌐 ${isEn ? 'Language, Units & View' : '语言、单位与显示偏好'}</h3>
      </div>
      <div class="form-row-2">
        <button class="btn-secondary" data-action="toggle-lang">
          ${isEn ? 'Switch to 中文 (Chinese)' : '切换为英文界面 (English)'}
        </button>
        <button class="btn-secondary" data-action="toggle-unit">
          ${ui.unitSystem === 'us' ? 'Switch to Metric (kg / °C)' : '切换为美国单位 (lbs / °F / mg/dL)'}
        </button>
      </div>
      <button class="btn-secondary" style="width:100%;margin-top:8px;" data-action="toggle-frame">
        ${ui.desktopFrame ? (isEn ? '🖥️ Switch to Clean Desktop Layout' : '🖥️ 切换桌面宽屏卡片布局') : (isEn ? '📱 Preview in Phone Frame' : '📱 切换手机外壳预览')}
      </button>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>🔐 ${isEn ? 'PIN Code & Auto-Lock' : '防误触 PIN 码与自动锁定'}</h3>
      </div>
      <form class="stack-form" data-form="change-pin">
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'New PIN (4-6 digits)' : '新 PIN 码（4~6位数字）'}</span>
            <input type="password" inputmode="numeric" pattern="\\d{4,6}" name="newPin" placeholder="${isEn ? '4-6 digits' : '输入4~6位数字'}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'Auto-Lock Timer' : '无操作自动回锁'}</span>
            <select name="autoLockMinutes" data-action="change-autolock">
              <option value="2" ${state.profile.autoLockMinutes === 2 ? 'selected' : ''}>2 min</option>
              <option value="5" ${state.profile.autoLockMinutes === 5 ? 'selected' : ''}>5 min</option>
              <option value="10" ${state.profile.autoLockMinutes === 10 ? 'selected' : ''}>10 min</option>
              <option value="0" ${state.profile.autoLockMinutes === 0 ? 'selected' : ''}>Manual only</option>
            </select>
          </label>
        </div>
        <button type="submit" class="btn-secondary">${isEn ? 'Update PIN' : '更新 PIN 密码'}</button>
      </form>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>💾 ${isEn ? 'Local Storage & Backup' : '手机本地存储与备份安全'}</h3>
      </div>
      <div class="storage-meta-box">
        <div>IndexedDB · ${isEn ? `Used ~${estKb} KB` : `已用约 ${estKb} KB`} · ${persisted ? '<span class="text-green">Persistent</span>' : 'Standard'}</div>
      </div>
      <div class="backup-btn-grid">
        <button class="btn-primary" data-action="export-backup">📤 ${isEn ? 'Export Backup (.json)' : '导出完整备份 (.json)'}</button>
        <label class="btn-secondary file-btn">
          📥 ${isEn ? 'Import Backup' : '导入恢复备份'}
          <input type="file" accept=".json,application/json" data-action="import-backup" hidden/>
        </label>
      </div>
      <div class="danger-zone">
        <button class="btn-ghost-danger" data-action="open-setup-wizard">✨ ${isEn ? 'Setup Real Profile' : '新建真实个人档案'}</button>
        <button class="btn-ghost-danger" data-action="reset-demo">🔄 ${isEn ? 'Reset Demo Data' : '恢复示例体验数据'}</button>
        <button class="btn-ghost-danger" data-action="clear-all">🗑️ ${isEn ? 'Clear All' : '清空全部病历'}</button>
      </div>
    </section>

    <section class="edit-card">
      <div class="edit-card-head">
        <h3>📱 ${isEn ? 'Optional Offline QR Snapshot' : '可选：离线二维码分享'}</h3>
      </div>
      <label class="switch-row" style="margin-bottom: 10px;">
        <input type="checkbox" ${state.profile.maskNameOnShare ? 'checked' : ''} data-action="toggle-mask-name"/>
        <span>${isEn ? 'Mask full name in QR snapshot' : '生成二维码时隐藏全名（脱敏显示）'}</span>
      </label>
      <button class="btn-secondary" style="width:100%;" data-action="open-qr">${isEn ? 'Generate QR Code' : '生成 / 查看二维码'}</button>
    </section>
  `;
}
