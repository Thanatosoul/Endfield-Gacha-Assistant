import { invoke } from '@tauri-apps/api/core';

export interface AppPaths {
  data_dir: string;
  database_url: string;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__ !== 'undefined' && window.__TAURI_INTERNALS__ !== null;
}

export function getAssetUrl(relativePath: string): string {
  return relativePath;
}

export async function resolveAppPaths(): Promise<AppPaths> {
  if (!isTauriRuntime()) {
    return {
      data_dir: 'browser-preview',
      database_url: 'sqlite:endfield-gacha-assistant-preview.db',
    };
  }

  return invoke<AppPaths>('app_paths');
}
