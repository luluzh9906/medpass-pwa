/**
 * Local-first IndexedDB persistence layer (MedPassDB) + BroadcastChannel auto-sync
 * + persistent storage request + full JSON backup export/import.
 */
import { createDemoData } from './seed.js';

const DB_NAME = 'MedPassDB';
const DB_VERSION = 1;
const STORE_NAME = 'records';
const RECORD_KEY = 'patient_state';
const LS_FALLBACK_KEY = 'medpass_fallback_state_v1';

const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('medpass_sync') : null;
let idbDisabled = false;

function withTimeout(promise, ms = 800) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('IndexedDB timeout')), ms))
  ]);
}

function openDb() {
  if (idbDisabled) return Promise.reject(new Error('IndexedDB disabled after fallback'));
  return withTimeout(
    new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB error'));
        req.onblocked = () => reject(new Error('IndexedDB blocked'));
      } catch (err) {
        reject(err);
      }
    }),
    600
  ).catch((err) => {
    idbDisabled = true;
    throw err;
  });
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore unsupported environments
  }
  return false;
}

export async function getStorageEstimate() {
  try {
    if (navigator.storage?.estimate) {
      const est = await withTimeout(navigator.storage.estimate(), 400);
      const persisted = navigator.storage.persisted ? await withTimeout(navigator.storage.persisted(), 400) : false;
      return {
        usageBytes: est.usage || 0,
        quotaBytes: est.quota || 0,
        persisted
      };
    }
  } catch {
    // Ignore
  }
  return { usageBytes: 0, quotaBytes: 0, persisted: false };
}

export async function migrateRecordIfNeeded(record) {
  if (!record) return createDemoData();
  // If user never edited an older demo dataset, seamlessly upgrade to latest demo schema
  if (record.isDemo && (record.schemaVersion || 1) < 7) {
    const fresh = await createDemoData();
    await saveState(fresh, { broadcast: false });
    return fresh;
  }
  return {
    ...record,
    schemaVersion: 7,
    profile: {
      dob: '',
      preferredLang: 'zh',
      unitSystem: 'metric',
      ...record.profile
    },
    careTeam: {
      pharmacy: '',
      pcp: '',
      insurance: '',
      savedContacts: [],
      ...(record.careTeam || {})
    },
    visit: {
      visitTime: '',
      doctorName: '',
      clinicName: '',
      clinicPhone: '',
      clinicAddress: '',
      visitReport: null,
      ...(record.visit || {})
    },
    rosNegatives: Array.isArray(record.rosNegatives) ? record.rosNegatives : [],
    visitHistory: Array.isArray(record.visitHistory) ? record.visitHistory : [],
    examHistory: Array.isArray(record.examHistory) ? record.examHistory : [],
    socialHistory: {
      smoking: '',
      alcohol: '',
      pregnancy: '',
      occupation: '',
      substances: '',
      ...(record.socialHistory || {})
    }
  };
}

export async function loadState() {
  try {
    const db = await openDb();
    const existing = await withTimeout(
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      }),
      800
    );
    if (existing) return migrateRecordIfNeeded(existing);
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (raw) return migrateRecordIfNeeded(JSON.parse(raw));
    } catch {
      // Fall through to demo seed
    }
  }

  const demo = await createDemoData();
  await saveState(demo, { broadcast: false });
  return demo;
}

export async function saveState(nextState, { broadcast = true } = {}) {
  const stamped = {
    ...nextState,
    updatedAt: new Date().toISOString()
  };

  try {
    const db = await openDb();
    await withTimeout(
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(stamped, RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
      800
    );
  } catch {
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(stamped));
    } catch {
      // Ignore quota/opaque-origin storage restrictions
    }
  }

  if (broadcast && syncChannel) {
    syncChannel.postMessage({ type: 'STATE_UPDATED', updatedAt: stamped.updatedAt });
  }
  return stamped;
}

export async function resetToDemoData() {
  const demo = await createDemoData();
  return saveState(demo);
}

export function subscribeRemoteSync(callback) {
  if (!syncChannel) return () => {};
  const handler = (event) => {
    if (event.data?.type === 'STATE_UPDATED') {
      callback(event.data.updatedAt);
    }
  };
  syncChannel.addEventListener('message', handler);
  return () => syncChannel.removeEventListener('message', handler);
}

export function exportBackupJson(state) {
  const payload = {
    app: 'MedPass-PWA',
    exportedAt: new Date().toISOString(),
    data: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `医览通健康备份_${dateStr}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function validateImportedBackup(parsed) {
  const candidate = parsed?.data && parsed.app === 'MedPass-PWA' ? parsed.data : parsed;
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('备份文件格式无效');
  }
  const required = ['profile', 'visit', 'symptoms', 'history', 'medications', 'weights', 'vitals'];
  for (const key of required) {
    if (!(key in candidate)) {
      throw new Error(`备份缺少必要字段：${key}`);
    }
  }
  return {
    ...candidate,
    attachments: Array.isArray(candidate.attachments) ? candidate.attachments : [],
    isDemo: false
  };
}
