import { firstValueFrom, type Observable, of } from 'rxjs';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { withSessionLock } from './session-lock.service';

describe('withSessionLock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs the operation under the exclusive session lock by default', async () => {
    const request: Mock = vi.fn(
      (_name: string, _options: LockOptions, run: () => Promise<void>): Promise<void> => run(),
    );
    vi.stubGlobal('navigator', { locks: { request } });

    await expect(firstValueFrom(withSessionLock(() => of('done')))).resolves.toBe('done');
    expect(request).toHaveBeenCalledWith(
      'cadenway-gateway-session',
      expect.objectContaining({ mode: 'exclusive' }),
      expect.any(Function),
    );
  });

  it('fails without sending anything when the browser has no Web Locks', async () => {
    vi.stubGlobal('navigator', {});
    const operation: Mock<() => Observable<string>> = vi.fn(() => of('done'));

    await expect(firstValueFrom(withSessionLock(operation))).rejects.toThrow();
    expect(operation).not.toHaveBeenCalled();
  });
});
