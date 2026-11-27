import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withErrorBoundaries } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import {
  ReauthenticationCancelledError,
  ReauthenticationService,
} from '@features/account/reauthentication';
import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { unsavedChangesGuard } from '@shared/unsaved-changes';

import { AuthenticationPolicyApi } from '../../../data-access/services/authentication-policy-api/authentication-policy-api.service';
import type { AuthenticationPolicy } from '../../../models/authentication-policy/authentication-policy.interface';
import { SecurityPage } from './security-page.component';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The policy of Atelier Nord: administrators required, 12 hours, 7 people without two-step
 * verification, version 2.
 *
 * @type {AuthenticationPolicy}
 */
const ATELIER_NORD: AuthenticationPolicy = {
  twoStepRequiredFor: 'admins',
  sessionTimeoutMinutes: 720,
  membersWithoutTwoStep: { admins: 0, everyone: 7 },
  version: 2,
};

/**
 * Component OtherSection
 *
 * @description
 * Another settings section to leave the page for.
 */
@Component({ selector: 'cw-other-section', template: '<p>Members</p>' })
class OtherSection {}

/**
 * Function problem
 *
 * @description
 * A refused call of the gateway.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The error.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { type: 'about:blank', title: '', status, code } });
}

/**
 * Function byTestId
 *
 * @description
 * An element of the page by its test id.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {string} id - Test id.
 * @returns {HTMLElement | null} The element, when rendered.
 */
function byTestId(harness: RouterTestingHarness, id: string): HTMLElement | null {
  harness.detectChanges();
  return harness.routeNativeElement?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null;
}

/**
 * Function switchOf
 *
 * @description
 * The switch button of a policy row.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {string} id - Test id of the `cw-switch`.
 * @returns {HTMLButtonElement | null} Its `role="switch"` button.
 */
function switchOf(harness: RouterTestingHarness, id: string): HTMLButtonElement | null {
  return byTestId(harness, id)?.querySelector<HTMLButtonElement>('[role="switch"]') ?? null;
}

/**
 * Function button
 *
 * @description
 * A button of the document by its text.
 *
 * @param {string} text - Visible text.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function button(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate: HTMLButtonElement) => candidate.textContent.trim() === text,
  );
}

/**
 * Function open
 *
 * @description
 * Opens the security section and waits for the policy.
 *
 * @returns {Promise<RouterTestingHarness>} The harness.
 */
async function open(): Promise<RouterTestingHarness> {
  const harness: RouterTestingHarness = await RouterTestingHarness.create('/security');
  await expect
    .poll(() => byTestId(harness, 'security-two-step-everyone-hint')?.textContent ?? '')
    .toContain('7 people have not set it up');
  return harness;
}

/**
 * Function pickTimeout
 *
 * @description
 * Picks an option of the `Idle session timeout` select.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {string} label - The option's text.
 * @returns {Promise<void>} Resolves once picked.
 */
