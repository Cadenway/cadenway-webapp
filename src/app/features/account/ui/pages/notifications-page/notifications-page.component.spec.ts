import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, type InputSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withErrorBoundaries, withRouterConfig } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { NotificationPreferencesApi } from '../../../data-access/services/notification-preferences-api/notification-preferences-api.service';
import type {
  NotificationPreferenceChange,
  NotificationPreferences,
} from '../../../models/notification-preferences/notification-preferences.interface';
import { applied } from '../../../services/notification-preferences-sync/notification-preferences-sync.service';
import { NotificationsPage } from './notifications-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the router's error component: it shows that the page failed.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="error">failed</p>',
})
class FakeBoundary {
  // #region Properties
  /**
   * Property error
   *
   * @description
   * Failure the router passes.
   *
   * @type {InputSignal<unknown>}
   * @readonly
   */
  public readonly error: InputSignal<unknown> = input<unknown>();
  // #endregion
}

/**
 * Constant camille
 *
 * @description
 * Camille Martin's preferences at version 1.
 *
 * @type {NotificationPreferences}
 */
const camille: NotificationPreferences = {
  channels: {
    mention: { inApp: true, email: true, mobile: true },
    assignment: { inApp: true, email: true, mobile: true },
    comment: { inApp: true, email: false, mobile: false },
    statusChange: { inApp: true, email: false, mobile: false },
    dueDate: { inApp: true, email: true, mobile: true },
    access: { inApp: true, email: true, mobile: false },
    billing: { inApp: true, email: true, mobile: false },
  },
  digest: 'daily',
  doNotDisturb: true,
  version: 1,
};

/**
 * Constant workspace
 *
 * @description
 * Camille Martin in Atelier Nord, without a display name.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u1',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: () => true,
};

describe('NotificationsPage', () => {
  let read: Mock<NotificationPreferencesApi['read']>;
  let write: Mock<NotificationPreferencesApi['write']>;
  let toasts: { error: Mock; dismiss: Mock };
  let recorded: NotificationPreferences;

  beforeEach(() => {
    recorded = camille;
    read = vi.fn<NotificationPreferencesApi['read']>(() => Promise.resolve(recorded));
    write = vi.fn<NotificationPreferencesApi['write']>((next, version) => {
      recorded = { ...applied(recorded, next), version: version + 1 };
      return Promise.resolve(recorded);
    });
    toasts = { error: vi.fn(() => 'toast-1'), dismiss: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [{ path: 'notifications', component: NotificationsPage }],
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        { provide: NotificationPreferencesApi, useValue: { read, write } },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
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
    await harness.navigateByUrl('/notifications');
    await settle(harness);
    return harness;
  }

  /**
   * Function settle
   *
   * @description
   * Waits until the section no longer shows its skeleton.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(harness: RouterTestingHarness): Promise<void> {
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[aria-busy="true"]') ?? null;
      })
      .toBeNull();
  }

  /**
   * Function hostOf
   *
   * @description
   * The element of the routed page.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The page.
   */
  function hostOf(harness: RouterTestingHarness): HTMLElement {
    const host: HTMLElement | null = harness.routeNativeElement;
    if (!host) throw new Error('Expected the routed page.');
    return host;
  }

  /**
   * Function byName
   *
   * @description
   * Finds a control by its role and accessible name.
   *
   * @param {HTMLElement} host - The page.
   * @param {string} role - Its role.
   * @param {string} name - Its accessible name.
   * @returns {HTMLElement} The control.
   */
  function byName(host: HTMLElement, role: string, name: string): HTMLElement {
    const found: HTMLElement | undefined = Array.from(
      host.querySelectorAll<HTMLElement>(`[role="${role}"]`),
    ).find(
      (candidate: HTMLElement) =>
        candidate.getAttribute('aria-label') === name ||
        host.querySelector(`label[for="${candidate.id}"]`)?.textContent.includes(name) === true,
    );
    if (!found) throw new Error(`No ${role} "${name}"`);
    return found;
  }

  it('shows the section skeleton while the preferences load', async () => {
    read.mockReturnValueOnce(new Promise<NotificationPreferences>(() => undefined));
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/notifications');
    harness.detectChanges();

    const status: Element | null = hostOf(harness).querySelector('[role="status"]');
    expect(status?.getAttribute('aria-label')).toBe('Loading the section');
    expect(hostOf(harness).querySelector('h1')).toBeNull();
  });

  it('shows the matrix, the email summary and the quiet hours read', async () => {
    const host: HTMLElement = hostOf(await open());

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Notifications');
    expect(host.textContent).toContain('@Camille in a comment or a description');
    expect(byName(host, 'checkbox', 'Comments by email').getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(byName(host, 'radio', 'Daily summary').getAttribute('aria-checked')).toBe('true');
    expect(byName(host, 'switch', 'Do not disturb').getAttribute('aria-checked')).toBe('true');
  });

  it('saves each change at once, without a toast', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    byName(host, 'checkbox', 'Comments by email').click();
    byName(host, 'radio', 'Weekly summary').click();
    byName(host, 'switch', 'Do not disturb').click();
    harness.detectChanges();

    await expect.poll(() => write.mock.calls.length).toBe(3);
    expect(
      write.mock.calls.map(
        ([next]: [NotificationPreferenceChange, number, string]): NotificationPreferenceChange =>
          next,
      ),
    ).toEqual([
      { kind: 'channel', event: 'comment', channel: 'email', enabled: true },
      { kind: 'digest', digest: 'weekly' },
      { kind: 'doNotDisturb', enabled: false },
    ]);
    harness.detectChanges();
    expect(byName(host, 'radio', 'Weekly summary').getAttribute('aria-checked')).toBe('true');
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('puts a refused change back with an error toast', async () => {
    write.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    byName(host, 'switch', 'Do not disturb').click();
    harness.detectChanges();
    expect(byName(host, 'switch', 'Do not disturb').getAttribute('aria-checked')).toBe('false');

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    harness.detectChanges();
    expect(byName(host, 'switch', 'Do not disturb').getAttribute('aria-checked')).toBe('true');
  });

  it('renders the route boundary on a failed read, and reads again on Retry', async () => {
    read.mockRejectedValueOnce(new Error('503'));

    const harness: RouterTestingHarness = await open();
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent.trim();
      })
      .toBe('failed');

    await harness.navigateByUrl('/notifications');
    await settle(harness);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('h1')?.textContent.trim();
      })
      .toBe('Notifications');
    expect(read).toHaveBeenCalledTimes(2);
  });
});
