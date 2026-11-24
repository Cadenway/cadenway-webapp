import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AuthApi } from '../../data-access/services/auth-api/auth-api.service';
import { SignOut } from './sign-out.service';

describe('SignOut', () => {
  let signOut: Mock<() => Promise<void>>;
  let navigateByUrl: Mock<(url: string) => Promise<boolean>>;

  beforeEach(() => {
    signOut = vi.fn(() => Promise.resolve());
    navigateByUrl = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApi, useValue: { signOut } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
  });

  it('closes the session, then opens the signed-out screen in place', async () => {
    await expect(TestBed.inject(SignOut).run()).resolves.toBe(true);

    expect(signOut).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/logged-out?reason=signed-out', {
      replaceUrl: true,
    });
  });

  it('stays on the page when the gateway refuses', async () => {
    signOut.mockRejectedValueOnce(new Error('unavailable'));

    await expect(TestBed.inject(SignOut).run()).resolves.toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
