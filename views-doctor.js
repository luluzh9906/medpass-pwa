/**
 * Mobile-First Read-only Physician View ("Tap-to-Enter Clinical Dashboard + Large-Type Detail Views").
 * Supports Bilingual switching (ZH / EN), Dual Units (Metric / US), Specialty/Doctor Scoping,
 * Zero-Hallucination Local Doctor Q&A, and Physician Voice Summary / After-Visit Report.
 */
import {
  escapeHtml,
  filterWeightsByRange,
  renderVitalSparkline,
  renderWeightChartSvg,
  summarizeWeightStats
} from './charts.js';
import {
  computeAge,
  formatDisplayDate,
  formatHeight,
  formatVitalReading,
  formatWeightValue,
  isFoldOpen,
  pickText,
  t
} from './i18n.js';
import { buildAvailableScopes, filterStateByScope } from './specialties.js';

const SEVERITY_CLS = { mild: 'pill-muted', moderate: 'pill-amber', severe: 'pill-red' };
const TREND_CLS = { worsening: 'trend-up', stable: 'trend-flat', improving: 'trend-down' };
const VITAL_TYPES = ['bp', 'hr', 'glucose', 'temp', 'spo2', 'pain'];
const DETAIL_ORDER = ['visit', 'report', 'symptoms', 'meds', 'weight', 'vitals_labs', 'history', 'qa'];

