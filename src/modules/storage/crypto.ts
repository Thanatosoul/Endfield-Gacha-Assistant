import CryptoJS from 'crypto-js';
import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '@/lib/runtime';

const PREFIX = 'aes256cbc:';

let cachedKey: string | null = null;

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

export async function getEncryptionKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  const fingerprint = await resolveDeviceFingerprint();
  cachedKey = CryptoJS.PBKDF2(fingerprint, 'endfield-gacha-assistant', {
    keySize: 256 / 32,
    iterations: 10000,
  }).toString();

  return cachedKey;
}

export async function encryptPreference(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const key = await getEncryptionKey();
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, CryptoJS.enc.Hex.parse(key), {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const ivHex = iv.toString();
  const ct = encrypted.ciphertext.toString();
  return `${PREFIX}${ivHex}:${ct}`;
}

export async function decryptPreference(encoded: string): Promise<string> {
  if (!encoded) return '';
  if (!encoded.startsWith(PREFIX)) {
    // Plaintext backward compat — will be encrypted on next save
    return encoded;
  }

  try {
    const key = await getEncryptionKey();
    const payload = encoded.slice(PREFIX.length);
    const colonIdx = payload.indexOf(':');
    if (colonIdx === -1) return '';
    const ivHex = payload.slice(0, colonIdx);
    const ctHex = payload.slice(colonIdx + 1);

    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const ct = CryptoJS.enc.Hex.parse(ctHex);
    const decrypted = CryptoJS.AES.decrypt(
      CryptoJS.lib.CipherParams.create({ ciphertext: ct }),
      CryptoJS.enc.Hex.parse(key),
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function resetKeyCache(): void {
  cachedKey = null;
}
