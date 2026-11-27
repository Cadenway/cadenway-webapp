import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';
import { ShellOverlay } from '@shared/layout-slot';

import { OnboardingApi } from '../../../data-access/services/onboarding-api/onboarding-api.service';
import type { OnboardingProgress } from '../../../models/onboarding/onboarding.interface';
import type { OnboardingWizardStatus } from '../../../models/onboarding/onboarding.type';
import { OnboardingStore } from '../../../state/onboarding/onboarding.store';
import { OnboardingWizardHost } from './onboarding-wizard-host.component';

/**
 * Component BlankPage
 *
 * @description
 * A routed page that renders nothing.
 */
@Component({ selector: 'cw-blank-page', template: '' })
class BlankPage {}

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization of the mockup.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o-atelier',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

/**
 * Constant RANKS
 *
 * @description
 * Rank of each role, for the faked `can()`.
 *
 * @type {Readonly<Record<WorkspaceRole, number>>}
 */
const RANKS: Readonly<Record<WorkspaceRole, number>> = { guest: 0, member: 1, admin: 2, owner: 3 };

/**
 * Function progress
 *
 * @description
 * An onboarding progress at a version.
 *
 * @param {number} version - The version.
 * @param {OnboardingWizardStatus} [status] - The assistant's status.
 * @returns {OnboardingProgress} The progress.
 */
function progress(
  version: number,
  status: OnboardingWizardStatus = 'in-progress',
): OnboardingProgress {
  return {
    version,
    wizard: {
      status,
      step: version > 1 ? 'preset' : 'space',
      preset: 'dev',
      name: version > 1 ? 'Product' : null,
      prefix: version > 1 ? 'PRO' : null,
      color: 'violet',
    },
    provisioning: null,
    checklist: {
      presentation: 'expanded',
      firstTaskCreated: false,
      invitationSent: false,
      boardTried: false,
    },
  };
}

/**
 * Interface Harness
 *
 * @description
 * The rendered host and its fakes.
 */
interface Harness {
  // #region Properties
  /**
   * Property fixture
   *
   * @description
   * The rendered host.
   *
   * @type {ComponentFixture<OnboardingWizardHost>}
   * @readonly
   */
  readonly fixture: ComponentFixture<OnboardingWizardHost>;

  /**
   * Property router
   *
   * @description
   * The application router.
   *
   * @type {Router}
   * @readonly
   */
  readonly router: Router;

  /**
   * Property progress
   *
   * @description
   * The shared store's progress.
   *
   * @type {WritableSignal<OnboardingProgress | null>}
   * @readonly
   */
  readonly progress: WritableSignal<OnboardingProgress | null>;

  /**
   * Property load
   *
   * @description
   * The shared store's first read.
   *
   * @type {Mock}
   * @readonly
   */
  readonly load: Mock;

  /**
   * Property dismiss
   *
   * @description
   * The shared store's dismissal.
   *
   * @type {Mock}
   * @readonly
   */
  readonly dismiss: Mock;

  /**
   * Property saveDraft
   *
   * @description
   * The shared store's draft save; by default it answers version 2 and shows it.
   *
   * @type {Mock}
   * @readonly
   */
  readonly saveDraft: Mock;

  /**
   * Property navigate
   *
   * @description
   * Spy on the router's navigation.
   *
   * @type {Mock}
   * @readonly
   */
  readonly navigate: Mock;
  // #endregion
}

/**
 * Function render
 *
 * @description
 * Opens an address, then renders the host over a faked onboarding store.
 *
 * @param {string} address - The address opened first.
 * @param {OnboardingProgress | null} initial - The progress shown.
 * @param {WorkspaceRole} [role] - The person's role.
 * @param {() => void} [prepare] - Runs before the host is created.
 * @returns {Promise<Harness>} The harness.
 */
