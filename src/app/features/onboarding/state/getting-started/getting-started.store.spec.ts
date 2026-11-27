import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  createEnvironmentInjector,
  EnvironmentInjector,
  signal,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CwToastService } from '@cadenway/ui/components/toast';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import type { CreatedTask } from '@features/task';
import { TaskCreate } from '@features/task';
import type {
  WorkspaceContextPort,
  WorkspaceOrganization,
  WorkspaceRole,
} from '@features/workspace/ports/workspace-context';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { ShellOverlay } from '@shared/layout-slot';

import {
  ONBOARDING_INVITE_DIALOG_OVERLAY,
  ONBOARDING_WIZARD_OVERLAY,
} from '../../constants/overlays/onboarding-overlays.constants';
import { OnboardingApi } from '../../data-access/services/onboarding-api/onboarding-api.service';
import type {
  OnboardingChecklist,
  OnboardingProgress,
} from '../../models/onboarding/onboarding.interface';
import type { OnboardingWizardStatus } from '../../models/onboarding/onboarding.type';
import { OnboardingStore } from '../onboarding/onboarding.store';
import { GettingStartedStore } from './getting-started.store';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization the workspace opens with.
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
 * Constant STUDIO_PIXEL
 *
 * @description
 * The organization the workspace switches to.
 *
 * @type {WorkspaceOrganization}
 */
const STUDIO_PIXEL: WorkspaceOrganization = {
  ...ATELIER_NORD,
  id: 'o-studio',
  slug: 'studio-pixel',
  name: 'Studio Pixel',
  initials: 'SP',
};

/**
 * Component Blank
 *
 * @description
 * An empty routed screen.
 */
@Component({ selector: 'cw-blank', template: '' })
class Blank {}

/**
 * Function progress
 *
 * @description
 * An onboarding progress: by default, a finished assistant whose first space is provisioned, with
 * the checklist expanded and no marker recorded.
 *
 * @param {number} version - Its version.
 * @param {Partial<OnboardingChecklist>} checklist - Checklist members to change.
 * @param {OnboardingWizardStatus} status - The assistant's status.
 * @returns {OnboardingProgress} The progress.
 */
function progress(
  version: number,
  checklist: Partial<OnboardingChecklist> = {},
  status: OnboardingWizardStatus = 'finished',
): OnboardingProgress {
  const provisioned: boolean = status === 'finished';
  return {
    version,
    wizard: {
      status,
      step: 'import',
      preset: 'dev',
      name: 'Product',
      prefix: 'PRO',
      color: 'violet',
    },
    provisioning: provisioned ? { spaceId: 'sp-product', firstListId: 'l-backlog' } : null,
    checklist: {
      presentation: 'expanded',
      firstTaskCreated: false,
      invitationSent: false,
      boardTried: false,
      ...checklist,
    },
  };
}

/**
 * Function problem
 *
 * @description
 * A gateway refusal with a problem code.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The refusal.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code } });
}

/**
 * Interface FakeOnboardingApi
 *
 * @description
 * The data-access methods the stores call.
 */
interface FakeOnboardingApi {
  // #region Properties
  /**
   * Property get
   *
   * @description
   * Read of the progress; answers `shown`.
   *
   * @type {Mock}
   */
  get: Mock;

  /**
   * Property updateChecklist
   *
   * @description
   * Checklist write; answers the change applied at the next version.
   *
   * @type {Mock}
   */
  updateChecklist: Mock;

  /**
   * Property invite
   *
   * @description
   * Invitation batch.
   *
   * @type {Mock}
   */
  invite: Mock;
  // #endregion
}

/**
 * Interface FakeToasts
 *
 * @description
 * The toast service the store calls, keeping the toasts shown so a dismissal is observable.
 */
interface FakeToasts {
  // #region Properties
  /**
   * Property toasts
   *
   * @description
   * The toasts shown, by id.
   *
   * @type {WritableSignal<readonly { id: string; tone: string; title: string }[]>}
   * @readonly
   */
  readonly toasts: WritableSignal<readonly { id: string; tone: string; title: string }[]>;

  /**
   * Property success
   *
   * @description
   * Success toast.
   *
   * @type {Mock}
   * @readonly
   */
  readonly success: Mock;

  /**
   * Property info
   *
   * @description
   * Information toast.
   *
   * @type {Mock}
   * @readonly
   */
  readonly info: Mock;

  /**
   * Property warning
   *
   * @description
   * Warning toast.
   *
   * @type {Mock}
   * @readonly
   */
  readonly warning: Mock;

  /**
   * Property error
   *
   * @description
   * Failure toast.
   *
   * @type {Mock}
   * @readonly
   */
  readonly error: Mock;

  /**
   * Property dismiss
   *
   * @description
   * Dismissal of a toast.
   *
   * @type {Mock}
   * @readonly
   */
  readonly dismiss: Mock;
  // #endregion
}

/**
 * Function fakeToasts
 *
 * @description
 * A toast service that keeps what it shows until it is dismissed.
 *
 * @returns {FakeToasts} The service.
 */
function fakeToasts(): FakeToasts {
  const toasts: WritableSignal<readonly { id: string; tone: string; title: string }[]> = signal<
    readonly { id: string; tone: string; title: string }[]
  >([]);
  let next: number = 0;
  const tone: (name: string) => Mock = (name: string): Mock =>
    vi.fn((title: string): string => {
      next += 1;
      const id: string = `toast-${String(next)}`;
      toasts.update((shown) => [...shown, { id, tone: name, title }]);
      return id;
    });
  return {
    toasts,
    success: tone('success'),
    info: tone('info'),
    warning: tone('warning'),
    error: tone('error'),
    dismiss: vi.fn((id: string): void => {
      toasts.update((shown) => shown.filter((toast: { id: string }): boolean => toast.id !== id));
    }),
  };
}

