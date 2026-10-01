import { describe, expect, it } from 'vitest';
import { AppError, isAppError, toAppError, userMessageFor } from '@/domain/errors';

describe('domain errors', () => {
  it('wraps an unknown error with the fallback code', () => {
    const appError = toAppError(new Error('boom'), 'STORAGE');
    expect(appError).toBeInstanceOf(AppError);
    expect(appError.code).toBe('STORAGE');
    expect(appError.message).toBe('boom');
  });

  it('returns the same instance for an existing AppError', () => {
    const original = new AppError('AUTH', 'expired');
    expect(toAppError(original)).toBe(original);
  });

  it('maps abort errors to CANCELLED', () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    expect(toAppError(abort).code).toBe('CANCELLED');
  });

  it('prefers an explicit userMessage over the code default', () => {
    const appError = new AppError('HTTP', 'HTTP 500', { userMessage: '自定义提示' });
    expect(userMessageFor(appError)).toBe('自定义提示');
  });

  it('falls back to the localized message for a known code', () => {
    expect(userMessageFor(new AppError('RISK_CONTROL', 'raw'))).toContain('风控');
  });

  it('recognises subclasses as AppError', () => {
    class HttpLikeError extends AppError {
      constructor() {
        super('HTTP', 'nope');
        this.name = 'HttpLikeError';
      }
    }
    expect(isAppError(new HttpLikeError())).toBe(true);
  });
});
