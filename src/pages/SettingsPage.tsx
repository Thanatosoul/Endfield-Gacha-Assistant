import { memo, useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Cloud, Download, RefreshCw, Upload } from 'lucide-react';
import { useData } from '@/app/hooks/contexts';
import { getSecurePreference, saveSecurePreference } from '@/modules/storage/repositories';
import { isTauriRuntime } from '@/lib/runtime';
import {
  BACKUP_PASSWORD_REQUIRED,
  backupToFile,
  backupToWebdav,
  pickBackupFile,
  restoreFromFile,
  restoreFromWebdav,
} from '@/modules/backup/service';
import type { BackupRestoreResult } from '@/modules/backup/types';

const WDAV_URL_KEY = 'webdav.url';
const WDAV_USER_KEY = 'webdav.user';
const WDAV_PASS_KEY = 'webdav.pass';

function friendlyBackupError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === BACKUP_PASSWORD_REQUIRED) {
    return '该备份已加密，请在上方「备份密码」中输入密码后重试。';
  }
  return message;
}

function describeRestore(result: BackupRestoreResult): string {
  return `恢复完成：${result.accounts} 个账号，${result.records} 条记录，${result.preferences} 项设置。`;
}

export const SettingsPage = memo(function SettingsPage() {
  const { storageState, pathsLabel, exportJson, importJson, exportCsv, importCsv, syncAssets, refresh } = useData();
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [csvMsg, setCsvMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [assetMsg, setAssetMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncingAssets, setSyncingAssets] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlistenProgress: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    void Promise.all([
      listen<{ checked: number; total: number; downloaded: number; skipped: number; failed: number; complete: boolean }>('assets:sync-progress', (event) => {
        const { checked, total, downloaded, skipped, failed, complete } = event.payload;
        if (complete) {
          setSyncingAssets(false);
          setAssetMsg({ ok: failed === 0, text: `图片同步完成：检查 ${total}，下载 ${downloaded}，跳过 ${skipped}${failed ? `，失败 ${failed}` : ''}` });
        } else {
          setSyncingAssets(true);
          setAssetMsg({ ok: true, text: `正在后台检查图片缓存：${checked}/${total}（下载 ${downloaded}，跳过 ${skipped}）` });
        }
      }),
      listen<string>('assets:sync-error', (event) => {
        setSyncingAssets(false);
        setAssetMsg({ ok: false, text: `图片缓存同步失败：${event.payload}` });
      }),
    ]).then(([progress, error]) => {
      unlistenProgress = progress;
      unlistenError = error;
    });
    return () => { unlistenProgress?.(); unlistenError?.(); };
  }, []);

  // WebDAV state
  const [wdavUrl, setWdavUrl] = useState('');
  const [wdavUser, setWdavUser] = useState('');
  const [wdavPass, setWdavPass] = useState('');
  const [wdavMsg, setWdavMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [wdavTesting, setWdavTesting] = useState(false);
  const [wdavBacking, setWdavBacking] = useState(false);
  const [wdavBackups, setWdavBackups] = useState<string[]>([]);
  const [wdavRestoring, setWdavRestoring] = useState(false);
  const [wdavEncrypt, setWdavEncrypt] = useState(false);
  const [wdavPassword, setWdavPassword] = useState('');

  // Load saved configs
  useEffect(() => {
    void (async () => {
      const [url, user, pass] = await Promise.all([
        getSecurePreference(WDAV_URL_KEY),
        getSecurePreference(WDAV_USER_KEY),
        getSecurePreference(WDAV_PASS_KEY),
      ]);
      if (url) setWdavUrl(url);
      if (user) setWdavUser(user);
      if (pass) setWdavPass(pass);
    })();
  }, []);

  const handleExportJson = async () => {
    try {
      const path = await exportJson();
      if (path != null && path.length > 0) {
        setImportMsg({ ok: true, text: path });
      }
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleImportJson = async () => {
    try {
      const result = await importJson();
      const label = result.fromLegacy
        ? `旧版格式已转换 · ${result.accounts} 账号, ${result.records} 条记录`
        : `${result.accounts} accounts, ${result.records} records`;
      setImportMsg({ ok: true, text: label });
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleExportCsv = async () => {
    try {
      const path = await exportCsv();
      if (path != null && path.length > 0) {
        setCsvMsg({ ok: true, text: path });
      }
    } catch (e) {
      setCsvMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleImportCsv = async () => {
    try {
      const count = await importCsv();
      setCsvMsg({ ok: true, text: `已导入 ${count} 条记录` });
    } catch (e) {
      setCsvMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleSyncAssets = async () => {
    setSyncingAssets(true);
    try {
      const result = await syncAssets();
      setAssetMsg({
        ok: true,
        text: result.cacheStarted
          ? `已检查 ${result.pools} 个卡池，版本 ${result.version}。图片正后台全量检查并增量下载。`
          : `已检查 ${result.pools} 个卡池，资源版本 ${result.version}；图片缓存任务已在运行。`,
      });
    } catch (error) {
      setAssetMsg({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSyncingAssets(false);
    }
  };

  // ─── WebDAV ─────────────────────────────────────────────────────

  const saveWdavConfig = useCallback(async () => {
    await Promise.all([
      saveSecurePreference(WDAV_URL_KEY, wdavUrl),
      saveSecurePreference(WDAV_USER_KEY, wdavUser),
      saveSecurePreference(WDAV_PASS_KEY, wdavPass),
    ]);
    setWdavMsg({ ok: true, text: '配置已保存' });
  }, [wdavUrl, wdavUser, wdavPass]);

  const handleWdavTest = async () => {
    if (!isTauriRuntime()) { setWdavMsg({ ok: false, text: '仅桌面端可用' }); return; }
    setWdavTesting(true);
    try {
      const result = await invoke<string>('webdav_test', { url: wdavUrl, username: wdavUser, password: wdavPass });
      setWdavMsg({ ok: true, text: result });
    } catch (e) {
      setWdavMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setWdavTesting(false);
    }
  };

  const handleWdavBackup = async () => {
    if (!isTauriRuntime()) { setWdavMsg({ ok: false, text: '仅桌面端可用' }); return; }
    if (wdavEncrypt && !wdavPassword.trim()) { setWdavMsg({ ok: false, text: '请先输入加密密码' }); return; }
    setWdavBacking(true);
    try {
      const result = await backupToWebdav(
        { url: wdavUrl, user: wdavUser, pass: wdavPass },
        wdavEncrypt ? wdavPassword : undefined,
      );
      setWdavMsg({ ok: true, text: `备份成功：${result.name}${result.encrypted ? '（已加密）' : '（未加密）'}` });
      await handleWdavList();
    } catch (e) {
      setWdavMsg({ ok: false, text: friendlyBackupError(e) });
    } finally {
      setWdavBacking(false);
    }
  };

  const handleWdavList = async () => {
    if (!isTauriRuntime()) return;
    try {
      const list = await invoke<string[]>('webdav_list_backups', { url: wdavUrl, username: wdavUser, password: wdavPass });
      setWdavBackups(list);
      if (list.length === 0) setWdavMsg({ ok: true, text: '服务器上暂无备份' });
    } catch (e) {
      setWdavMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleWdavRestore = async (name: string) => {
    if (!isTauriRuntime()) return;
    setWdavRestoring(true);
    try {
      const result = await restoreFromWebdav({ url: wdavUrl, user: wdavUser, pass: wdavPass }, name, wdavPassword);
      await refresh();
      setWdavMsg({ ok: true, text: describeRestore(result) });
    } catch (e) {
      setWdavMsg({ ok: false, text: friendlyBackupError(e) });
    } finally {
      setWdavRestoring(false);
    }
  };

  const handleWdavBackupToFile = async () => {
    if (!isTauriRuntime()) { setWdavMsg({ ok: false, text: '仅桌面端可用' }); return; }
    if (wdavEncrypt && !wdavPassword.trim()) { setWdavMsg({ ok: false, text: '请先输入加密密码' }); return; }
    setWdavBacking(true);
    try {
      const path = await backupToFile(wdavEncrypt ? wdavPassword : undefined);
      if (path) setWdavMsg({ ok: true, text: `已导出备份文件：${path}` });
    } catch (e) {
      setWdavMsg({ ok: false, text: friendlyBackupError(e) });
    } finally {
      setWdavBacking(false);
    }
  };

  const handleWdavRestoreFromFile = async () => {
    if (!isTauriRuntime()) return;
    setWdavRestoring(true);
    try {
      const path = await pickBackupFile();
      if (!path) return;
      const result = await restoreFromFile(path, wdavPassword);
      await refresh();
      setWdavMsg({ ok: true, text: describeRestore(result) });
    } catch (e) {
      setWdavMsg({ ok: false, text: friendlyBackupError(e) });
    } finally {
      setWdavRestoring(false);
    }
  };

  // ─── Update ─────────────────────────────────────────────────────

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      {/* left: preferences */}
      <section className="ef-sec p-5 sm:p-6">
        <p className="ef-kicker">偏好设置</p>
        <h3 className="mt-2 ef-title text-xl">数据与本地行为</h3>

        <div className="mt-5 grid gap-3">
          <div className="ef-sub p-5">
            <div className="text-xs font-mono uppercase tracking-[0.18em] text-muted">资源同步</div>
            <p className="mt-3 text-sm text-muted">启动时后台检查卡池数据。手动同步会全量检查卡池和图片，但只下载缺失或已变化的图片，不会阻塞使用。</p>
            <div className="mt-4">
              <ActionBtn onClick={() => void handleSyncAssets()} disabled={syncingAssets}>
                <RefreshCw className={syncingAssets ? 'animate-spin' : ''} />
                {syncingAssets ? '同步中…' : '同步资源'}
              </ActionBtn>
            </div>
            {assetMsg && <MsgBanner {...assetMsg} onDismiss={() => setAssetMsg(null)} />}
          </div>

          {/* JSON backup */}
          <div className="ef-sub p-5">
            <div className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">
              导入 / 导出
            </div>
            <div className="flex flex-wrap gap-3">
              <ActionBtn onClick={() => void handleExportJson()}>导出 JSON</ActionBtn>
              <ActionBtn onClick={() => void handleImportJson()}>导入 JSON</ActionBtn>
              <ActionBtn onClick={() => void handleExportCsv()}>导出 CSV</ActionBtn>
              <ActionBtn onClick={() => void handleImportCsv()}>导入 CSV</ActionBtn>
            </div>
            {importMsg && <MsgBanner {...importMsg} onDismiss={() => setImportMsg(null)} />}
            {csvMsg && <MsgBanner {...csvMsg} onDismiss={() => setCsvMsg(null)} />}
            <p className="mt-4 text-sm text-muted">文件对话框使用 Tauri 插件，导入时自动去重。CSV 可在 Excel 中查看编辑。</p>
          </div>

          {/* WebDAV backup */}
          <div className="ef-sub p-5">
            <div className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">
              <span className="inline-flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" />WebDAV 备份</span>
            </div>

            <div className="grid gap-2">
              <input type="text" value={wdavUrl} onChange={(e) => setWdavUrl(e.target.value)}
                placeholder="https://your-webdav-server.com/dav/"
                className="ef-field" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={wdavUser} onChange={(e) => setWdavUser(e.target.value)}
                  placeholder="用户名" className="ef-field" />
                <input type="password" value={wdavPass} onChange={(e) => setWdavPass(e.target.value)}
                  placeholder="密码" className="ef-field" />
              </div>
              <input type="password" value={wdavPassword} onChange={(e) => setWdavPassword(e.target.value)}
                placeholder="备份密码（加密备份 / 恢复加密备份时使用）" className="ef-field" />
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={wdavEncrypt} onChange={(e) => setWdavEncrypt(e.target.checked)}
                  className="h-3.5 w-3.5" />
                使用密码加密本次备份（跨设备恢复时必须使用同一密码）
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ActionBtn onClick={() => void saveWdavConfig()}>保存配置</ActionBtn>
              <ActionBtn onClick={() => void handleWdavTest()}>{wdavTesting ? '测试中…' : '测试连接'}</ActionBtn>
              <ActionBtn onClick={() => void handleWdavBackup()} disabled={wdavBacking}>{wdavBacking ? '备份中…' : '备份到 WebDAV'}</ActionBtn>
              <ActionBtn onClick={() => void handleWdavBackupToFile()} disabled={wdavBacking}>
                <Upload className="inline h-3 w-3" /> 备份到文件
              </ActionBtn>
            </div>

            <p className="mt-4 text-xs text-muted">
              备份包含账号、抽卡记录、应用设置与 Token。选择不加密则备份为明文，仅建议存放在可信位置；
              选择加密后，在任意设备上恢复都需要输入同一密码。
            </p>

            <div className="mt-3 border-t border-[color:var(--rule)] pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void handleWdavList()}
                  className="ef-btn ef-btn--sm">
                  刷新备份列表
                </button>
                <button type="button" onClick={() => void handleWdavRestoreFromFile()}
                  disabled={wdavRestoring}
                  className="ef-btn ef-btn--sm">
                  <Upload className="inline h-3 w-3" /> 从文件恢复
                </button>
              </div>
              {wdavBackups.length > 0 && (
                <div className="mt-2 max-h-32 overflow-auto border border-[color:var(--rule)] p-1">
                  {wdavBackups.map((name) => (
                    <div key={name} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs hover:bg-white/5">
                      <span className="text-muted truncate">{name}</span>
                      <button type="button" onClick={() => void handleWdavRestore(name)}
                        disabled={wdavRestoring}
                        className="ef-btn ef-btn--sm shrink-0">
                        <Download className="inline h-3 w-3" /> 恢复
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {wdavMsg && <MsgBanner {...wdavMsg} onDismiss={() => setWdavMsg(null)} />}
          </div>

          {/* token safety */}
          <div className="ef-sub p-5">
            <div className="text-xs font-mono uppercase tracking-[0.18em] text-muted">Token 安全</div>
            <p className="mt-3 text-sm text-muted">Token 和密码使用设备指纹加密存储，仅本地可解密。</p>
          </div>
        </div>
      </section>

      {/* right: runtime + updates */}
      <section className="ef-sec p-5 sm:p-6">
        <p className="ef-kicker">运行时状态</p>
        <h3 className="mt-2 ef-title text-xl">桌面集成状态</h3>

        <div className="mt-5 grid gap-3">
          <StatusCard label="存储初始化" value={storageState} />
          <StatusCard label="数据目录路径" value={pathsLabel} />
        </div>
      </section>
    </div>
  );
});

// ─── Internal components ──────────────────────────────────────────

function ActionBtn({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="ef-btn">
      {children}
    </button>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="ef-sub p-5">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-3 text-sm text-muted break-all">{value}</div>
    </div>
  );
}

function MsgBanner({ ok, text, onDismiss }: { ok: boolean; text: string; onDismiss: () => void }) {
  return (
    <div className={[
      'mt-4 border-l-[3px] px-4 py-3 text-sm',
      ok
        ? 'border-[color:var(--success)] bg-[color:var(--success)]/5 text-[color:var(--success)]'
        : 'border-[color:var(--danger)] bg-[color:var(--danger)]/5 text-[color:var(--danger)]',
    ].join(' ')}>
      {text}
      <button type="button" onClick={onDismiss} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}