function renderFoldCard({ key, ui, defaultOpen = false, titleHtml, badgeHtml = '', metaHtml = '', bodyHtml, cardCls = '' }) {
  const open = isFoldOpen(ui, key, defaultOpen);
  return `
    <div class="fold-card ${open ? 'is-open' : ''} ${cardCls}">
      <button type="button" class="fold-head" data-action="toggle-fold" data-fold-key="${escapeHtml(key)}" data-default-open="${defaultOpen ? 'true' : 'false'}" aria-expanded="${open}">
        <div class="fold-head-main">
          <div class="fold-title-row">
            ${titleHtml}
            ${badgeHtml}
          </div>
          ${metaHtml ? `<div class="fold-meta-row">${metaHtml}</div>` : ''}
        </div>
        <span class="fold-caret" aria-hidden="true">${open ? '▾' : '▸'}</span>
      </button>
      <div class="fold-body">
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderExpandAllPill(keys, ui, dict, defaultAllOpen = false) {
  if (!keys || keys.length < 2) return '';
  const allOpen = keys.every((k) => isFoldOpen(ui, k, defaultAllOpen));
  return `
    <button type="button" class="btn-fold-all no-print" data-action="toggle-fold-group" data-keys="${escapeHtml(keys.join(','))}" data-expand-all="${allOpen ? 'false' : 'true'}">
      ${allOpen ? `▴ ${dict.collapseAll}` : `▾ ${dict.expandAll}`}
    </button>
  `;
}

export function renderDoctorView(rawState, ui) {
  const lang = ui.lang || rawState.profile?.preferredLang || 'zh';
  const unitSystem = ui.unitSystem || rawState.profile?.unitSystem || 'metric';
  const dict = t(lang);
  const isSnapshot = !!rawState.isSnapshot;

  // Resolve active physician / specialty scope
  const availableScopes = buildAvailableScopes(rawState);
  let selectedScopeKey = ui.doctorScope;
  if (!selectedScopeKey || selectedScopeKey === 'auto') {
    const currentScope = availableScopes.find((s) => s.isCurrentVisit && s.specialtyId !== 'pcp');
    selectedScopeKey = currentScope ? currentScope.key : 'all';
  }
  const scopeCtx = filterStateByScope(rawState, selectedScopeKey, availableScopes);
  const state = scopeCtx.scopedState;
  const activeSection = ui.doctorSection || null;

  const ctx = {
    rawState,
    state,
    scopeCtx,
    availableScopes,
    selectedScopeKey,
    ui,
    lang,
    unitSystem,
    dict,
    isSnapshot
  };

  if (activeSection) {
    return renderDetailScreen(ctx, activeSection);
  }
  return renderHomeDashboard(ctx);
}

function renderHomeDashboard(ctx) {
  const { state, scopeCtx, availableScopes, selectedScopeKey, ui, lang, unitSystem, dict, isSnapshot } = ctx;
  const { isFiltered, activeScope, hiddenSummary, showWeightSection } = scopeCtx;
  const { profile, visit, symptoms, rosNegatives, history, socialHistory, medications, weights, vitals, attachments } = state;
  const age = computeAge(profile);
  const allergiesList = pickText(profile, 'allergies', lang) || [];
  const alertsList = pickText(profile, 'specialAlerts', lang) || [];

  const updatedLabel = state.updatedAt
    ? new Date(state.updatedAt).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  // Concise live previews for tap-to-enter menu cards
  const symPreview = symptoms?.length
    ? `${symptoms.length} ${dict.itemsCount} · ${symptoms.slice(0, 2).map((s) => pickText(s, 'name', lang)).join('、')}`
    : dict.noSymptoms;

  const activeMeds = (medications || []).filter((m) => m.status === 'active');
  const recentMeds = (medications || []).filter((m) => m.status === 'recent');
  const medPreview = activeMeds.length
    ? `${dict.medTabActive} ${activeMeds.length} (${activeMeds.slice(0, 2).map((m) => pickText(m, 'name', lang)).join('、')}) · ${dict.medTabRecent} ${recentMeds.length}`
    : `${dict.medTabActive} 0 · ${dict.medTabRecent} ${recentMeds.length}`;

  const rangedWeights = filterWeightsByRange(weights, ui.weightRange);
  const wtStats = summarizeWeightStats(rangedWeights, profile.heightCm, lang);
  let weightPreview = lang === 'en' ? 'No weight entries' : '暂无体重记录';
  if (wtStats) {
    const lf = formatWeightValue(wtStats.latest.weightKg, unitSystem);
    const sign = wtStats.deltaKg > 0 ? '+' : '';
    weightPreview = `${lf.val} ${lf.unit} · BMI ${wtStats.bmi ? wtStats.bmi.value : '—'} · ${sign}${wtStats.deltaPct}%${wtStats.significantLoss ? ' ⚠️' : ''}`;
  }

  const latestBp = (vitals || []).filter((v) => v.type === 'bp').sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestHr = (vitals || []).filter((v) => v.type === 'hr').sort((a, b) => b.date.localeCompare(a.date))[0];
  const vitalBits = [];
  if (latestBp) vitalBits.push(`${lang === 'en' ? 'BP' : '血压'} ${latestBp.value1}/${latestBp.value2}`);
  if (latestHr) vitalBits.push(`${lang === 'en' ? 'HR' : '心率'} ${latestHr.value1}${latestHr.value1 >= 90 ? '↑' : ''}`);
  vitalBits.push(`${attachments?.length || 0} ${lang === 'en' ? 'reports' : '份报告'}`);
  vitalBits.push(`${state.examHistory?.length || 0} ${lang === 'en' ? 'past exams' : '项既往检查'}`);
  const vitalsPreview = vitalBits.join(' · ');

  const condCount = history?.conditions?.length || 0;
  const smokeTxt = pickText(socialHistory, 'smoking', lang);
  const historyPreview = [
    `${condCount} ${lang === 'en' ? 'PMH' : '项慢性病'}`,
    smokeTxt || (lang === 'en' ? 'Social Hx' : '社会史'),
    `${state.visitHistory?.length || 0} ${lang === 'en' ? 'prior visits' : '次过往就诊'}`
  ].join(' · ');

  const vr = visit.visitReport;
  const vrPreview = vr
    ? pickText(vr, 'patientTakeaway', lang) || pickText(vr, 'diagnosis', lang) || (lang === 'en' ? 'Saved visit summary' : '已生成结构化就医报告')
    : lang === 'en'
      ? 'Tap to let MD dictate visit wrap-up'
      : '点击录入医生语音口述总结';

  return `
    <div class="doc-shell" id="doctor-view">
      <!-- Sticky Mobile-Friendly Header -->
      <header class="doc-header">
        <div class="doc-header-top">
          <div class="doc-status-pill ${isSnapshot ? 'status-snap' : 'status-live'}">
            <span class="pulse-dot"></span>
            <span>${isSnapshot ? dict.modeSnapshot : `${dict.modeDocLocked} · ${updatedLabel}`}</span>
          </div>
          <div class="doc-header-actions no-print">
            <button class="btn-lang-pill" data-action="toggle-lang">${lang === 'zh' ? '中/EN' : 'EN/中'}</button>
            <button class="btn-lang-pill" data-action="toggle-unit">${unitSystem === 'us' ? 'lbs·°F' : 'kg·°C'}</button>
            ${!isSnapshot ? `<button class="btn-icon-pill" data-action="open-qr" title="${dict.btnQr}">📱</button>` : ''}
            <button class="btn-icon-pill" data-action="print-summary" title="${dict.btnPrint}">🖨️</button>
            ${!isSnapshot ? `<button class="btn-lock-unlock" data-action="prompt-unlock">🔒 ${dict.btnUnlock}</button>` : ''}
          </div>
        </div>

        <div class="patient-strip">
          <div class="patient-identity">
            <h1 class="patient-name">${escapeHtml(pickText(profile, 'name', lang))}</h1>
            <div class="patient-meta-line tabular">
              <span>${escapeHtml(pickText(profile, 'gender', lang) || '—')}</span>
              ${age !== null ? `<span>· ${age} ${dict.ageUnit}</span>` : ''}
              ${profile.heightCm ? `<span>· ${formatHeight(profile.heightCm, unitSystem)}</span>` : ''}
              ${profile.dob ? `<span>· ${formatDisplayDate(profile.dob, lang)}</span>` : ''}
              ${profile.bloodType ? `<span class="tag-blood">${escapeHtml(profile.bloodType)}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Always-Visible Allergy Safety Banner -->
        <div class="allergy-banner ${allergiesList.length ? 'has-allergy' : 'no-allergy'}">
          <div class="allergy-title">
            <span>${allergiesList.length ? `⚠️ ${dict.allergyTitle}` : `✅ ${dict.noAllergyTitle}`}</span>
          </div>
          <div class="allergy-items">
            ${
              allergiesList.length
                ? allergiesList.map((a) => `<span class="allergy-chip">${escapeHtml(a)}</span>`).join('')
                : `<span class="muted-sm">${dict.noAllergyDesc}</span>`
            }
          </div>
          ${alertsList.length ? `<div class="special-alerts">${alertsList.map((s) => `<span>· ${escapeHtml(s)}</span>`).join('')}</div>` : ''}
        </div>
      </header>

      <main class="doc-main">
        ${
          !isSnapshot && (ui.canInstallPrompt || ui.showIosInstallTip) && !ui.installBannerDismissed
            ? `<div class="install-banner no-print">
                <div>
                  <strong>📲 ${lang === 'en' ? 'Install MedPass' : '安装「医览通」到桌面'}</strong>
                  <div class="muted-sm">${
                    ui.canInstallPrompt
                      ? lang === 'en' ? 'Full-screen offline PWA.' : '全屏离线运行，像小程序一样使用。'
                      : lang === 'en' ? 'Safari: Share → Add to Home Screen.' : 'Safari 点「分享」→「添加到主屏幕」。'
                  }</div>
                </div>
                <div class="install-actions">
                  ${ui.canInstallPrompt ? `<button class="btn-primary-sm" data-action="trigger-install">${lang === 'en' ? 'Install' : '安装'}</button>` : ''}
                  <button class="btn-del-xs" data-action="dismiss-install">✕</button>
                </div>
              </div>`
            : ''
        }

        ${
          ctx.rawState.isDemo && !isSnapshot
            ? `<div class="demo-cta-bar no-print">
                <span>✨ ${lang === 'en' ? 'Sample profile (PIN: 1234)' : '示例档案（解锁码 1234）'}</span>
                <button class="btn-mini btn-nowrap" data-action="prompt-unlock">${lang === 'en' ? 'Create Mine' : '创建档案'}</button>
              </div>`
            : ''
        }

        <!-- Collapsible Physician / Specialty Scope Selector -->
        ${
          availableScopes.length > 0 && !isSnapshot
            ? (() => {
                const scopeOpen = isFoldOpen(ui, 'd:scope', false);
                const curScopeText = isFiltered
                  ? lang === 'en'
                    ? activeScope?.labelEn
                    : activeScope?.labelZh
                  : lang === 'en'
                    ? 'All Specialties'
                    : '全部病例';
                return `<section class="scope-bar ${scopeOpen ? 'is-open' : ''} no-print">
                  <button type="button" class="scope-fold-toggle" data-action="toggle-fold" data-fold-key="d:scope" data-default-open="false" aria-expanded="${scopeOpen}">
                    <span class="scope-bar-label">🎯 ${escapeHtml(curScopeText)}${isFiltered && hiddenSummary?.totalHidden > 0 ? ` <em class="scope-hidden-tag">${lang === 'en' ? `· ${hiddenSummary.totalHidden} folded` : `· 已折${hiddenSummary.totalHidden}项`}</em>` : ''}</span>
                    <span class="scope-switch-pill">${dict.switchView} ${scopeOpen ? '▴' : '▾'}</span>
                  </button>
                  <div class="scope-fold-body">
                    <div class="scope-chips">
                      ${availableScopes
                        .map((sc) => {
                          const active = isFiltered ? activeScope?.key === sc.key : selectedScopeKey === sc.key;
                          return `<button type="button" class="scope-chip ${active ? 'active' : ''}" data-action="set-doc-scope" data-scope="${escapeHtml(sc.key)}">${escapeHtml(lang === 'en' ? sc.labelEn : sc.labelZh)}</button>`;
                        })
                        .join('')}
                      <button type="button" class="scope-chip ${!isFiltered ? 'active' : ''}" data-action="set-doc-scope" data-scope="all">📋 ${lang === 'en' ? 'All Charts' : '全部病例'}</button>
                    </div>
                    ${
                      isFiltered && hiddenSummary?.totalHidden > 0
                        ? `<div class="scope-notice">${
                            lang === 'en'
                              ? `Focused on <strong>${escapeHtml(activeScope.labelEn)}</strong> · ${hiddenSummary.totalHidden} unrelated specialty records folded.`
                              : `已聚焦「<strong>${escapeHtml(activeScope.labelZh)}</strong>」，自动折叠了 ${hiddenSummary.totalHidden} 项其他专科记录。`
                          }</div>`
                        : ''
                    }
                  </div>
                </section>`;
              })()
            : ''
        }

        <!-- Primary Highlight 1: Visit Purpose Card (Tap for Full Visit Details & Prior Visits) -->
        <section class="clinical-card card-focus tap-card" data-action="open-doc-section" data-section="visit" role="button" tabindex="0">
          <div class="card-head">
            <div class="card-title-group">
              <span class="card-badge-num">1</span>
              <h2>${dict.sec1Title}</h2>
            </div>
            <div class="visit-meta tabular">
              ${pickText(visit, 'department', lang) ? `<span class="dept-chip">${escapeHtml(pickText(visit, 'department', lang))}</span>` : ''}
              ${visit.visitDate ? `<span>${escapeHtml(formatDisplayDate(visit.visitDate, lang))}</span>` : ''}
            </div>
          </div>
          ${visit.doctorName ? `<div class="home-doc-line">👨‍⚕️ ${escapeHtml(visit.doctorName)} ${visit.visitTime ? `· ${escapeHtml(visit.visitTime)}` : ''}</div>` : ''}
          <p class="visit-purpose">${escapeHtml(
            pickText(visit, 'purpose', lang) ||
              (isFiltered
                ? lang === 'en'
                  ? 'Tap to view prior visits with this specialist.'
                  : '暂无该专科新主诉，点击查看与该医生过往就诊记录'
                : '—')
          )}</p>
          <div class="tap-card-foot">
            <span>${(pickText(visit, 'questions', lang) || []).length} ${lang === 'en' ? 'questions' : '个重点问题'} · ${state.visitHistory?.length || 0} ${lang === 'en' ? 'prior visits' : '次相关复诊'}</span>
            <span class="tap-arrow">${dict.tapToView} ›</span>
          </div>
        </section>

        <!-- Primary Highlight 2: Physician Voice Summary / Report -->
        <section class="clinical-card vr-card">
          <div class="card-head" style="margin-bottom: 6px;">
            <div class="card-title-group">
              <span class="vr-icon-badge">📋</span>
              <h2>${dict.visitReportTitle}</h2>
            </div>
            ${
              !isSnapshot
                ? `<button type="button" class="btn-voice-cta no-print" data-action="open-voice-summary">🎙️ ${dict.voiceInputBtn}</button>`
                : ''
            }
          </div>
          <div class="tap-inline-area" data-action="open-doc-section" data-section="report" role="button" tabindex="0">
            <div class="vr-home-preview">${escapeHtml(vrPreview)}</div>
            <div class="tap-card-foot" style="margin-top:6px;">
              <span>${vr ? (lang === 'en' ? 'Ready to view / print' : '已生成报告，点击查看完整内容') : (lang === 'en' ? 'Or tap 🎙️ above to dictate' : '可点右上角 🎙️ 口述或点此查看')}</span>
              <span class="tap-arrow">›</span>
            </div>
          </div>
        </section>

        <!-- Tap-to-Enter Section Directory (Large Mobile Cards) -->
        <nav class="nav-cards-list" aria-label="Medical Summary Sections">
          <button type="button" class="nav-card nav-card-qa" data-action="open-doc-section" data-section="qa">
            <span class="nav-card-ico ico-dark">💬</span>
            <div class="nav-card-body">
              <div class="nav-card-title">${dict.navCards.qaTitle}</div>
              <div class="nav-card-sub">${dict.navCards.qaSub}</div>
            </div>
            <span class="nav-card-chevron">›</span>
          </button>

          <button type="button" class="nav-card" data-action="open-doc-section" data-section="symptoms">
            <span class="nav-card-ico ico-amber">🩺</span>
            <div class="nav-card-body">
              <div class="nav-card-title">${dict.navCards.symptomsTitle}</div>
              <div class="nav-card-sub">${escapeHtml(symPreview)}</div>
            </div>
            <span class="nav-card-chevron">›</span>
          </button>

          <button type="button" class="nav-card" data-action="open-doc-section" data-section="meds">
            <span class="nav-card-ico ico-green">💊</span>
            <div class="nav-card-body">
              <div class="nav-card-title">${dict.navCards.medsTitle}</div>
              <div class="nav-card-sub">${escapeHtml(medPreview)}</div>
            </div>
            <span class="nav-card-chevron">›</span>
          </button>

          ${
            !isFiltered || showWeightSection !== false
              ? `<button type="button" class="nav-card" data-action="open-doc-section" data-section="weight">
                  <span class="nav-card-ico ico-blue">⚖️</span>
                  <div class="nav-card-body">
                    <div class="nav-card-title">${dict.navCards.weightTitle}</div>
                    <div class="nav-card-sub tabular">${escapeHtml(weightPreview)}</div>
                  </div>
                  <span class="nav-card-chevron">›</span>
                </button>`
              : ''
          }

          <button type="button" class="nav-card" data-action="open-doc-section" data-section="vitals_labs">
            <span class="nav-card-ico ico-rose">📊</span>
            <div class="nav-card-body">
              <div class="nav-card-title">${dict.navCards.vitalsTitle}</div>
              <div class="nav-card-sub tabular">${escapeHtml(vitalsPreview)}</div>
            </div>
            <span class="nav-card-chevron">›</span>
          </button>

          <button type="button" class="nav-card" data-action="open-doc-section" data-section="history">
            <span class="nav-card-ico ico-slate">📁</span>
            <div class="nav-card-body">
              <div class="nav-card-title">${dict.navCards.historyTitle}</div>
              <div class="nav-card-sub">${escapeHtml(historyPreview)}</div>
            </div>
            <span class="nav-card-chevron">›</span>
          </button>
        </nav>

        ${
          isSnapshot
            ? `<div class="snapshot-footer no-print">
                <p>${dict.snapFooterTip}</p>
                <button class="btn-secondary-sm" data-action="exit-snapshot">${dict.exitSnapBtn}</button>
              </div>`
            : `<div class="doc-bottom-lock-tip no-print">
                <span>🔒 ${dict.lockedFooterTip}</span>
              </div>`
        }
      </main>

      <!-- Print-only full chart so browser Print/PDF always includes every section -->
      <div class="print-only-all">
        ${renderVisitSectionBody(ctx)}
        ${renderReportSectionBody(ctx)}
        ${renderSymptomsSectionBody(ctx)}
        ${renderMedsSectionBody(ctx)}
        ${renderWeightSectionBody(ctx)}
        ${renderVitalsLabsSectionBody(ctx)}
        ${renderHistorySectionBody(ctx)}
      </div>
    </div>
  `;
}

function renderDetailScreen(ctx, sectionId) {
  const { lang, unitSystem, dict, isSnapshot, scopeCtx } = ctx;
  const { isFiltered, showWeightSection } = scopeCtx;

  const visibleOrder = DETAIL_ORDER.filter((s) => !(isFiltered && showWeightSection === false && s === 'weight'));
  const curIdx = visibleOrder.indexOf(sectionId);
  const prevSec = curIdx > 0 ? visibleOrder[curIdx - 1] : null;
  const nextSec = curIdx >= 0 && curIdx < visibleOrder.length - 1 ? visibleOrder[curIdx + 1] : null;

  const titles = {
    visit: dict.navCards.visitTitle,
    report: dict.visitReportTitle,
    symptoms: dict.navCards.symptomsTitle,
    meds: dict.navCards.medsTitle,
    weight: dict.navCards.weightTitle,
    vitals_labs: dict.navCards.vitalsTitle,
    history: dict.navCards.historyTitle,
    qa: dict.navCards.qaTitle
  };

  let bodyHtml = '';
  if (sectionId === 'qa') bodyHtml = renderQaSectionBody(ctx);
  else if (sectionId === 'visit') bodyHtml = renderVisitSectionBody(ctx);
  else if (sectionId === 'report') bodyHtml = renderReportSectionBody(ctx);
  else if (sectionId === 'symptoms') bodyHtml = renderSymptomsSectionBody(ctx);
  else if (sectionId === 'meds') bodyHtml = renderMedsSectionBody(ctx);
  else if (sectionId === 'weight') bodyHtml = renderWeightSectionBody(ctx);
  else if (sectionId === 'vitals_labs') bodyHtml = renderVitalsLabsSectionBody(ctx);
  else if (sectionId === 'history') bodyHtml = renderHistorySectionBody(ctx);

  return `
    <div class="doc-shell detail-shell" id="doctor-view" data-active-section="${escapeHtml(sectionId)}">
      <header class="detail-header no-print">
        <button type="button" class="btn-back-pill" data-action="close-doc-section">
          <span>‹ ${dict.backToHome}</span>
        </button>
        <h1 class="detail-title">${escapeHtml(titles[sectionId] || '')}</h1>
        <div class="detail-header-right">
          <button class="btn-lang-pill" data-action="toggle-lang">${lang === 'zh' ? '中/EN' : 'EN/中'}</button>
          ${!isSnapshot ? `<button class="btn-lock-unlock" data-action="prompt-unlock">🔒</button>` : ''}
        </div>
      </header>

      <main class="detail-main">
        ${bodyHtml}

        <div class="detail-pager no-print">
          ${
            prevSec
              ? `<button type="button" class="btn-pager" data-action="open-doc-section" data-section="${prevSec}">‹ ${dict.prevSection}<br/><small>${escapeHtml(titles[prevSec])}</small></button>`
              : '<span></span>'
          }
          ${
            nextSec
              ? `<button type="button" class="btn-pager btn-pager-next" data-action="open-doc-section" data-section="${nextSec}">${dict.nextSection} ›<br/><small>${escapeHtml(titles[nextSec])}</small></button>`
              : ''
          }
        </div>
      </main>
    </div>
  `;
}

function renderQaSectionBody(ctx) {
  const { ui, lang, dict } = ctx;
  return `
    <section class="clinical-card qa-card">
      <div class="card-head" style="margin-bottom: 8px;">
        <div class="card-title-group">
          <span class="qa-icon-badge">💬</span>
          <h2>${dict.qaTitle}</h2>
        </div>
      </div>
      <span class="qa-safety-badge" style="display:inline-block;margin-bottom:10px;">${dict.qaBadge}</span>
      <form class="qa-form" data-form="doctor-qa">
        <input type="text" name="question" value="${escapeHtml(ui.qaInput || '')}" placeholder="${escapeHtml(dict.qaPlaceholder)}" class="qa-input" autocomplete="off"/>
        <button type="submit" class="btn-primary-sm">${dict.qaAskBtn}</button>
        ${ui.qaResult ? `<button type="button" class="btn-secondary-sm" data-action="clear-qa">${dict.qaClearBtn}</button>` : ''}
      </form>
      <div class="qa-chips">
        ${dict.qaChips
          .map((c) => `<button type="button" class="qa-chip" data-action="qa-chip" data-question="${escapeHtml(c.q)}">${escapeHtml(c.label)}</button>`)
          .join('')}
      </div>
      ${renderQaResultBox(ui.qaResult, lang)}
      ${
        ui.qaHistory?.length > 1
          ? `<details class="qa-history-details" open>
              <summary>${lang === 'en' ? `Earlier queries (${ui.qaHistory.length - 1})` : `本轮问询历史 (${ui.qaHistory.length - 1} 条)`}</summary>
              <div class="qa-history-list">
                ${ui.qaHistory.slice(1, 5).map((item) => renderQaResultBox(item, lang)).join('')}
              </div>
            </details>`
          : ''
      }
      <div class="qa-disclaimer">${dict.qaDisclaimer}</div>
    </section>
  `;
}

function renderVisitSectionBody(ctx) {
  const { state, scopeCtx, ui, lang, dict, isSnapshot } = ctx;
  const { isFiltered } = scopeCtx;
  const { visit } = state;
  const questionsList = pickText(visit, 'questions', lang) || [];
  const vhKeys = (state.visitHistory || []).map((vh) => `d:vh-${vh.id}`);

  return `
    <section class="clinical-card card-focus">
      <div class="card-head">
        <div class="card-title-group">
          <span class="card-badge-num">1</span>
          <h2>${dict.sec1Title}</h2>
        </div>
        <div class="visit-meta tabular">
          ${pickText(visit, 'department', lang) ? `<span class="dept-chip">${escapeHtml(pickText(visit, 'department', lang))}</span>` : ''}
          <span>${escapeHtml(formatDisplayDate(visit.visitDate, lang))}${visit.visitTime ? ` ${escapeHtml(visit.visitTime)}` : ''}</span>
          ${visit.visitDate && !isSnapshot ? `<button class="btn-mini no-print" data-action="export-ics">📅</button>` : ''}
        </div>
      </div>
      ${
        visit.doctorName || visit.clinicName
          ? `<div class="appt-provider-line">
              ${visit.doctorName ? `<span>👨‍⚕️ <strong>${escapeHtml(visit.doctorName)}</strong></span>` : ''}
              ${visit.clinicName ? `<span>🏥 ${escapeHtml(visit.clinicName)}</span>` : ''}
              ${visit.clinicPhone ? `<span class="tabular">📞 ${escapeHtml(visit.clinicPhone)}</span>` : ''}
              ${visit.clinicAddress ? `<span>📍 ${escapeHtml(visit.clinicAddress)}</span>` : ''}
            </div>`
          : ''
      }
      <p class="visit-purpose">${escapeHtml(
        pickText(visit, 'purpose', lang) ||
          (isFiltered
            ? lang === 'en'
              ? 'No active visit chief complaint set for this specialist yet — showing relevant prior visits below.'
              : '当前暂无该医生/专科的待诊主诉；以下为与该医生相关的过往就诊记录。'
            : '—')
      )}</p>
      ${pickText(visit, 'onsetSummary', lang) ? `<div class="onset-bar"><strong>${dict.onsetSummaryLabel}</strong>${escapeHtml(pickText(visit, 'onsetSummary', lang))}</div>` : ''}
      ${
        questionsList.length
          ? `<div style="margin-top:12px;">
              ${renderFoldCard({
                key: 'd:visit-q',
                ui,
                defaultOpen: true,
                titleHtml: `<strong class="fold-title-sm">❓ ${dict.questionsLabel}</strong>`,
                badgeHtml: `<span class="count-pill tabular">${questionsList.length} ${dict.itemsCount}</span>`,
                bodyHtml: `<ol class="questions-list">${questionsList.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol>`
              })}
            </div>`
          : ''
      }
      ${
        state.visitHistory?.length
          ? `<div class="fold-section-block">
              <div class="sub-label-row">
                <span class="sub-label">📁 ${isFiltered ? (lang === 'en' ? 'Prior Visits with This Doctor' : '本医生 / 本专科过往就诊') : dict.visitHistoryTitle} (${state.visitHistory.length})</span>
                ${renderExpandAllPill(vhKeys, ui, dict)}
              </div>
              <div class="fold-list">
                ${state.visitHistory
                  .map((vh) =>
                    renderFoldCard({
                      key: `d:vh-${vh.id}`,
                      ui,
                      defaultOpen: false,
                      titleHtml: `<strong class="fold-title-sm tabular">${escapeHtml(formatDisplayDate(vh.date, lang))} · ${escapeHtml(pickText(vh, 'purpose', lang))}</strong>`,
                      badgeHtml: vh.doctorName ? `<span class="dept-chip">${escapeHtml(vh.doctorName)}</span>` : '',
                      bodyHtml: `<div class="visit-hist-notes">${escapeHtml(pickText(vh, 'doctorNotes', lang) || '—')}</div>`
                    })
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }
    </section>
  `;
}

function renderReportSectionBody(ctx) {
  const { state, lang, dict, isSnapshot } = ctx;
  return renderVisitReportCard(state.visit?.visitReport, lang, dict, isSnapshot);
}

function renderSymptomsSectionBody(ctx) {
  const { state, ui, lang, dict } = ctx;
  const { symptoms, rosNegatives } = state;
  const allKeys = [
    ...(symptoms || []).map((s) => `d:sym-${s.id}`),
    ...(rosNegatives?.length ? ['d:ros'] : [])
  ];

  return `
    <section class="clinical-card">
      <div class="card-head">
        <div class="card-title-group">
          <span class="card-badge-num">2</span>
          <h2>${dict.sec2Title}</h2>
        </div>
        <div class="card-head-actions">
          <span class="count-pill tabular">${symptoms?.length || 0} ${dict.itemsCount}</span>
          ${renderExpandAllPill(allKeys, ui, dict)}
        </div>
      </div>
      ${
        symptoms?.length
          ? `<div class="fold-list">
              ${symptoms
                .map((s) => {
                  const sevLabel = dict.severity[s.severity] || dict.severity.mild;
                  const trLabel = dict.trend[s.trend] || dict.trend.stable;
                  const notesTxt = pickText(s, 'notes', lang);
                  const selfCareTxt = pickText(s, 'selfCare', lang);
                  const durTxt = pickText(s, 'durationText', lang) || '—';
                  return renderFoldCard({
                    key: `d:sym-${s.id}`,
                    ui,
                    defaultOpen: false,
                    cardCls: 'fold-symptom',
                    titleHtml: `<span class="symptom-name">${escapeHtml(pickText(s, 'name', lang))}</span>`,
                    badgeHtml: `
                      <div class="symptom-pills">
                        <span class="pill ${SEVERITY_CLS[s.severity] || 'pill-muted'}">${sevLabel}</span>
                        <span class="pill ${TREND_CLS[s.trend] || 'trend-flat'}">${trLabel}</span>
                      </div>
                    `,
                    metaHtml: `<span class="tabular">${dict.durationLabel}${escapeHtml(durTxt)}${s.onsetDate ? ` · ${dict.onsetLabel}${escapeHtml(formatDisplayDate(s.onsetDate, lang))}` : ''}</span>`,
                    bodyHtml: `
                      ${notesTxt ? `<p class="symptom-notes">${escapeHtml(notesTxt)}</p>` : `<p class="symptom-notes muted-sm">${lang === 'en' ? 'No extra clinical notes' : '暂无补充症状描述'}</p>`}
                      ${selfCareTxt ? `<div class="self-care">${dict.selfCareLabel}${escapeHtml(selfCareTxt)}</div>` : ''}
                    `
                  });
                })
                .join('')}
            </div>`
          : `<div class="empty-box">${dict.noSymptoms}</div>`
      }
      ${
        rosNegatives?.length
          ? `<div style="margin-top: 12px;">
              ${renderFoldCard({
                key: 'd:ros',
                ui,
                defaultOpen: false,
                cardCls: 'fold-ros',
                titleHtml: `<strong class="fold-title-sm">🛡️ ${dict.rosTitle}</strong>`,
                badgeHtml: `<span class="count-pill tabular">${rosNegatives.length} ${dict.itemsCount}</span>`,
                metaHtml: escapeHtml(rosNegatives.slice(0, 2).map((n) => pickText(n, 'text', lang)).join(' · ')),
                bodyHtml: `<div class="ros-chips">${rosNegatives.map((n) => `<span class="ros-chip">✓ ${escapeHtml(pickText(n, 'text', lang))}</span>`).join('')}</div>`
              })}
            </div>`
          : ''
      }
    </section>
  `;
}

function renderMedsSectionBody(ctx) {
  const { state, scopeCtx, ui, lang, dict } = ctx;
  const { isFiltered, otherActiveMeds } = scopeCtx;
  const { medications } = state;
  const activeMeds = (medications || []).filter((m) => m.status === 'active');
  const recentMeds = (medications || []).filter((m) => m.status === 'recent');
  const medTab = ui.doctorMedTab || 'all';
  const showActive = medTab === 'all' || medTab === 'active';
  const showRecent = medTab === 'all' || medTab === 'recent';

  const visibleMedKeys = [
    ...(showActive ? activeMeds : []).map((m) => `d:med-${m.id}`),
    ...(showRecent ? recentMeds : []).map((m) => `d:med-${m.id}`),
    ...(isFiltered && otherActiveMeds.length > 0 ? ['d:med-other-group', ...otherActiveMeds.map((m) => `d:med-other-${m.id}`)] : [])
  ];

  return `
    <section class="clinical-card">
      <div class="card-head">
        <div class="card-title-group">
          <span class="card-badge-num">3</span>
          <h2>${dict.sec3Title}</h2>
        </div>
        ${renderExpandAllPill(visibleMedKeys, ui, dict)}
      </div>

      <div class="seg-tabs full-width no-print" style="margin-bottom: 12px;">
        <button class="seg-btn ${medTab === 'all' ? 'active' : ''}" data-action="doc-med-tab" data-tab="all">${dict.medTabAll} (${medications?.length || 0})</button>
        <button class="seg-btn ${medTab === 'active' ? 'active' : ''}" data-action="doc-med-tab" data-tab="active">${dict.medTabActive} (${activeMeds.length})</button>
        <button class="seg-btn ${medTab === 'recent' ? 'active' : ''}" data-action="doc-med-tab" data-tab="recent">${dict.medTabRecent} (${recentMeds.length})</button>
      </div>

      ${
        showActive
          ? `<div class="med-group">
              <div class="med-group-title med-active-title">💊 ${dict.medActiveHeading} (${activeMeds.length})</div>
              ${
                activeMeds.length
                  ? `<div class="fold-list">${activeMeds.map((m) => renderMedCard(m, false, lang, dict, ui)).join('')}</div>`
                  : `<div class="empty-inline">${dict.noActiveMeds}</div>`
              }
            </div>`
          : ''
      }

      ${
        showRecent
          ? `<div class="med-group" style="margin-top: 14px;">
              <div class="med-group-title med-recent-title">🕒 ${dict.medRecentHeading} (${recentMeds.length})</div>
              ${
                recentMeds.length
                  ? `<div class="fold-list">${recentMeds.map((m) => renderMedCard(m, true, lang, dict, ui)).join('')}</div>`
                  : `<div class="empty-inline">${dict.noRecentMeds}</div>`
              }
            </div>`
          : ''
      }

      ${
        isFiltered && otherActiveMeds.length > 0
          ? `<div style="margin-top: 14px;">
              ${renderFoldCard({
                key: 'd:med-other-group',
                ui,
                defaultOpen: false,
                cardCls: 'fold-warning',
                titleHtml: `<strong class="fold-title-sm">⚠️ ${lang === 'en' ? `Other Active Meds (${otherActiveMeds.length})` : `其他专科在服药 (${otherActiveMeds.length}项 · 防冲突核对)`}</strong>`,
                metaHtml: escapeHtml(otherActiveMeds.map((m) => pickText(m, 'name', lang)).join(' · ')),
                bodyHtml: `<div class="fold-list">${otherActiveMeds.map((m) => renderMedCard(m, false, lang, dict, ui, 'd:med-other-')).join('')}</div>`
              })}
            </div>`
          : ''
      }
    </section>
  `;
}

function renderWeightSectionBody(ctx) {
  const { state, ui, lang, unitSystem, dict } = ctx;
  const { profile, weights } = state;
  const rangedWeights = filterWeightsByRange(weights, ui.weightRange);
  const wtStats = summarizeWeightStats(rangedWeights, profile.heightCm, lang);

  return `
    <section class="clinical-card">
      <div class="card-head">
        <div class="card-title-group">
          <span class="card-badge-num">4</span>
          <h2>${dict.sec4Title}</h2>
        </div>
        <div class="seg-tabs no-print">
          <button class="seg-btn ${ui.weightRange === 30 ? 'active' : ''}" data-action="weight-range" data-range="30">${dict.range30}</button>
          <button class="seg-btn ${ui.weightRange === 90 ? 'active' : ''}" data-action="weight-range" data-range="90">${dict.range90}</button>
          <button class="seg-btn ${ui.weightRange === 'all' ? 'active' : ''}" data-action="weight-range" data-range="all">${dict.rangeAll}</button>
        </div>
      </div>

      ${
        wtStats
          ? (() => {
              const latestFmt = formatWeightValue(wtStats.latest.weightKg, unitSystem);
              const deltaFmt = formatWeightValue(Math.abs(wtStats.deltaKg), unitSystem);
              const sign = wtStats.deltaKg > 0 ? '+' : wtStats.deltaKg < 0 ? '-' : '';
              return `
                <div class="kpi-row">
                  <div class="kpi-box">
                    <div class="kpi-label">${dict.latestWeight}</div>
                    <div class="kpi-val tabular">${latestFmt.val} <small>${latestFmt.unit}</small></div>
                    <div class="kpi-sub tabular">${formatDisplayDate(wtStats.latest.date, lang)}</div>
                  </div>
                  <div class="kpi-box">
                    <div class="kpi-label">${dict.currentBmi}</div>
                    <div class="kpi-val tabular">${wtStats.bmi ? wtStats.bmi.value : '—'} ${
                      wtStats.bmi ? `<span class="bmi-tag tone-${wtStats.bmi.tone}">${wtStats.bmi.label}</span>` : ''
                    }</div>
                    <div class="kpi-sub">${profile.heightCm ? `${dict.heightLabel} ${formatHeight(profile.heightCm, unitSystem)}` : '—'}</div>
                  </div>
                  <div class="kpi-box ${wtStats.significantLoss ? 'kpi-alert' : ''}">
                    <div class="kpi-label">${dict.rangeChange}</div>
                    <div class="kpi-val tabular ${wtStats.deltaKg < 0 ? 'text-blue' : wtStats.deltaKg > 0 ? 'text-amber' : ''}">
                      ${sign}${deltaFmt.val} <small>${deltaFmt.unit}</small>
                    </div>
                    <div class="kpi-sub tabular">${wtStats.deltaPct > 0 ? '+' : ''}${wtStats.deltaPct}% (${rangedWeights.length} ${dict.recordsUnit})</div>
                  </div>
                </div>
                ${
                  wtStats.significantLoss
                    ? `<div class="clinical-alert-strip">⚠️ ${dict.weightAlertPrefix} ${Math.abs(wtStats.deltaPct)}% (${deltaFmt.val} ${deltaFmt.unit})${dict.weightAlertSuffix}</div>`
                    : ''
                }
                <div class="chart-wrap">
                  ${renderWeightChartSvg(rangedWeights, profile.heightCm, ui.selectedWeightIdx, lang, unitSystem)}
                </div>
              `;
            })()
          : `<div class="empty-box">—</div>`
      }
    </section>
  `;
}

function renderVitalsLabsSectionBody(ctx) {
  const { state, scopeCtx, ui, lang, unitSystem, dict } = ctx;
  const { isFiltered, allowedVitalTypes } = scopeCtx;
  const { vitals, attachments } = state;
  const repKeys = (attachments || []).map((a) => `d:rep-${a.id}`);
  const examList = [...(state.examHistory || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const examKeys = examList.map((e) => `d:exam-${e.id}`);

  return `
    <section class="clinical-card">
      <div class="card-head">
        <div class="card-title-group">
          <span class="card-badge-num">5</span>
          <h2>${dict.sec5Title}</h2>
        </div>
      </div>

      <div class="vitals-grid">
        ${VITAL_TYPES.map((type) => {
          if (isFiltered && allowedVitalTypes && !allowedVitalTypes.includes(type)) return '';
          const meta = dict.vitalsMeta[type];
          const list = (vitals || []).filter((v) => v.type === type).sort((a, b) => b.date.localeCompare(a.date));
          const latest = list[0];
          if (!latest && (type === 'spo2' || type === 'pain')) return '';
          const isHrHigh = type === 'hr' && latest && latest.value1 >= 90;
          const fmt = formatVitalReading(latest, unitSystem);
          const hint = unitSystem === 'us' ? meta.hintUs : meta.hintMetric;
          return `
            <div class="vital-card ${isHrHigh ? 'vital-attention' : ''}">
              <div class="vital-top">
                <span class="vital-title">${meta.icon} ${meta.title}</span>
                <span class="vital-ref">${hint}</span>
              </div>
              <div class="vital-main">
                <div>
                  <div class="vital-num tabular">${fmt.display} <small>${escapeHtml(fmt.unit)}</small></div>
                  <div class="vital-date tabular">${latest ? `${formatDisplayDate(latest.date, lang)}${latest.context ? ` · ${escapeHtml(latest.context)}` : ''}` : '—'}</div>
                </div>
                <div class="vital-spark">${renderVitalSparkline(list, type)}</div>
              </div>
              ${
                list.length > 1
                  ? `<div class="vital-mini-hist tabular">${list
                      .slice(0, 3)
                      .map((item) => `${formatVitalReading(item, unitSystem).display}(${item.date.slice(5)})`)
                      .join(' · ')}</div>`
                  : ''
              }
            </div>
          `;
        }).join('')}
      </div>

      <div class="reports-block">
        <div class="sub-label-row">
          <span class="sub-label">${dict.reportsTitle} (${attachments?.length || 0})</span>
          ${renderExpandAllPill(repKeys, ui, dict)}
        </div>
        ${
          attachments?.length
            ? `<div class="fold-list">
                ${attachments
                  .map((att) => {
                    const titleTxt = pickText(att, 'title', lang);
                    const sumTxt = pickText(att, 'summaryHighlight', lang);
                    return renderFoldCard({
                      key: `d:rep-${att.id}`,
                      ui,
                      defaultOpen: false,
                      cardCls: att.isAbnormal ? 'fold-abnormal' : '',
                      titleHtml: `<strong class="report-title">${escapeHtml(titleTxt)}</strong>`,
                      badgeHtml: att.isAbnormal ? `<span class="pill pill-red">${dict.abnormalFlag}</span>` : `<span class="pill pill-green">${dict.normalFlag}</span>`,
                      metaHtml: `<span class="tabular">${escapeHtml(formatDisplayDate(att.date, lang))}${sumTxt ? ` · ${escapeHtml(sumTxt.slice(0, 32))}` : ''}</span>`,
                      bodyHtml: `
                        <div class="report-expanded-body">
                          ${sumTxt ? `<div class="report-summary">${escapeHtml(sumTxt)}</div>` : ''}
                          ${
                            att.imageDataUrl
                              ? `<button class="report-thumb-btn" style="margin-top:8px;" data-action="preview-image" data-title="${escapeHtml(titleTxt)}" data-src="${escapeHtml(att.imageDataUrl)}">
                                  <img src="${escapeHtml(att.imageDataUrl)}" alt="${escapeHtml(titleTxt)}"/>
                                  <span class="zoom-tag">🔍 ${dict.zoomLabel}</span>
                                </button>`
                              : ''
                          }
                        </div>
                      `
                    });
                  })
                  .join('')}
              </div>`
            : `<div class="empty-inline">${dict.noReports}</div>`
        }
      </div>

      <div class="reports-block">
        <div class="sub-label-row">
          <span class="sub-label">🔬 ${dict.examHistoryTitle} (${examList.length})</span>
          ${renderExpandAllPill(examKeys, ui, dict)}
        </div>
        ${
          examList.length
            ? `<div class="fold-list">
                ${examList
                  .map((ex) => {
                    const nameTxt = pickText(ex, 'name', lang);
                    const resTxt = pickText(ex, 'resultSummary', lang);
                    const facTxt = pickText(ex, 'facility', lang);
                    const catLabel = dict.examCategories?.[ex.category] || ex.category || '';
                    return renderFoldCard({
                      key: `d:exam-${ex.id}`,
                      ui,
                      defaultOpen: false,
                      cardCls: ex.isAbnormal ? 'fold-abnormal' : '',
                      titleHtml: `<strong class="exam-name">${escapeHtml(nameTxt)}</strong>`,
                      badgeHtml: ex.isAbnormal ? `<span class="pill pill-red">${dict.abnormalFlag}</span>` : `<span class="pill pill-green">${dict.normalFlag}</span>`,
                      metaHtml: `<span class="tabular">${escapeHtml(formatDisplayDate(ex.date, lang))}${catLabel ? ` · ${escapeHtml(catLabel)}` : ''}</span>`,
                      bodyHtml: `
                        ${facTxt ? `<div class="exam-facility">${escapeHtml(facTxt)}</div>` : ''}
                        ${resTxt ? `<div class="exam-summary">${escapeHtml(resTxt)}</div>` : ''}
                        ${
                          ex.imageDataUrl
                            ? `<button class="btn-mini" style="margin-top:8px;" data-action="preview-image" data-title="${escapeHtml(nameTxt)}" data-src="${escapeHtml(ex.imageDataUrl)}">🔍 ${dict.zoomLabel}</button>`
                            : ''
                        }
                      `
                    });
                  })
                  .join('')}
              </div>`
            : `<div class="empty-inline">${dict.noExamHistory}</div>`
        }
      </div>
    </section>
  `;
}

function renderHistorySectionBody(ctx) {
  const { state, ui, lang, dict, isSnapshot } = ctx;
  const { profile, careTeam, history, socialHistory } = state;
  const hasCareTeam = careTeam && (pickText(careTeam, 'pharmacy', lang) || pickText(careTeam, 'pcp', lang) || pickText(careTeam, 'insurance', lang));
  const surgeries = pickText(history, 'surgeries', lang) || [];
  const familyHx = pickText(history, 'familyHistory', lang) || [];

  const histKeys = [
    ...(hasCareTeam ? ['d:careteam'] : []),
    'd:pmh',
    'd:psh-fh',
    'd:sh',
    ...(state.visitHistory?.length ? ['d:vh-all'] : [])
  ];

  return `
    <section class="clinical-card">
      <div class="card-head">
        <div class="card-title-group">
          <span class="card-badge-num">6</span>
          <h2>${dict.sec6Title}</h2>
        </div>
        ${renderExpandAllPill(histKeys, ui, dict)}
      </div>

      <div class="fold-list">
        ${
          hasCareTeam
            ? renderFoldCard({
                key: 'd:careteam',
                ui,
                defaultOpen: false,
                titleHtml: `<strong class="fold-title-sm">🏥 ${dict.careLogisticsTitle}</strong>`,
                metaHtml: escapeHtml(pickText(careTeam, 'pharmacy', lang) || pickText(careTeam, 'pcp', lang) || ''),
                bodyHtml: `
                  <div class="logistics-grid">
                    ${pickText(careTeam, 'pharmacy', lang) ? `<div><strong>${dict.pharmacyLabel}:</strong> ${escapeHtml(pickText(careTeam, 'pharmacy', lang))}</div>` : ''}
                    ${pickText(careTeam, 'pcp', lang) ? `<div><strong>${dict.pcpLabel}:</strong> ${escapeHtml(pickText(careTeam, 'pcp', lang))}</div>` : ''}
                    ${pickText(careTeam, 'insurance', lang) ? `<div><strong>${dict.insuranceLabel}:</strong> ${escapeHtml(pickText(careTeam, 'insurance', lang))}</div>` : ''}
                  </div>
                `
              })
            : ''
        }

        ${renderFoldCard({
          key: 'd:pmh',
          ui,
          defaultOpen: false,
          titleHtml: `<strong class="fold-title-sm">📌 ${dict.pmhLabel}</strong>`,
          badgeHtml: `<span class="count-pill tabular">${history?.conditions?.length || 0} ${dict.itemsCount}</span>`,
          metaHtml: history?.conditions?.length
            ? escapeHtml(history.conditions.slice(0, 2).map((c) => pickText(c, 'name', lang)).join(' · '))
            : '—',
          bodyHtml: history?.conditions?.length
            ? `<div class="cond-list">
                ${history.conditions
                  .map(
                    (c) => `
                    <div class="cond-item">
                      <div class="cond-main">
                        <strong>${escapeHtml(pickText(c, 'name', lang))}</strong>
                        <span class="pill pill-blue">${escapeHtml(pickText(c, 'status', lang) || 'Active')}</span>
                      </div>
                      <div class="cond-sub tabular">${escapeHtml(c.diagnosedYear || '—')} ${pickText(c, 'note', lang) ? `· ${escapeHtml(pickText(c, 'note', lang))}` : ''}</div>
                    </div>
                  `
                  )
                  .join('')}
              </div>`
            : `<div class="empty-inline">—</div>`
        })}

        ${renderFoldCard({
          key: 'd:psh-fh',
          ui,
          defaultOpen: false,
          titleHtml: `<strong class="fold-title-sm">🧬 ${dict.pshLabel} & ${dict.fhLabel}</strong>`,
          badgeHtml: `<span class="count-pill tabular">${surgeries.length + familyHx.length} ${dict.itemsCount}</span>`,
          metaHtml: `${dict.pshLabel} (${surgeries.length}) · ${dict.fhLabel} (${familyHx.length})`,
          bodyHtml: `
            <div class="history-grid">
              <div class="history-box">
                <div class="sub-label">${dict.pshLabel}</div>
                ${
                  surgeries.length
                    ? `<ul class="simple-list">${surgeries.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
                    : `<div class="muted-sm">—</div>`
                }
              </div>
              <div class="history-box">
                <div class="sub-label">${dict.fhLabel}</div>
                ${
                  familyHx.length
                    ? `<ul class="simple-list">${familyHx.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
                    : `<div class="muted-sm">—</div>`
                }
              </div>
            </div>
          `
        })}

        ${renderFoldCard({
          key: 'd:sh',
          ui,
          defaultOpen: false,
          titleHtml: `<strong class="fold-title-sm">🌿 ${dict.shLabel}</strong>`,
          metaHtml: escapeHtml([pickText(socialHistory, 'smoking', lang), pickText(socialHistory, 'alcohol', lang)].filter(Boolean).join(' · ') || '—'),
          bodyHtml: `
            <div class="social-grid">
              <div><span class="muted-sm">${dict.smokingLabel}:</span> <strong>${escapeHtml(pickText(socialHistory, 'smoking', lang) || (lang === 'en' ? 'Not documented' : '未记录'))}</strong></div>
              <div><span class="muted-sm">${dict.alcoholLabel}:</span> <strong>${escapeHtml(pickText(socialHistory, 'alcohol', lang) || (lang === 'en' ? 'Not documented' : '未记录'))}</strong></div>
              <div><span class="muted-sm">${dict.pregnancyLabel}:</span> <strong>${escapeHtml(pickText(socialHistory, 'pregnancy', lang) || (lang === 'en' ? 'Not documented' : '未记录'))}</strong></div>
              <div><span class="muted-sm">${dict.occupationLabel}:</span> <strong>${escapeHtml(pickText(socialHistory, 'occupation', lang) || (lang === 'en' ? 'Not documented' : '未记录'))}</strong></div>
            </div>
          `
        })}

        ${
          state.visitHistory?.length
            ? renderFoldCard({
                key: 'd:vh-all',
                ui,
                defaultOpen: false,
                titleHtml: `<strong class="fold-title-sm">📁 ${dict.visitHistoryTitle}</strong>`,
                badgeHtml: `<span class="count-pill tabular">${state.visitHistory.length}</span>`,
                metaHtml: escapeHtml(state.visitHistory.slice(0, 1).map((vh) => `${formatDisplayDate(vh.date, lang)} ${pickText(vh, 'purpose', lang)}`).join('')),
                bodyHtml: `
                  <div class="visit-hist-list">
                    ${state.visitHistory
                      .map(
                        (vh) => `
                        <div class="visit-hist-item">
                          <div class="visit-hist-top tabular">
                            <strong>${escapeHtml(formatDisplayDate(vh.date, lang))}</strong>
                            ${pickText(vh, 'department', lang) ? `<span class="dept-chip">${escapeHtml(pickText(vh, 'department', lang))}</span>` : ''}
                            <span>${escapeHtml(pickText(vh, 'purpose', lang))}</span>
                          </div>
                          ${pickText(vh, 'doctorNotes', lang) ? `<div class="visit-hist-notes">${escapeHtml(pickText(vh, 'doctorNotes', lang))}</div>` : ''}
                        </div>
                      `
                      )
                      .join('')}
                  </div>
                `
              })
            : ''
        }
      </div>

      ${pickText(profile, 'emergencyContact', lang) && !isSnapshot ? `<div class="emergency-bar">${dict.emergencyLabel}${escapeHtml(pickText(profile, 'emergencyContact', lang))}</div>` : ''}
    </section>
  `;
}

function renderVisitReportCard(vr, lang, dict, isSnapshot) {
  const diag = vr ? pickText(vr, 'diagnosis', lang) : '';
  const medPlan = vr ? pickText(vr, 'medPlan', lang) : '';
  const testsPlan = vr ? pickText(vr, 'testsPlan', lang) : '';
  const followUp = vr ? pickText(vr, 'followUp', lang) : '';
  const takeaway = vr ? pickText(vr, 'patientTakeaway', lang) : '';

  return `
    <section class="clinical-card vr-card" id="visit-report-card">
      <div class="card-head">
        <div class="card-title-group">
          <span class="vr-icon-badge">📋</span>
          <h2>${dict.visitReportTitle}</h2>
        </div>
        ${!isSnapshot ? `<button type="button" class="btn-voice-cta no-print" data-action="open-voice-summary">🎙️ ${dict.voiceInputBtn}</button>` : ''}
      </div>
      ${
        vr
          ? `<div class="vr-meta tabular">
              ${vr.doctorName ? `<span>👨‍⚕️ ${escapeHtml(vr.doctorName)}</span>` : ''}
              ${vr.updatedAt ? `<span>${escapeHtml(new Date(vr.updatedAt).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))}</span>` : ''}
              ${vr.nextFollowUpDate ? `<span class="dept-chip">${lang === 'en' ? 'Follow-up:' : '建议复诊:'} ${escapeHtml(formatDisplayDate(vr.nextFollowUpDate, lang))}</span>` : ''}
            </div>
            <div class="vr-grid">
              ${diag ? `<div class="vr-row"><strong>${dict.vrDiagnosis}</strong><div>${escapeHtml(diag)}</div></div>` : ''}
              ${medPlan ? `<div class="vr-row"><strong>${dict.vrMedPlan}</strong><div>${escapeHtml(medPlan)}</div></div>` : ''}
              ${testsPlan ? `<div class="vr-row"><strong>${dict.vrTestsPlan}</strong><div>${escapeHtml(testsPlan)}</div></div>` : ''}
              ${followUp ? `<div class="vr-row"><strong>${dict.vrFollowUp}</strong><div>${escapeHtml(followUp)}</div></div>` : ''}
            </div>
            ${takeaway ? `<div class="vr-takeaway"><strong>💡 ${dict.vrTakeaway}：</strong>${escapeHtml(takeaway)}</div>` : ''}
            ${
              vr.rawTranscript
                ? `<details class="vr-transcript-details no-print">
                    <summary>${dict.vrRawTranscript}</summary>
                    <p>${escapeHtml(vr.rawTranscript)}</p>
                  </details>`
                : ''
            }`
          : `<div class="vr-empty-tip">${dict.voiceEmptyTip}</div>`
      }
    </section>
  `;
}

function renderQaResultBox(res, lang) {
  if (!res) return '';
  const isEn = lang === 'en';
  return `
    <div class="qa-answer-box status-${res.status}">
      <div class="qa-q-line"><strong>Q:</strong> ${escapeHtml(res.question)}</div>
      ${
        res.facts?.length
          ? `<div class="qa-facts">
              ${res.facts
                .map(
                  (f) => `
                  <div class="qa-fact-item">
                    <span class="qa-src-tag">${escapeHtml(f.source)}</span>
                    <span>${escapeHtml(f.text)}</span>
                  </div>
                `
                )
                .join('')}
            </div>`
          : ''
      }
      ${
        res.unknowns?.length
          ? `<div class="qa-unknowns">
              ${res.unknowns
                .map(
                  (u) => `
                  <div class="qa-unknown-item">
                    <span class="qa-unk-tag">${isEn ? 'UNCLEAR / MISSING' : '不清楚 · 未记录'}</span>
                    <span>${escapeHtml(u)}</span>
                  </div>
                `
                )
                .join('')}
            </div>`
          : ''
      }
    </div>
  `;
}

function renderMedCard(m, isRecent, lang, dict, ui = {}, keyPrefix = 'd:med-') {
  const name = pickText(m, 'name', lang);
  const dosage = pickText(m, 'dosage', lang);
  const freq = pickText(m, 'frequency', lang);
  const timing = pickText(m, 'timing', lang);
  const lastTaken = pickText(m, 'lastTaken', lang);
  const stopReason = pickText(m, 'stopReason', lang);
  const notes = pickText(m, 'notes', lang);
  const catTag = m.category === 'otc' ? dict.medOtcTag : dict.medRxTag;

  const metaParts = [dosage, freq, !isRecent && lastTaken ? `✅ ${lastTaken}` : ''].filter(Boolean);

  return renderFoldCard({
    key: `${keyPrefix}${m.id}`,
    ui,
    defaultOpen: false,
    cardCls: `med-fold ${isRecent ? 'med-card-recent' : 'med-card-active'}`,
    titleHtml: `
      <span class="med-cat-badge ${m.category === 'otc' ? 'cat-otc' : 'cat-rx'}">${catTag}</span>
      <span class="med-name">${escapeHtml(name)}</span>
    `,
    metaHtml: metaParts.length ? `<span class="tabular">${escapeHtml(metaParts.join(' · '))}</span>` : '',
    bodyHtml: `
      <div class="med-card-body">
        ${
          m.photoDataUrl || m.genericName || timing
            ? `<div class="med-top" style="margin-bottom:6px;">
                <div>
                  ${m.genericName ? `<div class="med-generic">${escapeHtml(m.genericName)}</div>` : ''}
                  ${timing ? `<div class="med-timing-line">🕒 ${escapeHtml(timing)}</div>` : ''}
                </div>
                ${
                  m.photoDataUrl
                    ? `<button class="med-thumb-btn" data-action="preview-image" data-title="${escapeHtml(name)}" data-src="${escapeHtml(m.photoDataUrl)}">
                        <img src="${escapeHtml(m.photoDataUrl)}" alt="${dict.medBoxLabel}"/>
                        <span>${dict.medBoxLabel}</span>
                      </button>`
                    : ''
                }
              </div>`
            : ''
        }
        <div class="med-dates tabular">
          ${
            isRecent
              ? `${dict.cycleLabel}${escapeHtml(formatDisplayDate(m.startDate, lang) || '?')} – ${escapeHtml(formatDisplayDate(m.endDate, lang) || '')}`
              : `${dict.startLabel}${escapeHtml(formatDisplayDate(m.startDate, lang) || '')}`
          }
        </div>
        ${isRecent && stopReason ? `<div class="stop-reason"><strong>${dict.stopReasonLabel}</strong>${escapeHtml(stopReason)}</div>` : ''}
        ${notes ? `<div class="med-notes">${escapeHtml(notes)}</div>` : ''}
      </div>
    `
  });
}
