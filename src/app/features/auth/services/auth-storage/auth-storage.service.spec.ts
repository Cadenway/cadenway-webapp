import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { AuthStorageService } from './auth-storage.service';

describe('AuthStorageService', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('keeps the challenge token and the return path in this tab until cleared', () => {
    const storage: AuthStorageService = TestBed.inject(AuthStorageService);

    storage.keepChallengeToken('fixture-challenge-token');
    storage.keepReturnUrl('/invite/invitation-lumen');
    expect(storage.challengeToken()).toBe('fixture-challenge-token');
    expect(storage.returnUrl()).toBe('/invite/invitation-lumen');
    expect(localStorage.length).toBe(0);

    storage.keepChallengeToken(null);
    storage.keepReturnUrl(null);
    expect(storage.challengeToken()).toBeNull();
    expect(storage.returnUrl()).toBeNull();
  });
});