describe('GettingStartedStore', () => {
  let api: FakeOnboardingApi;
  let toasts: FakeToasts;
  let organization: WritableSignal<WorkspaceOrganization>;
  let role: WritableSignal<WorkspaceRole>;
  let pin: OrganizationPin;
  let created: Subject<CreatedTask>;
  let taskCreate: { open: Mock; created: Subject<CreatedTask> };
  let shown: OnboardingProgress;
  let route: EnvironmentInjector;
  let host: EnvironmentInjector;

  /**
   * Function settle
   *
   * @description
   * Lets the pending promises and the stores' reactions run.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(): Promise<void> {
    for (let turn: number = 0; turn < 5; turn += 1) {
      await Promise.resolve();
      TestBed.tick();
    }
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 0);
    });
    TestBed.tick();
  }

  /**
   * Function createHost
   *
   * @description
   * Creates the checklist's store in its own injector below the route's, as the application shell
   * creates `GettingStartedHost`, then lets its reads settle.
   *
   * @returns {Promise<GettingStartedStore>} The checklist's store.
   */
  async function createHost(): Promise<GettingStartedStore> {
    host = createEnvironmentInjector([GettingStartedStore], route);
    const store: GettingStartedStore = host.get(GettingStartedStore);
    TestBed.tick();
    await settle();
    return store;
  }

  /**
   * Function setup
   *
   * @description
   * Creates the route's onboarding store and the checklist's store over the fake data access, in
   * Atelier Nord, then lets the first read settle.
   *
   * @param {string} url - The address the router shows first.
   * @returns {Promise<GettingStartedStore>} The checklist's store.
   */
  async function setup(url: string = '/atelier-nord'): Promise<GettingStartedStore> {
    organization = signal(ATELIER_NORD);
    role = signal<WorkspaceRole>('owner');
    const order: readonly WorkspaceRole[] = ['guest', 'member', 'admin', 'owner'];
    const workspace: Pick<WorkspaceContextPort, 'organization' | 'can'> = {
      organization,
      can: (minimum: WorkspaceRole): boolean => order.indexOf(role()) >= order.indexOf(minimum),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: ':org/l/:listId/:layout', component: Blank },
          { path: '**', component: Blank },
        ]),
        { provide: OnboardingApi, useValue: api },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: CwToastService, useValue: toasts },
        { provide: TaskCreate, useValue: taskCreate },
      ],
    });
    await TestBed.inject(Router).navigateByUrl(url);
    pin = TestBed.inject(OrganizationPin);
    pin.set(ATELIER_NORD.id);
    route = createEnvironmentInjector([OnboardingStore], TestBed.inject(EnvironmentInjector));
    const store: GettingStartedStore = await createHost();
    await vi.waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    await settle();
    return store;
  }

  /**
   * Function switchOrganization
   *
   * @description
   * Commits Studio Pixel in the workspace and the pin, as the resolver does.
   */
  function switchOrganization(): void {
    organization.set(STUDIO_PIXEL);
    pin.set(STUDIO_PIXEL.id);
  }

  /**
   * Function switchBack
   *
   * @description
   * Commits Atelier Nord again, after `switchOrganization`.
   */
  function switchBack(): void {
    organization.set(ATELIER_NORD);
    pin.set(ATELIER_NORD.id);
  }

  /**
   * Function showTab
   *
   * @description
   * Makes the tab visible again.
   */
  function showTab(): void {
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    shown = progress(4);
    api = {
      get: vi.fn(() => Promise.resolve(shown)),
      updateChecklist: vi.fn((change: Partial<OnboardingChecklist>, version: number) => {
        shown = progress(version + 1, { ...shown.checklist, ...change }, shown.wizard.status);
        return Promise.resolve(shown);
      }),
      invite: vi.fn(() => Promise.resolve({ invited: 1, skipped: 0, alreadyInvited: 0 })),
    };
    toasts = fakeToasts();
    created = new Subject<CreatedTask>();
    taskCreate = { open: vi.fn(() => true), created };
  });

  describe('visibility', () => {
    it('shows the checklist once the assistant provisioned the first space', async () => {
      const store: GettingStartedStore = await setup();

      expect(store.visible()).toBe(true);
      expect(store.expanded()).toBe(true);
    });

    it('shows nothing while the assistant is in progress', async () => {
      shown = progress(2, {}, 'in-progress');
      const store: GettingStartedStore = await setup();

      expect(store.visible()).toBe(false);
      expect(store.items()).toEqual([]);
    });

    it('shows nothing after the assistant was set up later', async () => {
      shown = progress(2, {}, 'dismissed');
      const store: GettingStartedStore = await setup();

      expect(store.visible()).toBe(false);
    });

    it('shows nothing once the checklist was dismissed', async () => {
      shown = progress(6, { presentation: 'dismissed' });
      const store: GettingStartedStore = await setup();

      expect(store.visible()).toBe(false);
    });

    it('shows nothing while the assistant covers the shell', async () => {
      const store: GettingStartedStore = await setup();

      TestBed.inject(ShellOverlay).open(ONBOARDING_WIZARD_OVERLAY);

      expect(store.visible()).toBe(false);
    });

    it('shows nothing when the first read failed', async () => {
      api.get.mockRejectedValue(problem(503, 'service.unavailable'));
      const store: GettingStartedStore = await setup();

      expect(store.visible()).toBe(false);
      expect(toasts.error).not.toHaveBeenCalled();
    });

    it('reads again after a failed first read when the tab shows again', async () => {
      api.get.mockRejectedValueOnce(problem(503, 'service.unavailable'));
      const store: GettingStartedStore = await setup();
      expect(store.visible()).toBe(false);

      showTab();
      await settle();

      expect(api.get).toHaveBeenCalledTimes(2);
      expect(store.visible()).toBe(true);
    });

    it('reads again after a failed first read once a task is created', async () => {
      api.get.mockRejectedValueOnce(problem(503, 'service.unavailable'));
      const store: GettingStartedStore = await setup();

      created.next({} as CreatedTask);
      await settle();

      expect(api.get).toHaveBeenCalledTimes(2);
      expect(store.visible()).toBe(true);
    });
  });

  describe('items', () => {
    it('lists the three items with the markers the gateway recorded', async () => {
      shown = progress(5, { firstTaskCreated: true, boardTried: true });
      const store: GettingStartedStore = await setup();

      expect(store.items()).toEqual([
        { key: 'task', done: true },
        { key: 'invite', done: false },
        { key: 'board', done: true },
      ]);
    });

    it('leaves out the invitation for a member, who may not invite', async () => {
      const store: GettingStartedStore = await setup();

      role.set('member');

      expect(store.items().map((item: { key: string }) => item.key)).toEqual(['task', 'board']);
    });
  });

  describe('presentation', () => {
    it('collapses the list at once and saves it', async () => {
      const store: GettingStartedStore = await setup();

      const toggled: Promise<void> = store.toggle();
      expect(store.expanded()).toBe(false);
      await toggled;

      expect(api.updateChecklist).toHaveBeenCalledWith({ presentation: 'collapsed' }, 4);
      expect(store.expanded()).toBe(false);
    });

    it('expands a collapsed list', async () => {
      shown = progress(5, { presentation: 'collapsed' });
      const store: GettingStartedStore = await setup();

      await store.toggle();

      expect(api.updateChecklist).toHaveBeenCalledWith({ presentation: 'expanded' }, 5);
      expect(store.expanded()).toBe(true);
    });

    it('restores the list and shows a toast when the gateway refuses the change', async () => {
      const store: GettingStartedStore = await setup();
      api.updateChecklist.mockRejectedValueOnce(problem(403, 'auth.csrf-rejected'));

      await store.toggle();

      expect(store.expanded()).toBe(true);
      expect(toasts.error).toHaveBeenCalledWith('The list could not be updated');
    });

    it('says the change may not have been saved after an unknown outcome', async () => {
      const store: GettingStartedStore = await setup();
      api.updateChecklist.mockRejectedValueOnce(problem(503, 'service.unavailable'));

      await store.toggle();

      expect(toasts.error).not.toHaveBeenCalled();
      expect(toasts.warning).toHaveBeenCalledWith(
        'Your change to “Getting started” may not have been saved',
      );
    });

    it('hides the checklist at once and saves it', async () => {
      const store: GettingStartedStore = await setup();

      const dismissed: Promise<void> = store.dismiss();
      expect(store.visible()).toBe(false);
      await dismissed;

      expect(api.updateChecklist).toHaveBeenCalledWith({ presentation: 'dismissed' }, 4);
      expect(store.visible()).toBe(false);
    });

    it('shows the checklist again with a toast when the dismissal is refused', async () => {
      const store: GettingStartedStore = await setup();
      api.updateChecklist.mockRejectedValueOnce(problem(403, 'auth.csrf-rejected'));

      await store.dismiss();

      expect(store.visible()).toBe(true);
      expect(toasts.error).toHaveBeenCalledWith('“Getting started” could not be hidden');
    });

    it('shows no toast for a change dropped for another session organization', async () => {
      const store: GettingStartedStore = await setup();
      api.updateChecklist.mockRejectedValueOnce(problem(412, 'organization.context-changed'));

      await store.toggle();

      expect(toasts.error).not.toHaveBeenCalled();
      expect(toasts.warning).not.toHaveBeenCalled();
    });
  });

  describe('actions', () => {
    it('opens the task create dialog on the first list', async () => {
      const store: GettingStartedStore = await setup();

      store.start('task');

      expect(taskCreate.open).toHaveBeenCalledWith({ listId: 'l-backlog' });
    });

    it('opens and closes the invite dialog', async () => {
      const store: GettingStartedStore = await setup();

      store.start('invite');
      expect(store.inviteOpen()).toBe(true);

      store.setInviteOpen(false);
      expect(store.inviteOpen()).toBe(false);
    });

    it('opens the first list in the Board view', async () => {
      const store: GettingStartedStore = await setup();

      store.start('board');
      await settle();

      expect(TestBed.inject(Router).url).toBe('/atelier-nord/l/l-backlog/board');
    });
  });

  describe('board watcher', () => {
    it('records the Board view once a navigation shows a board', async () => {
      await setup();

      await TestBed.inject(Router).navigateByUrl('/atelier-nord/l/l-sprint/list');
      await settle();
      expect(api.updateChecklist).not.toHaveBeenCalled();

      await TestBed.inject(Router).navigateByUrl('/atelier-nord/l/l-sprint/board');
      await settle();

      expect(api.updateChecklist).toHaveBeenCalledTimes(1);
      expect(api.updateChecklist).toHaveBeenCalledWith({ boardTried: true }, 4);
    });

    it('records the board the address shows when the progress arrives', async () => {
      await setup('/atelier-nord/l/l-backlog/board');

      expect(api.updateChecklist).toHaveBeenCalledWith({ boardTried: true }, 4);
    });

    it('sends the marker again on the next board navigation after a refusal', async () => {
      await setup();
      const router: Router = TestBed.inject(Router);
      api.updateChecklist.mockRejectedValueOnce(problem(403, 'auth.csrf-rejected'));

      await router.navigateByUrl('/atelier-nord/l/l-sprint/board');
      await settle();
      await router.navigateByUrl('/atelier-nord/l/l-backlog/board');
      await settle();

      expect(api.updateChecklist).toHaveBeenCalledTimes(2);
      expect(toasts.error).not.toHaveBeenCalled();
    });

    it('sends nothing once the Board view is recorded', async () => {
      shown = progress(5, { boardTried: true });
      await setup();

      await TestBed.inject(Router).navigateByUrl('/atelier-nord/l/l-sprint/board');
      await settle();

      expect(api.updateChecklist).not.toHaveBeenCalled();
    });

    it('sends nothing while the assistant is in progress', async () => {
      shown = progress(2, {}, 'in-progress');
      await setup();

      await TestBed.inject(Router).navigateByUrl('/atelier-nord/l/l-sprint/board');
      await settle();

      expect(api.updateChecklist).not.toHaveBeenCalled();
    });

    it('records the board for the new organization only, from its own progress', async () => {
      await setup();
      const router: Router = TestBed.inject(Router);
      shown = progress(2);

      switchOrganization();
      await router.navigateByUrl('/studio-pixel/l/l-other/board');
      await settle();

      expect(api.updateChecklist).toHaveBeenCalledTimes(1);
      expect(api.updateChecklist).toHaveBeenCalledWith({ boardTried: true }, 2);
      expect(toasts.error).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('reads the progress again after a task is created', async () => {
      const store: GettingStartedStore = await setup();
      shown = progress(5, { firstTaskCreated: true });

      created.next({} as CreatedTask);
      await settle();

      expect(api.get).toHaveBeenCalledTimes(2);
      expect(store.items()[0]).toEqual({ key: 'task', done: true });
    });

    it('reads nothing more after a task is created once the first task is recorded', async () => {
      shown = progress(5, { firstTaskCreated: true });
      await setup();

      created.next({} as CreatedTask);
      await settle();

      expect(api.get).toHaveBeenCalledTimes(1);
    });

    describe('changes made in another tab', () => {
      let now: number;
      let timers: { run: () => void; delay: number; cleared: boolean }[];

      /**
       * Function runTrailingRead
       *
       * @description
       * Runs the throttle's trailing read the store scheduled, unless it was cleared.
       */
      function runTrailingRead(): void {
        for (const timer of timers) if (!timer.cleared) timer.run();
      }

      beforeEach(() => {
        now = 1_000;
        timers = [];
        vi.spyOn(performance, 'now').mockImplementation((): number => now);
        // Timers of 1 to 29 seconds are the throttle's trailing read: held for the test to run.
        const realSetTimeout: typeof setTimeout = globalThis.setTimeout;
        const realClearTimeout: typeof clearTimeout = globalThis.clearTimeout;
        vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
          handler: () => void,
          delay?: number,
        ): unknown => {
          if ((delay ?? 0) < 1_000 || (delay ?? 0) >= 30_000) return realSetTimeout(handler, delay);
          timers.push({ run: handler, delay: delay ?? 0, cleared: false });
          return 900_000 + timers.length;
        }) as never);
        vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((handle?: number): void => {
          if ((handle ?? 0) <= 900_000) {
            realClearTimeout(handle);
            return;
          }
          const timer: { cleared: boolean } | undefined = timers.at((handle ?? 0) - 900_001);
          if (timer !== undefined) timer.cleared = true;
        }) as never);
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('shows a dismissal made elsewhere once the tab shows again', async () => {
        shown = progress(5, { firstTaskCreated: true });
        const store: GettingStartedStore = await setup();
        expect(store.visible()).toBe(true);
        shown = progress(6, { firstTaskCreated: true, presentation: 'dismissed' });

        showTab();
        await settle();

        expect(api.get).toHaveBeenCalledTimes(2);
        expect(store.visible()).toBe(false);
      });

      it('shows an invitation and a board visit made elsewhere', async () => {
        shown = progress(5, { firstTaskCreated: true });
        const store: GettingStartedStore = await setup();
        shown = progress(7, { firstTaskCreated: true, invitationSent: true, boardTried: true });

        showTab();
        await settle();

        expect(store.items()).toEqual([
          { key: 'task', done: true },
          { key: 'invite', done: true },
          { key: 'board', done: true },
        ]);
      });

      it('reads at most once every 30 seconds', async () => {
        shown = progress(5, { firstTaskCreated: true });
        await setup();

        showTab();
        await settle();
        now = 30_000;
        showTab();
        await settle();
        expect(api.get).toHaveBeenCalledTimes(2);

        now = 31_000;
        showTab();
        await settle();
        expect(api.get).toHaveBeenCalledTimes(3);
      });

      it('reads once at the end of the interval when the tab showed again inside it', async () => {
        shown = progress(5, { firstTaskCreated: true });
        const store: GettingStartedStore = await setup();
        showTab();
        await settle();

        now = 30_000;
        showTab();
        now = 30_500;
        showTab();
        await settle();
        expect(api.get).toHaveBeenCalledTimes(2);
        expect(timers.map((timer) => timer.delay)).toEqual([1_000]);

        shown = progress(6, { firstTaskCreated: true, presentation: 'dismissed' });
        now = 31_000;
        runTrailingRead();
        await settle();

        expect(api.get).toHaveBeenCalledTimes(3);
        expect(store.visible()).toBe(false);
      });

      it('drops the trailing read once the tab is hidden again', async () => {
        shown = progress(5, { firstTaskCreated: true });
        await setup();
        showTab();
        await settle();
        now = 30_000;
        showTab();
        await settle();

        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        runTrailingRead();
        await settle();

        expect(api.get).toHaveBeenCalledTimes(2);
      });

      it('clears the trailing read on destruction and on an organization change', async () => {
        shown = progress(5, { firstTaskCreated: true });
        await setup();
        showTab();
        await settle();
        now = 30_000;
        showTab();
        await settle();

        switchOrganization();
        TestBed.tick();
        await settle();
        expect(timers[0].cleared).toBe(true);
        const reads: number = api.get.mock.calls.length;

        host.destroy();
        runTrailingRead();
        await settle();
        expect(api.get).toHaveBeenCalledTimes(reads);
      });

      it('reads nothing when the tab shows again once the checklist was dismissed', async () => {
        shown = progress(5, { firstTaskCreated: true, presentation: 'dismissed' });
        await setup();

        showTab();
        await settle();

        expect(api.get).toHaveBeenCalledTimes(1);
      });

      it('reads nothing when the tab shows again while the assistant is in progress', async () => {
        shown = progress(2, {}, 'in-progress');
        await setup();

        showTab();
        await settle();

        expect(api.get).toHaveBeenCalledTimes(1);
      });
    });

    it('reads the progress again when the tab shows again', async () => {
      await setup();

      showTab();
      await settle();

      expect(api.get).toHaveBeenCalledTimes(2);
    });

    it('reads the progress again when the host is created over a progress already read', async () => {
      await setup();
      host.destroy();
      shown = progress(5, { firstTaskCreated: true });

      const store: GettingStartedStore = await createHost();

      expect(api.get).toHaveBeenCalledTimes(2);
      expect(store.items()[0]).toEqual({ key: 'task', done: true });
    });
  });

  describe('invitations', () => {
    it('invites the addresses, closes the dialog and records the invitation', async () => {
      const store: GettingStartedStore = await setup();
      store.start('invite');

      const sending: Promise<void> = store.invite(['ines.robert@ateliernord.fr']);
      expect(store.inviting()).toBe(true);
      await sending;
      await settle();

      expect(api.invite).toHaveBeenCalledWith(['ines.robert@ateliernord.fr']);
      expect(toasts.success).toHaveBeenCalledWith('1 invitation sent', { description: '' });
      expect(store.inviteOpen()).toBe(false);
      expect(store.inviting()).toBe(false);
      expect(api.updateChecklist).toHaveBeenCalledWith({ invitationSent: true }, 4);
      expect(store.items()[1]).toEqual({ key: 'invite', done: true });
    });

    it('counts the skipped addresses', async () => {
      api.invite.mockResolvedValueOnce({ invited: 2, skipped: 1, alreadyInvited: 0 });
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite(['a@ateliernord.fr', 'b@ateliernord.fr', 'c@ateliernord.fr']);

      expect(toasts.success).toHaveBeenCalledWith('2 invitations sent', {
        description: '1 address skipped: already a member or invited.',
      });
    });

    it('records nothing when every address was already a member', async () => {
      api.invite.mockResolvedValueOnce({ invited: 0, skipped: 2, alreadyInvited: 0 });
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite(['a@ateliernord.fr', 'b@ateliernord.fr']);

      expect(toasts.info).toHaveBeenCalledWith('No invitation sent', {
        description: '2 addresses skipped: already members or invited.',
      });
      expect(store.inviteOpen()).toBe(false);
      expect(api.updateChecklist).not.toHaveBeenCalled();
    });

    it('keeps the dialog open with a toast when the invitations are refused', async () => {
      api.invite.mockRejectedValueOnce(problem(403, 'organization.role-forbidden'));
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite(['ines.robert@ateliernord.fr']);

      expect(toasts.error).toHaveBeenCalledWith('The invitations could not be sent');
      expect(store.inviteOpen()).toBe(true);
      expect(store.inviting()).toBe(false);
      expect(api.updateChecklist).not.toHaveBeenCalled();
    });

    it('explains the daily limit', async () => {
      api.invite.mockRejectedValueOnce(problem(429, 'invitation.daily-limit-reached'));
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite(['ines.robert@ateliernord.fr']);

      expect(toasts.error).toHaveBeenCalledWith('The invitations could not be sent', {
        description: 'The daily invitation limit is reached: try again later.',
      });
    });

    it('says an unknown outcome may be sent again, then records the invitation already out', async () => {
      api.invite.mockRejectedValueOnce(problem(503, 'service.unavailable'));
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite(['ines.robert@ateliernord.fr']);

      expect(toasts.error).not.toHaveBeenCalled();
      expect(toasts.warning).toHaveBeenCalledWith('The invitations may not have been sent', {
        description: 'Sending again is safe.',
      });
      expect(store.inviteOpen()).toBe(true);

      api.invite.mockResolvedValueOnce({ invited: 0, skipped: 1, alreadyInvited: 1 });
      await store.invite(['ines.robert@ateliernord.fr']);
      await settle();

      expect(api.updateChecklist).toHaveBeenCalledWith({ invitationSent: true }, 4);
      expect(store.items()[1]).toEqual({ key: 'invite', done: true });
    });

    it('sends the addresses in batches of 50', async () => {
      api.invite.mockImplementation((batch: readonly string[]) =>
        Promise.resolve({ invited: batch.length, skipped: 0, alreadyInvited: 0 }),
      );
      const emails: readonly string[] = Array.from(
        { length: 120 },
        (_unused: unknown, index: number): string => `member${String(index)}@ateliernord.fr`,
      );
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite(emails);

      expect(
        api.invite.mock.calls.map((call: unknown[]): number => (call[0] as string[]).length),
      ).toEqual([50, 50, 20]);
      expect(api.invite).toHaveBeenNthCalledWith(2, emails.slice(50, 100));
      expect(toasts.success).toHaveBeenCalledWith('120 invitations sent', { description: '' });
      expect(store.inviteOpen()).toBe(false);
      expect(api.updateChecklist).toHaveBeenCalledTimes(1);
    });

    it('keeps only the addresses the gateway did not invite, with a toast counting them', async () => {
      api.invite.mockResolvedValueOnce({
        invited: 1,
        skipped: 2,
        alreadyInvited: 0,
        notSent: ['Marc.Roux@ateliernord.fr', 'lea.petit@ateliernord.fr'],
      });
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite([
        'ines.robert@ateliernord.fr',
        'marc.roux@ateliernord.fr',
        'lea.petit@ateliernord.fr',
      ]);

      expect(toasts.success).toHaveBeenCalledWith('1 invitation sent', { description: '' });
      expect(toasts.error).toHaveBeenCalledWith('2 addresses could not be invited', {
        description: 'The addresses stay in the list: press Invite to try again.',
      });
      expect(store.inviteOpen()).toBe(true);
      expect(store.inviteKept()).toEqual(['marc.roux@ateliernord.fr', 'lea.petit@ateliernord.fr']);
      expect(api.updateChecklist).toHaveBeenCalledWith({ invitationSent: true }, 4);

      api.invite.mockResolvedValueOnce({ invited: 2, skipped: 0, alreadyInvited: 0 });
      await store.invite(store.inviteKept());

      expect(api.invite).toHaveBeenLastCalledWith([
        'marc.roux@ateliernord.fr',
        'lea.petit@ateliernord.fr',
      ]);
      expect(store.inviteOpen()).toBe(false);
      expect(store.inviteKept()).toEqual([]);
    });

    it('keeps the addresses of a refused batch only, after the others were invited', async () => {
      api.invite
        .mockResolvedValueOnce({ invited: 50, skipped: 0, alreadyInvited: 0 })
        .mockRejectedValueOnce(problem(429, 'invitation.daily-limit-reached'));
      const emails: readonly string[] = Array.from(
        { length: 52 },
        (_unused: unknown, index: number): string => `member${String(index)}@ateliernord.fr`,
      );
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite(emails);

      expect(toasts.success).toHaveBeenCalledWith('50 invitations sent', { description: '' });
      expect(toasts.error).toHaveBeenCalledWith('The invitations could not be sent', {
        description: 'The daily invitation limit is reached: try again later.',
      });
      expect(store.inviteOpen()).toBe(true);
      expect(store.inviteKept()).toEqual(emails.slice(50));
    });

    describe('several batches', () => {
      const many: readonly string[] = Array.from(
        { length: 120 },
        (_unused: unknown, index: number): string => `member${String(index)}@ateliernord.fr`,
      );

      /**
       * Function holdFirstBatch
       *
       * @description
       * Makes the first batch wait until the test answers it; the next ones invite every address.
       *
       * @returns {() => void} Answers the first batch with all its addresses invited.
       */
      function holdFirstBatch(): () => void {
        let answer: () => void = (): void => undefined;
        api.invite.mockImplementation((batch: readonly string[]) =>
          Promise.resolve({ invited: batch.length, skipped: 0, alreadyInvited: 0 }),
        );
        api.invite.mockImplementationOnce(
          (batch: readonly string[]) =>
            new Promise((resolve: (outcome: unknown) => void) => {
              answer = (): void => {
                resolve({ invited: batch.length, skipped: 0, alreadyInvited: 0 });
              };
            }),
        );
        return (): void => {
          answer();
        };
      }

      it('stops the batches once the organization changes', async () => {
        const answer: () => void = holdFirstBatch();
        const store: GettingStartedStore = await setup();
        store.start('invite');

        const sending: Promise<void> = store.invite(many);
        switchOrganization();
        answer();
        await sending;

        expect(api.invite).toHaveBeenCalledTimes(1);
        expect(api.updateChecklist).not.toHaveBeenCalled();
      });

      it('sends every batch even once the host is destroyed', async () => {
        const answer: () => void = holdFirstBatch();
        const store: GettingStartedStore = await setup();
        store.start('invite');

        const sending: Promise<void> = store.invite(many);
        host.destroy();
        answer();
        await sending;

        expect(api.invite).toHaveBeenCalledTimes(3);
        expect(toasts.success).toHaveBeenCalledWith('120 invitations sent', { description: '' });
        expect(toasts.error).not.toHaveBeenCalled();
      });

      it('still says what a send did once the host is destroyed, and keeps those toasts', async () => {
        const answer: () => void = holdFirstBatch();
        api.invite.mockRejectedValue(problem(429, 'invitation.daily-limit-reached'));
        const store: GettingStartedStore = await setup();
        store.start('invite');

        const sending: Promise<void> = store.invite(many);
        host.destroy();
        answer();
        await sending;

        expect(api.invite).toHaveBeenCalledTimes(2);
        expect(toasts.success).toHaveBeenCalledWith('50 invitations sent', { description: '' });
        expect(toasts.error).toHaveBeenCalledWith('70 addresses could not be invited', {
          description:
            'The daily invitation limit is reached: try again later. Invite them again from “Getting started” or the Members page.',
        });
        expect(toasts.dismiss).not.toHaveBeenCalled();
        expect(toasts.toasts()).toHaveLength(2);
      });

      it('says nothing once the organization changed, even with the host destroyed', async () => {
        const answer: () => void = holdFirstBatch();
        const store: GettingStartedStore = await setup();
        store.start('invite');

        const sending: Promise<void> = store.invite(many);
        host.destroy();
        switchOrganization();
        answer();
        await sending;

        expect(toasts.toasts()).toEqual([]);
      });

      it('stops the batches after a switch to another organization and back', async () => {
        const answer: () => void = holdFirstBatch();
        const store: GettingStartedStore = await setup();
        store.start('invite');

        const sending: Promise<void> = store.invite(many);
        switchOrganization();
        switchBack();
        answer();
        await sending;

        expect(api.invite).toHaveBeenCalledTimes(1);
        expect(toasts.toasts()).toEqual([]);
      });

      it('stops the batches of a destroyed host after a switch away and back, silently', async () => {
        const answer: () => void = holdFirstBatch();
        const store: GettingStartedStore = await setup();
        store.start('invite');

        const sending: Promise<void> = store.invite(many);
        host.destroy();
        switchOrganization();
        switchBack();
        answer();
        await sending;

        expect(api.invite).toHaveBeenCalledTimes(1);
        expect(toasts.toasts()).toEqual([]);
      });

      it('records the invitation marker once, after the first batch that reaches someone', async () => {
        api.invite.mockImplementation((batch: readonly string[]) =>
          Promise.resolve({ invited: batch.length, skipped: 0, alreadyInvited: 0 }),
        );
        api.invite.mockResolvedValueOnce({ invited: 0, skipped: 50, alreadyInvited: 0 });
        const order: string[] = [];
        const invite: Mock = api.invite;
        api.invite = vi.fn((batch: readonly string[]) => {
          order.push('invite');
          return invite(batch) as Promise<unknown>;
        });
        const write: Mock = api.updateChecklist;
        api.updateChecklist = vi.fn((change: unknown, version: number) => {
          order.push('marker');
          return write(change, version) as Promise<unknown>;
        });
        const store: GettingStartedStore = await setup();
        store.start('invite');

        await store.invite(many);
        await settle();

        expect(order.filter((call: string) => call === 'invite')).toHaveLength(3);
        expect(order.indexOf('marker')).toBeGreaterThan(1);
        expect(api.updateChecklist).toHaveBeenCalledTimes(1);
      });

      it('sends the next batches while the marker write is still pending', async () => {
        api.invite.mockImplementation((batch: readonly string[]) =>
          Promise.resolve({ invited: batch.length, skipped: 0, alreadyInvited: 0 }),
        );
        let saveMarker: () => void = (): void => undefined;
        const write: Mock = api.updateChecklist;
        api.updateChecklist = vi.fn(
          (change: unknown, version: number) =>
            new Promise((resolve: (progress: unknown) => void) => {
              saveMarker = (): void => {
                resolve(write(change, version));
              };
            }),
        );
        const store: GettingStartedStore = await setup();
        store.start('invite');

        await store.invite(many);
        await settle();

        expect(api.invite).toHaveBeenCalledTimes(3);
        expect(api.updateChecklist).toHaveBeenCalledTimes(1);
        expect(store.inviteOpen()).toBe(false);
        expect(store.items()[1]).toEqual({ key: 'invite', done: false });

        saveMarker();
        await settle();

        expect(store.items()[1]).toEqual({ key: 'invite', done: true });
      });

      it('stops at a definite refusal and keeps the addresses not sent', async () => {
        api.invite.mockRejectedValueOnce(problem(429, 'invitation.daily-limit-reached'));
        const store: GettingStartedStore = await setup();
        store.start('invite');

        await store.invite(many);

        expect(api.invite).toHaveBeenCalledTimes(1);
        expect(store.inviteKept()).toEqual(many);
        expect(toasts.error).toHaveBeenCalledTimes(1);
        expect(toasts.error).toHaveBeenCalledWith('The invitations could not be sent', {
          description: 'The daily invitation limit is reached: try again later.',
        });
      });
    });

    it('counts the addresses that leave the list in the failure summary when none was invited', async () => {
      api.invite.mockResolvedValueOnce({
        invited: 0,
        skipped: 3,
        alreadyInvited: 0,
        notSent: ['lea.petit@ateliernord.fr'],
      });
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite([
        'ines.robert@ateliernord.fr',
        'marc.roux@ateliernord.fr',
        'lea.petit@ateliernord.fr',
      ]);

      expect(toasts.info).not.toHaveBeenCalled();
      expect(toasts.success).not.toHaveBeenCalled();
      expect(toasts.error).toHaveBeenCalledTimes(1);
      expect(toasts.error).toHaveBeenCalledWith('1 address could not be invited', {
        description:
          '2 addresses skipped: already members or invited. The addresses stay in the list: press Invite to try again.',
      });
      expect(store.inviteKept()).toEqual(['lea.petit@ateliernord.fr']);
    });

    it('empties the kept addresses when the dialog closes', async () => {
      api.invite.mockRejectedValueOnce(problem(503, 'service.unavailable'));
      const store: GettingStartedStore = await setup();
      store.start('invite');
      await store.invite(['ines.robert@ateliernord.fr']);
      expect(store.inviteKept()).toEqual(['ines.robert@ateliernord.fr']);

      store.setInviteOpen(false);

      expect(store.inviteKept()).toEqual([]);
    });

    it('records the invitation marker again after its write failed', async () => {
      const store: GettingStartedStore = await setup();
      store.start('invite');
      api.updateChecklist.mockRejectedValueOnce(problem(403, 'auth.csrf-rejected'));

      await store.invite(['ines.robert@ateliernord.fr']);
      expect(store.items()[1]).toEqual({ key: 'invite', done: false });

      showTab();
      await settle();

      expect(api.updateChecklist).toHaveBeenCalledTimes(2);
      expect(api.updateChecklist).toHaveBeenLastCalledWith({ invitationSent: true }, 4);
      expect(store.items()[1]).toEqual({ key: 'invite', done: true });
    });

    it('keeps an owed marker across a new host and records it there', async () => {
      const store: GettingStartedStore = await setup();
      store.start('invite');
      api.updateChecklist.mockRejectedValueOnce(problem(403, 'auth.csrf-rejected'));
      await store.invite(['ines.robert@ateliernord.fr']);
      await settle();
      expect(route.get(OnboardingStore).owesInvitation()).toBe(true);

      host.destroy();
      const again: GettingStartedStore = await createHost();

      expect(api.updateChecklist).toHaveBeenCalledTimes(2);
      expect(api.updateChecklist).toHaveBeenLastCalledWith({ invitationSent: true }, 4);
      expect(again.items()[1]).toEqual({ key: 'invite', done: true });
      expect(route.get(OnboardingStore).owesInvitation()).toBe(false);
    });

    it('closes the dialog without a toast when the organization pin drops the batch', async () => {
      api.invite.mockRejectedValueOnce(problem(412, 'organization.context-changed'));
      const store: GettingStartedStore = await setup();
      store.start('invite');

      await store.invite(['ines.robert@ateliernord.fr']);

      expect(store.inviteOpen()).toBe(false);
      expect(toasts.error).not.toHaveBeenCalled();
      expect(toasts.warning).not.toHaveBeenCalled();
    });

    it('closes the dialog when the organization changes and sends nothing to the new one', async () => {
      const store: GettingStartedStore = await setup();
      store.start('invite');
      expect(store.inviteOpen()).toBe(true);

      switchOrganization();
      TestBed.tick();
      expect(store.inviteOpen()).toBe(false);
      await store.invite(['ines.robert@ateliernord.fr']);

      expect(api.invite).not.toHaveBeenCalled();
    });

    it('shows nothing when the organization changed during the batch', async () => {
      let answer: (outcome: {
        invited: number;
        skipped: number;
        alreadyInvited: number;
      }) => void = (): void => undefined;
      api.invite.mockReturnValueOnce(
        new Promise(
          (
            resolve: (outcome: {
              invited: number;
              skipped: number;
              alreadyInvited: number;
            }) => void,
          ) => {
            answer = resolve;
          },
        ),
      );
      const store: GettingStartedStore = await setup();
      store.start('invite');

      const sending: Promise<void> = store.invite(['ines.robert@ateliernord.fr']);
      switchOrganization();
      answer({ invited: 1, skipped: 0, alreadyInvited: 0 });
      await sending;

      expect(toasts.success).not.toHaveBeenCalled();
      expect(api.updateChecklist).not.toHaveBeenCalled();
      expect(store.inviting()).toBe(false);
    });
  });

  describe('late answers', () => {
    /**
     * Function heldInvite
     *
     * @description
     * Makes the next batch wait until the test answers it.
     *
     * @returns {(invited: number) => void} Answers the batch with that many addresses invited.
     */
    function heldInvite(): (invited: number) => void {
      let answer: (outcome: {
        invited: number;
        skipped: number;
        alreadyInvited: number;
      }) => void = (): void => undefined;
      api.invite.mockReturnValueOnce(
        new Promise(
          (
            resolve: (outcome: {
              invited: number;
              skipped: number;
              alreadyInvited: number;
            }) => void,
          ) => {
            answer = resolve;
          },
        ),
      );
      return (invited: number): void => {
        answer({ invited, skipped: 0, alreadyInvited: 0 });
      };
    }

    it('leaves a dialog opened again alone when the earlier batch answers', async () => {
      const store: GettingStartedStore = await setup();
      const answer: (invited: number) => void = heldInvite();
      store.start('invite');
      const sending: Promise<void> = store.invite(['ines.robert@ateliernord.fr']);

      store.setInviteOpen(false);
      store.start('invite');
      expect(store.inviting()).toBe(false);
      answer(1);
      await sending;

      expect(store.inviteOpen()).toBe(true);
      expect(toasts.toasts()).toEqual([]);
      expect(api.updateChecklist).toHaveBeenCalledWith({ invitationSent: true }, 4);
    });

    it('leaves the dialog of the new organization alone when the earlier batch answers', async () => {
      const store: GettingStartedStore = await setup();
      const answer: (invited: number) => void = heldInvite();
      store.start('invite');
      const sending: Promise<void> = store.invite(['ines.robert@ateliernord.fr']);

      switchOrganization();
      TestBed.tick();
      await settle();
      store.start('invite');
      answer(1);
      await sending;
      await settle();

      expect(store.inviteOpen()).toBe(true);
      expect(toasts.toasts()).toEqual([]);
      expect(api.updateChecklist).not.toHaveBeenCalled();
    });

    it('leaves the dialog of a new host alone when a batch of the destroyed one answers', async () => {
      const store: GettingStartedStore = await setup();
      const answer: (invited: number) => void = heldInvite();
      store.start('invite');
      const sending: Promise<void> = store.invite(['ines.robert@ateliernord.fr']);

      host.destroy();
      const again: GettingStartedStore = await createHost();
      again.start('invite');
      answer(1);
      await sending;
      await settle();

      expect(again.inviteOpen()).toBe(true);
      expect(again.inviteKept()).toEqual([]);
      expect(toasts.toasts().map((toast) => toast.title)).toEqual(['1 invitation sent']);
      expect(api.updateChecklist).toHaveBeenCalledWith({ invitationSent: true }, 4);
    });

    it('leaves a dialog opened again alone when the earlier batch fails', async () => {
      const store: GettingStartedStore = await setup();
      let fail: (error: unknown) => void = (): void => undefined;
      api.invite.mockReturnValueOnce(
        new Promise((_resolve: unknown, reject: (error: unknown) => void) => {
          fail = reject;
        }),
      );
      store.start('invite');
      const sending: Promise<void> = store.invite(['ines.robert@ateliernord.fr']);

      store.setInviteOpen(false);
      store.start('invite');
      fail(problem(412, 'organization.context-changed'));
      await sending;

      expect(store.inviteOpen()).toBe(true);
      expect(toasts.toasts()).toEqual([]);
    });
  });

  describe('organization change and destruction', () => {
    it('dismisses the toasts it showed when the organization changes', async () => {
      const store: GettingStartedStore = await setup();
      api.updateChecklist.mockRejectedValueOnce(problem(403, 'auth.csrf-rejected'));
      await store.toggle();
      expect(toasts.toasts()).toHaveLength(1);

      switchOrganization();
      TestBed.tick();

      expect(toasts.toasts()).toEqual([]);
    });

    it('closes the dialog, dismisses its toasts and stops listening once destroyed', async () => {
      const store: GettingStartedStore = await setup();
      store.start('invite');
      api.invite.mockRejectedValueOnce(problem(403, 'organization.role-forbidden'));
      await store.invite(['ines.robert@ateliernord.fr']);
      expect(toasts.toasts()).toHaveLength(1);

      host.destroy();
      showTab();
      created.next({} as CreatedTask);
      await TestBed.inject(Router).navigateByUrl('/atelier-nord/l/l-sprint/board');
      await settle();

      expect(TestBed.inject(ShellOverlay).isOpen(ONBOARDING_INVITE_DIALOG_OVERLAY)).toBe(false);
      expect(toasts.toasts()).toEqual([]);
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(api.updateChecklist).not.toHaveBeenCalled();
    });
  });
});
