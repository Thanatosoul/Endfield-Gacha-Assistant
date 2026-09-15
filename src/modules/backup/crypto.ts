import CryptoJS from 'crypto-js';
import { BACKUP_FORMAT, BACKUP_VERSION } from '@/modules/backup/types';
import type { BackupContainer, BackupPayload } from '@/modules/backup/types';

const PBKDF2_ITERATIONS = 100_000;

export const BACKUP_PASSWORD_REQUIRED = 'BACKUP_PASSWORD_REQUIRED';

function deriveKey(password: string, saltHex: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(saltHex), {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
}

function parseContainer(text: string): BackupContainer {
  let container: unknown;
  try {
    container = JSON.parse(text);
  } catch {
    throw new Error('备份文件格式无效（不是有效的 JSON）。');
  }
  if (!container || typeof container !== 'object' || Array.isArray(container)) {
    throw new Error('备份文件格式无效。');
  }
  const candidate = container as BackupContainer;
  if (candidate.format !== BACKUP_FORMAT) {
    throw new Error('无法识别该备份文件（缺少格式标识）。');
  }
  return candidate;
}

/** Inspect a backup file without needing the password. */
export function inspectBackup(text: string): { encrypted: boolean } {
  return { encrypted: parseContainer(text).encrypted === true };
}

/** Serialize a payload to backup text, optionally protecting it with a password. */
export function serializeBackup(payload: BackupPayload, password?: string): string {
  if (!password) {
    const container: BackupContainer = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      encrypted: false,
      payload,
    };
    return JSON.stringify(container);
  }

  const salt = CryptoJS.lib.WordArray.random(16);
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = deriveKey(password, salt.toString());
  const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(payload), key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).ciphertext;

  const container: BackupContainer = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    encrypted: true,
    salt: salt.toString(),
    iv: iv.toString(),
    data: ciphertext.toString(CryptoJS.enc.Base64),
  };
  return JSON.stringify(container);
}

/** Parse backup text back into a payload, decrypting when required. */
export function deserializeBackup(text: string, password?: string): BackupPayload {
  const container = parseContainer(text);

  if (!container.encrypted) {
    if (!container.payload) throw new Error('备份内容为空或已损坏。');
    return container.payload;
  }

  if (!password) {
    throw new Error(BACKUP_PASSWORD_REQUIRED);
  }

  const key = deriveKey(password, container.salt ?? '');
  let json = '';
  try {
    const decrypted = CryptoJS.AES.decrypt(
      CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(container.data ?? '') }),
      key,
      {
        iv: CryptoJS.enc.Hex.parse(container.iv ?? ''),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      },
    );
    json = decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new Error('密码错误，或备份已损坏。');
  }

  if (!json) throw new Error('密码错误，或备份已损坏。');

  try {
    return JSON.parse(json) as BackupPayload;
  } catch {
    throw new Error('密码错误，或备份已损坏。');
  }
}
