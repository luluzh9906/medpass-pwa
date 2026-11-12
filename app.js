import {
  aiAutofillVisitCard,
  aiExtractBusinessCard,
  aiExtractLabReport,
  aiExtractMedBox,
  aiMatchIntakeForm,
  aiSummarizeDoctorVoice,
  downloadAppointmentIcs,
  getGeminiApiKey,
  localSummarizeDoctorTranscript,
  setGeminiApiKey
} from './ai.js';
import {
  exportBackupJson,
  getStorageEstimate,
  loadState,
  requestPersistentStorage,
  resetToDemoData,
  saveState,
  subscribeRemoteSync,
  validateImportedBackup
} from './db.js';
import { escapeHtml } from './charts.js';
import { decodeShareToken, encodeShareToken } from './codec.js';
import { fahrenheitToCelsius, ftInToCm, lbsToKg, mgdlToMmol } from './i18n.js';
import { answerDoctorQuery } from './qa.js';
import { generateQR, renderQRSvg } from './qrcode.js';
import { createBlankUserState } from './seed.js';
import { hashPin, verifyPin } from './security.js';
import { inferSpecialtyId, SPECIALTY_CATALOG } from './specialties.js';
import { renderDoctorView } from './views-doctor.js';
import { renderManageView } from './views-manage.js';

let deferredInstallPrompt = null;

const appState = {
  data: null,
  snapshotData: null,
  ui: {
    mode: 'doctor', // 'doctor' | 'manage' | 'snapshot'
    doctorSection: null, // null (home) | 'visit' | 'report' | 'symptoms' | 'meds' | 'weight' | 'vitals_labs' | 'history' | 'qa'
    doctorScope: 'auto', // 'auto' | 'all' | '<doctor>::<spec>'
    openFolds: {}, // foldKey -> boolean persisted across re-renders
    lang: 'zh',
    unitSystem: 'metric',
    weightRange: 90,
    selectedWeightIdx: null,
    doctorMedTab: 'all',
    manageTab: 'visit-vitals',
    quickVitalType: 'bp',
    weightInputUnit: 'kg',
    tempInputUnit: 'C',
    glucoseInputUnit: 'mmol',
    desktopFrame: true,
    storageStats: null,
    autoLockRemainingText: '',
    canInstallPrompt: false,
    showIosInstallTip: false,
    installBannerDismissed: false,
    qaInput: '',
    qaResult: null,
    qaHistory: [],
    pinModalOpen: false,
    pinBuffer: '',
    pinError: '',
    qrModalOpen: false,
    qrLoading: false,
    qrInfo: null,
    lightbox: null,
    stopMedModal: null,
    setupModalOpen: false,
    archiveVisitModalOpen: false,
    editModal: null, // { kind: 'symptom'|'med'|'condition'|'report', item }
    aiBusyLabel: '',
    businessCardModal: null,
    intakeResultModal: null,
    voiceModal: null
  }
};

let speechRecInstance = null;
let mediaRecorderInstance = null;
let mediaStreamInstance = null;
let recordTimerId = null;

let lastActivityTs = Date.now();
let autoLockTimerId = null;
let pendingCompressedImages = {};

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function showToast(msg, tone = 'info') {
  const existing = document.getElementById('toast-box');
  if (!existing) return;
  existing.innerHTML = '';
  const el = document.createElement('div');
  el.className = `toast-item toast-${tone}`;
  el.textContent = msg;
  existing.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 260);
  }, 2400);
}

async function compressImageFile(file, maxDim = 1280, quality = 0.78) {
  const origKb = Math.round(file.size / 1024);
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  const compressedUrl = canvas.toDataURL('image/jpeg', quality);
  const compKb = Math.round((compressedUrl.length * 3) / 4 / 1024);
  return { dataUrl: compressedUrl, origKb, compKb };
}

function resetIdleClock() {
  lastActivityTs = Date.now();
}

function startAutoLockWatcher() {
  if (autoLockTimerId) clearInterval(autoLockTimerId);
  autoLockTimerId = setInterval(() => {
    if (appState.ui.mode !== 'manage' || !appState.data) return;
    const mins = Number(appState.data.profile.autoLockMinutes ?? 5);
    if (!mins) {
      appState.ui.autoLockRemainingText = '';
      return;
    }
    const elapsedMs = Date.now() - lastActivityTs;
    const remainSec = Math.max(0, Math.ceil((mins * 60 * 1000 - elapsedMs) / 1000));
    if (remainSec <= 0) {
      appState.ui.mode = 'doctor';
      appState.ui.autoLockRemainingText = '';
      render();
      showToast(appState.ui.lang === 'en' ? 'Auto-locked back to Physician View' : '长时间未操作，已自动锁定回医生只读视图', 'info');
      return;
    }
    const mm = Math.floor(remainSec / 60);
    const ss = String(remainSec % 60).padStart(2, '0');
    const txt = appState.ui.lang === 'en' ? `Auto-lock ${mm}:${ss}` : `${mm}:${ss} 后自动回锁`;
    appState.ui.autoLockRemainingText = txt;
    const el = document.querySelector('.lock-countdown');
    if (el) el.textContent = txt;
  }, 1000);
}

async function handleHashRoute() {
  const hash = window.location.hash || '';
  if (hash.startsWith('#/s/')) {
    const token = hash.slice(4).trim();
    try {
      appState.snapshotData = await decodeShareToken(token);
      appState.ui.mode = 'snapshot';
      appState.ui.qrModalOpen = false;
      appState.ui.pinModalOpen = false;
    } catch (err) {
      showToast(err.message || '二维码链接解析失败', 'error');
      window.location.hash = '';
      appState.ui.mode = 'doctor';
    }
  } else if (appState.ui.mode === 'snapshot') {
    appState.snapshotData = null;
    appState.ui.mode = 'doctor';
  }
  render();
}

async function openQrModal() {
  appState.ui.qrModalOpen = true;
  appState.ui.qrLoading = true;
  render();

  try {
    const maskName = !!appState.data.profile.maskNameOnShare;
    const encoded = await encodeShareToken(appState.data, { maskName, includeHistory: true });
    const baseUrl = window.location.href.split('#')[0];
    const shareUrl = `${baseUrl}#/s/${encoded.token}`;
    const qr = generateQR(shareUrl, 'M');
    const svg = renderQRSvg(qr, 232, 3);
    appState.ui.qrInfo = {
      shareUrl,
      svg,
      version: qr.version,
      ecLevel: qr.ecLevel,
      rawBytes: encoded.rawBytes,
      compressedBytes: encoded.compressedBytes,
      urlBytes: qr.byteLength,
      attachmentCount: encoded.attachmentCount,
      maskName
    };
  } catch (err) {
    appState.ui.qrInfo = { error: err.message || '生成二维码失败' };
  } finally {
    appState.ui.qrLoading = false;
    render();
  }
}

