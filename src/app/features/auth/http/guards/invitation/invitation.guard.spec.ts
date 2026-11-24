import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  type UrlTree,
} from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { AuthApi } from '../../../data-access/services/auth-api/auth-api.service';
import { openInvitation } from './invitation.guard';

/**
 * Function run
 *
 * @description
 * Runs the guard for `/invite/invitation-lumen` and serializes its redirect.
 *
 * @param {() => Promise<unknown>} currentAccount - The faked current-account read.
 * @returns {Promise<string>} The redirect URL.
 */
async function run(currentAccount: () => Promise<unknown>): Promise<string> {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthApi, useValue: { currentAccount } }],
  });
  const tree: UrlTree = await TestBed.runInInjectionContext(() =>
    openInvitation({
      paramMap: convertToParamMap({ invitationId: 'invitation-lumen' }),
    } as ActivatedRouteSnapshot),
  );
  return TestBed.inject(Router).serializeUrl(tree);
}

describe('openInvitation', () => {
  it('opens the chooser with the invitation highlighted when signed in', async () => {
    await expect(run(() => Promise.resolve({}))).resolves.toBe(
      '/organizations?invitation=invitation-lumen',
    );
  });

  it('goes to sign-in and comes back to the link when signed out', async () => {
    await expect(
      run(vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 401 }))),
    ).resolves.toBe('/login?next=%2Finvite%2Finvitation-lumen');
  });
});
