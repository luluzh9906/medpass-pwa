/**
 * Compact schema serialization + browser-native DEFLATE compression + Base64URL
 * so full clinical text + trend charts fit cleanly inside a scannable QR code URL hash (`#/s/...`).
 */
import { maskPatientName } from './security.js';

function toBase64Url(uint8) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < uint8.length; i += chunk) {
    bin += String.fromCharCode(...uint8.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64u) {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64u.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function compressBytes(bytes) {
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return { mode: 'z', data: new Uint8Array(buf) };
  }
  return { mode: 'r', data: bytes };
}

async function decompressBytes(mode, bytes) {
  if (mode === 'z') {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('当前浏览器不支持解压此二维码数据，请更换新版浏览器');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }
  return bytes;
}

function clip(str, maxLen = 48) {
  const s = String(str || '').trim();
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}

export function buildCompactSharePayload(state, { maskName = true, includeHistory = true } = {}) {
  const sortedWeights = [...(state.weights || [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);

  // Pick latest 2 entries per vital type so QR remains crisp and easy to scan
  const recentVitals = [];
  for (const type of ['bp', 'hr', 'glucose', 'temp']) {
    const items = (state.vitals || [])
      .filter((v) => v.type === type)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 2);
    for (const v of items) {
      recentVitals.push([v.type, v.date, v.value1, v.value2 ?? '', clip(v.context, 16)]);
    }
  }

  return {
    v: 1,
    g: new Date().toISOString().slice(0, 16).replace('T', ' '),
    p: {
      n: maskName ? maskPatientName(state.profile.name) : state.profile.name,
      gd: state.profile.gender,
      db: state.profile.dob || '',
      by: state.profile.birthYear,
      bt: state.profile.bloodType,
      h: state.profile.heightCm,
      al: state.profile.allergies || [],
      sa: []
    },
    ct: state.careTeam
      ? {
          ph: clip(state.careTeam.pharmacy, 42),
          pc: clip(state.careTeam.pcp, 34)
        }
      : null,
    rs: (state.rosNegatives || []).slice(0, 5).map((r) => clip(r.text, 28)),
    sh: state.socialHistory
      ? {
          sm: clip(state.socialHistory.smoking, 20),
          al: clip(state.socialHistory.alcohol, 20),
          pg: clip(state.socialHistory.pregnancy, 28)
        }
      : null,
    vt: {
      pu: clip(state.visit.purpose, 72),
      dp: state.visit.department,
      dt: state.visit.visitDate,
      os: clip(state.visit.onsetSummary, 48),
      q: (state.visit.questions || []).slice(0, 3).map((q) => clip(q, 42)),
      vr: state.visit.visitReport
        ? {
            dg: clip(state.visit.visitReport.diagnosis, 48),
            mp: clip(state.visit.visitReport.medPlan, 48),
            tp: clip(state.visit.visitReport.testsPlan, 42),
            fu: clip(state.visit.visitReport.followUp, 48)
          }
        : null
    },
    sy: (state.symptoms || []).slice(0, 6).map((s) => [
      clip(s.name, 26),
      clip(s.durationText, 16),
      s.severity,
      s.trend,
      clip(s.notes, 34),
      ''
    ]),
    md: (state.medications || []).slice(0, 8).map((m) => [
      clip(m.name, 28),
      clip(m.dosage, 16),
      clip(m.frequency, 14),
      clip(m.timing, 16),
      m.status,
      m.startDate,
      m.endDate,
      clip(m.stopReason, 32),
      ''
    ]),
    wt: sortedWeights.map((w) => [w.date, w.weightKg]),
    vl: recentVitals,
    hs: includeHistory
      ? {
          c: (state.history?.conditions || []).slice(0, 5).map((c) => [clip(c.name, 26), c.diagnosedYear, clip(c.status, 14)]),
          s: (state.history?.surgeries || []).slice(0, 3).map((s) => clip(s, 30)),
          f: (state.history?.familyHistory || []).slice(0, 3).map((f) => clip(f, 30))
        }
      : null,
    ac: (state.attachments || []).slice(0, 4).map((a) => ({
      d: a.date,
      t: clip(a.title, 34),
      ab: !!a.isAbnormal,
      s: clip(a.summaryHighlight, 44)
    })),
    ex: (state.examHistory || []).slice(0, 4).map((e) => ({
      d: e.date,
      c: e.category,
      n: clip(e.name, 28),
      r: clip(e.resultSummary, 42),
      ab: !!e.isAbnormal
    }))
  };
}

export async function encodeShareToken(state, options = {}) {
  const compact = buildCompactSharePayload(state, options);
  const json = JSON.stringify(compact);
  const rawBytes = new TextEncoder().encode(json);
  const { mode, data } = await compressBytes(rawBytes);
  return {
    token: `${mode}.${toBase64Url(data)}`,
    rawBytes: rawBytes.length,
    compressedBytes: data.length,
    attachmentCount: (state.attachments || []).length
  };
}

export async function decodeShareToken(token) {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) throw new Error('无效的分享二维码参数');
  const mode = token.slice(0, dotIdx);
  const body = token.slice(dotIdx + 1);
  const compressed = fromBase64Url(body);
  const rawBytes = await decompressBytes(mode, compressed);
  const compact = JSON.parse(new TextDecoder().decode(rawBytes));

  return {
    isSnapshot: true,
    generatedAt: compact.g,
    updatedAt: compact.g,
    profile: {
      name: compact.p.n,
      gender: compact.p.gd,
      dob: compact.p.db || '',
      birthYear: compact.p.by,
      bloodType: compact.p.bt,
      heightCm: compact.p.h,
      allergies: compact.p.al || [],
      specialAlerts: compact.p.sa || []
    },
    careTeam: compact.ct
      ? { pharmacy: compact.ct.ph || '', pcp: compact.ct.pc || '', insurance: '' }
      : { pharmacy: '', pcp: '', insurance: '' },
    rosNegatives: (compact.rs || []).map((t, idx) => ({ id: `snap-r-${idx}`, text: t })),
    socialHistory: compact.sh
      ? { smoking: compact.sh.sm || '', alcohol: compact.sh.al || '', pregnancy: compact.sh.pg || '', occupation: '' }
      : { smoking: '', alcohol: '', pregnancy: '', occupation: '' },
    visit: {
      purpose: compact.vt.pu,
      department: compact.vt.dp,
      visitDate: compact.vt.dt,
      onsetSummary: compact.vt.os,
      questions: compact.vt.q || [],
      visitReport: compact.vt.vr
        ? {
            diagnosis: compact.vt.vr.dg,
            medPlan: compact.vt.vr.mp,
            testsPlan: compact.vt.vr.tp,
            followUp: compact.vt.vr.fu
          }
        : null
    },
    symptoms: (compact.sy || []).map((s, idx) => ({
      id: `snap-sym-${idx}`,
      name: s[0],
      durationText: s[1],
      severity: s[2],
      trend: s[3],
      notes: s[4],
      selfCare: s[5]
    })),
    medications: (compact.md || []).map((m, idx) => ({
      id: `snap-med-${idx}`,
      name: m[0],
      dosage: m[1],
      frequency: m[2],
      timing: m[3],
      status: m[4],
      startDate: m[5],
      endDate: m[6],
      stopReason: m[7],
      notes: m[8],
      photoDataUrl: ''
    })),
    weights: (compact.wt || []).map((w, idx) => ({
      id: `snap-w-${idx}`,
      date: w[0],
      weightKg: w[1],
      note: ''
    })),
    vitals: (compact.vl || []).map((v, idx) => ({
      id: `snap-v-${idx}`,
      type: v[0],
      date: v[1],
      value1: v[2],
      value2: v[3] === '' ? null : v[3],
      unit: v[0] === 'bp' ? 'mmHg' : v[0] === 'hr' ? 'bpm' : v[0] === 'glucose' ? 'mmol/L' : '°C',
      context: v[4] || ''
    })),
    history: compact.hs
      ? {
          conditions: (compact.hs.c || []).map((c, idx) => ({
            id: `snap-c-${idx}`,
            name: c[0],
            diagnosedYear: c[1],
            status: c[2],
            note: ''
          })),
          surgeries: compact.hs.s || [],
          familyHistory: compact.hs.f || []
        }
      : { conditions: [], surgeries: [], familyHistory: [] },
    attachments: (compact.ac || []).map((a, idx) => ({
      id: `snap-a-${idx}`,
      date: a.d,
      title: a.t,
      isAbnormal: a.ab,
      summaryHighlight: a.s,
      imageDataUrl: ''
    })),
    examHistory: (compact.ex || []).map((e, idx) => ({
      id: `snap-ex-${idx}`,
      date: e.d,
      category: e.c || 'imaging',
      name: e.n,
      facility: '',
      resultSummary: e.r,
      isAbnormal: e.ab,
      imageDataUrl: ''
    }))
  };
}