async function render(
  address: string,
  initial: OnboardingProgress | null,
  role: WorkspaceRole = 'owner',
  prepare: () => void = (): void => undefined,
): Promise<Harness> {
  const progressSignal: WritableSignal<OnboardingProgress | null> = signal(initial);
  const load: Mock = vi.fn();
  const dismiss: Mock = vi.fn(() => Promise.resolve(progress(2, 'dismissed')));
  const saveDraft: Mock = vi.fn(() => {
    progressSignal.set(progress(2));
    return Promise.resolve(progress(2));
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: ':org',
          children: [
            { path: '', component: BlankPage },
            { path: 'l/:listId', component: BlankPage },
          ],
        },
      ]),
      provideCadenwayIcons(),
      {
        provide: OnboardingStore,
        useValue: {
          progress: progressSignal,
          loading: signal(initial === null),
          failed: signal(false),
          load,
          reload: vi.fn(() => Promise.resolve()),
          saveDraft,
          dismiss,
          finish: vi.fn(),
          recordInvitation: vi.fn(() => Promise.resolve()),
          retryOwedInvitation: vi.fn(() => Promise.resolve()),
        },
      },
      { provide: OnboardingApi, useValue: { invite: vi.fn() } },
      { provide: OrganizationPin, useValue: { current: signal('o-atelier') } },
      {
        provide: WORKSPACE_CONTEXT,
        useValue: {
          organization: signal(ATELIER_NORD),
          role: signal(role),
          can: (needed: WorkspaceRole): boolean => RANKS[role] >= RANKS[needed],
        },
      },
      { provide: NAVIGATION_REFRESH, useValue: { refresh: vi.fn(), refreshCounts: vi.fn() } },
      { provide: CwToastService, useValue: { show: vi.fn(), error: vi.fn() } },
    ],
  });
  const router: Router = TestBed.inject(Router);
  await router.navigateByUrl(address);
  const navigate: Mock = vi.spyOn(router, 'navigate');
  prepare();
  const fixture: ComponentFixture<OnboardingWizardHost> =
    TestBed.createComponent(OnboardingWizardHost);
  await settle(fixture);
  return { fixture, router, progress: progressSignal, load, dismiss, saveDraft, navigate };
}

/**
 * Function settle
 *
 * @description
 * Waits for navigations, the deferred assistant and the view to settle.
 *
 * @param {ComponentFixture<OnboardingWizardHost>} fixture - The fixture.
 * @returns {Promise<void>} Resolves once settled.
 */
async function settle(fixture: ComponentFixture<OnboardingWizardHost>): Promise<void> {
  for (let round: number = 0; round < 4; round += 1) {
    await fixture.whenStable();
    await new Promise<void>((resolve: () => void) => setTimeout(resolve));
  }
}

/**
 * Function wizard
 *
 * @description
 * The assistant's window, when shown.
 *
 * @returns {HTMLElement | null} The window.
 */
function wizard(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="onboarding-wizard"]');
}