async function commitData(mutatorFn, toastMsg = '已保存并同步更新', { preserveDemoFlag = false } = {}) {
  const clone = structuredClone(appState.data);
  mutatorFn(clone);
  if (!preserveDemoFlag) clone.isDemo = false;
  appState.data = await saveState(clone);
  appState.ui.storageStats = await getStorageEstimate();
  if (appState.ui.qaInput && appState.ui.qaResult) {
    appState.ui.qaResult = answerDoctorQuery(appState.ui.qaInput, appState.data, appState.ui.lang, appState.ui.unitSystem);
  }
  if (appState.ui.businessCardModal) {
    const bc = appState.ui.businessCardModal;
    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="bcard">
        <div class="modal-sheet wide-sheet">
          <div class="modal-head">
            <h3>🪪 ${isEn ? 'Scanned Physician / Appointment Card' : '名片 / 预约单识别结果'}</h3>
            <button class="modal-close" data-action="close-bcard-modal">✕</button>
          </div>
          <form class="stack-form" data-form="save-business-card">
            <div class="form-row-2">
              <label class="field">
                <span>${isEn ? 'Doctor Name' : '医生姓名'}</span>
                <input type="text" name="doctorName" value="${escapeHtml(bc.doctorName || '')}"/>
              </label>
              <label class="field">
                <span>${isEn ? 'Specialty' : '科室'}</span>
                <input type="text" name="department" value="${escapeHtml(bc.department || '')}"/>
              </label>
            </div>
            <input type="hidden" name="departmentEn" value="${escapeHtml(bc.departmentEn || '')}"/>
            <div class="form-row-2">
              <label class="field">
                <span>${isEn ? 'Clinic / Hospital' : '医院/诊所'}</span>
                <input type="text" name="clinicName" value="${escapeHtml(bc.clinicName || '')}"/>
              </label>
              <label class="field">
                <span>${isEn ? 'Phone' : '联系电话'}</span>
                <input type="text" name="phone" value="${escapeHtml(bc.phone || '')}"/>
              </label>
            </div>
            <label class="field">
              <span>${isEn ? 'Address' : '地址'}</span>
              <input type="text" name="address" value="${escapeHtml(bc.address || '')}"/>
            </label>
            <div class="form-row-2">
              <label class="field">
                <span>${isEn ? 'Appointment Date' : '预约日期'}</span>
                <input type="date" name="appointmentDate" value="${escapeHtml(bc.appointmentDate || '')}"/>
              </label>
              <label class="field">
                <span>${isEn ? 'Appointment Time' : '预约时间'}</span>
                <input type="time" name="appointmentTime" value="${escapeHtml(bc.appointmentTime || '')}"/>
              </label>
            </div>
            <label class="field">
              <span>${isEn ? 'Notes / Prep' : '备注 / 就诊前注意事项'}</span>
              <input type="text" name="notes" value="${escapeHtml(bc.notes || '')}"/>
            </label>
            <label class="switch-row">
              <input type="checkbox" name="updateVisit" checked/>
              <span>${isEn ? 'Apply to current Visit Card & Appointment' : '同步填入本次就诊卡（预约日期、时间与医生）'}</span>
            </label>
            <label class="switch-row">
              <input type="checkbox" name="saveContact" checked/>
              <span>${isEn ? 'Save to Physician Contacts' : '同时存入“医生名片夹”方便下次复用'}</span>
            </label>
            <label class="switch-row">
              <input type="checkbox" name="exportIcs"/>
              <span>${isEn ? 'Download Calendar Event (.ics)' : '保存后同时下载手机日历提醒 (.ics)'}</span>
            </label>
            <button type="submit" class="btn-primary">${isEn ? 'Confirm & Save' : '确认保存名片与就诊时间'}</button>
          </form>
        </div>
      </div>
    `);
  }

  if (appState.ui.intakeResultModal) {
    const ir = appState.ui.intakeResultModal;
    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="intake">
        <div class="modal-sheet wide-sheet">
          <div class="modal-head">
            <h3>📝 ${escapeHtml(ir.formTitle || (isEn ? 'Auto-Filled Intake Form' : '就诊卡自动代填结果'))}</h3>
            <button class="modal-close" data-action="close-intake-modal">✕</button>
          </div>
          <p class="pin-desc">${isEn ? 'Filled strictly from your saved personal profile. Missing fields are flagged rather than guessed.' : '以下内容严格根据你已保存的全部档案自动填入；档案中缺少的字段会明确标出，请现场手动补充。'}</p>
          <div class="intake-fields-list">
            ${(ir.fields || [])
              .map(
                (f) => `
              <div class="intake-field-row ${f.status === 'missing' ? 'intake-missing' : ''}">
                <div class="intake-field-head">
                  <strong>${escapeHtml(f.label)}</strong>
                  <span class="${f.status === 'missing' ? 'qa-unk-tag' : 'qa-src-tag'}">${escapeHtml(f.source || (f.status === 'missing' ? '未记录' : '已匹配'))}</span>
                </div>
                <div class="intake-field-val">${escapeHtml(f.value)}</div>
              </div>
            `
              )
              .join('')}
          </div>
          <button type="button" class="btn-primary" style="width:100%;margin-top:10px;" data-action="copy-intake-all">📋 ${isEn ? 'Copy All Filled Fields' : '一键复制全部代填结果'}</button>
        </div>
      </div>
    `);
  }

  if (appState.ui.voiceModal) {
    const vm = appState.ui.voiceModal;
    const hasSpeechApi = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const hasMediaRec = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
    const hasKey = !!getGeminiApiKey();
    const d = vm.draft;

    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="voice">
        <div class="modal-sheet wide-sheet">
          <div class="modal-head">
            <h3>🎙️ ${isEn ? 'Physician Voice Summary → Visit Report' : '医生语音总结 → 自动生成就医报告'}</h3>
            <button class="modal-close" data-action="close-voice-modal">✕</button>
          </div>
          <p class="pin-desc">${isEn ? 'Dictate assessment, med changes, tests, and follow-up—auto-summarized strictly from what is spoken.' : '医生口述诊断、调药、检查和复诊注意事项，自动整理进本次就医报告（仅据实整理口述内容）。'}</p>

          <div class="voice-controls-row">
            <select class="voice-lang-sel" data-action="voice-lang-change">
              <option value="zh-CN" ${vm.speechLang === 'zh-CN' ? 'selected' : ''}>普通话听写</option>
              <option value="en-US" ${vm.speechLang === 'en-US' ? 'selected' : ''}>English Dictation</option>
            </select>
            ${
              hasSpeechApi
                ? `<button type="button" class="btn-rec ${vm.isDictating ? 'recording' : ''}" data-action="toggle-speech-dictation">
                    ${vm.isDictating ? (isEn ? '⏹ Stop Dictation' : '⏹ 停止听写') : (isEn ? '🎙️ Live Dictate' : '🎙️ 实时语音转字')}
                  </button>`
                : ''
            }
            ${
              hasMediaRec
                ? `<button type="button" class="btn-rec ${vm.isRecordingAudio ? 'recording' : ''}" data-action="toggle-audio-record">
                    ${vm.isRecordingAudio ? `⏹ ${isEn ? 'Stop' : '停止录音'} (${vm.recordSeconds}s)` : (isEn ? '🔴 Record Audio' : '🔴 录音直传AI')}
                  </button>`
                : ''
            }
            <button type="button" class="btn-mini" data-action="fill-sample-voice">🪄 ${isEn ? 'Sample' : '示例口述'}</button>
          </div>

          ${
            vm.audioDataUrl
              ? `<div class="voice-audio-preview">
                  <audio controls src="${vm.audioDataUrl}" style="width:100%;height:34px;"></audio>
                </div>`
              : ''
          }

          <label class="field" style="margin-top:8px;">
            <span>${isEn ? 'Spoken Transcript (or type / use phone keyboard mic)' : '医生口述原文（可实时转写、修改或用手机键盘麦克风听写）'}</span>
            <textarea id="voice-transcript-input" rows="3" placeholder="${isEn ? 'Dictate or paste what the physician said...' : '例如：考虑优甲乐过量引起的亚临床甲亢，建议从50微克减到25微克每天一次...'}">${escapeHtml(vm.transcript || '')}</textarea>
          </label>

          <div class="voice-gen-row">
            <button type="button" class="btn-primary" style="flex:1;" data-action="summarize-voice" ${vm.summarizing ? 'disabled' : ''}>
              ${vm.summarizing ? (isEn ? '⏳ Summarizing...' : '⏳ 正在整理就医报告...') : (isEn ? '✨ Summarize into Visit Report' : '✨ 自动总结进就医报告')}
            </button>
          </div>
          <div class="muted-xs" style="margin-top:4px;">
            ${hasKey ? (isEn ? 'Powered by Gemini 2.5 Flash (supports bilingual audio & text).' : '已启用 Gemini 智能整理（支持中英混说录音直转与双语总结）。') : (isEn ? 'Offline local summarizer active (add Gemini API Key for direct audio transcription & bilingual output).' : '当前未配 API Key，将使用本机离线规则自动分段整理（配置 Key 后可支持直接录音总结）。')}
          </div>

          ${
            d
              ? `<form class="stack-form vr-draft-form" data-form="save-visit-report">
                  <div class="sub-label" style="margin-top:10px;">📋 ${isEn ? 'Structured Visit Report Preview (Editable)' : '结构化就医报告预览（可直接微调后保存）'}</div>
                  <label class="field">
                    <span>${isEn ? 'Assessment / Diagnosis' : '诊断与评估'}</span>
                    <input type="text" name="diagnosis" value="${escapeHtml(d.diagnosis || '')}"/>
                  </label>
                  <label class="field">
                    <span>${isEn ? 'Medication Plan' : '用药调整方案'}</span>
                    <input type="text" name="medPlan" value="${escapeHtml(d.medPlan || '')}"/>
                  </label>
                  <label class="field">
                    <span>${isEn ? 'Ordered Tests / Labs' : '检查 / 化验安排'}</span>
                    <input type="text" name="testsPlan" value="${escapeHtml(d.testsPlan || '')}"/>
                  </label>
                  <label class="field">
                    <span>${isEn ? 'Follow-Up & Return Precautions' : '复诊计划与注意事项'}</span>
                    <textarea name="followUp" rows="2">${escapeHtml(d.followUp || '')}</textarea>
                  </label>
                  <div class="form-row-2">
                    <label class="field">
                      <span>${isEn ? 'Suggested Follow-Up Date' : '建议复诊日期（可选）'}</span>
                      <input type="date" name="nextFollowUpDate" value="${escapeHtml(d.nextFollowUpDate || '')}"/>
                    </label>
                    <label class="field">
                      <span>${isEn ? 'Attending Physician' : '主诊医生'}</span>
                      <input type="text" name="doctorName" value="${escapeHtml(appState.data.visit?.doctorName || '')}"/>
                    </label>
                  </div>
                  <label class="field">
                    <span>${isEn ? 'Patient Key Takeaway' : '通俗核心要点'}</span>
                    <input type="text" name="patientTakeaway" value="${escapeHtml(d.patientTakeaway || '')}"/>
                  </label>
                  <button type="submit" class="btn-primary">✅ ${isEn ? 'Save to Visit Report' : '保存至本次就医报告'}</button>
                </form>`
              : ''
          }
        </div>
      </div>
    `);
  }

  if (appState.ui.qrModalOpen) {
    await openQrModal();
  } else {
    render();
  }
  if (toastMsg) showToast(toastMsg, 'success');
}

function runQa(questionText) {
  const activeState = appState.ui.mode === 'snapshot' && appState.snapshotData ? appState.snapshotData : appState.data;
  const result = answerDoctorQuery(questionText, activeState, appState.ui.lang, appState.ui.unitSystem);
  appState.ui.qaInput = questionText;
  appState.ui.qaResult = result;
  if (result) {
    appState.ui.qaHistory = [result, ...appState.ui.qaHistory.filter((h) => h.question !== result.question)].slice(0, 6);
  }
  render();
}

function stopActiveVoiceSessions() {
  if (speechRecInstance) {
    try {
      speechRecInstance.stop();
    } catch {
      // Ignore
    }
    speechRecInstance = null;
  }
  if (mediaRecorderInstance && mediaRecorderInstance.state !== 'inactive') {
    try {
      mediaRecorderInstance.stop();
    } catch {
      // Ignore
    }
  }
  if (mediaStreamInstance) {
    mediaStreamInstance.getTracks().forEach((t) => t.stop());
    mediaStreamInstance = null;
  }
  if (recordTimerId) {
    clearInterval(recordTimerId);
    recordTimerId = null;
  }
}

function renderEditModalBody(editModal, isEn) {
  const { kind, item } = editModal;
  if (kind === 'symptom') {
    return `
      <form class="stack-form" data-form="save-edit-item">
        <input type="hidden" name="kind" value="symptom"/>
        <input type="hidden" name="id" value="${item.id}"/>
        <label class="field">
          <span>${isEn ? 'Symptom Name' : '症状名称'}</span>
          <input type="text" name="name" value="${escapeHtml(item.name || '')}" required/>
        </label>
        <label class="field">
          <span>${isEn ? 'English Name (optional)' : '英文名称（可选）'}</span>
          <input type="text" name="nameEn" value="${escapeHtml(item.nameEn || '')}"/>
        </label>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Duration' : '持续时间'}</span>
            <input type="text" name="durationText" value="${escapeHtml(item.durationText || '')}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Severity' : '严重程度'}</span>
            <select name="severity">
              <option value="mild" ${item.severity === 'mild' ? 'selected' : ''}>${isEn ? 'Mild' : '轻度'}</option>
              <option value="moderate" ${item.severity === 'moderate' ? 'selected' : ''}>${isEn ? 'Moderate' : '中度'}</option>
              <option value="severe" ${item.severity === 'severe' ? 'selected' : ''}>${isEn ? 'Severe' : '重度'}</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>${isEn ? 'Details / Notes' : '详细描述'}</span>
          <textarea name="notes" rows="2">${escapeHtml(item.notes || '')}</textarea>
        </label>
        <label class="field">
          <span>${isEn ? 'Details (English, optional)' : '英文详细描述（可选）'}</span>
          <input type="text" name="notesEn" value="${escapeHtml(item.notesEn || '')}"/>
        </label>
        <button type="submit" class="btn-primary">${isEn ? 'Save Changes' : '保存修改'}</button>
      </form>
    `;
  }
  if (kind === 'med') {
    return `
      <form class="stack-form" data-form="save-edit-item">
        <input type="hidden" name="kind" value="med"/>
        <input type="hidden" name="id" value="${item.id}"/>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Medication Name' : '药物名称'}</span>
            <input type="text" name="name" value="${escapeHtml(item.name || '')}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'English Name (optional)' : '英文药名（可选）'}</span>
            <input type="text" name="nameEn" value="${escapeHtml(item.nameEn || '')}"/>
          </label>
        </div>
        <div class="form-row-3">
          <label class="field">
            <span>${isEn ? 'Dose' : '剂量'}</span>
            <input type="text" name="dosage" value="${escapeHtml(item.dosage || '')}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Frequency' : '频次'}</span>
            <input type="text" name="frequency" value="${escapeHtml(item.frequency || '')}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Type' : '类型'}</span>
            <select name="category">
              <option value="rx" ${item.category !== 'otc' ? 'selected' : ''}>Rx</option>
              <option value="otc" ${item.category === 'otc' ? 'selected' : ''}>OTC</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>${isEn ? 'Last Dose Taken' : '末次服药'}</span>
          <input type="text" name="lastTaken" value="${escapeHtml(item.lastTaken || '')}"/>
        </label>
        <label class="field">
          <span>${isEn ? 'Notes' : '备注'}</span>
          <input type="text" name="notes" value="${escapeHtml(item.notes || '')}"/>
        </label>
        <button type="submit" class="btn-primary">${isEn ? 'Save Changes' : '保存药物修改'}</button>
      </form>
    `;
  }
  if (kind === 'condition') {
    return `
      <form class="stack-form" data-form="save-edit-item">
        <input type="hidden" name="kind" value="condition"/>
        <input type="hidden" name="id" value="${item.id}"/>
        <label class="field">
          <span>${isEn ? 'Condition' : '疾病名称'}</span>
          <input type="text" name="name" value="${escapeHtml(item.name || '')}" required/>
        </label>
        <label class="field">
          <span>${isEn ? 'English Name (optional)' : '英文名称（可选）'}</span>
          <input type="text" name="nameEn" value="${escapeHtml(item.nameEn || '')}"/>
        </label>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Year' : '确诊年份'}</span>
            <input type="text" name="diagnosedYear" value="${escapeHtml(item.diagnosedYear || '')}"/>
          </label>
          <label class="field">
            <span>${isEn ? 'Status' : '当前状态'}</span>
            <input type="text" name="status" value="${escapeHtml(item.status || '')}"/>
          </label>
        </div>
        <label class="field">
          <span>${isEn ? 'Note' : '备注'}</span>
          <input type="text" name="note" value="${escapeHtml(item.note || '')}"/>
        </label>
        <button type="submit" class="btn-primary">${isEn ? 'Save Changes' : '保存病史修改'}</button>
      </form>
    `;
  }
  if (kind === 'exam') {
    return `
      <form class="stack-form" data-form="save-edit-item">
        <input type="hidden" name="kind" value="exam"/>
        <input type="hidden" name="id" value="${item.id}"/>
        <div class="form-row-2">
          <label class="field">
            <span>${isEn ? 'Date' : '检查日期'}</span>
            <input type="date" name="date" value="${escapeHtml(item.date || '')}" required/>
          </label>
          <label class="field">
            <span>${isEn ? 'Flag' : '结果标识'}</span>
            <select name="isAbnormal">
              <option value="false" ${!item.isAbnormal ? 'selected' : ''}>${isEn ? 'Normal / Benign' : '正常 / 良性'}</option>
              <option value="true" ${item.isAbnormal ? 'selected' : ''}>${isEn ? 'Abnormal' : '有异常'}</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>${isEn ? 'Exam Name' : '检查名称'}</span>
          <input type="text" name="name" value="${escapeHtml(item.name || '')}" required/>
        </label>
        <label class="field">
          <span>${isEn ? 'English Name (optional)' : '英文名称（可选）'}</span>
          <input type="text" name="nameEn" value="${escapeHtml(item.nameEn || '')}"/>
        </label>
        <label class="field">
          <span>${isEn ? 'Hospital / Facility' : '检查机构'}</span>
          <input type="text" name="facility" value="${escapeHtml(item.facility || '')}"/>
        </label>
        <label class="field">
          <span>${isEn ? 'Findings / Impression' : '检查结论'}</span>
          <textarea name="resultSummary" rows="2">${escapeHtml(item.resultSummary || '')}</textarea>
        </label>
        <button type="submit" class="btn-primary">${isEn ? 'Save Changes' : '保存检查修改'}</button>
      </form>
    `;
  }
  return `
    <form class="stack-form" data-form="save-edit-item">
      <input type="hidden" name="kind" value="report"/>
      <input type="hidden" name="id" value="${item.id}"/>
      <div class="form-row-2">
        <label class="field">
          <span>${isEn ? 'Date' : '检查日期'}</span>
          <input type="date" name="date" value="${escapeHtml(item.date || '')}" required/>
        </label>
        <label class="field">
          <span>${isEn ? 'Flag' : '异常标识'}</span>
          <select name="isAbnormal">
            <option value="true" ${item.isAbnormal ? 'selected' : ''}>${isEn ? 'Abnormal' : '有异常'}</option>
            <option value="false" ${!item.isAbnormal ? 'selected' : ''}>${isEn ? 'Normal' : '正常'}</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span>${isEn ? 'Report Title' : '报告名称'}</span>
        <input type="text" name="title" value="${escapeHtml(item.title || '')}" required/>
      </label>
      <label class="field">
        <span>${isEn ? 'Key Values Summary' : '关键指标摘录'}</span>
        <textarea name="summaryHighlight" rows="2">${escapeHtml(item.summaryHighlight || '')}</textarea>
      </label>
      <button type="submit" class="btn-primary">${isEn ? 'Save Changes' : '保存报告修改'}</button>
    </form>
  `;
}

function renderModals() {
  const isEn = appState.ui.lang === 'en';
  const parts = [];

  if (appState.ui.pinModalOpen) {
    const dots = [0, 1, 2, 3].map((i) => `<span class="pin-dot ${i < appState.ui.pinBuffer.length ? 'filled' : ''}"></span>`);
    const extraDots =
      appState.ui.pinBuffer.length > 4
        ? Array.from({ length: appState.ui.pinBuffer.length - 4 }, () => `<span class="pin-dot filled"></span>`).join('')
        : '';

    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="pin">
        <div class="modal-sheet pin-sheet">
          <div class="modal-head">
            <h3>🔒 ${isEn ? 'Enter PIN to Edit' : '输入解锁码进入个人端'}</h3>
            <button class="modal-close" data-action="close-pin-modal">✕</button>
          </div>
          <p class="pin-desc">${isEn ? 'Prevents accidental edits by physician.' : '防止医生浏览时误触修改。'}${appState.data?.isDemo ? (isEn ? ' <strong>Demo PIN: 1234</strong>' : ' <strong>示例默认密码：1234</strong>') : ''}</p>
          <div class="pin-dots">${dots.join('')}${extraDots}</div>
          ${appState.ui.pinError ? `<div class="pin-error">${escapeHtml(appState.ui.pinError)}</div>` : '<div class="pin-error"></div>'}
          <div class="keypad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key-btn" data-action="pin-digit" data-digit="${n}">${n}</button>`).join('')}
            <button class="key-btn key-muted" data-action="pin-clear">${isEn ? 'Clear' : '清空'}</button>
            <button class="key-btn" data-action="pin-digit" data-digit="0">0</button>
            <button class="key-btn key-muted" data-action="pin-back">⌫</button>
          </div>
          ${
            appState.ui.pinBuffer.length >= 4
              ? `<button class="btn-primary" style="width:100%;margin-top:10px;" data-action="pin-submit">${isEn ? 'Unlock' : '确认解锁'}</button>`
              : ''
          }
        </div>
      </div>
    `);
  }

  if (appState.ui.setupModalOpen) {
    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="setup">
        <div class="modal-sheet wide-sheet">
          <div class="modal-head">
            <h3>✨ ${isEn ? 'Create My Real Health Profile' : '创建我的真实健康档案'}</h3>
            <button class="modal-close" data-action="close-setup-modal">✕</button>
          </div>
          <p class="pin-desc">${isEn ? 'Clears sample data and initializes your private local profile.' : '将清空示例体验数据，初始化属于你自己的本地加密健康档案。'}</p>
          <form class="stack-form" data-form="complete-setup">
            <div class="form-row-2">
              <label class="field">
                <span>${isEn ? 'Your Name' : '姓名/称呼'}</span>
                <input type="text" name="name" placeholder="${isEn ? 'e.g. Wei Zhang' : '例如：张明'}" required/>
              </label>
              <label class="field">
                <span>${isEn ? 'English Name (for US MD)' : '英文名（可选，美国医生核对用）'}</span>
                <input type="text" name="nameEn" placeholder="e.g. Ming Zhang"/>
              </label>
            </div>
            <div class="form-row-3">
              <label class="field">
                <span>${isEn ? 'DOB' : '出生日期 (DOB)'}</span>
                <input type="date" name="dob" required/>
              </label>
              <label class="field">
                <span>${isEn ? 'Sex' : '性别'}</span>
                <select name="gender">
                  <option value="女">女 / Female</option>
                  <option value="男">男 / Male</option>
                  <option value="其他">其他 / Other</option>
                </select>
              </label>
              <label class="field">
                <span>${isEn ? 'Height (cm)' : '身高 (cm)'}</span>
                <input type="number" name="heightCm" min="50" max="240" placeholder="168"/>
              </label>
            </div>
            <label class="field">
              <span>${isEn ? 'Drug/Food Allergies (leave blank if NKDA)' : '过敏史（无已知过敏可留空，每行1项）'}</span>
              <textarea name="allergies" rows="2" placeholder="${isEn ? 'e.g. Penicillin allergy' : '例如：青霉素类过敏'}"></textarea>
            </label>
            <label class="field">
              <span>${isEn ? 'Preferred Pharmacy (optional)' : '常用药房（美国看诊可选填）'}</span>
              <input type="text" name="pharmacy" placeholder="e.g. CVS #4821 or Walgreens"/>
            </label>
            <label class="field">
              <span>${isEn ? 'Set Your Personal PIN (4–6 digits)' : '设置你的防误触解锁 PIN 码（4~6位数字）'}</span>
              <input type="password" inputmode="numeric" pattern="\\d{4,6}" name="pin" placeholder="例如：2580" required/>
            </label>
            <button type="submit" class="btn-primary">${isEn ? 'Start My Health Record' : '清空示例并启用我的档案'}</button>
          </form>
        </div>
      </div>
    `);
  }

  if (appState.ui.archiveVisitModalOpen) {
    const v = appState.data.visit || {};
    const vr = v.visitReport;
    const prefillNotes = vr
      ? [vr.diagnosis, vr.medPlan, vr.testsPlan, vr.followUp].filter(Boolean).join('；')
      : '';
    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="archive">
        <div class="modal-sheet wide-sheet">
          <div class="modal-head">
            <h3>📁 ${isEn ? 'Archive Completed Visit' : '归档本次就诊记录'}</h3>
            <button class="modal-close" data-action="close-archive-modal">✕</button>
          </div>
          <p class="pin-desc">${isEn ? 'Save the doctor’s conclusion to Prior Visits and prepare a clean slate for your next appointment.' : '将本次就诊结论和医嘱保存至“过往就诊记录”，方便下次复诊快速回顾。'}</p>
          <form class="stack-form" data-form="confirm-archive-visit">
            <label class="field">
              <span>${isEn ? 'Visit Date' : '就诊日期'}</span>
              <input type="date" name="date" value="${escapeHtml(v.visitDate || new Date().toISOString().slice(0, 10))}" required/>
            </label>
            <label class="field">
              <span>${isEn ? 'Doctor’s Diagnosis / Plan / Follow-up Notes' : '医生诊断结论与后续医嘱'}</span>
              <textarea name="doctorNotes" rows="3" placeholder="${isEn ? 'e.g. Reduced levothyroxine to 25 mcg daily; recheck TSH in 6 weeks.' : '例如：优甲乐减量至 25μg/日，6周后复查甲功五项及心电图。'}" required>${escapeHtml(prefillNotes)}</textarea>
            </label>
            <label class="switch-row">
              <input type="checkbox" name="resetCurrentVisit" checked/>
              <span>${isEn ? 'Clear current visit purpose/questions for next visit' : '同时清空本次就诊目的，准备下一次就诊'}</span>
            </label>
            <button type="submit" class="btn-primary">${isEn ? 'Archive Visit' : '确认归档本次就诊'}</button>
          </form>
        </div>
      </div>
    `);
  }

  if (appState.ui.editModal) {
    const titleMap = {
      symptom: isEn ? 'Edit Symptom' : '编辑症状记录',
      med: isEn ? 'Edit Medication' : '编辑用药记录',
      condition: isEn ? 'Edit Condition' : '编辑病史记录',
      report: isEn ? 'Edit Diagnostic Report' : '编辑检查报告',
      exam: isEn ? 'Edit Past Exam' : '编辑既往检查记录'
    };
    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="edit">
        <div class="modal-sheet wide-sheet">
          <div class="modal-head">
            <h3>✏️ ${titleMap[appState.ui.editModal.kind] || 'Edit'}</h3>
            <button class="modal-close" data-action="close-edit-modal">✕</button>
          </div>
          ${renderEditModalBody(appState.ui.editModal, isEn)}
        </div>
      </div>
    `);
  }

  if (appState.ui.businessCardModal) {
    const bc = appState.ui.businessCardModal;
    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="bcard">
        <div class="modal-sheet wide-sheet">
          <div class="modal-head">
            <h3>🪪 ${isEn ? 'Scanned Physician / Appointment Card' : '名片 / 预约单识别结果'}</h3>
            <button class="modal-close" data-action="close-bcard-modal">✕</button>
          </div>
          <form class="stack-form" data-form="save-business-card">
            <div class="form-row-2">
              <label class="field">
                <span>${isEn ? 'Doctor Name' : '医生姓名'}</span>
                <input type="text" name="doctorName" value="${escapeHtml(bc.doctorName || '')}"/>
              </label>
              <label class="field">
                <span>${isEn ? 'Specialty' : '科室'}</span>
                <input type="text" name="department" value="${escapeHtml(bc.department || '')}"/>
              </label>
            </div>
            <input type="hidden" name="departmentEn" value="${escapeHtml(bc.departmentEn || '')}"/>
            <div class="form-row-2">
              <label class="field">
                <span>${isEn ? 'Clinic / Hospital' : '医院/诊所'}</span>
                <input type="text" name="clinicName" value="${escapeHtml(bc.clinicName || '')}"/>
              </label>
              <label class="field">
                <span>${isEn ? 'Phone' : '联系电话'}</span>
                <input type="text" name="phone" value="${escapeHtml(bc.phone || '')}"/>
              </label>
            </div>
            <label class="field">
              <span>${isEn ? 'Address' : '地址'}</span>
              <input type="text" name="address" value="${escapeHtml(bc.address || '')}"/>
            </label>
            <div class="form-row-2">
              <label class="field">
                <span>${isEn ? 'Appointment Date' : '预约日期'}</span>
                <input type="date" name="appointmentDate" value="${escapeHtml(bc.appointmentDate || '')}"/>
              </label>
              <label class="field">
                <span>${isEn ? 'Appointment Time' : '预约时间'}</span>
                <input type="time" name="appointmentTime" value="${escapeHtml(bc.appointmentTime || '')}"/>
              </label>
            </div>
            <label class="field">
              <span>${isEn ? 'Notes / Prep' : '备注 / 就诊前注意事项'}</span>
              <input type="text" name="notes" value="${escapeHtml(bc.notes || '')}"/>
            </label>
            <label class="switch-row">
              <input type="checkbox" name="updateVisit" checked/>
              <span>${isEn ? 'Apply to current Visit Card & Appointment' : '同步填入本次就诊卡（预约日期、时间与医生）'}</span>
            </label>
            <label class="switch-row">
              <input type="checkbox" name="saveContact" checked/>
              <span>${isEn ? 'Save to Physician Contacts' : '同时存入“医生名片夹”方便下次复用'}</span>
            </label>
            <label class="switch-row">
              <input type="checkbox" name="exportIcs"/>
              <span>${isEn ? 'Download Calendar Event (.ics)' : '保存后同时下载手机日历提醒 (.ics)'}</span>
            </label>
            <button type="submit" class="btn-primary">${isEn ? 'Confirm & Save' : '确认保存名片与就诊时间'}</button>
          </form>
        </div>
      </div>
    `);
  }

  if (appState.ui.intakeResultModal) {
    const ir = appState.ui.intakeResultModal;
    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="intake">
        <div class="modal-sheet wide-sheet">
          <div class="modal-head">
            <h3>📝 ${escapeHtml(ir.formTitle || (isEn ? 'Auto-Filled Intake Form' : '就诊卡自动代填结果'))}</h3>
            <button class="modal-close" data-action="close-intake-modal">✕</button>
          </div>
          <p class="pin-desc">${isEn ? 'Filled strictly from your saved personal profile. Missing fields are flagged rather than guessed.' : '以下内容严格根据你已保存的全部档案自动填入；档案中缺少的字段会明确标出，请现场手动补充。'}</p>
          <div class="intake-fields-list">
            ${(ir.fields || [])
              .map(
                (f) => `
              <div class="intake-field-row ${f.status === 'missing' ? 'intake-missing' : ''}">
                <div class="intake-field-head">
                  <strong>${escapeHtml(f.label)}</strong>
                  <span class="${f.status === 'missing' ? 'qa-unk-tag' : 'qa-src-tag'}">${escapeHtml(f.source || (f.status === 'missing' ? '未记录' : '已匹配'))}</span>
                </div>
                <div class="intake-field-val">${escapeHtml(f.value)}</div>
              </div>
            `
              )
              .join('')}
          </div>
          <button type="button" class="btn-primary" style="width:100%;margin-top:10px;" data-action="copy-intake-all">📋 ${isEn ? 'Copy All Filled Fields' : '一键复制全部代填结果'}</button>
        </div>
      </div>
    `);
  }

  if (appState.ui.voiceModal) {
    const vm = appState.ui.voiceModal;
    const hasSpeechApi = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const hasMediaRec = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
    const hasKey = !!getGeminiApiKey();
    const d = vm.draft;

    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="voice">
        <div class="modal-sheet wide-sheet">
          <div class="modal-head">
            <h3>🎙️ ${isEn ? 'Physician Voice Summary → Visit Report' : '医生语音总结 → 自动生成就医报告'}</h3>
            <button class="modal-close" data-action="close-voice-modal">✕</button>
          </div>
          <p class="pin-desc">${isEn ? 'Dictate assessment, med changes, tests, and follow-up—auto-summarized strictly from what is spoken.' : '医生口述诊断、调药、检查和复诊注意事项，自动整理进本次就医报告（仅据实整理口述内容）。'}</p>

          <div class="voice-controls-row">
            <select class="voice-lang-sel" data-action="voice-lang-change">
              <option value="zh-CN" ${vm.speechLang === 'zh-CN' ? 'selected' : ''}>普通话听写</option>
              <option value="en-US" ${vm.speechLang === 'en-US' ? 'selected' : ''}>English Dictation</option>
            </select>
            ${
              hasSpeechApi
                ? `<button type="button" class="btn-rec ${vm.isDictating ? 'recording' : ''}" data-action="toggle-speech-dictation">
                    ${vm.isDictating ? (isEn ? '⏹ Stop Dictation' : '⏹ 停止听写') : (isEn ? '🎙️ Live Dictate' : '🎙️ 实时语音转字')}
                  </button>`
                : ''
            }
            ${
              hasMediaRec
                ? `<button type="button" class="btn-rec ${vm.isRecordingAudio ? 'recording' : ''}" data-action="toggle-audio-record">
                    ${vm.isRecordingAudio ? `⏹ ${isEn ? 'Stop' : '停止录音'} (${vm.recordSeconds}s)` : (isEn ? '🔴 Record Audio' : '🔴 录音直传AI')}
                  </button>`
                : ''
            }
            <button type="button" class="btn-mini" data-action="fill-sample-voice">🪄 ${isEn ? 'Sample' : '示例口述'}</button>
          </div>

          ${
            vm.audioDataUrl
              ? `<div class="voice-audio-preview">
                  <audio controls src="${vm.audioDataUrl}" style="width:100%;height:34px;"></audio>
                </div>`
              : ''
          }

          <label class="field" style="margin-top:8px;">
            <span>${isEn ? 'Spoken Transcript (or type / use phone keyboard mic)' : '医生口述原文（可实时转写、修改或用手机键盘麦克风听写）'}</span>
            <textarea id="voice-transcript-input" rows="3" placeholder="${isEn ? 'Dictate or paste what the physician said...' : '例如：考虑优甲乐过量引起的亚临床甲亢，建议从50微克减到25微克每天一次...'}">${escapeHtml(vm.transcript || '')}</textarea>
          </label>

          <div class="voice-gen-row">
            <button type="button" class="btn-primary" style="flex:1;" data-action="summarize-voice" ${vm.summarizing ? 'disabled' : ''}>
              ${vm.summarizing ? (isEn ? '⏳ Summarizing...' : '⏳ 正在整理就医报告...') : (isEn ? '✨ Summarize into Visit Report' : '✨ 自动总结进就医报告')}
            </button>
          </div>
          <div class="muted-xs" style="margin-top:4px;">
            ${hasKey ? (isEn ? 'Powered by Gemini 2.5 Flash (supports bilingual audio & text).' : '已启用 Gemini 智能整理（支持中英混说录音直转与双语总结）。') : (isEn ? 'Offline local summarizer active (add Gemini API Key for direct audio transcription & bilingual output).' : '当前未配 API Key，将使用本机离线规则自动分段整理（配置 Key 后可支持直接录音总结）。')}
          </div>

          ${
            d
              ? `<form class="stack-form vr-draft-form" data-form="save-visit-report">
                  <div class="sub-label" style="margin-top:10px;">📋 ${isEn ? 'Structured Visit Report Preview (Editable)' : '结构化就医报告预览（可直接微调后保存）'}</div>
                  <label class="field">
                    <span>${isEn ? 'Assessment / Diagnosis' : '诊断与评估'}</span>
                    <input type="text" name="diagnosis" value="${escapeHtml(d.diagnosis || '')}"/>
                  </label>
                  <label class="field">
                    <span>${isEn ? 'Medication Plan' : '用药调整方案'}</span>
                    <input type="text" name="medPlan" value="${escapeHtml(d.medPlan || '')}"/>
                  </label>
                  <label class="field">
                    <span>${isEn ? 'Ordered Tests / Labs' : '检查 / 化验安排'}</span>
                    <input type="text" name="testsPlan" value="${escapeHtml(d.testsPlan || '')}"/>
                  </label>
                  <label class="field">
                    <span>${isEn ? 'Follow-Up & Return Precautions' : '复诊计划与注意事项'}</span>
                    <textarea name="followUp" rows="2">${escapeHtml(d.followUp || '')}</textarea>
                  </label>
                  <div class="form-row-2">
                    <label class="field">
                      <span>${isEn ? 'Suggested Follow-Up Date' : '建议复诊日期（可选）'}</span>
                      <input type="date" name="nextFollowUpDate" value="${escapeHtml(d.nextFollowUpDate || '')}"/>
                    </label>
                    <label class="field">
                      <span>${isEn ? 'Attending Physician' : '主诊医生'}</span>
                      <input type="text" name="doctorName" value="${escapeHtml(appState.data.visit?.doctorName || '')}"/>
                    </label>
                  </div>
                  <label class="field">
                    <span>${isEn ? 'Patient Key Takeaway' : '通俗核心要点'}</span>
                    <input type="text" name="patientTakeaway" value="${escapeHtml(d.patientTakeaway || '')}"/>
                  </label>
                  <button type="submit" class="btn-primary">✅ ${isEn ? 'Save to Visit Report' : '保存至本次就医报告'}</button>
                </form>`
              : ''
          }
        </div>
      </div>
    `);
  }

  if (appState.ui.qrModalOpen) {
    const info = appState.ui.qrInfo;
    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="qr">
        <div class="modal-sheet qr-sheet">
          <div class="modal-head">
            <h3>📱 ${isEn ? 'Physician QR Summary' : '医生扫码查看病历摘要'}</h3>
            <button class="modal-close" data-action="close-qr-modal">✕</button>
          </div>
          ${
            appState.ui.qrLoading
              ? `<div class="empty-box">${isEn ? 'Generating QR code...' : '正在压缩编码生成二维码...'}</div>`
              : info?.error
                ? `<div class="clinical-alert-strip">${escapeHtml(info.error)}</div>`
                : info
                  ? `
                    <div class="qr-card-frame">
                      <div class="qr-svg-wrap">${info.svg}</div>
                      <div class="qr-caption">${isEn ? 'Scan with camera to open read-only summary' : '请医生使用手机相机或微信扫一扫'}</div>
                    </div>
                    <div class="qr-stats tabular">
                      <span>${info.rawBytes} B → ${info.compressedBytes} B</span>
                      <span>QR V${info.version} (${info.ecLevel})</span>
                    </div>
                    <label class="switch-row" style="margin: 8px 0;">
                      <input type="checkbox" ${appState.data.profile.maskNameOnShare ? 'checked' : ''} data-action="toggle-mask-name"/>
                      <span>${isEn ? 'Mask patient full name' : '隐藏患者全名（脱敏显示）'}</span>
                    </label>
                    <div class="qr-actions">
                      <button class="btn-primary" data-action="open-qr-preview">🔗 ${isEn ? 'Preview Scanned View in New Tab' : '模拟医生扫码在新标签打开'}</button>
                      <button class="btn-secondary" data-action="copy-qr-link">📋 ${isEn ? 'Copy Read-Only Link' : '复制只读分享链接'}</button>
                    </div>
                  `
                  : ''
          }
        </div>
      </div>
    `);
  }

  if (appState.ui.lightbox) {
    parts.push(`
      <div class="modal-backdrop lightbox-bg" data-backdrop-close="lightbox">
        <div class="lightbox-card">
          <div class="lightbox-head">
            <span>${escapeHtml(appState.ui.lightbox.title || 'Preview')}</span>
            <button class="modal-close" data-action="close-lightbox">✕</button>
          </div>
          <div class="lightbox-img-wrap">
            <img src="${escapeHtml(appState.ui.lightbox.src)}" alt="${escapeHtml(appState.ui.lightbox.title || 'Preview')}"/>
          </div>
        </div>
      </div>
    `);
  }

  if (appState.ui.stopMedModal) {
    const med = appState.ui.stopMedModal;
    const today = new Date().toISOString().slice(0, 10);
    parts.push(`
      <div class="modal-backdrop" data-backdrop-close="stop-med">
        <div class="modal-sheet">
          <div class="modal-head">
            <h3>🕒 ${isEn ? 'Move to Discontinued Meds' : '转为近期曾用药物'}</h3>
            <button class="modal-close" data-action="close-stop-med">✕</button>
          </div>
          <p class="pin-desc"><strong>${escapeHtml(med.name)}</strong></p>
          <form class="stack-form" data-form="confirm-stop-med">
            <input type="hidden" name="id" value="${med.id}"/>
            <label class="field">
              <span>${isEn ? 'Stop Date' : '停药日期'}</span>
              <input type="date" name="endDate" value="${today}" required/>
            </label>
            <label class="field">
              <span>${isEn ? 'Stop Reason / Reaction' : '停药原因（方便医生了解既往疗效与不良反应）'}</span>
              <input type="text" name="stopReason" placeholder="${isEn ? 'e.g. Course finished / Side effect' : '例如：疗程结束 / 指标恢复正常'}" required/>
            </label>
            <button type="submit" class="btn-primary">${isEn ? 'Confirm Discontinue' : '确认移入“近期曾服药物”'}</button>
          </form>
        </div>
      </div>
    `);
  }

  return parts.join('');
}

