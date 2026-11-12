/**
 * PIN code hashing & verification + auto-lock protection.
 * Uses Web Crypto SHA-256 when available (HTTPS / localhost), with a pure-JS
 * deterministic fallback for non-secure contexts.
 */

const SALT = 'medpass-local-pin-v1:';

function fallbackHash(str) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'fb-' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export async function hashPin(pin) {
  const input = SALT + String(pin).trim();
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return fallbackHash(input);
}

export async function verifyPin(pin, storedHash) {
  if (!storedHash) return false;
  const computed = await hashPin(pin);
  if (computed === storedHash) return true;
  // Support fallback hash check if created in non-secure context and later opened on HTTPS
  if (storedHash.startsWith('fb-') && fallbackHash(SALT + String(pin).trim()) === storedHash) {
    return true;
  }
  return false;
}

export function maskPatientName(name) {
  if (!name) return '患者';
  const clean = name.replace(/（.*?）|\(.*?\)/g, '').trim();
  if (!clean) return '*';
  if (/^[A-Za-z\s.'-]+$/.test(clean)) {
    const parts = clean.split(/\s+/);
    return parts.map((p) => (p.length <= 1 ? p : p[0] + '***')).join(' ');
  }
  if (clean.length <= 1) return '*';
  return clean[0] + '*'.repeat(Math.min(clean.length - 1, 2));
}
