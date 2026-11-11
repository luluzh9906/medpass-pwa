/**
 * Read-only Physician View ("US Clinic SOAP / 30-Second Clinical Summary").
 * Supports Bilingual switching (ZH / EN), Dual Units (Metric / US),
 * and Zero-Hallucination Local Doctor Q&A grounded strictly in stored patient data.
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
  pickText,
  t
} from './i18n.js';
import { buildAvailableScopes, filterStateByScope } from './specialties.js';

const SEVERITY_CLS = { mild: 'pill-muted', moderate: 'pill-amber', severe: 'pill-red' };
const TREND_CLS = { worsening: 'trend-up', stable: 'trend-flat', improving: 'trend-down' };
const VITAL_TYPES = ['bp', 'hr', 'glucose', 'temp', 'spo2', 'pain'];

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
  const { isFiltered, activeScope, scopedState: state, otherActiveMeds, showWeightSection, allowedVitalTypes, hiddenSummary } =
    filterStateByScope(rawState, selectedScopeKey, availableScopes);

  const { profile, careTeam, visit, symptoms, rosNegatives, history, socialHistory, medications, weights, vitals, attachments } = state;
  const age = computeAge(profile);

  // Weight analytics
  const rangedWeights = filterWeightsByRange(weights, ui.weightRange);
  const wtStats = summarizeWeightStats(rangedWeights, profile.heightCm, lang);

  // Meds split
  const activeMeds = (medications || []).filter((m) => m.status === 'active');
  const recentMeds = (medications || []).filter((m) => m.status === 'recent');
  const medTab = ui.doctorMedTab || 'all';
  const showActive = medTab === 'all' || medTab === 'active';
  const showRecent = medTab === 'all' || medTab === 'recent';

  const allergiesList = pickText(profile, 'allergies', lang) || [];
  const alertsList = pickText(profile, 'specialAlerts', lang) || [];
  const questionsList = pickText(visit, 'questions', lang) || [];

  const updatedLabel = state.updatedAt
    ? new Date(state.updatedAt).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  return `
    <div class="doc-shell" id="doctor-view">
      <!-- Sticky Top Bar -->
      <header class="doc-header">
        <div class="doc-header-top">
          <div class="doc-status-pill ${isSnapshot ? 'status-snap' : 'status-live'}">
            <span class="pulse-dot"></span>
            <span>${isSnapshot ? `${dict.modeSnapshot} · ${escapeHtml(state.generatedAt || '')}` : `${dict.modeDocLocked} · ${updatedLabel}`}</span>
          </div>
          <div class="doc-header-actions no-print">
            <button class="btn-lang-pill" data-action="toggle-lang" title="Switch Chinese / English">
              ${lang === 'zh' ? '中 / EN' : 'EN / 中'}
            </button>
            <button class="btn-lang-pill" data-action="toggle-unit" title="Switch Metric / US Units">
              ${unitSystem === 'us' ? 'lbs·°F' : 'kg·°C'}
            </button>
            ${
              !isSnapshot
                ? `<button class="btn-icon-pill" data-action="open-qr" title="${dict.btnQr}">📱</button>`
                : ''
            }
            <button class="btn-icon-pill" data-action="print-summary" title="${dict.btnPrint}">🖨️</button>
            ${
              !isSnapshot
                ? `<button class="btn-lock-unlock" data-action="prompt-unlock">🔒 ${dict.btnUnlock}</button>`
                : ''
            }
          </div>
        </div>

        <div class="patient-strip">
          <div class="patient-identity">
            <h1 class="patient-name">${escapeHtml(pickText(profile, 'name', lang))}</h1>
            <div class="patient-tags tabular">
              <span>${escapeHtml(pickText(profile, 'gender', lang) || '—')}</span>
              ${age !== null ? `<span>${age} ${dict.ageUnit}</span>` : ''}
              ${profile.dob ? `<span>${dict.dobLabel}: ${formatDisplayDate(profile.dob, lang)}</span>` : ''}
              ${profile.heightCm ? `<span>${formatHeight(profile.heightCm, unitSystem)}</span>` : ''}
              ${profile.bloodType ? `<span class="tag-blood">${escapeHtml(profile.bloodType)}</span>` : ''}
            </div>
          </div>
          ${state.isDemo && !isSnapshot ? `<span class="demo-badge">${dict.demoBadge}</span>` : ''}
        </div>

        <!-- Allergy & Safety Red Banner -->
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
          ${
            alertsList.length
              ? `<div class="special-alerts">${alertsList.map((s) => `<span>· ${escapeHtml(s)}</span>`).join('')}</div>`
              : ''
          }
        </div>
      </header>

      <main class="doc-main">
        ${
          !isSnapshot && (ui.canInstallPrompt || ui.showIosInstallTip) && !ui.installBannerDismissed
            ? `<div class="install-banner no-print">
                <div>
                  <strong>📲 ${lang === 'en' ? 'Install MedPass to Home Screen' : '安装「医览通」到手机桌面'}</strong>
                  <div class="muted-xs">${
                    ui.canInstallPrompt
                      ? lang === 'en'
                        ? 'Works offline like a native app & protects local data.'
                        : '全屏离线运行，像原生小程序一样随时打开。'
                      : lang === 'en'
                        ? 'In Safari tap Share → "Add to Home Screen".'
                        : '在 Safari 点击底部「分享」→「添加到主屏幕」即可离线使用。'
                  }</div>
                </div>
                <div class="install-actions">
                  ${ui.canInstallPrompt ? `<button class="btn-primary-sm" data-action="trigger-install">${lang === 'en' ? 'Install' : '立即安装'}</button>` : ''}
                  <button class="btn-del-xs" data-action="dismiss-install" title="Dismiss">✕</button>
                </div>
              </div>`
            : ''
        }

        ${
          state.isDemo && !isSnapshot
            ? `<div class="demo-cta-bar no-print">
                <span>✨ ${lang === 'en' ? 'Viewing sample profile (Demo PIN: 1234).' : '当前为高保真示例档案（默认解锁码 1234）。'}</span>
                <button class="btn-mini" data-action="prompt-unlock">${lang === 'en' ? 'Unlock & Create Mine' : '解锁创建我的真实档案'}</button>
              </div>`
            : ''
        }

        <!-- Physician / Specialty Scope Switcher -->
        ${
          availableScopes.length > 0 && !isSnapshot
            ? `<section class="scope-bar no-print">
                <div class="scope-bar-top">
                  <span class="scope-bar-label">🎯 ${lang === 'en' ? 'View Scope (By Doctor / Specialty)' : '就诊视角（按医生 / 专科调取）'}</span>
                  ${
                    isFiltered
                      ? `<button class="btn-mini" data-action="set-doc-scope" data-scope="all">📋 ${lang === 'en' ? 'Show Full Chart' : '显示全部病例'}</button>`
                      : ''
                  }
                </div>
                <div class="scope-chips">
                  ${availableScopes
                    .map((sc) => {
                      const active = isFiltered ? activeScope?.key === sc.key : selectedScopeKey === sc.key;
                      return `<button type="button" class="scope-chip ${active ? 'active' : ''}" data-action="set-doc-scope" data-scope="${escapeHtml(sc.key)}">${escapeHtml(lang === 'en' ? sc.labelEn : sc.labelZh)}</button>`;
                    })
                    .join('')}
                  <button type="button" class="scope-chip ${!isFiltered ? 'active' : ''}" data-action="set-doc-scope" data-scope="all">📋 ${lang === 'en' ? 'Full Chart (All)' : '全部病例'}</button>
                </div>
                ${
                  isFiltered && hiddenSummary?.totalHidden > 0
                    ? `<div class="scope-notice">
                        ${
                          lang === 'en'
                            ? `Focused on <strong>${escapeHtml(activeScope.labelEn)}</strong> · ${hiddenSummary.totalHidden} unrelated specialty items hidden (Allergies & active med safety check retained).`
                            : `当前仅展示「<strong>${escapeHtml(activeScope.labelZh)}</strong>」相关记录，已折叠 ${hiddenSummary.totalHidden} 项其他专科条目（过敏史与在服药安全核对已保留）。`
                        }
                      </div>`
                    : ''
                }
              </section>`
            : ''
        }

        <!-- Interactive Physician Q&A Box (Fact-Grounded, Zero-Hallucination) -->
        <section class="clinical-card qa-card no-print">
          <div class="card-head" style="margin-bottom: 6px;">
            <div class="card-title-group">
              <span class="qa-icon-badge">💬</span>
              <h2>${dict.qaTitle}</h2>
            </div>
            <span class="qa-safety-badge">${dict.qaBadge}</span>
          </div>
          <form class="qa-form" data-form="doctor-qa">
            <input type="text" name="question" value="${escapeHtml(ui.qaInput || '')}" placeholder="${escapeHtml(dict.qaPlaceholder)}" class="qa-input" autocomplete="off"/>
            <button type="submit" class="btn-primary-sm">${dict.qaAskBtn}</button>
            ${ui.qaResult ? `<button type="button" class="btn-secondary-sm" data-action="clear-qa">${dict.qaClearBtn}</button>` : ''}
          </form>
          <div class="qa-chips">
            ${dict.qaChips
              .map(
                (c) => `<button type="button" class="qa-chip" data-action="qa-chip" data-question="${escapeHtml(c.q)}">${escapeHtml(c.label)}</button>`
              )
              .join('')}
          </div>
          ${renderQaResultBox(ui.qaResult, lang)}
          ${
            ui.qaHistory?.length > 1
              ? `<details class="qa-history-details">
                  <summary>${lang === 'en' ? `Earlier queries in this session (${ui.qaHistory.length - 1})` : `本轮问询历史 (${ui.qaHistory.length - 1} 条)`}</summary>
                  <div class="qa-history-list">
                    ${ui.qaHistory
                      .slice(1, 4)
                      .map((item) => renderQaResultBox(item, lang))
                      .join('')}
                  </div>
                </details>`
              : ''
          }
          <div class="qa-disclaimer">${dict.qaDisclaimer}</div>
        </section>

        <!-- Care Team & Preferred Pharmacy (US Clinic Standard) -->
        ${
          careTeam && (pickText(careTeam, 'pharmacy', lang) || pickText(careTeam, 'pcp', lang) || pickText(careTeam, 'insurance', lang))
            ? `<section class="clinical-card logistics-card">
                <div class="sub-label" style="margin-bottom: 6px;">🏥 ${dict.careLogisticsTitle}</div>
                <div class="logistics-grid">
                  ${pickText(careTeam, 'pharmacy', lang) ? `<div><strong>${dict.pharmacyLabel}:</strong> ${escapeHtml(pickText(careTeam, 'pharmacy', lang))}</div>` : ''}
                  ${pickText(careTeam, 'pcp', lang) ? `<div><strong>${dict.pcpLabel}:</strong> ${escapeHtml(pickText(careTeam, 'pcp', lang))}</div>` : ''}
                  ${pickText(careTeam, 'insurance', lang) ? `<div><strong>${dict.insuranceLabel}:</strong> ${escapeHtml(pickText(careTeam, 'insurance', lang))}</div>` : ''}
                </div>
              </section>`
            : ''
        }

        <!-- 1. Chief Complaint & HPI -->
        <section class="clinical-card card-focus">
          <div class="card-head">
            <div class="card-title-group">
              <span class="card-badge-num">1</span>
              <h2>${dict.sec1Title}</h2>
            </div>
            <div class="visit-meta tabular">
              ${pickText(visit, 'department', lang) ? `<span class="dept-chip">${escapeHtml(pickText(visit, 'department', lang))}</span>` : ''}
              <span>${escapeHtml(formatDisplayDate(visit.visitDate, lang))}${visit.visitTime ? ` ${escapeHtml(visit.visitTime)}` : ''}</span>
              ${visit.visitDate && !isSnapshot ? `<button class="btn-mini no-print" data-action="export-ics" title="${lang === 'en' ? 'Add to Calendar (.ics)' : '导出日历提醒 (.ics)'}">📅</button>` : ''}
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
                  ? 'No active visit chief complaint set for this doctor yet — showing this doctor/specialty’s relevant history below.'
                  : '当前暂无该医生/专科的待诊主诉；以下已自动调取与该医生相关的过往就诊及专科病史。'
                : '—')
          )}</p>
          ${
            pickText(visit, 'onsetSummary', lang)
              ? `<div class="onset-bar"><strong>${dict.onsetSummaryLabel}</strong>${escapeHtml(pickText(visit, 'onsetSummary', lang))}</div>`
              : ''
          }
          ${
            questionsList.length
              ? `<div class="questions-box">
                  <div class="sub-label">${dict.questionsLabel}</div>
                  <ol class="questions-list">
                    ${questionsList.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}
                  </ol>
                </div>`
              : ''
          }
          ${
            isFiltered && state.visitHistory?.length
              ? `<div class="questions-box">
                  <div class="sub-label">📁 ${lang === 'en' ? 'Prior Visits with This Doctor / Specialty' : '本医生 / 本专科过往所有就诊记录'} (${state.visitHistory.length})</div>
                  <div class="visit-hist-list">
                    ${state.visitHistory
                      .map(
                        (vh) => `
                        <div class="visit-hist-item">
                          <div class="visit-hist-top tabular">
                            <strong>${escapeHtml(formatDisplayDate(vh.date, lang))}</strong>
                            ${vh.doctorName ? `<span class="dept-chip">${escapeHtml(vh.doctorName)}</span>` : ''}
                            <span>${escapeHtml(pickText(vh, 'purpose', lang))}</span>
                          </div>
                          ${pickText(vh, 'doctorNotes', lang) ? `<div class="visit-hist-notes">${escapeHtml(pickText(vh, 'doctorNotes', lang))}</div>` : ''}
                        </div>
                      `
                      )
                      .join('')}
                  </div>
                </div>`
              : ''
          }
        </section>

        <!-- Physician Voice Summary / After-Visit Report -->
        ${renderVisitReportCard(visit.visitReport, lang, dict, isSnapshot)}

        <!-- 2. Current Symptoms & Pertinent Negatives (ROS) -->
        <section class="clinical-card">
          <div class="card-head">
            <div class="card-title-group">
              <span class="card-badge-num">2</span>
              <h2>${dict.sec2Title}</h2>
            </div>
            <span class="count-pill tabular">${symptoms?.length || 0} ${dict.itemsCount}</span>
          </div>
          ${
            symptoms?.length
              ? `<div class="symptom-list">
                  ${symptoms
                    .map((s) => {
                      const sevLabel = dict.severity[s.severity] || dict.severity.mild;
                      const trLabel = dict.trend[s.trend] || dict.trend.stable;
                      const notesTxt = pickText(s, 'notes', lang);
                      const selfCareTxt = pickText(s, 'selfCare', lang);
                      return `
                        <article class="symptom-item">
                          <div class="symptom-top">
                            <div class="symptom-name">${escapeHtml(pickText(s, 'name', lang))}</div>
                            <div class="symptom-pills">
                              <span class="pill ${SEVERITY_CLS[s.severity] || 'pill-muted'}">${sevLabel}</span>
                              <span class="pill ${TREND_CLS[s.trend] || 'trend-flat'}">${trLabel}</span>
                            </div>
                          </div>
                          <div class="symptom-meta tabular">
                            <span>${dict.durationLabel}${escapeHtml(pickText(s, 'durationText', lang) || '—')}</span>
                            ${s.onsetDate ? `<span>${dict.onsetLabel}${escapeHtml(formatDisplayDate(s.onsetDate, lang))}</span>` : ''}
                          </div>
                          ${notesTxt ? `<p class="symptom-notes">${escapeHtml(notesTxt)}</p>` : ''}
                          ${selfCareTxt ? `<div class="self-care">${dict.selfCareLabel}${escapeHtml(selfCareTxt)}</div>` : ''}
                        </article>
                      `;
                    })
                    .join('')}
                </div>`
              : `<div class="empty-box">${dict.noSymptoms}</div>`
          }

          ${
            rosNegatives?.length
              ? `<div class="ros-box">
                  <div class="sub-label">🛡️ ${dict.rosTitle}</div>
                  <div class="ros-chips">
                    ${rosNegatives.map((n) => `<span class="ros-chip">✓ ${escapeHtml(pickText(n, 'text', lang))}</span>`).join('')}
                  </div>
                </div>`
              : ''
          }
        </section>

        <!-- 3. Medication Reconciliation -->
        <section class="clinical-card">
          <div class="card-head">
            <div class="card-title-group">
              <span class="card-badge-num">3</span>
              <h2>${dict.sec3Title}</h2>
            </div>
            <div class="seg-tabs no-print">
              <button class="seg-btn ${medTab === 'all' ? 'active' : ''}" data-action="doc-med-tab" data-tab="all">${dict.medTabAll} (${medications?.length || 0})</button>
              <button class="seg-btn ${medTab === 'active' ? 'active' : ''}" data-action="doc-med-tab" data-tab="active">${dict.medTabActive} (${activeMeds.length})</button>
              <button class="seg-btn ${medTab === 'recent' ? 'active' : ''}" data-action="doc-med-tab" data-tab="recent">${dict.medTabRecent} (${recentMeds.length})</button>
            </div>
          </div>

          ${
            showActive
              ? `<div class="med-group">
                  <div class="med-group-title med-active-title">💊 ${dict.medActiveHeading} (${activeMeds.length})</div>
                  ${
                    activeMeds.length
                      ? activeMeds.map((m) => renderMedCard(m, false, lang, dict)).join('')
                      : `<div class="empty-inline">${dict.noActiveMeds}</div>`
                  }
                </div>`
              : ''
          }

          ${
            showRecent
              ? `<div class="med-group" style="margin-top: 12px;">
                  <div class="med-group-title med-recent-title">🕒 ${dict.medRecentHeading} (${recentMeds.length})</div>
                  ${
                    recentMeds.length
                      ? recentMeds.map((m) => renderMedCard(m, true, lang, dict)).join('')
                      : `<div class="empty-inline">${dict.noRecentMeds}</div>`
                  }
                </div>`
              : ''
          }

          ${
            isFiltered && otherActiveMeds.length > 0
              ? `<details class="safety-meds-details">
                  <summary>⚠️ ${
                    lang === 'en'
                      ? `Other Active Meds (${otherActiveMeds.length} — Interaction Safety Check)`
                      : `其他专科当前在服药物（${otherActiveMeds.length} 项 · 防药物相互作用核对）`
                  }</summary>
                  <div style="margin-top: 8px;">
                    ${otherActiveMeds.map((m) => renderMedCard(m, false, lang, dict)).join('')}
                  </div>
                </details>`
              : ''
          }
        </section>

        <!-- 4. Weight Trend & BMI -->
        ${
          !isFiltered || showWeightSection !== false
            ? `<section class="clinical-card">`
            : `<section class="clinical-card collapsed-note-card no-print">
                <div class="card-head" style="margin-bottom:0;">
                  <span class="muted-sm">⚖️ ${lang === 'en' ? 'Weight Trend hidden for this specialty' : '本专科默认折叠体重趋势图'}</span>
                  <button class="btn-mini" data-action="set-doc-scope" data-scope="all">${lang === 'en' ? 'Show All' : '查看全部'}</button>
                </div>
              </section>
              <!-- hidden weight section skipped in focused specialty -->
              ${''}`
        }
        ${
          !isFiltered || showWeightSection !== false
            ? `
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
        </section>`
            : ''
        }

        <!-- 5. Vital Signs & Labs -->
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
              const list = (vitals || [])
                .filter((v) => v.type === type)
                .sort((a, b) => b.date.localeCompare(a.date));
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
                    <div class="vital-spark">
                      ${renderVitalSparkline(list, type)}
                    </div>
                  </div>
                  ${
                    list.length > 1
                      ? `<div class="vital-mini-hist tabular">${list
                          .slice(0, 3)
                          .map((item) => {
                            const f = formatVitalReading(item, unitSystem);
                            return `${f.display}(${item.date.slice(5)})`;
                          })
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
            </div>
            ${
              attachments?.length
                ? `<div class="report-list">
                    ${attachments
                      .map((att) => {
                        const titleTxt = pickText(att, 'title', lang);
                        const sumTxt = pickText(att, 'summaryHighlight', lang);
                        return `
                          <div class="report-item ${att.isAbnormal ? 'report-abnormal' : ''}">
                            ${
                              att.imageDataUrl
                                ? `<button class="report-thumb-btn" data-action="preview-image" data-title="${escapeHtml(titleTxt)}" data-src="${escapeHtml(att.imageDataUrl)}">
                                    <img src="${escapeHtml(att.imageDataUrl)}" alt="${escapeHtml(titleTxt)}"/>
                                    <span class="zoom-tag">🔍 ${dict.zoomLabel}</span>
                                  </button>`
                                : ''
                            }
                            <div class="report-body">
                              <div class="report-head">
                                <span class="report-date tabular">${escapeHtml(formatDisplayDate(att.date, lang))}</span>
                                ${att.isAbnormal ? `<span class="pill pill-red">${dict.abnormalFlag}</span>` : `<span class="pill pill-green">${dict.normalFlag}</span>`}
                              </div>
                              <div class="report-title">${escapeHtml(titleTxt)}</div>
                              ${sumTxt ? `<div class="report-summary">${escapeHtml(sumTxt)}</div>` : ''}
                            </div>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>`
                : `<div class="empty-inline">${dict.noReports}</div>`
            }
          </div>

          <div class="reports-block">
            <div class="sub-label-row">
              <span class="sub-label">🔬 ${dict.examHistoryTitle} (${state.examHistory?.length || 0})</span>
            </div>
            ${
              state.examHistory?.length
                ? `<div class="exam-list">
                    ${[...state.examHistory]
                      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                      .map((ex) => {
                        const nameTxt = pickText(ex, 'name', lang);
                        const resTxt = pickText(ex, 'resultSummary', lang);
                        const facTxt = pickText(ex, 'facility', lang);
                        const catLabel = dict.examCategories?.[ex.category] || ex.category || '';
                        return `
                          <div class="exam-item ${ex.isAbnormal ? 'exam-abnormal' : ''}">
                            <div class="exam-top">
                              <div class="exam-title-wrap">
                                <span class="exam-date tabular">${escapeHtml(formatDisplayDate(ex.date, lang))}</span>
                                ${catLabel ? `<span class="pill pill-blue">${escapeHtml(catLabel)}</span>` : ''}
                                <strong class="exam-name">${escapeHtml(nameTxt)}</strong>
                              </div>
                              ${ex.isAbnormal ? `<span class="pill pill-red">${dict.abnormalFlag}</span>` : `<span class="pill pill-green">${dict.normalFlag}</span>`}
                            </div>
                            ${facTxt ? `<div class="exam-facility">${escapeHtml(facTxt)}</div>` : ''}
                            ${resTxt ? `<div class="exam-summary">${escapeHtml(resTxt)}</div>` : ''}
                            ${
                              ex.imageDataUrl
                                ? `<button class="btn-mini" style="margin-top:5px;" data-action="preview-image" data-title="${escapeHtml(nameTxt)}" data-src="${escapeHtml(ex.imageDataUrl)}">🔍 ${dict.zoomLabel}</button>`
                                : ''
                            }
                          </div>
                        `;
                      })
                      .join('')}
                  </div>`
                : `<div class="empty-inline">${dict.noExamHistory}</div>`
            }
          </div>
        </section>

        <!-- 6. PMH / PSH / FH / Social History -->
        <section class="clinical-card">
          <div class="card-head">
            <div class="card-title-group">
              <span class="card-badge-num">6</span>
              <h2>${dict.sec6Title}</h2>
            </div>
          </div>

          <div class="history-section">
            <div class="sub-label">${dict.pmhLabel}</div>
            ${
              history?.conditions?.length
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
            }
          </div>

          <div class="history-grid">
            <div class="history-box">
              <div class="sub-label">${dict.pshLabel}</div>
              ${
                (pickText(history, 'surgeries', lang) || []).length
                  ? `<ul class="simple-list">${(pickText(history, 'surgeries', lang) || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
                  : `<div class="muted-sm">—</div>`
              }
            </div>
            <div class="history-box">
              <div class="sub-label">${dict.fhLabel}</div>
              ${
                (pickText(history, 'familyHistory', lang) || []).length
                  ? `<ul class="simple-list">${(pickText(history, 'familyHistory', lang) || []).map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
                  : `<div class="muted-sm">—</div>`
              }
            </div>
          </div>

          <!-- Social History (US Clinic Essential) -->
          <div class="social-box">
            <div class="sub-label">${dict.shLabel}</div>
            <div class="social-grid">
              <div><span class="muted-xs">${dict.smokingLabel}:</span> <strong>${escapeHtml(pickText(socialHistory, 'smoking', lang) || (lang === 'en' ? 'Not documented' : '未记录'))}</strong></div>
              <div><span class="muted-xs">${dict.alcoholLabel}:</span> <strong>${escapeHtml(pickText(socialHistory, 'alcohol', lang) || (lang === 'en' ? 'Not documented' : '未记录'))}</strong></div>
              <div><span class="muted-xs">${dict.pregnancyLabel}:</span> <strong>${escapeHtml(pickText(socialHistory, 'pregnancy', lang) || (lang === 'en' ? 'Not documented' : '未记录'))}</strong></div>
              <div><span class="muted-xs">${dict.occupationLabel}:</span> <strong>${escapeHtml(pickText(socialHistory, 'occupation', lang) || (lang === 'en' ? 'Not documented' : '未记录'))}</strong></div>
            </div>
          </div>

          ${
            state.visitHistory?.length
              ? `<div class="visit-hist-box">
                  <div class="sub-label">📁 ${dict.visitHistoryTitle} (${state.visitHistory.length})</div>
                  <div class="visit-hist-list">
                    ${state.visitHistory
                      .slice(0, 4)
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
                </div>`
              : ''
          }

          ${
            pickText(profile, 'emergencyContact', lang) && !isSnapshot
              ? `<div class="emergency-bar">${dict.emergencyLabel}${escapeHtml(pickText(profile, 'emergencyContact', lang))}</div>`
              : ''
          }
        </section>

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
    </div>
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
        ${
          !isSnapshot
            ? `<button type="button" class="btn-voice-cta no-print" data-action="open-voice-summary">
                🎙️ ${dict.voiceInputBtn}
              </button>`
            : ''
        }
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

function renderMedCard(m, isRecent, lang, dict) {
  const name = pickText(m, 'name', lang);
  const dosage = pickText(m, 'dosage', lang);
  const freq = pickText(m, 'frequency', lang);
  const timing = pickText(m, 'timing', lang);
  const lastTaken = pickText(m, 'lastTaken', lang);
  const stopReason = pickText(m, 'stopReason', lang);
  const notes = pickText(m, 'notes', lang);
  const catTag = m.category === 'otc' ? dict.medOtcTag : dict.medRxTag;

  return `
    <div class="med-card ${isRecent ? 'med-card-recent' : 'med-card-active'}">
      <div class="med-card-body">
        <div class="med-top">
          <div>
            <div class="med-name-row">
              <span class="med-cat-badge ${m.category === 'otc' ? 'cat-otc' : 'cat-rx'}">${catTag}</span>
              <span class="med-name">${escapeHtml(name)}</span>
            </div>
            ${m.genericName ? `<div class="med-generic">${escapeHtml(m.genericName)}</div>` : ''}
          </div>
          ${
            m.photoDataUrl
              ? `<button class="med-thumb-btn" data-action="preview-image" data-title="${escapeHtml(name)}" data-src="${escapeHtml(m.photoDataUrl)}">
                  <img src="${escapeHtml(m.photoDataUrl)}" alt="${dict.medBoxLabel}"/>
                  <span>${dict.medBoxLabel}</span>
                </button>`
              : ''
          }
        </div>
        <div class="med-dose-line tabular">
          ${dosage ? `<span class="dose-chip">${escapeHtml(dosage)}</span>` : ''}
          ${freq ? `<span>${escapeHtml(freq)}</span>` : ''}
          ${timing ? `<span>· ${escapeHtml(timing)}</span>` : ''}
        </div>
        ${!isRecent && lastTaken ? `<div class="med-last-taken">✅ ${dict.lastTakenLabel}<strong>${escapeHtml(lastTaken)}</strong></div>` : ''}
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
    </div>
  `;
}