function renderDesktopStudioBar(activeState) {
  const isSnap = appState.ui.mode === 'snapshot';
  const isEn = appState.ui.lang === 'en';
  const isDemo = !!activeState?.isDemo;
  const modeLabel = isSnap
    ? isEn ? 'QR Snapshot (MD View)' : '医生扫码快照视角'
    : appState.ui.mode === 'manage'
      ? isEn ? 'Patient Edit Mode' : '个人管理端（已解锁）'
      : isEn ? 'Physician Locked View' : '医生只读视图（已锁定）';

  return `
    <aside class="studio-bar no-print">
      <div class="studio-brand">
        <div class="studio-logo">🩺</div>
        <div>
          <div class="studio-title">医览通 MedPass</div>
          <div class="studio-sub">${isDemo ? '高保真示例档案 · 本地优先 PWA' : '个人本地健康档案 · 美式/中式双语'}</div>
        </div>
      </div>
      <div class="studio-controls">
        <div class="studio-pill">${isEn ? 'Mode: ' : '当前视角：'}<strong>${modeLabel}</strong></div>
        <button class="studio-btn studio-btn-primary" data-action="toggle-lang">
          ${isEn ? '🌐 切换回中文视图 (ZH / Metric)' : '🌐 切换美国医生英文视图 (EN / US Units)'}
        </button>
        <button class="studio-btn" data-action="toggle-frame">
          ${appState.ui.desktopFrame ? '🖥️ 切换宽屏桌面视图' : '📱 切换手机外壳预览'}
        </button>
        ${
          !isSnap && appState.ui.mode === 'doctor'
            ? `<button class="studio-btn" data-action="prompt-unlock">🔓 ${isDemo ? '解锁编辑 (示例 PIN: 1234)' : '输入 PIN 解锁个人管理端'}</button>`
            : !isSnap
              ? `<button class="studio-btn" data-action="lock-to-doctor">🔒 锁定回医生视图</button>`
              : `<button class="studio-btn" data-action="exit-snapshot">↩️ 返回本地档案</button>`
        }
        ${isDemo && !isSnap ? `<button class="studio-btn" data-action="open-setup-from-doc">✨ 创建我的真实档案（清空示例）</button>` : ''}
      </div>
      ${
        isDemo && !isSnap
          ? `<div class="studio-tip">🇺🇸 <strong>双语 & 美国看诊：</strong>支持中/英及 lbs·°F·mg/dL 一键切换，含 DOB、药房、ROS 阴性鉴别、末次服药、社会史与<strong>零幻觉医生问询</strong>。</div>`
          : ''
      }
    </aside>
  `;
}