async function pickTimeout(harness: RouterTestingHarness, label: string): Promise<void> {
  byTestId(harness, 'security-session-timeout')
    ?.querySelector<HTMLButtonElement>('[role="combobox"]')
    ?.click();
  await expect
    .poll(() => {
      harness.detectChanges();
      return document.querySelectorAll('[role="option"]').length;
    })
    .toBe(4);
  [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    .find((option: HTMLElement) => option.textContent.trim() === label)
    ?.click();
  harness.detectChanges();
}

describe('SecurityPage', () => {
  let api: { policy: Mock; update: Mock };
  let toasts: { success: Mock; error: Mock };
  let run: Mock;

  beforeEach(() => {
    api = {
      policy: vi.fn(() => Promise.resolve(ATELIER_NORD)),
      update: vi.fn((change: Partial<AuthenticationPolicy>) =>
        Promise.resolve({ ...ATELIER_NORD, ...change, version: 3 }),
      ),
    };
    toasts = { success: vi.fn(), error: vi.fn() };
    run = vi.fn((operation: () => Promise<unknown>) => operation());
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: 'security',
              component: SecurityPage,
              canDeactivate: [unsavedChangesGuard],
              runGuardsAndResolvers: 'always',
            },
            { path: 'members', component: OtherSection },
          ],
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        { provide: AuthenticationPolicyApi, useValue: api },
        {
          provide: ReauthenticationService,
          useValue: { run },
        },
        { provide: CwToastService, useValue: toasts },
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: () => ({ id: 'org-1', slug: 'atelier-nord' }) },
        },
      ],
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the loading state until the policy arrives', async () => {
    let answer: (policy: AuthenticationPolicy) => void = (): void => undefined;
    api.policy.mockReturnValue(
      new Promise<AuthenticationPolicy>((resolve: (policy: AuthenticationPolicy) => void) => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/security');

    const loading: Element | null =
      harness.routeNativeElement?.querySelector('[role="status"]') ?? null;
    expect(loading?.getAttribute('aria-label')).toBe('Loading the section');
    expect(loading?.getAttribute('aria-busy')).toBe('true');

    answer(ATELIER_NORD);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent ?? '';
      })
      .toContain('Authentication policy');
    expect(harness.routeNativeElement?.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the saved policy', async () => {
    const harness: RouterTestingHarness = await open();

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Security and SSO',
    );
    expect(switchOf(harness, 'security-two-step-admins')?.getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(switchOf(harness, 'security-two-step-everyone')?.getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(byTestId(harness, 'security-session-timeout')?.textContent).toContain('12 hours');
    expect(byTestId(harness, 'security-unsaved')).toBeNull();
    expect(button('Save')?.disabled).toBe(true);
    expect(harness.routeNativeElement?.textContent).not.toContain('SAML');
  });

  it.each([
    [0, 'Everyone has already set it up.'],
    [1, '1 person has not set it up: they will have to at their next sign-in.'],
  ])('counts %i people without two-step verification', async (count: number, hint: string) => {
    api.policy.mockResolvedValue({
      ...ATELIER_NORD,
      membersWithoutTwoStep: { admins: 0, everyone: count },
    });
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/security');

    await expect
      .poll(() => byTestId(harness, 'security-two-step-everyone-hint')?.textContent.trim())
      .toBe(hint);
  });

  it('retries a failed read through the route boundary', async () => {
    api.policy.mockRejectedValueOnce(problem(503, 'service.unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/security');

    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent ?? '';
      })
      .toContain('Retry');
    button('Retry')?.click();

    await expect
      .poll(() => byTestId(harness, 'security-two-step-everyone-hint')?.textContent ?? '')
      .toContain('7 people have not set it up');
    expect(api.policy).toHaveBeenCalledTimes(2);
  });

  it('requiring every member keeps the administrators required, and Cancel restores the policy', async () => {
    const harness: RouterTestingHarness = await open();

    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();

    const admins: HTMLButtonElement | null = switchOf(harness, 'security-two-step-admins');
    expect(admins?.getAttribute('aria-checked')).toBe('true');
    expect(admins?.disabled).toBe(true);
    expect(byTestId(harness, 'security-unsaved')?.textContent).toContain('Unsaved changes');

    button('Cancel')?.click();
    harness.detectChanges();

    expect(switchOf(harness, 'security-two-step-everyone')?.getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(switchOf(harness, 'security-two-step-admins')?.disabled).toBe(false);
    expect(byTestId(harness, 'security-unsaved')).toBeNull();
  });

  it('turning every member off keeps the administrators required', async () => {
    api.policy.mockResolvedValue({ ...ATELIER_NORD, twoStepRequiredFor: 'everyone' });
    const harness: RouterTestingHarness = await open();

    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();
    button('Save')?.click();

    await expect.poll(() => api.update.mock.calls.length).toBe(1);
    expect(api.update).toHaveBeenCalledWith({ twoStepRequiredFor: 'admins' }, 2);
  });

  it('switching a control back leaves nothing to save', async () => {
    const harness: RouterTestingHarness = await open();

    switchOf(harness, 'security-two-step-admins')?.click();
    harness.detectChanges();
    expect(byTestId(harness, 'security-unsaved')).not.toBeNull();
    switchOf(harness, 'security-two-step-admins')?.click();
    harness.detectChanges();

    expect(byTestId(harness, 'security-unsaved')).toBeNull();
    expect(button('Save')?.disabled).toBe(true);
  });

  it('turning every member on then off from nobody leaves nothing to save', async () => {
    api.policy.mockResolvedValue({ ...ATELIER_NORD, twoStepRequiredFor: 'nobody' });
    const harness: RouterTestingHarness = await open();

    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();
    expect(switchOf(harness, 'security-two-step-admins')?.getAttribute('aria-checked')).toBe(
      'true',
    );
    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();

    expect(switchOf(harness, 'security-two-step-admins')?.getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(byTestId(harness, 'security-unsaved')).toBeNull();
    expect(button('Save')?.disabled).toBe(true);
  });

  it('does not show an unknown requirement as nobody', async () => {
    api.policy.mockResolvedValue({ ...ATELIER_NORD, twoStepRequiredFor: null });
    const harness: RouterTestingHarness = await open();

    expect(byTestId(harness, 'security-two-step-unknown')?.textContent).toContain(
      'The current two-step verification rule cannot be shown here.',
    );
    expect(switchOf(harness, 'security-two-step-admins')?.disabled).toBe(true);
    expect(switchOf(harness, 'security-two-step-everyone')?.disabled).toBe(true);
    expect(byTestId(harness, 'security-unsaved')).toBeNull();
    expect(button('Save')?.disabled).toBe(true);
  });

  it('replaces an unknown requirement once the person chooses a new rule', async () => {
    api.policy.mockResolvedValue({ ...ATELIER_NORD, twoStepRequiredFor: null });
    const harness: RouterTestingHarness = await open();

    button('Choose a new rule')?.click();
    harness.detectChanges();

    expect(byTestId(harness, 'security-two-step-unknown')).toBeNull();
    expect(switchOf(harness, 'security-two-step-admins')?.disabled).toBe(false);
    expect(switchOf(harness, 'security-two-step-everyone')?.disabled).toBe(false);
    expect(byTestId(harness, 'security-unsaved')).not.toBeNull();

    button('Cancel')?.click();
    harness.detectChanges();
    expect(byTestId(harness, 'security-two-step-unknown')).not.toBeNull();
    expect(byTestId(harness, 'security-unsaved')).toBeNull();

    button('Choose a new rule')?.click();
    harness.detectChanges();
    button('Save')?.click();

    await expect.poll(() => api.update.mock.calls.length).toBe(1);
    expect(api.update).toHaveBeenCalledWith({ twoStepRequiredFor: 'nobody' }, 2);
  });

  it('sends the switches once an unknown requirement is replaced', async () => {
    api.policy.mockResolvedValue({ ...ATELIER_NORD, twoStepRequiredFor: null });
    const harness: RouterTestingHarness = await open();

    button('Choose a new rule')?.click();
    harness.detectChanges();
    switchOf(harness, 'security-two-step-admins')?.click();
    harness.detectChanges();
    button('Save')?.click();

    await expect.poll(() => api.update.mock.calls.length).toBe(1);
    expect(api.update).toHaveBeenCalledWith({ twoStepRequiredFor: 'admins' }, 2);
  });

  it('toasts a two-step change without naming the timeout', async () => {
    const harness: RouterTestingHarness = await open();

    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();
    button('Save')?.click();

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(api.update).toHaveBeenCalledWith({ twoStepRequiredFor: 'everyone' }, 2);
    expect(toasts.success).toHaveBeenCalledWith('Two-step verification policy updated');
  });

  it('keeps the edits silently when the reauthentication is closed', async () => {
    run.mockRejectedValue(new ReauthenticationCancelledError());
    const harness: RouterTestingHarness = await open();

    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();
    button('Save')?.click();

    await expect.poll(() => run.mock.calls.length).toBe(1);
    await expect
      .poll(() => {
        harness.detectChanges();
        return switchOf(harness, 'security-two-step-everyone')?.disabled;
      })
      .toBe(false);
    expect(toasts.success).not.toHaveBeenCalled();
    expect(toasts.error).not.toHaveBeenCalled();
    expect(switchOf(harness, 'security-two-step-everyone')?.getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(byTestId(harness, 'security-unsaved')).not.toBeNull();
    expect(button('Save')?.disabled).toBe(false);
  });

  it('keeps the edits silently when the organization context changed', async () => {
    api.update.mockRejectedValue(problem(412, 'organization.context-changed'));
    const harness: RouterTestingHarness = await open();

    await pickTimeout(harness, '7 days');
    button('Save')?.click();

    await expect.poll(() => api.update.mock.calls.length).toBe(1);
    await expect
      .poll(() => {
        harness.detectChanges();
        return button('Save')?.disabled;
      })
      .toBe(false);
    expect(toasts.success).not.toHaveBeenCalled();
    expect(toasts.error).not.toHaveBeenCalled();
    expect(api.policy).toHaveBeenCalledTimes(1);
    expect(byTestId(harness, 'security-session-timeout')?.textContent).toContain('7 days');
    expect(byTestId(harness, 'security-unsaved')).not.toBeNull();
  });

  it('keeps the edits without asking through a workspace recovery', async () => {
    const harness: RouterTestingHarness = await open();
    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();

    const recovered: boolean = await TestBed.inject(Router).navigateByUrl('/security', {
      onSameUrlNavigation: 'reload',
      info: Symbol('recovery'),
    });
    harness.detectChanges();

    expect(recovered).toBe(true);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(switchOf(harness, 'security-two-step-everyone')?.getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(byTestId(harness, 'security-unsaved')).not.toBeNull();
  });

  it('saves only the changed timeout and toasts it', async () => {
    const harness: RouterTestingHarness = await open();

    await pickTimeout(harness, '1 hour');
    expect(byTestId(harness, 'security-unsaved')).not.toBeNull();
    button('Save')?.click();

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(api.update).toHaveBeenCalledWith({ sessionTimeoutMinutes: 60 }, 2);
    expect(toasts.success).toHaveBeenCalledWith('Session policy updated', {
      description: 'Idle sessions now expire after 1 hour.',
    });
    expect(byTestId(harness, 'security-unsaved')).toBeNull();
    expect(byTestId(harness, 'security-session-timeout')?.textContent).toContain('1 hour');
  });

  it('keeps the edits and toasts a refused save', async () => {
    api.update.mockRejectedValue(problem(503, 'service.unavailable'));
    const harness: RouterTestingHarness = await open();

    switchOf(harness, 'security-two-step-admins')?.click();
    harness.detectChanges();
    button('Save')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('The authentication policy could not be saved');
    expect(byTestId(harness, 'security-unsaved')).not.toBeNull();
    expect(switchOf(harness, 'security-two-step-admins')?.getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('explains why requiring two-step verification of the own role is refused', async () => {
    api.update.mockRejectedValue(problem(409, 'auth.two-step-not-enabled'));
    const harness: RouterTestingHarness = await open();

    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();
    button('Save')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('Set up two-step verification first', {
      description: 'You cannot require it for your own role before using it yourself.',
    });
  });

  it('shows the latest policy after a stale version', async () => {
    api.update.mockRejectedValue(problem(412, 'request.version-mismatch'));
    const harness: RouterTestingHarness = await open();
    api.policy.mockResolvedValue({ ...ATELIER_NORD, sessionTimeoutMinutes: 10080, version: 4 });

    await pickTimeout(harness, '1 hour');
    button('Save')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('The policy changed in the meantime', {
      description: 'Its latest version is shown.',
    });
    await expect
      .poll(() => byTestId(harness, 'security-session-timeout')?.textContent ?? '')
      .toContain('7 days');
    expect(byTestId(harness, 'security-unsaved')).toBeNull();
  });

  it('asks before leaving with unsaved changes', async () => {
    const harness: RouterTestingHarness = await open();
    switchOf(harness, 'security-two-step-admins')?.click();
    harness.detectChanges();

    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl('/members');
    await expect
      .poll(() => {
        harness.detectChanges();
        return document.querySelector('[role="alertdialog"]')?.textContent ?? '';
      })
      .toContain('Discard unsaved changes?');
    button('Keep editing')?.click();

    expect(await leaving).toBe(false);
    expect(byTestId(harness, 'security-unsaved')).not.toBeNull();
  });

  it('waits for a change on its way instead of offering to discard it, then leaves once saved', async () => {
    let answer: (policy: AuthenticationPolicy) => void = (): void => undefined;
    api.update.mockReturnValue(
      new Promise<AuthenticationPolicy>((resolve: (policy: AuthenticationPolicy) => void) => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await open();
    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();
    button('Save')?.click();
    await expect.poll(() => api.update.mock.calls.length).toBe(1);

    let left: boolean | undefined;
    void TestBed.inject(Router)
      .navigateByUrl('/members')
      .then((result: boolean) => {
        left = result;
      });
    await new Promise<void>((resolve: () => void) => setTimeout(resolve, 50));
    harness.detectChanges();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(left).toBeUndefined();

    answer({ ...ATELIER_NORD, twoStepRequiredFor: 'everyone', version: 3 });

    await expect.poll(() => left).toBe(true);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/members');
  });

  it('asks once a change on its way is refused', async () => {
    let refuse: (error: unknown) => void = (): void => undefined;
    api.update.mockReturnValue(
      new Promise<AuthenticationPolicy>(
        (_resolve: (policy: AuthenticationPolicy) => void, reject: (error: unknown) => void) => {
          refuse = reject;
        },
      ),
    );
    const harness: RouterTestingHarness = await open();
    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();
    button('Save')?.click();
    await expect.poll(() => api.update.mock.calls.length).toBe(1);

    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl('/members');
    refuse(problem(503, 'service.unavailable'));
    await expect
      .poll(() => {
        harness.detectChanges();
        return document.querySelector('[role="alertdialog"]')?.textContent ?? '';
      })
      .toContain('Discard unsaved changes?');
    button('Keep editing')?.click();

    expect(await leaving).toBe(false);
    expect(byTestId(harness, 'security-unsaved')).not.toBeNull();
  });

  it('offers to discard a save that only waits for the reauthentication', async () => {
    run.mockReturnValue(new Promise<never>(() => undefined));
    const harness: RouterTestingHarness = await open();
    switchOf(harness, 'security-two-step-everyone')?.click();
    harness.detectChanges();
    button('Save')?.click();
    await expect.poll(() => run.mock.calls.length).toBe(1);

    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl('/members');
    await expect
      .poll(() => {
        harness.detectChanges();
        return document.querySelector('[role="alertdialog"]')?.textContent ?? '';
      })
      .toContain('Discard unsaved changes?');
    button('Discard')?.click();

    expect(await leaving).toBe(true);
    expect(api.update).not.toHaveBeenCalled();
  });

  it('leaves at once without unsaved changes', async () => {
    await open();

    expect(await TestBed.inject(Router).navigateByUrl('/members')).toBe(true);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
