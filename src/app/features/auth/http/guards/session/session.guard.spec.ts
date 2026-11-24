import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { AuthApi } from '../../../data-access/services/auth-api/auth-api.service';
import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { requireSession } from './session.guard';

/**
 * Function run
 *
 * @description
 * Runs the guard for `/organizations` with a faked current-account read.
 *
 * @param {() => Promise<unknown>} currentAccount - The faked read.
 * @param {Mock} setAccount - Spy of the flow store.
 * @returns {Promise<boolean | UrlTree>} The guard's answer.
 */
function run(
  currentAccount: () => Promise<unknown>,
  setAccount: Mock = vi.fn(),
): Promise<boolean | UrlTree> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthApi, useValue: { currentAccount } },
      { provide: AuthFlowStore, useValue: { setAccount } },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    requireSession({} as ActivatedRouteSnapshot, { url: '/organizations' } as RouterStateSnapshot),
  );
}

describe('requireSession', () => {
  it('opens the screen and records the account of a confirmed session', async () => {
    const setAccount: Mock = vi.fn();
    const account: { name: string; email: string } = {
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
    };

    await expect(run(() => Promise.resolve(account), setAccount)).resolves.toBe(true);
    expect(setAccount).toHaveBeenCalledWith(account);
  });

  it('redirects to /login with the target as next without a session', async () => {
    const result: boolean | UrlTree = await run(
      vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 401 })),
    );

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/login?next=%2Forganizations',
    );
  });

  it('lets the screen show its own error for another failure', async () => {
    await expect(
      run(vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 503 }))),
    ).resolves.toBe(true);
  });
});
