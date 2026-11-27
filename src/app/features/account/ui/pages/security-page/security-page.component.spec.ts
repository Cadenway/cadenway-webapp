import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withErrorBoundaries, withRouterConfig } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { unsavedChangesGuard } from '@shared/unsaved-changes';

import { SecurityApi } from '../../../data-access/services/security-api/security-api.service';
import type { AccountSession } from '../../../models/session/session.interface';
import type { SecurityOverview } from '../../../models/two-step/security-overview.interface';
import type { BackupCodeSet, TwoStepOverview } from '../../../models/two-step/two-step.interface';
import { ReauthenticationService } from '../../../reauthentication/reauthentication.service';
import { SecurityKeyRegistration } from '../../../services/security-key-registration/security-key-registration.service';
import { SecurityPage } from './security-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the route's error boundary.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="boundary">Could not load this section</p>',
})
class FakeBoundary {}

/**
 * Component Elsewhere
 *
 * @description
 * Another settings section to navigate to.
 */
@Component({
  selector: 'cw-elsewhere',
  template: '<p data-testid="elsewhere">Profile</p>',
})
class Elsewhere {}

/**
 * Constant TWO_STEP_ON
 *
 * @description
 * Camille's two-step verification in the mockup (`Compte.dc.html` lines 279-306), required by
 * Atelier Nord for owners and administrators.
 *
 * @type {TwoStepOverview}
 */
const TWO_STEP_ON: TwoStepOverview = {
  enabled: true,
  appIsPrimary: true,
  appConfiguredAt: '2026-03-03T09:00:00Z',
  securityKeys: [
    { id: 'k1', name: 'YubiKey 5C NFC', createdAt: '2026-03-04T09:00:00Z', lastUsedAt: null },
  ],
  backupCodes: { remaining: 7, total: 10 },
  requiredBy: [{ organizationId: 'org-nord', requiredFor: 'admins' }],
};

/**
 * Constant TWO_STEP_OFF
 *
 * @description
 * Two-step verification off and required by nobody.
 *
 * @type {TwoStepOverview}
 */
const TWO_STEP_OFF: TwoStepOverview = {
  enabled: false,
  appIsPrimary: false,
  appConfiguredAt: null,
  securityKeys: [],
  backupCodes: null,
  requiredBy: [],
};

/**
 * Constant SESSIONS
 *
 * @description
 * Two sessions of the mockup's list (`Compte.dc.html` lines 1463-1464).
 *
 * @type {readonly AccountSession[]}
 */
const SESSIONS: readonly AccountSession[] = [
  {
    id: 's1',
    current: true,
    deviceType: 'desktop',
    device: 'Firefox 132 · Windows 11',
    ipAddress: '192.0.2.14',
    lastActiveAt: new Date().toISOString(),
    inactivityTimeoutMinutes: 720,
  },
  {
    id: 's2',
    current: false,
    deviceType: 'mobile',
    device: 'Cadenway · iPhone 15',
    ipAddress: '198.51.100.7',
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    inactivityTimeoutMinutes: 720,
  },
];

/**
 * Constant CODES
 *
 * @description
 * The mockup's backup codes (`Compte.dc.html` line 1490).
 *
 * @type {BackupCodeSet}
 */
const CODES: BackupCodeSet = {
  codes: [
    '4F7K-2M9Q',
    'H3XP-8D2L',
    'Q9TZ-5W1C',
    'B6NR-7J4E',
    'K2VD-9S8A',
    'M8LC-3F6P',
    'T5QW-1H7Z',
    'R4GY-6B3N',
    'C7EJ-2K5U',
    'W1PS-8V9D',
  ],
  generatedAt: '2026-11-08T09:00:00Z',
};

/**
 * Constant SECRET
 *
 * @description
 * The mockup's authenticator key (`Compte.dc.html` line 1622), twice to reach 32 characters.
 *
 * @type {string}
 */