function scrollScreenTop() {
  const sc = document.getElementById('scroll-container');
  if (sc) sc.scrollTop = 0;
  window.scrollTo(0, 0);
}

function render() {
  const root = document.getElementById('app');
  if (!root || !appState.data) return;

  const isSnapshot = appState.ui.mode === 'snapshot' && appState.snapshotData;
  const activeState = isSnapshot ? appState.snapshotData : appState.data;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const isDesktop = window.innerWidth >= 820 && !isStandalone;

  const screenHtml =
    appState.ui.mode === 'manage' && !isSnapshot
      ? renderManageView(activeState, appState.ui)
      : renderDoctorView(activeState, appState.ui);

  const modalsHtml = renderModals();

  if (isDesktop && appState.ui.desktopFrame) {
    root.innerHTML = `
      <div class="studio-layout">
        ${renderDesktopStudioBar(activeState)}
        <div class="phone-stage">
          <div class="phone-bezel">
            <div class="phone-notch"><span class="notch-pill"></span></div>
            <div class="phone-viewport" id="scroll-container">
              ${screenHtml}
            </div>
            <div class="phone-home-bar"></div>
          </div>
        </div>
      </div>
      ${modalsHtml}
    `;
  } else {
    root.innerHTML = `
      <div class="wide-layout ${isDesktop ? 'is-desktop-wide' : 'is-mobile-native'}">
        ${isDesktop ? renderDesktopStudioBar(activeState) : ''}
        <div class="app-container" id="scroll-container">
          ${screenHtml}
        </div>
      </div>
      ${modalsHtml}
    `;
  }
}

async function attemptPinSubmit() {
  const pin = appState.ui.pinBuffer;
  if (pin.length < 4) return;
  const ok = await verifyPin(pin, appState.data.profile.pinHash);
  if (ok) {
    appState.ui.pinModalOpen = false;
    appState.ui.pinBuffer = '';
    appState.ui.pinError = '';
    appState.ui.mode = 'manage';
    resetIdleClock();
    render();
    showToast(appState.ui.lang === 'en' ? 'Unlocked Patient Edit Mode' : '已解锁个人管理端', 'success');
  } else {
    appState.ui.pinError = appState.ui.lang === 'en' ? 'Incorrect PIN' : 'PIN 码不正确';
    appState.ui.pinBuffer = '';
    render();
  }
}

