import { describe, expect, it } from 'vitest';
import {
  BACKUP_PASSWORD_REQUIRED,
  deserializeBackup,
  inspectBackup,
  serializeBackup,
} from '@/modules/backup/crypto';
import { BACKUP_VERSION } from '@/modules/backup/types';
import type { BackupPayload } from '@/modules/backup/types';

const payload: BackupPayload = {
  version: BACKUP_VERSION,
  exportedAt: 1_700_000_000_000,
  accounts: [],
  records: [],
  metadata: [],
  preferences: [
    { key: 'auth.appToken', value: 'secret-token', secure: true, updated_at: 1 },
    { key: 'ui.theme', value: 'dark', secure: false, updated_at: 2 },
  ],
};

describe('backup crypto', () => {
  it('round-trips a plaintext backup', () => {
    const text = serializeBackup(payload);
    expect(inspectBackup(text).encrypted).toBe(false);
    expect(deserializeBackup(text)).toEqual(payload);
  });

  it('round-trips an encrypted backup with the correct password', () => {
    const text = serializeBackup(payload, 'hunter2');
    expect(inspectBackup(text).encrypted).toBe(true);
    expect(text).not.toContain('secret-token');
    expect(deserializeBackup(text, 'hunter2')).toEqual(payload);
  });

  it('requires a password for encrypted backups', () => {
    const text = serializeBackup(payload, 'hunter2');
    expect(() => deserializeBackup(text)).toThrowError(BACKUP_PASSWORD_REQUIRED);
  });

  it('rejects a wrong password', () => {
    const text = serializeBackup(payload, 'hunter2');
    expect(() => deserializeBackup(text, 'wrong-password')).toThrow();
  });

  it('rejects malformed input', () => {
    expect(() => deserializeBackup('not json')).toThrow();
    expect(() => deserializeBackup(JSON.stringify({ hello: 'world' }))).toThrow();
  });
});
