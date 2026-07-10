import { invoke } from '@tauri-apps/api/core';

export interface AppPaths {
  data_dir: string;
  database_url: string;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__ !== 'undefined' && window.__TAURI_INTERNALS__ !== null;
}

export function getAssetUrl(relativePath: string): string {
  const normalized = relativePath.replace(/^\/source\//, '');
  const mapped = normalized
    .replace(/^character\//, 'images/character/')
    .replace(/^weapon\//, 'images/weapon/')
    .replace(/^pool\/background\//, 'images/banner/');
  // Windows WebView2 exposes Tauri custom protocols as http://<scheme>.localhost.
  if (isTauriRuntime()) return `http://asset-cache.localhost/${mapped}`;
  return `https://raw.githubusercontent.com/Thanatosoul/Endfield-Gacha-Assets/master/public/${mapped}`;
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
