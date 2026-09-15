import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { isTauriRuntime } from '@/lib/runtime';
import { BACKUP_PASSWORD_REQUIRED, deserializeBackup, inspectBackup, serializeBackup } from '@/modules/backup/crypto';
import { applyBackupPayload, buildBackupPayload } from '@/modules/backup/payload';
import type { BackupRestoreResult } from '@/modules/backup/types';

export interface WebdavConfig {
  url: string;
  user: string;
  pass: string;
}

export interface BackupUploadResult {
  name: string;
  encrypted: boolean;
}

function timestamp(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function resolvePassword(password?: string): string | undefined {
  const trimmed = password?.trim();
  return trimmed ? trimmed : undefined;
}

async function encodeBackup(password?: string): Promise<string> {
  const payload = await buildBackupPayload();
  return serializeBackup(payload, resolvePassword(password));
}

async function decodeAndApply(text: string, password?: string): Promise<BackupRestoreResult> {
  const payload = deserializeBackup(text, resolvePassword(password));
  return applyBackupPayload(payload);
}

/** Whether a backup file requires a password to decode. */
export function isBackupEncrypted(text: string): boolean {
  return inspectBackup(text).encrypted;
}

/** Upload a full portable backup to the configured WebDAV endpoint. */
export async function backupToWebdav(config: WebdavConfig, password?: string): Promise<BackupUploadResult> {
  const effective = resolvePassword(password);
  const text = await encodeBackup(effective);
  const name = `endfield-backup-${timestamp()}.json`;
  await invoke('webdav_backup', {
    url: config.url,
    username: config.user,
    password: config.pass,
    remoteName: name,
    text,
  });
  return { name, encrypted: Boolean(effective) };
}

/** Download a backup from WebDAV and restore it locally (cross-machine safe). */
export async function restoreFromWebdav(
  config: WebdavConfig,
  backupName: string,
  password?: string,
): Promise<BackupRestoreResult> {
  const text = await invoke<string>('webdav_restore', {
    url: config.url,
    username: config.user,
    password: config.pass,
    backupName,
  });
  return decodeAndApply(text, password);
}

/** Write a full portable backup to a local file. */
export async function backupToFile(password?: string): Promise<string | null> {
  if (!isTauriRuntime()) throw new Error('仅桌面版支持文件备份。');
  const effective = resolvePassword(password);
  const filePath = await save({
    defaultPath: `endfield-backup-${timestamp()}.json`,
    filters: [{ name: 'Endfield 备份', extensions: ['json'] }],
  });
  if (!filePath) return null;
  await writeTextFile(filePath, await encodeBackup(effective));
  return filePath;
}

/** Prompt for a local backup file, returning its path (or null when cancelled). */
export async function pickBackupFile(): Promise<string | null> {
  if (!isTauriRuntime()) throw new Error('仅桌面版支持文件恢复。');
  const filePath = await open({
    multiple: false,
    filters: [{ name: 'Endfield 备份', extensions: ['json'] }],
  });
  if (!filePath || Array.isArray(filePath)) return null;
  return filePath;
}

/** Read a local backup file and restore it locally. */
export async function restoreFromFile(filePath: string, password?: string): Promise<BackupRestoreResult> {
  if (!isTauriRuntime()) throw new Error('仅桌面版支持文件恢复。');
  const text = await readTextFile(filePath);
  return decodeAndApply(text, password);
}

export { BACKUP_PASSWORD_REQUIRED };