function bindEvents() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    appState.ui.canInstallPrompt = true;
    render();
  });

  ['click', 'keydown', 'touchstart'].forEach((evt) => {
    document.addEventListener(evt, resetIdleClock, { passive: true });
  });

  let hiddenAt = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt && appState.ui.mode === 'manage' && appState.data) {
      const mins = Number(appState.data.profile.autoLockMinutes ?? 5);
      if (mins > 0 && Date.now() - hiddenAt > mins * 60 * 1000) {
        appState.ui.mode = 'doctor';
        render();
        showToast(appState.ui.lang === 'en' ? 'Auto-locked back to Physician View' : '切回前台已自动锁定为医生只读视图');
      }
      hiddenAt = null;
    }
  });

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      appState.ui.lightbox = null;
      appState.ui.qrModalOpen = false;
      appState.ui.pinModalOpen = false;
      appState.ui.stopMedModal = null;
      appState.ui.setupModalOpen = false;
      appState.ui.archiveVisitModalOpen = false;
      appState.ui.editModal = null;
      appState.ui.businessCardModal = null;
      appState.ui.intakeResultModal = null;
      if (appState.ui.voiceModal) {
        stopActiveVoiceSessions();
        appState.ui.voiceModal = null;
      }
      render();
      return;
    }

    if (appState.ui.pinModalOpen) {
      if (/^\d$/.test(e.key) && appState.ui.pinBuffer.length < 6) {
        appState.ui.pinBuffer += e.key;
        appState.ui.pinError = '';
        render();
        if (appState.ui.pinBuffer.length === 4) {
          const quickMatch = await verifyPin(appState.ui.pinBuffer, appState.data.profile.pinHash);
          if (quickMatch) await attemptPinSubmit();
        }
      } else if (e.key === 'Backspace') {
        appState.ui.pinBuffer = appState.ui.pinBuffer.slice(0, -1);
        render();
      } else if (e.key === 'Enter') {
        await attemptPinSubmit();
      }
    }
  });

  document.addEventListener('click', async (e) => {
    const backdrop = e.target.closest('[data-backdrop-close]');
    if (backdrop && e.target === backdrop) {
      const which = backdrop.dataset.backdropClose;
      if (which === 'pin') appState.ui.pinModalOpen = false;
      else if (which === 'qr') appState.ui.qrModalOpen = false;
      else if (which === 'lightbox') appState.ui.lightbox = null;
      else if (which === 'stop-med') appState.ui.stopMedModal = null;
      else if (which === 'setup') appState.ui.setupModalOpen = false;
      else if (which === 'archive') appState.ui.archiveVisitModalOpen = false;
      else if (which === 'edit') appState.ui.editModal = null;
      else if (which === 'bcard') appState.ui.businessCardModal = null;
      else if (which === 'intake') appState.ui.intakeResultModal = null;
      else if (which === 'voice') {
        stopActiveVoiceSessions();
        appState.ui.voiceModal = null;
      }
      render();
      return;
    }

    const chartPt = e.target.closest('[data-weight-idx]');
    if (chartPt) {
      appState.ui.selectedWeightIdx = Number(chartPt.dataset.weightIdx);
      render();
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    switch (action) {
      case 'open-doc-section':
        appState.ui.doctorSection = btn.dataset.section || null;
        render();
        scrollScreenTop();
        break;
      case 'close-doc-section':
        appState.ui.doctorSection = null;
        render();
        scrollScreenTop();
        break;
      case 'toggle-fold': {
        const fk = btn.dataset.foldKey;
        const defOpen = btn.dataset.defaultOpen === 'true';
        if (fk) {
          const cur = Object.prototype.hasOwnProperty.call(appState.ui.openFolds, fk)
            ? !!appState.ui.openFolds[fk]
            : defOpen;
          appState.ui.openFolds[fk] = !cur;
          render();
        }
        break;
      }
      case 'toggle-fold-group': {
        const keys = (btn.dataset.keys || '').split(',').filter(Boolean);
        const expand = btn.dataset.expandAll === 'true';
        for (const k of keys) {
          appState.ui.openFolds[k] = expand;
        }
        render();
        break;
      }
      case 'set-doc-scope':
        appState.ui.doctorScope = btn.dataset.scope || 'all';
        appState.ui.doctorSection = null;
        appState.ui.openFolds['d:scope'] = false;
        render();
        break;
      case 'focus-contact-scope': {
        const c = (appState.data.careTeam?.savedContacts || []).find((x) => x.id === btn.dataset.id);
        if (c) {
          const specId = c.specialtyId || inferSpecialtyId(c.department || c.departmentEn) || 'pcp';
          appState.ui.doctorScope = `${String(c.doctorName || '').trim().toLowerCase()}::${specId}`;
          appState.ui.doctorSection = null;
          appState.ui.mode = 'doctor';
          render();
          scrollScreenTop();
          showToast(`已切换至「${c.doctorName || c.department}」专属视角`, 'info');
        }
        break;
      }
      case 'trigger-install':
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          appState.ui.canInstallPrompt = false;
          render();
        }
        break;
      case 'dismiss-install':
        appState.ui.installBannerDismissed = true;
        render();
        break;
      case 'toggle-lang': {
        const nextLang = appState.ui.lang === 'zh' ? 'en' : 'zh';
        const nextUnit = nextLang === 'en' ? 'us' : 'metric';
        appState.ui.lang = nextLang;
        appState.ui.unitSystem = nextUnit;
        if (appState.ui.qaInput && appState.ui.qaResult) {
          const activeState = appState.ui.mode === 'snapshot' && appState.snapshotData ? appState.snapshotData : appState.data;
          appState.ui.qaResult = answerDoctorQuery(appState.ui.qaInput, activeState, nextLang, nextUnit);
        }
        if (appState.data && appState.ui.mode !== 'snapshot') {
          await commitData(
            (d) => {
              d.profile.preferredLang = nextLang;
              d.profile.unitSystem = nextUnit;
            },
            nextLang === 'en' ? 'Switched to English (US Clinic Mode)' : '已切换为中文视图',
            { preserveDemoFlag: true }
          );
        } else {
          render();
        }
        break;
      }
      case 'toggle-unit': {
        const nextUnit = appState.ui.unitSystem === 'metric' ? 'us' : 'metric';
        appState.ui.unitSystem = nextUnit;
        if (appState.ui.qaInput && appState.ui.qaResult) {
          const activeState = appState.ui.mode === 'snapshot' && appState.snapshotData ? appState.snapshotData : appState.data;
          appState.ui.qaResult = answerDoctorQuery(appState.ui.qaInput, activeState, appState.ui.lang, nextUnit);
        }
        if (appState.data && appState.ui.mode !== 'snapshot') {
          await commitData(
            (d) => {
              d.profile.unitSystem = nextUnit;
            },
            nextUnit === 'us' ? 'Switched to US Units (lbs / °F / mg/dL)' : '已切换为公制单位 (kg / °C / mmol/L)',
            { preserveDemoFlag: true }
          );
        } else {
          render();
        }
        break;
      }
      case 'qa-chip':
        runQa(btn.dataset.question || '');
        break;
      case 'clear-qa':
        appState.ui.qaInput = '';
        appState.ui.qaResult = null;
        render();
        break;
      case 'toggle-frame':
        appState.ui.desktopFrame = !appState.ui.desktopFrame;
        render();
        break;
      case 'open-setup-from-doc':
        appState.ui.setupModalOpen = true;
        render();
        break;
      case 'open-setup-wizard':
        appState.ui.setupModalOpen = true;
        render();
        break;
      case 'close-setup-modal':
        appState.ui.setupModalOpen = false;
        render();
        break;
      case 'open-archive-visit':
        appState.ui.archiveVisitModalOpen = true;
        render();
        break;
      case 'close-archive-modal':
        appState.ui.archiveVisitModalOpen = false;
        render();
        break;
      case 'edit-item': {
        const kind = btn.dataset.kind;
        const id = btn.dataset.id;
        let item = null;
        if (kind === 'symptom') item = appState.data.symptoms.find((x) => x.id === id);
        else if (kind === 'med') item = appState.data.medications.find((x) => x.id === id);
        else if (kind === 'condition') item = appState.data.history.conditions.find((x) => x.id === id);
        else if (kind === 'report') item = appState.data.attachments.find((x) => x.id === id);
        else if (kind === 'exam') item = (appState.data.examHistory || []).find((x) => x.id === id);
        if (item) {
          appState.ui.editModal = { kind, item: structuredClone(item) };
          render();
        }
        break;
      }
      case 'close-edit-modal':
        appState.ui.editModal = null;
        render();
        break;
      case 'close-bcard-modal':
        appState.ui.businessCardModal = null;
        render();
        break;
      case 'close-intake-modal':
        appState.ui.intakeResultModal = null;
        render();
        break;
      case 'open-voice-summary': {
        const existingVr = appState.data?.visit?.visitReport;
        appState.ui.voiceModal = {
          speechLang: appState.ui.lang === 'en' ? 'en-US' : 'zh-CN',
          transcript: existingVr?.rawTranscript || '',
          isDictating: false,
          isRecordingAudio: false,
          recordSeconds: 0,
          audioDataUrl: null,
          summarizing: false,
          draft: existingVr ? structuredClone(existingVr) : null
        };
        render();
        break;
      }
      case 'close-voice-modal':
        stopActiveVoiceSessions();
        appState.ui.voiceModal = null;
        render();
        break;
      case 'fill-sample-voice': {
        if (!appState.ui.voiceModal) break;
        const sampleText =
          appState.ui.lang === 'en'
            ? 'Assessment: Suppressed TSH 0.18 with elevated Free T4 indicates iatrogenic levothyroxine over-replacement. Plan: Reduce Levothyroxine from 50 mcg to 25 mcg PO daily on empty stomach. Order 12-lead EKG today to evaluate palpitations, and repeat TSH and Free T4 in 6 weeks. Follow up in 6 weeks; go to urgent care or ER immediately if resting heart rate exceeds 115 or chest pain develops.'
            : '诊断评估：目前TSH偏低至0.18、游离T4升高，考虑优甲乐剂量偏高导致的轻度药物性甲亢。用药调整：建议左甲状腺素钠片从每天50微克减量到每天25微克，继续晨起空腹服用。检查安排：今天先加做一份十二导联心电图排查心律，6周后抽血复查甲功五项。复诊与注意：6周后带新化验单复诊；如果期间出现明显胸痛或静息心率持续超过115次/分，请及时去急诊。';
        appState.ui.voiceModal.transcript = sampleText;
        const ta = document.getElementById('voice-transcript-input');
        if (ta) ta.value = sampleText;
        showToast('已填入示例医生口述，请点击「自动总结进就医报告」', 'info');
        break;
      }
      case 'toggle-speech-dictation': {
        const vm = appState.ui.voiceModal;
        if (!vm) break;
        const ta = document.getElementById('voice-transcript-input');
        if (ta) vm.transcript = ta.value;

        if (vm.isDictating) {
          stopActiveVoiceSessions();
          vm.isDictating = false;
          render();
          break;
        }
        const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Rec) {
          showToast('当前浏览器不支持实时听写，请用录音或键盘麦克风输入', 'error');
          break;
        }
        stopActiveVoiceSessions();
        vm.isRecordingAudio = false;
        const rec = new Rec();
        rec.lang = vm.speechLang || 'zh-CN';
        rec.continuous = true;
        rec.interimResults = true;
        let baseText = vm.transcript ? vm.transcript.trim() + ' ' : '';

        rec.onresult = (event) => {
          let finalPart = '';
          let interimPart = '';
          for (let i = 0; i < event.results.length; i++) {
            const chunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalPart += chunk;
            else interimPart += chunk;
          }
          vm.transcript = (baseText + finalPart + interimPart).trim();
          const box = document.getElementById('voice-transcript-input');
          if (box) box.value = vm.transcript;
        };
        rec.onerror = () => {
          vm.isDictating = false;
          render();
          showToast('语音听写已停止，请检查麦克风权限', 'error');
        };
        rec.onend = () => {
          vm.isDictating = false;
          render();
        };
        speechRecInstance = rec;
        vm.isDictating = true;
        rec.start();
        render();
        break;
      }
      case 'toggle-audio-record': {
        const vm = appState.ui.voiceModal;
        if (!vm) break;
        const ta = document.getElementById('voice-transcript-input');
        if (ta) vm.transcript = ta.value;

        if (vm.isRecordingAudio) {
          stopActiveVoiceSessions();
          vm.isRecordingAudio = false;
          render();
          break;
        }
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          showToast('当前浏览器不支持录音功能', 'error');
          break;
        }
        try {
          stopActiveVoiceSessions();
          vm.isDictating = false;
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamInstance = stream;
          const preferredMime = MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/mp4')
              ? 'audio/mp4'
              : '';
          const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
          const chunks = [];
          recorder.ondataavailable = (ev) => {
            if (ev.data?.size > 0) chunks.push(ev.data);
          };
          recorder.onstop = () => {
            const mime = recorder.mimeType || 'audio/webm';
            const blob = new Blob(chunks, { type: mime });
            const reader = new FileReader();
            reader.onload = () => {
              if (appState.ui.voiceModal) {
                appState.ui.voiceModal.audioDataUrl = reader.result;
                appState.ui.voiceModal.isRecordingAudio = false;
                render();
                showToast('录音已完成，点击「自动总结进就医报告」', 'success');
              }
            };
            reader.readAsDataURL(blob);
          };
          mediaRecorderInstance = recorder;
          vm.isRecordingAudio = true;
          vm.recordSeconds = 0;
          vm.audioDataUrl = null;
          recorder.start();
          recordTimerId = setInterval(() => {
            if (appState.ui.voiceModal?.isRecordingAudio) {
              appState.ui.voiceModal.recordSeconds++;
              const recBtn = document.querySelector('[data-action="toggle-audio-record"]');
              if (recBtn) recBtn.textContent = `⏹ 停止录音 (${appState.ui.voiceModal.recordSeconds}s)`;
            }
          }, 1000);
          render();
        } catch {
          showToast('无法访问麦克风，请允许浏览器麦克风权限', 'error');
        }
        break;
      }
      case 'summarize-voice': {
        const vm = appState.ui.voiceModal;
        if (!vm) break;
        const ta = document.getElementById('voice-transcript-input');
        if (ta) vm.transcript = ta.value.trim();
        if (!vm.transcript && !vm.audioDataUrl) {
          showToast('请先语音录入、录音或输入医生口述内容', 'error');
          return;
        }
        stopActiveVoiceSessions();
        vm.isDictating = false;
        vm.isRecordingAudio = false;
        vm.summarizing = true;
        render();

        try {
          const apiKey = getGeminiApiKey();
          let summary;
          if (apiKey) {
            summary = await aiSummarizeDoctorVoice({
              transcript: vm.transcript,
              audioDataUrl: vm.audioDataUrl,
              patientState: appState.data,
              apiKey
            });
          } else {
            if (vm.audioDataUrl && !vm.transcript) {
              throw new Error('直接分析录音文件需先配置 Gemini API Key，或改用「实时语音转字」');
            }
            summary = localSummarizeDoctorTranscript(vm.transcript);
          }
          vm.transcript = summary.rawTranscript || vm.transcript;
          vm.draft = summary;
          showToast(apiKey ? '✨ AI 已自动总结生成就医报告' : '已按本地规则总结成就医报告', 'success');
        } catch (err) {
          showToast(err.message || '总结失败', 'error');
        } finally {
          if (appState.ui.voiceModal) appState.ui.voiceModal.summarizing = false;
          render();
        }
        break;
      }
      case 'copy-intake-all': {
        const ir = appState.ui.intakeResultModal;
        if (ir?.fields && navigator.clipboard) {
          const text = ir.fields.map((f) => `${f.label}: ${f.value}`).join('\n');
          await navigator.clipboard.writeText(text);
          showToast('已复制全部就诊卡代填内容', 'success');
        }
        break;
      }
      case 'goto-api-key':
        appState.ui.manageTab = 'share-security';
        appState.ui.openFolds['m:ai-key'] = true;
        render();
        setTimeout(() => document.getElementById('ai-key-section')?.scrollIntoView({ behavior: 'smooth' }), 60);
        break;
      case 'clear-api-key':
        setGeminiApiKey('');
        render();
        showToast('已清除本地 API Key', 'info');
        break;
      case 'export-ics': {
        const v = appState.data.visit || {};
        try {
          downloadAppointmentIcs({
            title: `${v.department || '门诊'}就诊${v.doctorName ? ' · ' + v.doctorName : ''}`,
            date: v.visitDate,
            time: v.visitTime || '09:00',
            location: [v.clinicName, v.clinicAddress].filter(Boolean).join(' '),
            description: `${v.purpose || ''}${v.clinicPhone ? ' | Tel: ' + v.clinicPhone : ''}`
          });
          showToast('已生成日历提醒 (.ics)', 'success');
        } catch (err) {
          showToast(err.message || '请先填写预约日期', 'error');
        }
        break;
      }
      case 'apply-contact-to-visit': {
        const c = (appState.data.careTeam?.savedContacts || []).find((x) => x.id === btn.dataset.id);
        if (c) {
          await commitData((d) => {
            d.visit.doctorName = c.doctorName || '';
            d.visit.department = c.department || d.visit.department;
            d.visit.departmentEn = c.departmentEn || '';
            d.visit.clinicName = c.clinicName || '';
            d.visit.clinicPhone = c.phone || '';
            d.visit.clinicAddress = c.address || '';
          }, '已将医生名片填入本次就诊卡');
        }
        break;
      }
      case 'del-saved-contact':
        await commitData((d) => {
          if (d.careTeam?.savedContacts) {
            d.careTeam.savedContacts = d.careTeam.savedContacts.filter((x) => x.id !== btn.dataset.id);
          }
        }, '已删除医生名片');
        break;
      case 'ai-autofill-visit': {
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
          appState.ui.manageTab = 'share-security';
          render();
          showToast('请先配置 Gemini API Key', 'error');
          return;
        }
        appState.ui.aiBusyLabel = 'AI 正在根据你的全部健康资料生成就诊卡...';
        render();
        try {
          const res = await aiAutofillVisitCard(appState.data, apiKey);
          appState.ui.aiBusyLabel = '';
          await commitData((d) => {
            if (res.purpose) d.visit.purpose = res.purpose;
            if (res.purposeEn) d.visit.purposeEn = res.purposeEn;
            if (res.onsetSummary) d.visit.onsetSummary = res.onsetSummary;
            if (res.onsetSummaryEn) d.visit.onsetSummaryEn = res.onsetSummaryEn;
            if (Array.isArray(res.questions) && res.questions.length) d.visit.questions = res.questions;
            if (Array.isArray(res.questionsEn) && res.questionsEn.length) d.visit.questionsEn = res.questionsEn;
            d.visit.updatedAt = new Date().toISOString();
          }, '✨ 已根据个人全部档案自动填好本次就诊卡');
        } catch (err) {
          appState.ui.aiBusyLabel = '';
          render();
          showToast(err.message || 'AI 生成失败', 'error');
        }
        break;
      }
      case 'ai-scan-medbox': {
        const dataUrl = pendingCompressedImages['med-photo-preview'];
        if (!dataUrl) {
          showToast('请先拍照或选择药盒/药瓶照片', 'error');
          return;
        }
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
          appState.ui.manageTab = 'share-security';
          render();
          showToast('请先配置 Gemini API Key', 'error');
          return;
        }
        const previewEl = document.getElementById('med-photo-preview');
        if (previewEl) previewEl.innerHTML = '⏳ AI 正在识别药盒信息...';
        try {
          const res = await aiExtractMedBox(dataUrl, apiKey);
          const form = document.querySelector('form[data-form="add-med"]');
          if (form) {
            if (res.name) form.querySelector('input[name="name"]').value = res.name;
            if (res.nameEn) form.querySelector('input[name="nameEn"]').value = res.nameEn;
            if (res.category === 'otc' || res.category === 'rx') form.querySelector('select[name="category"]').value = res.category;
            if (res.dosage) form.querySelector('input[name="dosage"]').value = res.dosage;
            if (res.frequency) form.querySelector('input[name="frequency"]').value = res.frequency;
            if (res.frequencyEn) form.querySelector('input[name="frequencyEn"]').value = res.frequencyEn;
            if (res.timing) form.querySelector('input[name="timing"]').value = res.timing;
            if (res.timingEn) form.querySelector('input[name="timingEn"]').value = res.timingEn;
            if (res.notes) form.querySelector('input[name="notes"]').value = res.notes;
          }
          if (previewEl) {
            previewEl.innerHTML = `✨ AI 已自动填好药盒信息，核对后点保存即可 <img src="${dataUrl}" class="mini-upload-thumb" alt="preview"/>`;
          }
          showToast('✨ 已识别药盒信息并填入表单', 'success');
        } catch (err) {
          if (previewEl) previewEl.innerHTML = `⚠️ ${escapeHtml(err.message)}`;
          showToast(err.message || '识别失败', 'error');
        }
        break;
      }
      case 'ai-scan-report': {
        const dataUrl = pendingCompressedImages['report-photo-preview'];
        if (!dataUrl) {
          showToast('请先拍照或选择化验单/报告照片', 'error');
          return;
        }
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
          appState.ui.manageTab = 'share-security';
          render();
          showToast('请先配置 Gemini API Key', 'error');
          return;
        }
        const previewEl = document.getElementById('report-photo-preview');
        if (previewEl) previewEl.innerHTML = '⏳ AI 正在识别报告指标与异常项...';
        try {
          const res = await aiExtractLabReport(dataUrl, apiKey);
          const form = document.querySelector('form[data-form="add-report"]');
          if (form) {
            if (res.date && /^\d{4}-\d{2}-\d{2}$/.test(res.date)) form.querySelector('input[name="date"]').value = res.date;
            form.querySelector('select[name="isAbnormal"]').value = res.isAbnormal ? 'true' : 'false';
            if (res.title) form.querySelector('input[name="title"]').value = res.title;
            if (res.titleEn) form.querySelector('input[name="titleEn"]').value = res.titleEn;
            if (res.summaryHighlight) form.querySelector('input[name="summaryHighlight"]').value = res.summaryHighlight;
            if (res.summaryHighlightEn) form.querySelector('input[name="summaryHighlightEn"]').value = res.summaryHighlightEn;
          }
          if (previewEl) {
            previewEl.innerHTML = `✨ AI 已自动填好报告单，核对后点上传即可 <img src="${dataUrl}" class="mini-upload-thumb" alt="preview"/>`;
          }
          showToast('✨ 已自动识别报告日期与异常指标', 'success');
        } catch (err) {
          if (previewEl) previewEl.innerHTML = `⚠️ ${escapeHtml(err.message)}`;
          showToast(err.message || '识别失败', 'error');
        }
        break;
      }
      case 'preset-ros': {
        const zh = btn.dataset.zh;
        const en = btn.dataset.en;
        await commitData((d) => {
          if (!Array.isArray(d.rosNegatives)) d.rosNegatives = [];
          if (!d.rosNegatives.some((r) => r.text === zh)) {
            d.rosNegatives.push({ id: uid('ros'), text: zh, textEn: en });
          }
        }, '已添加双语否认项');
        break;
      }
      case 'preset-allergy': {
        const zh = btn.dataset.zh;
        const en = btn.dataset.en;
        await commitData((d) => {
          if (!zh) {
            d.profile.allergies = [];
            d.profile.allergiesEn = [];
          } else {
            if (!d.profile.allergies.includes(zh)) d.profile.allergies.push(zh);
            if (!Array.isArray(d.profile.allergiesEn)) d.profile.allergiesEn = [];
            if (!d.profile.allergiesEn.includes(en)) d.profile.allergiesEn.push(en);
          }
        }, zh ? '已添加双语过敏史' : '已设为无已知过敏 (NKDA)');
        break;
      }
      case 'preset-condition': {
        const zh = btn.dataset.zh;
        const en = btn.dataset.en;
        await commitData((d) => {
          if (!d.history.conditions.some((c) => c.name === zh)) {
            d.history.conditions.push({
              id: uid('cond'),
              name: zh,
              nameEn: en,
              diagnosedYear: String(new Date().getFullYear()),
              status: '随访控制中',
              statusEn: 'Active / Controlled',
              note: ''
            });
          }
        }, '已添加双语既往病史');
        break;
      }
      case 'preset-exam': {
        const form = document.querySelector('form[data-form="add-exam"]');
        if (form) {
          form.querySelector('input[name="name"]').value = btn.dataset.zh || '';
          form.querySelector('input[name="nameEn"]').value = btn.dataset.en || '';
          form.querySelector('select[name="category"]').value = btn.dataset.cat || 'imaging';
          if (btn.dataset.spec) form.querySelector('select[name="specialtyTag"]').value = btn.dataset.spec;
        }
        break;
      }
      case 'del-exam':
        await commitData((d) => {
          d.examHistory = (d.examHistory || []).filter((ex) => ex.id !== btn.dataset.id);
        }, '已删除既往检查记录');
        break;
      case 'preset-med-freq': {
        const form = document.querySelector('form[data-form="add-med"]');
        const freqInput = form?.querySelector('input[name="frequency"]');
        if (freqInput) {
          freqInput.value = appState.ui.lang === 'en' ? btn.dataset.en : btn.dataset.zh;
          freqInput.dataset.presetEn = btn.dataset.en;
          freqInput.dataset.presetZh = btn.dataset.zh;
        }
        break;
      }
      case 'preset-social': {
        const field = btn.dataset.field;
        const zh = btn.dataset.zh;
        const en = btn.dataset.en;
        await commitData((d) => {
          if (!d.socialHistory) d.socialHistory = {};
          d.socialHistory[field] = zh;
          d.socialHistory[`${field}En`] = en;
        }, '已更新双语社会史');
        break;
      }
      case 'prompt-unlock':
        appState.ui.pinModalOpen = true;
        appState.ui.pinBuffer = '';
        appState.ui.pinError = '';
        render();
        break;
      case 'close-pin-modal':
        appState.ui.pinModalOpen = false;
        render();
        break;
      case 'pin-digit': {
        if (appState.ui.pinBuffer.length < 6) {
          appState.ui.pinBuffer += btn.dataset.digit;
          appState.ui.pinError = '';
          render();
          if (appState.ui.pinBuffer.length === 4) {
            const quickMatch = await verifyPin(appState.ui.pinBuffer, appState.data.profile.pinHash);
            if (quickMatch) await attemptPinSubmit();
          }
        }
        break;
      }
      case 'pin-back':
        appState.ui.pinBuffer = appState.ui.pinBuffer.slice(0, -1);
        render();
        break;
      case 'pin-clear':
        appState.ui.pinBuffer = '';
        appState.ui.pinError = '';
        render();
        break;
      case 'pin-submit':
        await attemptPinSubmit();
        break;
      case 'lock-to-doctor':
        appState.ui.mode = 'doctor';
        appState.ui.doctorSection = null;
        render();
        scrollScreenTop();
        showToast(appState.ui.lang === 'en' ? 'Locked to Physician View' : '已切换为医生只读视图并锁定', 'info');
        break;
      case 'open-qr':
        await openQrModal();
        break;
      case 'close-qr-modal':
        appState.ui.qrModalOpen = false;
        render();
        break;
      case 'open-qr-preview':
        if (appState.ui.qrInfo?.shareUrl) {
          window.open(appState.ui.qrInfo.shareUrl, '_blank', 'noopener');
        }
        break;
      case 'copy-qr-link':
        if (appState.ui.qrInfo?.shareUrl && navigator.clipboard) {
          await navigator.clipboard.writeText(appState.ui.qrInfo.shareUrl);
          showToast('Link copied', 'success');
        }
        break;
      case 'exit-snapshot':
        window.location.hash = '';
        appState.snapshotData = null;
        appState.ui.mode = 'doctor';
        render();
        break;
      case 'print-summary':
        window.print();
        break;
      case 'doc-med-tab':
        appState.ui.doctorMedTab = btn.dataset.tab;
        render();
        break;
      case 'weight-range':
        appState.ui.weightRange = btn.dataset.range === 'all' ? 'all' : Number(btn.dataset.range);
        appState.ui.selectedWeightIdx = null;
        render();
        break;
      case 'manage-tab':
        appState.ui.manageTab = btn.dataset.tab;
        render();
        break;
      case 'quick-vital-type':
        appState.ui.quickVitalType = btn.dataset.vtype;
        render();
        break;
      case 'preview-image':
        appState.ui.lightbox = { title: btn.dataset.title, src: btn.dataset.src };
        render();
        break;
      case 'close-lightbox':
        appState.ui.lightbox = null;
        render();
        break;
      case 'del-weight':
        await commitData((d) => {
          d.weights = d.weights.filter((w) => w.id !== btn.dataset.id);
        });
        break;
      case 'del-vital':
        await commitData((d) => {
          d.vitals = d.vitals.filter((v) => v.id !== btn.dataset.id);
        });
        break;
      case 'del-symptom':
        await commitData((d) => {
          d.symptoms = d.symptoms.filter((s) => s.id !== btn.dataset.id);
        });
        break;
      case 'del-ros':
        await commitData((d) => {
          d.rosNegatives = (d.rosNegatives || []).filter((n) => n.id !== btn.dataset.id);
        });
        break;
      case 'del-visit-history':
        await commitData((d) => {
          d.visitHistory = (d.visitHistory || []).filter((v) => v.id !== btn.dataset.id);
        });
        break;
      case 'cycle-symptom-trend': {
        const order = ['worsening', 'stable', 'improving'];
        await commitData((d) => {
          const item = d.symptoms.find((s) => s.id === btn.dataset.id);
          if (item) {
            const idx = order.indexOf(item.trend);
            item.trend = order[(idx + 1) % order.length];
          }
        });
        break;
      }
      case 'del-condition':
        await commitData((d) => {
          d.history.conditions = d.history.conditions.filter((c) => c.id !== btn.dataset.id);
        });
        break;
      case 'mark-med-today': {
        const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        await commitData((d) => {
          const med = d.medications.find((m) => m.id === btn.dataset.id);
          if (med) {
            med.lastTaken = `今日 ${nowTime} 已服`;
            med.lastTakenEn = `Taken today at ${nowTime}`;
          }
        }, appState.ui.lang === 'en' ? 'Updated last dose to today' : '已标记今日已服药');
        break;
      }
      case 'move-med-recent': {
        const med = appState.data.medications.find((m) => m.id === btn.dataset.id);
        if (med) {
          appState.ui.stopMedModal = med;
          render();
        }
        break;
      }
      case 'close-stop-med':
        appState.ui.stopMedModal = null;
        render();
        break;
      case 'del-med':
        await commitData((d) => {
          d.medications = d.medications.filter((m) => m.id !== btn.dataset.id);
        });
        break;
      case 'del-report':
        await commitData((d) => {
          d.attachments = d.attachments.filter((a) => a.id !== btn.dataset.id);
        });
        break;
      case 'export-backup':
        exportBackupJson(appState.data);
        showToast(appState.ui.lang === 'en' ? 'Backup exported' : '已导出本地健康备份文件', 'success');
        break;
      case 'reset-demo':
        appState.data = await resetToDemoData();
        appState.ui.storageStats = await getStorageEstimate();
        render();
        showToast('已恢复示例体验数据（PIN: 1234）', 'info');
        break;
      case 'clear-all':
        if (window.confirm('确认清空全部病历记录并从零开始？（建议先导出备份）')) {
          const blank = await createBlankUserState({
            preferredLang: appState.ui.lang,
            unitSystem: appState.ui.unitSystem
          });
          appState.data = await saveState(blank);
          appState.ui.storageStats = await getStorageEstimate();
          render();
          showToast('已清空并创建空白档案', 'info');
        }
        break;
      default:
        break;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target?.id === 'voice-transcript-input' && appState.ui.voiceModal) {
      appState.ui.voiceModal.transcript = e.target.value;
    }
  });

  document.addEventListener('change', async (e) => {
    const target = e.target;

    if (target.matches('input[type="file"][data-ai-upload]')) {
      const kind = target.dataset.aiUpload;
      const file = target.files?.[0];
      target.value = '';
      if (!file) return;
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        appState.ui.manageTab = 'share-security';
        render();
        showToast('请先在下方配置你的 Gemini API Key', 'error');
        return;
      }
      appState.ui.aiBusyLabel =
        kind === 'business-card'
          ? 'AI 正在识别医生名片 / 预约单信息...'
          : 'AI 正在读取就诊卡表单并匹配你的个人全部档案...';
      render();
      try {
        const compressed = await compressImageFile(file, 1440, 0.82);
        if (kind === 'business-card') {
          appState.ui.businessCardModal = await aiExtractBusinessCard(compressed.dataUrl, apiKey);
        } else {
          appState.ui.intakeResultModal = await aiMatchIntakeForm(compressed.dataUrl, appState.data, appState.ui.lang, apiKey);
        }
      } catch (err) {
        showToast(err.message || 'AI 识图失败', 'error');
      } finally {
        appState.ui.aiBusyLabel = '';
        render();
      }
      return;
    }

    if (target.dataset.action === 'voice-lang-change') {
      if (appState.ui.voiceModal) appState.ui.voiceModal.speechLang = target.value;
      return;
    }

    if (target.dataset.action === 'change-input-unit') {
      const kind = target.dataset.unitKind;
      if (kind === 'weight') appState.ui.weightInputUnit = target.value;
      else if (kind === 'temp') appState.ui.tempInputUnit = target.value;
      else if (kind === 'glucose') appState.ui.glucoseInputUnit = target.value;
      render();
      return;
    }

    if (target.matches('input[type="file"][data-compress-preview]')) {
      const previewId = target.dataset.compressPreview;
      const previewEl = document.getElementById(previewId);
      const file = target.files?.[0];
      if (!file) {
        delete pendingCompressedImages[previewId];
        if (previewEl) previewEl.innerHTML = '';
        return;
      }
      if (previewEl) previewEl.textContent = 'Compressing...';
      try {
        const res = await compressImageFile(file);
        pendingCompressedImages[previewId] = res.dataUrl;
        if (previewEl) {
          previewEl.innerHTML = `✅ ${res.origKb} KB → ${res.compKb} KB <img src="${res.dataUrl}" class="mini-upload-thumb" alt="preview"/>`;
        }
      } catch {
        if (previewEl) previewEl.textContent = 'Failed to read image';
      }
      return;
    }

    if (target.dataset.action === 'toggle-mask-name') {
      await commitData((d) => {
        d.profile.maskNameOnShare = !!target.checked;
      });
    } else if (target.dataset.action === 'change-autolock') {
      await commitData((d) => {
        d.profile.autoLockMinutes = Number(target.value);
      });
    } else if (target.dataset.action === 'import-backup') {
      const file = target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const validated = validateImportedBackup(JSON.parse(text));
        appState.data = await saveState(validated);
        appState.ui.storageStats = await getStorageEstimate();
        render();
        showToast('Backup restored!', 'success');
      } catch (err) {
        showToast(err.message || 'Invalid backup file', 'error');
      }
      target.value = '';
    }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form);
    const kind = form.dataset.form;

    switch (kind) {
      case 'save-visit-report': {
        const vm = appState.ui.voiceModal;
        const ta = document.getElementById('voice-transcript-input');
        const rawTranscript = (ta ? ta.value : vm?.transcript || '').trim();
        const prevDraft = vm?.draft || {};
        const report = {
          updatedAt: new Date().toISOString(),
          doctorName: String(fd.get('doctorName') || '').trim(),
          diagnosis: String(fd.get('diagnosis') || '').trim(),
          diagnosisEn: prevDraft.diagnosisEn || '',
          medPlan: String(fd.get('medPlan') || '').trim(),
          medPlanEn: prevDraft.medPlanEn || '',
          testsPlan: String(fd.get('testsPlan') || '').trim(),
          testsPlanEn: prevDraft.testsPlanEn || '',
          followUp: String(fd.get('followUp') || '').trim(),
          followUpEn: prevDraft.followUpEn || '',
          patientTakeaway: String(fd.get('patientTakeaway') || '').trim(),
          patientTakeawayEn: prevDraft.patientTakeawayEn || '',
          nextFollowUpDate: String(fd.get('nextFollowUpDate') || '').trim(),
          rawTranscript
        };
        stopActiveVoiceSessions();
        appState.ui.voiceModal = null;
        await commitData((d) => {
          d.visit.visitReport = report;
          if (report.doctorName && !d.visit.doctorName) d.visit.doctorName = report.doctorName;
        }, '✅ 已保存医生就诊总结进就医报告');
        break;
      }
      case 'save-api-key': {
        const key = String(fd.get('apiKey') || '').trim();
        setGeminiApiKey(key);
        render();
        showToast(key ? 'Gemini API Key 已加密保存到本机' : '已清除 API Key', 'success');
        break;
      }
      case 'save-business-card': {
        const doctorName = String(fd.get('doctorName') || '').trim();
        const department = String(fd.get('department') || '').trim();
        const departmentEn = String(fd.get('departmentEn') || '').trim();
        const clinicName = String(fd.get('clinicName') || '').trim();
        const phone = String(fd.get('phone') || '').trim();
        const address = String(fd.get('address') || '').trim();
        const appointmentDate = String(fd.get('appointmentDate') || '').trim();
        const appointmentTime = String(fd.get('appointmentTime') || '').trim();
        const notes = String(fd.get('notes') || '').trim();
        const updateVisit = fd.get('updateVisit') === 'on';
        const saveContact = fd.get('saveContact') === 'on';
        const exportIcs = fd.get('exportIcs') === 'on';
        appState.ui.businessCardModal = null;

        await commitData((d) => {
          if (saveContact && (doctorName || clinicName)) {
            if (!d.careTeam) d.careTeam = {};
            if (!Array.isArray(d.careTeam.savedContacts)) d.careTeam.savedContacts = [];
            d.careTeam.savedContacts.unshift({
              id: uid('doc'),
              doctorName,
              department,
              departmentEn,
              specialtyId: inferSpecialtyId(departmentEn || department),
              clinicName,
              phone,
              address
            });
          }
          if (updateVisit) {
            if (department) d.visit.department = department;
            if (departmentEn) d.visit.departmentEn = departmentEn;
            d.visit.specialtyId = inferSpecialtyId(departmentEn || department);
            if (appointmentDate) d.visit.visitDate = appointmentDate;
            if (appointmentTime) d.visit.visitTime = appointmentTime;
            if (doctorName) d.visit.doctorName = doctorName;
            if (clinicName) d.visit.clinicName = clinicName;
            if (phone) d.visit.clinicPhone = phone;
            if (address) d.visit.clinicAddress = address;
            if (notes && !d.visit.onsetSummary) d.visit.onsetSummary = notes;
            d.visit.updatedAt = new Date().toISOString();
          }
        }, '✅ 已保存医生名片与预约就诊时间');

        if (exportIcs && appointmentDate) {
          try {
            downloadAppointmentIcs({
              title: `${department || '门诊'}预约${doctorName ? ' · ' + doctorName : ''}`,
              date: appointmentDate,
              time: appointmentTime || '09:00',
              location: [clinicName, address].filter(Boolean).join(' '),
              description: `${notes || ''}${phone ? ' | Tel: ' + phone : ''}`
            });
          } catch {
            // Ignore calendar error if date missing
          }
        }
        break;
      }
      case 'doctor-qa': {
        const q = String(fd.get('question') || '').trim();
        if (q) runQa(q);
        break;
      }
      case 'complete-setup': {
        const pin = String(fd.get('pin') || '').trim();
        if (!/^\d{4,6}$/.test(pin)) {
          showToast('请输入 4~6 位纯数字 PIN 码', 'error');
          return;
        }
        const splitAllergies = String(fd.get('allergies') || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        const fresh = await createBlankUserState({
          name: String(fd.get('name')).trim(),
          nameEn: String(fd.get('nameEn') || '').trim(),
          dob: String(fd.get('dob') || ''),
          gender: String(fd.get('gender') || '女'),
          heightCm: fd.get('heightCm') ? Number(fd.get('heightCm')) : null,
          allergies: splitAllergies,
          allergiesEn: splitAllergies,
          pharmacy: String(fd.get('pharmacy') || '').trim(),
          pin,
          preferredLang: appState.ui.lang,
          unitSystem: appState.ui.unitSystem
        });
        appState.data = await saveState(fresh);
        appState.ui.setupModalOpen = false;
        appState.ui.mode = 'manage';
        appState.ui.qaResult = null;
        appState.ui.qaHistory = [];
        appState.ui.storageStats = await getStorageEstimate();
        render();
        showToast('个人健康档案已启用，示例数据已清空！', 'success');
        break;
      }
      case 'confirm-archive-visit': {
        const date = String(fd.get('date'));
        const doctorNotes = String(fd.get('doctorNotes') || '').trim();
        const resetCurrent = fd.get('resetCurrentVisit') === 'on';
        appState.ui.archiveVisitModalOpen = false;
        await commitData((d) => {
          if (!Array.isArray(d.visitHistory)) d.visitHistory = [];
          d.visitHistory.unshift({
            id: uid('vh'),
            date,
            doctorName: d.visit.doctorName || '',
            specialtyId: d.visit.specialtyId || inferSpecialtyId(d.visit.department || d.visit.departmentEn),
            department: d.visit.department || '',
            departmentEn: d.visit.departmentEn || '',
            purpose: d.visit.purpose || '门诊就诊',
            purposeEn: d.visit.purposeEn || '',
            doctorNotes,
            doctorNotesEn: ''
          });
          if (resetCurrent) {
            d.visit = {
              purpose: '',
              purposeEn: '',
              department: '',
              departmentEn: '',
              visitDate: new Date().toISOString().slice(0, 10),
              onsetSummary: '',
              onsetSummaryEn: '',
              questions: [],
              questionsEn: [],
              updatedAt: new Date().toISOString()
            };
          }
        }, '本次就诊已归档至过往记录');
        break;
      }
      case 'save-edit-item': {
        const editKind = String(fd.get('kind'));
        const id = String(fd.get('id'));
        appState.ui.editModal = null;
        await commitData((d) => {
          if (editKind === 'symptom') {
            const s = d.symptoms.find((x) => x.id === id);
            if (s) {
              s.name = String(fd.get('name')).trim();
              s.nameEn = String(fd.get('nameEn') || '').trim();
              s.durationText = String(fd.get('durationText') || '').trim();
              s.durationTextEn = '';
              s.severity = String(fd.get('severity') || 'moderate');
              s.notes = String(fd.get('notes') || '').trim();
              s.notesEn = String(fd.get('notesEn') || '').trim();
            }
          } else if (editKind === 'med') {
            const m = d.medications.find((x) => x.id === id);
            if (m) {
              m.name = String(fd.get('name')).trim();
              m.nameEn = String(fd.get('nameEn') || '').trim();
              m.dosage = String(fd.get('dosage') || '').trim();
              m.dosageEn = '';
              m.frequency = String(fd.get('frequency') || '').trim();
              m.frequencyEn = '';
              m.category = String(fd.get('category') || 'rx');
              m.lastTaken = String(fd.get('lastTaken') || '').trim();
              m.lastTakenEn = '';
              m.notes = String(fd.get('notes') || '').trim();
              m.notesEn = '';
            }
          } else if (editKind === 'condition') {
            const c = d.history.conditions.find((x) => x.id === id);
            if (c) {
              c.name = String(fd.get('name')).trim();
              c.nameEn = String(fd.get('nameEn') || '').trim();
              c.diagnosedYear = String(fd.get('diagnosedYear') || '').trim();
              c.status = String(fd.get('status') || '').trim();
              c.statusEn = '';
              c.note = String(fd.get('note') || '').trim();
              c.noteEn = '';
            }
          } else if (editKind === 'report') {
            const a = d.attachments.find((x) => x.id === id);
            if (a) {
              a.date = String(fd.get('date') || '');
              a.isAbnormal = fd.get('isAbnormal') === 'true';
              a.title = String(fd.get('title')).trim();
              a.titleEn = '';
              a.summaryHighlight = String(fd.get('summaryHighlight') || '').trim();
              a.summaryHighlightEn = '';
            }
          } else if (editKind === 'exam') {
            const ex = (d.examHistory || []).find((x) => x.id === id);
            if (ex) {
              ex.date = String(fd.get('date') || '');
              ex.isAbnormal = fd.get('isAbnormal') === 'true';
              ex.name = String(fd.get('name')).trim();
              ex.nameEn = String(fd.get('nameEn') || '').trim();
              ex.facility = String(fd.get('facility') || '').trim();
              ex.facilityEn = '';
              ex.resultSummary = String(fd.get('resultSummary') || '').trim();
              ex.resultSummaryEn = '';
            }
          }
        }, '记录修改已保存');
        break;
      }
      case 'add-weight': {
        const date = String(fd.get('date'));
        const rawVal = Number(fd.get('weightVal'));
        const unit = String(fd.get('weightUnit') || 'kg');
        const note = String(fd.get('note') || '').trim();
        if (!rawVal) return;
        const weightKg = unit === 'lbs' ? lbsToKg(rawVal) : rawVal;
        await commitData((d) => {
          d.weights.push({ id: uid('w'), date, weightKg, note, noteEn: '' });
        }, `已记录体重 ${rawVal} ${unit}`);
        break;
      }
      case 'add-vital': {
        const type = String(fd.get('type'));
        const date = String(fd.get('date'));
        let value1 = Number(fd.get('value1'));
        const value2 = fd.get('value2') ? Number(fd.get('value2')) : null;
        const context = String(fd.get('context') || '').trim();
        if (type === 'temp' && fd.get('tempUnit') === 'F') {
          value1 = fahrenheitToCelsius(value1);
        }
        if (type === 'glucose' && fd.get('glucoseUnit') === 'mgdl') {
          value1 = mgdlToMmol(value1);
        }
        const unitMap = { bp: 'mmHg', hr: 'bpm', glucose: 'mmol/L', temp: '°C', spo2: '%', pain: '/10' };
        await commitData((d) => {
          d.vitals.push({ id: uid('v'), type, date, value1, value2, unit: unitMap[type] || '', context, note: '' });
        });
        break;
      }
      case 'save-visit': {
        const splitLines = (name) =>
          String(fd.get(name) || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
        await commitData((d) => {
          d.visit.specialtyId = String(fd.get('specialtyId') || '');
          d.visit.department = String(fd.get('department') || '').trim();
          d.visit.departmentEn = '';
          d.visit.visitDate = String(fd.get('visitDate') || '');
          d.visit.visitTime = String(fd.get('visitTime') || '');
          d.visit.doctorName = String(fd.get('doctorName') || '').trim();
          d.visit.clinicName = String(fd.get('clinicName') || '').trim();
          d.visit.clinicPhone = String(fd.get('clinicPhone') || '').trim();
          d.visit.clinicAddress = String(fd.get('clinicAddress') || '').trim();
          d.visit.purpose = String(fd.get('purpose') || '').trim();
          d.visit.purposeEn = String(fd.get('purposeEn') || '').trim();
          d.visit.onsetSummary = String(fd.get('onsetSummary') || '').trim();
          d.visit.onsetSummaryEn = '';
          d.visit.questions = splitLines('questions');
          d.visit.questionsEn = splitLines('questionsEn');
          d.visit.updatedAt = new Date().toISOString();
        });
        break;
      }
      case 'add-symptom': {
        const tag = String(fd.get('specialtyTag') || '');
        await commitData((d) => {
          d.symptoms.unshift({
            id: uid('sym'),
            name: String(fd.get('name')).trim(),
            nameEn: String(fd.get('nameEn') || '').trim(),
            specialties: tag ? [tag] : [],
            onsetDate: String(fd.get('onsetDate') || ''),
            durationText: String(fd.get('durationText') || '').trim(),
            durationTextEn: '',
            severity: String(fd.get('severity') || 'moderate'),
            trend: String(fd.get('trend') || 'stable'),
            notes: String(fd.get('notes') || '').trim(),
            notesEn: '',
            selfCare: '',
            selfCareEn: ''
          });
        });
        break;
      }
      case 'add-ros': {
        const text = String(fd.get('text') || '').trim();
        if (!text) return;
        await commitData((d) => {
          if (!Array.isArray(d.rosNegatives)) d.rosNegatives = [];
          d.rosNegatives.push({ id: uid('ros'), text, textEn: text });
        });
        break;
      }
      case 'save-profile': {
        const splitLines = (name) =>
          String(fd.get(name) || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
        await commitData((d) => {
          d.profile.name = String(fd.get('name')).trim();
          d.profile.nameEn = String(fd.get('nameEn') || '').trim();
          d.profile.dob = String(fd.get('dob') || '').trim();
          if (d.profile.dob) d.profile.birthYear = Number(d.profile.dob.slice(0, 4));
          d.profile.gender = String(fd.get('gender') || '女');
          d.profile.genderEn = d.profile.gender === '男' ? 'Male' : d.profile.gender === '女' ? 'Female' : 'Other';
          d.profile.heightCm = Number(fd.get('heightCm')) || null;
          d.profile.bloodType = String(fd.get('bloodType') || '').trim();
          d.profile.allergies = splitLines('allergies');
          const enAllergies = splitLines('allergiesEn');
          d.profile.allergiesEn = enAllergies.length ? enAllergies : d.profile.allergies;
          d.profile.emergencyContact = String(fd.get('emergencyContact') || '').trim();
          d.profile.emergencyContactEn = '';
          d.careTeam = {
            pharmacy: String(fd.get('pharmacy') || '').trim(),
            pharmacyEn: '',
            pcp: String(fd.get('pcp') || '').trim(),
            pcpEn: '',
            insurance: String(fd.get('insurance') || '').trim(),
            insuranceEn: ''
          };
        });
        break;
      }
      case 'add-condition': {
        await commitData((d) => {
          d.history.conditions.push({
            id: uid('cond'),
            name: String(fd.get('name')).trim(),
            nameEn: String(fd.get('nameEn') || '').trim(),
            diagnosedYear: String(fd.get('diagnosedYear') || '').trim(),
            status: String(fd.get('status') || 'Active').trim(),
            statusEn: '',
            note: '',
            noteEn: ''
          });
        });
        break;
      }
      case 'save-history-lists': {
        const splitLines = (name) =>
          String(fd.get(name) || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
        await commitData((d) => {
          d.history.surgeries = splitLines('surgeries');
          d.history.surgeriesEn = [];
          d.history.familyHistory = splitLines('familyHistory');
          d.history.familyHistoryEn = [];
          d.socialHistory = {
            ...(d.socialHistory || {}),
            smoking: String(fd.get('smoking') || '').trim(),
            smokingEn: '',
            alcohol: String(fd.get('alcohol') || '').trim(),
            alcoholEn: '',
            pregnancy: String(fd.get('pregnancy') || '').trim(),
            pregnancyEn: '',
            occupation: String(fd.get('occupation') || '').trim(),
            occupationEn: ''
          };
        });
        break;
      }
      case 'add-med': {
        const photoDataUrl = pendingCompressedImages['med-photo-preview'] || '';
        delete pendingCompressedImages['med-photo-preview'];
        const tag = String(fd.get('specialtyTag') || '');
        const freqInput = form.querySelector('input[name="frequency"]');
        const freqVal = String(fd.get('frequency') || '').trim();
        const hiddenFreqEn = String(fd.get('frequencyEn') || '').trim();
        const freqEn = hiddenFreqEn || (freqInput?.dataset.presetZh === freqVal || freqInput?.dataset.presetEn === freqVal
          ? (freqInput.dataset.presetEn || '')
          : '');
        await commitData((d) => {
          d.medications.unshift({
            id: uid('med'),
            category: String(fd.get('category') || 'rx'),
            name: String(fd.get('name')).trim(),
            nameEn: String(fd.get('nameEn') || '').trim(),
            specialties: tag ? [tag] : [],
            genericName: '',
            dosage: String(fd.get('dosage') || '').trim(),
            dosageEn: '',
            frequency: freqVal,
            frequencyEn: freqEn,
            timing: String(fd.get('timing') || '').trim(),
            timingEn: String(fd.get('timingEn') || '').trim(),
            lastTaken: String(fd.get('lastTaken') || '').trim(),
            lastTakenEn: '',
            status: String(fd.get('status') || 'active'),
            startDate: String(fd.get('startDate') || ''),
            endDate: '',
            stopReason: String(fd.get('stopReason') || '').trim(),
            stopReasonEn: '',
            notes: String(fd.get('notes') || '').trim(),
            notesEn: '',
            photoDataUrl
          });
        });
        break;
      }
      case 'confirm-stop-med': {
        const id = String(fd.get('id'));
        const endDate = String(fd.get('endDate'));
        const stopReason = String(fd.get('stopReason')).trim();
        appState.ui.stopMedModal = null;
        await commitData((d) => {
          const med = d.medications.find((m) => m.id === id);
          if (med) {
            med.status = 'recent';
            med.endDate = endDate;
            med.stopReason = stopReason;
            med.stopReasonEn = '';
          }
        });
        break;
      }
      case 'add-report': {
        const imageDataUrl = pendingCompressedImages['report-photo-preview'] || '';
        delete pendingCompressedImages['report-photo-preview'];
        const tag = String(fd.get('specialtyTag') || '');
        await commitData((d) => {
          d.attachments.unshift({
            id: uid('att'),
            date: String(fd.get('date') || ''),
            title: String(fd.get('title')).trim(),
            titleEn: String(fd.get('titleEn') || '').trim(),
            specialties: tag ? [tag] : [],
            category: 'lab',
            isAbnormal: fd.get('isAbnormal') === 'true',
            summaryHighlight: String(fd.get('summaryHighlight') || '').trim(),
            summaryHighlightEn: String(fd.get('summaryHighlightEn') || '').trim(),
            imageDataUrl
          });
        });
        break;
      }
      case 'add-exam': {
        const imageDataUrl = pendingCompressedImages['exam-photo-preview'] || '';
        delete pendingCompressedImages['exam-photo-preview'];
        const tag = String(fd.get('specialtyTag') || '');
        await commitData((d) => {
          if (!Array.isArray(d.examHistory)) d.examHistory = [];
          d.examHistory.unshift({
            id: uid('ex'),
            date: String(fd.get('date') || ''),
            category: String(fd.get('category') || 'imaging'),
            name: String(fd.get('name')).trim(),
            nameEn: String(fd.get('nameEn') || '').trim(),
            facility: String(fd.get('facility') || '').trim(),
            facilityEn: '',
            resultSummary: String(fd.get('resultSummary') || '').trim(),
            resultSummaryEn: '',
            isAbnormal: fd.get('isAbnormal') === 'true',
            specialties: tag ? [tag] : [],
            imageDataUrl
          });
        }, '既往检查历史已保存');
        break;
      }
      case 'change-pin': {
        const newPin = String(fd.get('newPin') || '').trim();
        if (!/^\d{4,6}$/.test(newPin)) {
          showToast('请输入 4~6 位纯数字 PIN 码', 'error');
          return;
        }
        const hashed = await hashPin(newPin);
        await commitData((d) => {
          d.profile.pinHash = hashed;
        }, 'PIN 密码已更新');
        break;
      }
      default:
        break;
    }
  });
}

async function registerPwa() {
  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloading) {
        reloading = true;
        window.location.reload();
      }
    });
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update().catch(() => {});
        }
      });
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('发现新版本，正在为您自动刷新...', 'info');
          }
        });
      });
    } catch {
      // Optional on local environments
    }
  }
}

async function init() {
  requestPersistentStorage();
  appState.data = await loadState();
  appState.ui.lang = appState.data.profile?.preferredLang || 'zh';
  appState.ui.unitSystem = appState.data.profile?.unitSystem || (appState.ui.lang === 'en' ? 'us' : 'metric');
  appState.ui.desktopFrame = !!appState.data.isDemo; // Clean wide app layout automatically once using real profile
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  appState.ui.showIosInstallTip = isIos && !isStandalone;
  appState.ui.storageStats = await getStorageEstimate();

  bindEvents();
  startAutoLockWatcher();

  window.addEventListener('hashchange', handleHashRoute);
  window.addEventListener('resize', () => render());

  subscribeRemoteSync(async () => {
    appState.data = await loadState();
    appState.ui.storageStats = await getStorageEstimate();
    if (appState.ui.mode === 'doctor') {
      render();
      showToast(appState.ui.lang === 'en' ? 'Records synced & updated' : '检测到新资料，页面已自动更新', 'info');
    }
  });

  await handleHashRoute();
  await registerPwa();
}

init();
