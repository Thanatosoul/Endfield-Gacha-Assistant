// compact-build.mjs — cross-platform build + UPX compression pipeline
// Usage: node scripts/compact-build.mjs [--bundles nsis,msi]

import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const bundlesArg = process.argv.includes('--bundles')
  ? `--bundles ${process.argv[process.argv.indexOf('--bundles') + 1]}`
  : '';

console.log('[compact-build] Building Tauri app (release mode)...');
execSync(`npx tauri build ${bundlesArg}`, { cwd: root, stdio: 'inherit' });

const os = platform();
let exePath;

if (os === 'win32') {
  exePath = join(root, 'src-tauri', 'target', 'release', 'endfield-gacha-assistant.exe');
} else if (os === 'darwin') {
  exePath = join(root, 'src-tauri', 'target', 'release', 'endfield-gacha-assistant');
} else {
  // Linux
  exePath = join(root, 'src-tauri', 'target', 'release', 'endfield-gacha-assistant');
}

if (!existsSync(exePath)) {
  console.log('[compact-build] Binary not found. Bundles may be in src-tauri/target/release/bundle/');
  process.exit(0);
}

const sizeMB = (statSync(exePath).size / (1024 * 1024)).toFixed(2);
console.log(`[compact-build] Binary size: ${sizeMB} MB`);

// Try UPX compression
try {
  execSync('upx --version', { stdio: 'pipe' });
  console.log('[compact-build] Running UPX compression...');
  execSync(`upx --best --lzma "${exePath}"`, { cwd: root, stdio: 'inherit' });
  const afterMB = (statSync(exePath).size / (1024 * 1024)).toFixed(2);
  console.log(`[compact-build] After UPX: ${afterMB} MB`);
} catch {
  console.log('[compact-build] UPX not found — skipping compression.');
  console.log('[compact-build] Install UPX from https://upx.github.io for smaller binaries.');
}

console.log('[compact-build] Done.');