const SECRET: string = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

/**
 * Function overview
 *
 * @description
 * The section as read for Camille.
 *
 * @param {TwoStepOverview} twoStep - Its two-step verification.
 * @returns {SecurityOverview} The section.
 */
function overview(twoStep: TwoStepOverview): SecurityOverview {
  return {
    email: 'camille.martin@atelier-nord.fr',
    passwordChangedAt: '2026-08-12T09:00:00Z',
    twoStep,
    sessions: SESSIONS,
  };
}

describe('SecurityPage', () => {
  let api: Record<string, Mock>;
  let keys: { supported: Mock; create: Mock };
  let toasts: { success: Mock; error: Mock };
  let writeText: Mock;

  /**
   * Function configure
   *
   * @description
   * Provides the page's route and fakes.
   */
  function configure(): void {
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            { path: 'security', component: SecurityPage, canDeactivate: [unsavedChangesGuard] },
            { path: 'profile', component: Elsewhere },
          ],
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        { provide: SecurityApi, useValue: api },
        { provide: SecurityKeyRegistration, useValue: keys },
        {
          provide: ReauthenticationService,
          useValue: { run: (operation: () => Promise<unknown>) => operation() },
        },
        { provide: CwToastService, useValue: toasts },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            user: signal({ id: 'u-camille' }),
            organization: signal({ id: 'org-nord', name: 'Atelier Nord' }),
          },
        },
      ],
    });
  }

  beforeEach(() => {
    api = {
      overview: vi.fn(() => Promise.resolve(overview(TWO_STEP_ON))),
      changePassword: vi.fn(() => Promise.resolve(new Date().toISOString())),
      startAuthenticatorSetup: vi.fn(() => Promise.resolve({ secret: SECRET })),
      confirmAuthenticatorSetup: vi.fn(() =>
        Promise.resolve({ twoStep: TWO_STEP_ON, backupCodes: CODES }),
      ),
      regenerateBackupCodes: vi.fn(() => Promise.resolve(CODES)),
      revokeSession: vi.fn(() => Promise.resolve()),
      revokeOtherSessions: vi.fn(() => Promise.resolve(1)),
      disableTwoStep: vi.fn(() => Promise.resolve()),
    };
    keys = { supported: vi.fn(() => true), create: vi.fn() };
    toasts = { success: vi.fn(), error: vi.fn() };
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    configure();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  /**
   * Function open
   *
   * @description
   * Opens the section and waits until its skeleton is gone.
   *
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/security');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[aria-busy="true"]') ?? null;
      })
      .toBeNull();
    return harness;
  }

  /**
   * Function view
   *
   * @description
   * The routed view.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The view.
   */
  function view(harness: RouterTestingHarness): HTMLElement {
    const host: HTMLElement | null = harness.routeNativeElement;
    if (!host) throw new Error('Expected the routed view.');
    return host;
  }

  /**
   * Function byTestId
   *
   * @description
   * An element of the document by its `data-testid`, overlays included.
   *
   * @param {string} id - The test id.
   * @returns {HTMLElement | null} The element.
   */
  function byTestId(id: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  }

  /**
   * Function type
   *
   * @description
   * Types a value into a field of the document.
   *
   * @param {string} selector - The field's selector.
   * @param {string} value - The value.
   */
  function type(selector: string, value: string): void {
    const field: HTMLInputElement | null = document.querySelector<HTMLInputElement>(selector);
    if (field === null) throw new Error(`Expected ${selector}.`);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  /**
   * Function text
   *
   * @description
   * The text of an element with its whitespace collapsed.
   *
   * @param {Element | null} element - The element.
   * @returns {string} The text.
   */
  function text(element: Element | null): string {
    if (element === null) return '';
    const parts: string[] = [];
    const walker: TreeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node: Node | null = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const value: string = (node.textContent ?? '').trim();
      if (value !== '') parts.push(value);
    }
    return parts.join(' ').replace(/\s+/gu, ' ');
  }

  /**
   * Function dialog
   *
   * @description
   * The open dialog, rendered in the overlay container.
   *
   * @returns {Element | null} The dialog.
   */
  function dialog(): Element | null {
    return document.querySelector('[role="dialog"]');
  }

  it('shows the password, two-step and session cards as the mockup draws them', async () => {
    const harness: RouterTestingHarness = await open();

    expect(text(view(harness).querySelector('h1'))).toBe('Security and sign-in');
    expect(text(byTestId('password-changed'))).toBe('Changed on August 12, 2026.');
    expect(text(byTestId('two-step-status'))).toBe('Enabled');
    expect(text(byTestId('two-step-required'))).toBe(
      'Required by Atelier Nord for owners and administrators.',
    );
    expect(byTestId('two-step-disable')?.hasAttribute('disabled')).toBe(true);
    expect(text(byTestId('two-step-app'))).toBe('Configured on March 3, 2026 · primary method');
    expect(text(byTestId('two-step-keys'))).toContain('1 key: YubiKey 5C NFC');
    expect(text(byTestId('two-step-backup'))).toBe('7 unused codes out of 10');
    expect(text(byTestId('sessions-timeout'))).toBe(
      'A session inactive for 12 hours is closed automatically.',
    );
    const rows: string[] = [...view(harness).querySelectorAll('[data-testid="session-row"]')].map(
      text,
    );
    expect(rows).toEqual([
      'Firefox 132 · Windows 11 This device 192.0.2.14 Active now',
      'Cadenway · iPhone 15 198.51.100.7 2 h ago Revoke',
    ]);
    expect(view(harness).textContent).not.toContain('Sign-in providers');
    expect(view(harness).querySelector('[data-testid="boundary"]')).toBeNull();
  });

  it('hides the security keys where the browser has no WebAuthn', async () => {
    keys.supported.mockReturnValue(false);
    const harness: RouterTestingHarness = await open();

    expect(view(harness).querySelector('[data-testid="two-step-keys"]')).toBeNull();
    expect(view(harness).querySelector('[data-testid="two-step-backup"]')).not.toBeNull();
  });

  it('lets a failed read reach the error boundary, whose retry reads again', async () => {
    api['overview'].mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/security');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[data-testid="boundary"]') ?? null;
      })
      .not.toBeNull();

    await harness.navigateByUrl('/security');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[data-testid="two-step-card"]') ?? null;
      })
      .not.toBeNull();
    expect(api['overview']).toHaveBeenCalledTimes(2);
  });

  it('checks the password form, shows a wrong current password, then changes it', async () => {
    const harness: RouterTestingHarness = await open();
    byTestId('password-open')?.click();
    await harness.fixture.whenStable();

    byTestId('password-submit')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text(dialog())).toContain('Enter your current password.');
    });
    expect(document.activeElement?.id).toBe('password-current');
    expect(api['changePassword']).not.toHaveBeenCalled();

    type('#password-current', 'old secret');
    type('#password-new', 'short');
    await harness.fixture.whenStable();
    expect(text(byTestId('password-help'))).toBe('7 more characters.');
    type('#password-new', 'correct horse battery');
    type('#password-confirm', 'correct horse battery');
    api['changePassword'].mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 422,
        error: { code: 'auth.password-incorrect', details: { remainingAttempts: 2 } },
      }),
    );
    byTestId('password-submit')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text(dialog())).toContain('Incorrect password. Attempts left: 2.');
    });

    type('#password-current', 'the right one');
    byTestId('password-submit')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(dialog()).toBeNull();
    });
    expect(api['changePassword']).toHaveBeenLastCalledWith(
      'u-camille',
      'the right one',
      'correct horse battery',
    );
    expect(toasts.success).toHaveBeenCalledWith('Password changed', {
      description: 'A confirmation email was just sent to camille.martin@atelier-nord.fr.',
    });
    expect(text(byTestId('password-changed'))).toMatch(/^Changed today, /u);
    expect(document.body.innerHTML).not.toContain('correct horse battery');
  });

  it('sets up the app, shows the first codes once, and forgets them', async () => {
    api['overview'].mockResolvedValue(overview(TWO_STEP_OFF));
    const created: Mock = vi.fn((): string => 'blob:codes');
    const revoked: Mock = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked }),
    );
    const click: Mock = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
    const harness: RouterTestingHarness = await open();
    expect(text(byTestId('two-step-off-alert'))).toBe(
      'Your account is protected only by a password.',
    );

    byTestId('two-step-enable')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text(byTestId('setup-key'))).toBe('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP');
    });
    byTestId('setup-copy-key')?.click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(SECRET);
    });
    expect(toasts.success).toHaveBeenCalledWith('Key copied', {
      description: 'Paste it into your authenticator app.',
    });

    byTestId('setup-next')?.click();
    await harness.fixture.whenStable();
    expect(text(dialog())).toContain('Step 2 of 3');
    type('#setup-code', '123456');
    byTestId('setup-next')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text(byTestId('setup-codes'))).toContain('4F7K-2M9Q');
    });
    expect(api['confirmAuthenticatorSetup']).toHaveBeenCalledWith('u-camille', '123456');
    expect(text(dialog())).toContain('Step 3 of 3');

    expect(await TestBed.inject(Router).navigateByUrl('/profile')).toBe(false);

    byTestId('setup-download-codes')?.click();
    expect(click).toHaveBeenCalledOnce();
    expect(toasts.success).toHaveBeenCalledWith('Backup codes saved', {
      description: 'File cadenway-backup-codes.txt downloaded.',
    });
    const blob: unknown = created.mock.calls[0]?.[0];
    expect(blob instanceof Blob ? await blob.text() : '').toContain(
      'Account: camille.martin@atelier-nord.fr',
    );

    byTestId('setup-next')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(dialog()).toBeNull();
    });
    expect(toasts.success).toHaveBeenCalledWith('Two-step verification enabled', {
      description: 'You will be asked for it at your next sign-in.',
    });
    expect(document.body.innerHTML).not.toContain('4F7K-2M9Q');
    expect(document.body.innerHTML).not.toContain('JBSW');
    expect(text(byTestId('two-step-status'))).toBe('Enabled');
    vi.unstubAllGlobals();
  });

  it('keeps the setup open on a refused code', async () => {
    api['overview'].mockResolvedValue(overview(TWO_STEP_OFF));
    api['confirmAuthenticatorSetup'].mockRejectedValueOnce(
      new HttpErrorResponse({ status: 422, error: { code: 'auth.two-step-code-invalid' } }),
    );
    const harness: RouterTestingHarness = await open();
    byTestId('two-step-enable')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(byTestId('setup-next')).not.toBeNull();
    });
    byTestId('setup-next')?.click();
    await harness.fixture.whenStable();
    type('#setup-code', '000000');
    byTestId('setup-next')?.click();

    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text(dialog())).toContain('Incorrect code. Enter the one your app shows now.');
    });
    expect(text(byTestId('two-step-status'))).toBe('Disabled');
  });

  it('shows new backup codes with how many they replaced', async () => {
    const harness: RouterTestingHarness = await open();
    byTestId('two-step-backup-generate')?.click();

    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text(dialog())).toContain('The 7 previous codes no longer work.');
    });
    byTestId('backup-copy')?.click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(CODES.codes.join('\n'));
    });
    expect(text(byTestId('two-step-backup'))).toBe('10 unused codes out of 10');
  });

  it('revokes another session once confirmed', async () => {
    const harness: RouterTestingHarness = await open();
    view(harness)
      .querySelector<HTMLButtonElement>('[aria-label="Revoke the session of Cadenway · iPhone 15"]')
      ?.click();
    await harness.fixture.whenStable();
    expect(text(document.querySelector('[role="alertdialog"]'))).toContain(
      'Sign out Cadenway · iPhone 15?',
    );

    byTestId('security-confirm-action')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(view(harness).querySelectorAll('[data-testid="session-row"]')).toHaveLength(1);
    });
    expect(api['revokeSession']).toHaveBeenCalledWith('u-camille', 's2');
    expect(toasts.success).toHaveBeenCalledWith('Session revoked', {
      description: 'Cadenway · iPhone 15 is signed out.',
    });
    expect(byTestId('sessions-revoke-others')?.hasAttribute('disabled')).toBe(true);
  });

  it('asks for a key name, registers the key, then removes it once confirmed', async () => {
    api['startSecurityKeyRegistration'] = vi.fn(() => Promise.resolve({ challenge: 'Zml4dHVyZQ' }));
    api['addSecurityKey'] = vi.fn(() =>
      Promise.resolve({
        id: 'k2',
        name: 'Touch ID (MacBook Air)',
        createdAt: '2026-11-08T10:00:00Z',
        lastUsedAt: null,
      }),
    );
    api['removeSecurityKey'] = vi.fn(() => Promise.resolve());
    keys.create.mockResolvedValue({ id: 'credential' });
    const harness: RouterTestingHarness = await open();

    byTestId('two-step-add-key')?.click();
    await harness.fixture.whenStable();
    byTestId('key-name-submit')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text(dialog())).toContain('Enter a name for the key.');
    });
    expect(api['startSecurityKeyRegistration']).not.toHaveBeenCalled();

    type('#key-name', '  Touch ID (MacBook Air)  ');
    byTestId('key-name-submit')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text(byTestId('two-step-keys'))).toContain(
        '2 keys: YubiKey 5C NFC, Touch ID (MacBook Air)',
      );
    });
    expect(api['addSecurityKey']).toHaveBeenCalledWith('u-camille', 'Touch ID (MacBook Air)', {
      id: 'credential',
    });
    expect(toasts.success).toHaveBeenCalledWith('Security key added', {
      description: 'It can be used from your next sign-in.',
    });

    view(harness)
      .querySelector<HTMLButtonElement>('[aria-label="Remove the key “YubiKey 5C NFC”"]')
      ?.click();
    await harness.fixture.whenStable();
    expect(text(document.querySelector('[role="alertdialog"]'))).toContain(
      'Remove the key “YubiKey 5C NFC”?',
    );
    byTestId('security-confirm-action')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(text(byTestId('two-step-keys'))).toContain('1 key: Touch ID (MacBook Air)');
    });
    expect(api['removeSecurityKey']).toHaveBeenCalledWith('u-camille', 'k1');
  });

  it('waits for a write on its way before leaving', async () => {
    let finish: () => void = (): void => undefined;
    api['revokeOtherSessions'].mockReturnValueOnce(
      new Promise<number>((resolve: (count: number) => void): void => {
        finish = (): void => {
          resolve(1);
        };
      }),
    );
    const harness: RouterTestingHarness = await open();
    byTestId('sessions-revoke-others')?.click();
    await harness.fixture.whenStable();
    byTestId('security-confirm-action')?.click();
    await vi.waitFor(() => {
      expect(api['revokeOtherSessions']).toHaveBeenCalledOnce();
    });

    let left: boolean | null = null;
    void TestBed.inject(Router)
      .navigateByUrl('/profile')
      .then((result: boolean): void => {
        left = result;
      });
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 50);
    });
    expect(left).toBeNull();
    finish();

    await vi.waitFor(() => {
      expect(left).toBe(true);
    });
    expect(toasts.success).toHaveBeenCalledWith('1 session closed', {
      description: 'Only this device stays signed in.',
    });
  });
});
