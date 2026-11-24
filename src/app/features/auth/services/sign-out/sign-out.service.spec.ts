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

  it('closes the session, forgets the recent tasks, then opens the signed-out screen', async () => {
    localStorage.setItem('cadenway-recent-tasks:u1:o1', '[]');
    localStorage.setItem('cadenway-remembered-accounts', '[]');

    await expect(TestBed.inject(SignOut).run()).resolves.toBe(true);

    expect(localStorage.getItem('cadenway-recent-tasks:u1:o1')).toBeNull();
    expect(localStorage.getItem('cadenway-remembered-accounts')).toBe('[]');
    localStorage.clear();

    expect(signOut).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/logged-out?reason=signed-out', {
      replaceUrl: true,
    });
  });

  it('stays on the page when the gateway refuses', async () => {
    signOut.mockRejectedValueOnce(new Error('unavailable'));
    localStorage.setItem('cadenway-recent-tasks:u1:o1', '[]');

    await expect(TestBed.inject(SignOut).run()).resolves.toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(localStorage.getItem('cadenway-recent-tasks:u1:o1')).toBe('[]');
    localStorage.clear();
  });
});
