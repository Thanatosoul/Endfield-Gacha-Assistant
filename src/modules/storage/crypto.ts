import CryptoJS from 'crypto-js';
import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '@/lib/runtime';

// Current format: AES-256-GCM (authenticated). Legacy format: AES-256-CBC with
// no authentication tag. Legacy ciphertexts are still readable and are
// transparently re-encrypted with GCM on the next save.
const GCM_PREFIX = 'aes256gcm:';
const LEGACY_CBC_PREFIX = 'aes256cbc:';
const GCM_ITERATIONS = 100_000;
const GCM_SALT = 'endfield-gacha-assistant-gcm';

let cachedKey: string | null = null;
let cachedGcmKey: CryptoKey | null = null;

function hasWebCrypto(): boolean {
  return typeof globalThis.crypto?.subtle !== 'undefined';
}

async function resolveDeviceFingerprint(): Promise<string> {
  if (isTauriRuntime()) {
    try {
      const paths = await invoke<{ data_dir: string }>('app_paths');
      return CryptoJS.SHA256(`endfield-gacha-device:${paths.data_dir}`).toString();
    } catch {
      // fall through to browser fallback
    }
  }
  return CryptoJS.SHA256('endfield-gacha-device:browser-preview').toString();
}

/** Legacy CBC key (SHA-1 PBKDF2) — only used to read existing ciphertexts. */
export async function getEncryptionKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  const fingerprint = await resolveDeviceFingerprint();
  cachedKey = CryptoJS.PBKDF2(fingerprint, 'endfield-gacha-assistant', {
    keySize: 256 / 32,
    iterations: 10000,
  }).toString();

  return cachedKey;
}

async function getGcmKey(): Promise<CryptoKey> {
  if (cachedGcmKey) return cachedGcmKey;

  const fingerprint = await resolveDeviceFingerprint();
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(fingerprint), 'PBKDF2', false, [
    'deriveKey',
  ]);
  cachedGcmKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(GCM_SALT),
      iterations: GCM_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return cachedGcmKey;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encryptGcm(plaintext: string): Promise<string> {
  const key = await getGcmKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return `${GCM_PREFIX}${bytesToBase64(combined)}`;
}

async function decryptGcm(encoded: string): Promise<string> {
  const payload = base64ToBytes(encoded.slice(GCM_PREFIX.length));
  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  const key = await getGcmKey();
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

function encryptLegacyCbc(plaintext: string, key: string): string {
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, CryptoJS.enc.Hex.parse(key), {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return `${LEGACY_CBC_PREFIX}${iv.toString()}:${encrypted.ciphertext.toString()}`;
}

async function decryptLegacyCbc(encoded: string): Promise<string> {
  const key = await getEncryptionKey();
  const payload = encoded.slice(LEGACY_CBC_PREFIX.length);
  const colonIdx = payload.indexOf(':');
  if (colonIdx === -1) return '';
  const ivHex = payload.slice(0, colonIdx);
  const ctHex = payload.slice(colonIdx + 1);

  const decrypted = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Hex.parse(ctHex) }),
    CryptoJS.enc.Hex.parse(key),
    { iv: CryptoJS.enc.Hex.parse(ivHex), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
  );
  return decrypted.toString(CryptoJS.enc.Utf8);
}

export async function encryptPreference(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  if (hasWebCrypto()) {
    try {
      return await encryptGcm(plaintext);
    } catch {
      // Fall through to legacy CBC if WebCrypto is unavailable for any reason.
    }
  }
  return encryptLegacyCbc(plaintext, await getEncryptionKey());
}

export async function decryptPreference(encoded: string): Promise<string> {
  if (!encoded) return '';

  try {
    if (encoded.startsWith(GCM_PREFIX)) {
      return await decryptGcm(encoded);
    }
    if (encoded.startsWith(LEGACY_CBC_PREFIX)) {
      return await decryptLegacyCbc(encoded);
    }
    // Plaintext backward compat — will be encrypted on next save
    return encoded;
  } catch {
    return '';
  }
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(GCM_PREFIX) || value.startsWith(LEGACY_CBC_PREFIX);
}

export function isLegacyEncrypted(value: string): boolean {
  return value.startsWith(LEGACY_CBC_PREFIX);
}