describe('OnboardingWizardHost', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens on ?onboarding=start and keeps the parameter while the progress is read', async () => {
    const { router, load, navigate }: Harness = await render(
      '/atelier-nord?onboarding=start&notice=logo-upload-failed',
      null,
    );

    expect(load).toHaveBeenCalled();
    expect(wizard()).not.toBeNull();
    expect(document.querySelector('[data-testid="onboarding-loading"]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(router.url).toBe('/atelier-nord?onboarding=start&notice=logo-upload-failed');
  });

  it('saves the initial draft, then removes only the parameter once the save is confirmed', async () => {
    const pending: { resolve: () => void } = { resolve: (): void => undefined };
    const {
      fixture,
      router,
      progress: shown,
      saveDraft,
      navigate,
    }: Harness = await render('/atelier-nord?onboarding=start&notice=logo-upload-failed', null);
    saveDraft.mockImplementationOnce(
      () =>
        new Promise<OnboardingProgress>((resolve: (value: OnboardingProgress) => void) => {
          pending.resolve = (): void => {
            shown.set(progress(2));
            resolve(progress(2));
          };
        }),
    );

    shown.set(progress(1));
    await settle(fixture);

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith({
      step: 'space',
      name: 'Product',
      prefix: 'PRO',
      color: 'violet',
      preset: 'dev',
    });
    expect(router.url).toBe('/atelier-nord?onboarding=start&notice=logo-upload-failed');

    pending.resolve();
    await settle(fixture);

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { onboarding: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    expect(router.url).toBe('/atelier-nord?notice=logo-upload-failed');
    expect(wizard()).not.toBeNull();
  });

  it('reopens the assistant after a reload before the first save, the parameter still there', async () => {
    const first: Harness = await render('/atelier-nord?onboarding=start', null);
    first.saveDraft.mockReturnValueOnce(new Promise<OnboardingProgress>(() => undefined));
    first.progress.set(progress(1));
    await settle(first.fixture);
    expect(first.router.url).toBe('/atelier-nord?onboarding=start');

    TestBed.resetTestingModule();
    const reloaded: Harness = await render(first.router.url, progress(1));

    expect(wizard()).not.toBeNull();
    expect(reloaded.load).toHaveBeenCalled();
  });

  it('keeps the parameter after a failed first save, and the assistant usable', async () => {
    const {
      fixture,
      router,
      saveDraft,
      progress: shown,
    }: Harness = await render('/atelier-nord?onboarding=start', null);
    saveDraft.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    shown.set(progress(1));
    await settle(fixture);

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/atelier-nord?onboarding=start');
    expect(wizard()).not.toBeNull();

    document.querySelector<HTMLButtonElement>('[data-testid="onboarding-next"]')?.click();
    await settle(fixture);

    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(router.url).toBe('/atelier-nord');
  });

  it('removes the parameter at once for a launch already saved', async () => {
    const { router, saveDraft }: Harness = await render(
      '/atelier-nord?onboarding=start',
      progress(3),
    );

    expect(saveDraft).not.toHaveBeenCalled();
    expect(router.url).toBe('/atelier-nord');
    expect(wizard()).not.toBeNull();
  });

  it('opens when a later navigation carries ?onboarding=start', async () => {
    const { fixture, router }: Harness = await render('/atelier-nord/l/l-backlog', progress(1));
    expect(wizard()).toBeNull();

    await router.navigateByUrl('/atelier-nord/l/l-backlog?onboarding=start');
    await settle(fixture);

    expect(wizard()).not.toBeNull();
    expect(router.url).toBe('/atelier-nord/l/l-backlog');
  });

  it('closes once the progress read after the start shows the assistant closed', async () => {
    const { fixture, progress: shown }: Harness = await render(
      '/atelier-nord?onboarding=start',
      null,
    );
    expect(wizard()).not.toBeNull();

    shown.set(progress(4, 'dismissed'));
    await settle(fixture);

    expect(wizard()).toBeNull();
  });

  it('never opens for a guest, and still removes the parameter', async () => {
    const { router, load }: Harness = await render(
      '/atelier-nord?onboarding=start',
      progress(1),
      'guest',
    );

    expect(load).not.toHaveBeenCalled();
    expect(wizard()).toBeNull();
    expect(router.url).toBe('/atelier-nord');
  });

  it('never resumes for a guest', async () => {
    const { load }: Harness = await render('/atelier-nord', progress(3), 'guest');

    expect(load).not.toHaveBeenCalled();
    expect(wizard()).toBeNull();
  });

  it('resumes a saved draft by itself on the workspace root', async () => {
    const { load }: Harness = await render('/atelier-nord', progress(3));

    expect(load).toHaveBeenCalled();
    expect(wizard()).not.toBeNull();
  });

  it('does not open by itself on the workspace root for a draft never saved', async () => {
    const { load }: Harness = await render('/atelier-nord', progress(1));

    expect(load).toHaveBeenCalled();
    expect(wizard()).toBeNull();
  });

  it('never covers a deep link, then resumes on the workspace root', async () => {
    const { fixture, router, load }: Harness = await render(
      '/atelier-nord/l/l-backlog',
      progress(3),
    );

    expect(load).not.toHaveBeenCalled();
    expect(wizard()).toBeNull();

    await router.navigateByUrl('/atelier-nord?task=PRO-12');
    await settle(fixture);
    expect(wizard()).toBeNull();

    await router.navigateByUrl('/atelier-nord');
    await settle(fixture);
    expect(wizard()).not.toBeNull();
  });

  it('holds the onboarding.wizard shell overlay while shown, and releases it once closed', async () => {
    const { fixture }: Harness = await render('/atelier-nord', progress(3));
    const overlay: ShellOverlay = TestBed.inject(ShellOverlay);

    expect(overlay.isOpen('onboarding.wizard')).toBe(true);
    expect(overlay.open('search.command-palette')).toBe(false);

    document.querySelector<HTMLButtonElement>('[data-testid="onboarding-skip"]')?.click();
    await settle(fixture);

    expect(overlay.isOpen('onboarding.wizard')).toBe(false);
    expect(overlay.anyOpen()).toBe(false);
  });

  it('takes the shell overlay once another overlay closes, and releases it when destroyed', async () => {
    const { fixture }: Harness = await render('/atelier-nord', progress(3), 'owner', (): void => {
      TestBed.inject(ShellOverlay).open('search.command-palette');
    });
    const overlay: ShellOverlay = TestBed.inject(ShellOverlay);
    expect(overlay.isOpen('onboarding.wizard')).toBe(false);
    expect(wizard()).toBeNull();

    overlay.close('search.command-palette');
    await settle(fixture);
    expect(overlay.isOpen('onboarding.wizard')).toBe(true);
    expect(wizard()).not.toBeNull();

    fixture.destroy();
    expect(overlay.anyOpen()).toBe(false);
  });

  it('closes at once on Set up later and dismisses the assistant for good', async () => {
    const { fixture, dismiss }: Harness = await render('/atelier-nord', progress(3));

    document.querySelector<HTMLButtonElement>('[data-testid="onboarding-skip"]')?.click();
    await settle(fixture);

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(wizard()).toBeNull();
  });
});
