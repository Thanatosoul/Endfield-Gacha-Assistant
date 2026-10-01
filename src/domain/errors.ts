/**
 * Unified domain error model. Network, storage and UI layers wrap failures in
 * an `AppError` carrying a stable `code`, so the UI never has to match on
 * human-readable English strings to decide how to react.
 */
export type AppErrorCode =
  'NETWORK' | 'HTTP' | 'RISK_CONTROL' | 'AUTH' | 'PARSE' | 'STORAGE' | 'BACKUP' | 'IMPORT' | 'CANCELLED' | 'UNKNOWN';

export interface AppErrorOptions {
  cause?: unknown;
  details?: Record<string, unknown>;
  userMessage?: string;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: Record<string, unknown>;
  readonly userMessage?: string;

  constructor(code: AppErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = options.details;
    this.userMessage = options.userMessage;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown, fallbackCode: AppErrorCode = 'UNKNOWN'): AppError {
  if (isAppError(error)) return error;

  if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted')) {
    return new AppError('CANCELLED', error.message, { cause: error });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new AppError(fallbackCode, message, { cause: error });
}

const USER_MESSAGES: Record<AppErrorCode, string | undefined> = {
  NETWORK: '网络请求失败，请检查网络后重试。',
  HTTP: '官方接口返回异常，请稍后重试。',
  RISK_CONTROL: '触发官方风控或限流，请稍后重试。',
  AUTH: '登录状态已失效，请重新登录。',
  PARSE: '数据解析失败，请尝试重新同步。',
  STORAGE: '本地数据读写失败。',
  BACKUP: '备份或恢复失败。',
  IMPORT: '导入失败，请检查文件格式。',
  CANCELLED: '操作已取消。',
  UNKNOWN: undefined,
};

/** Localized, user-facing message; falls back to the raw message then code. */
export function userMessageFor(error: unknown): string {
  const appError = toAppError(error);
  return appError.userMessage ?? USER_MESSAGES[appError.code] ?? appError.message;
}
