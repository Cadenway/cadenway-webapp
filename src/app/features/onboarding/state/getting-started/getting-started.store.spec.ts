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
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

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

      TestBed.inject(ShellOverlay).open('onboarding.wizard');

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

    it('reads nothing more once the first task is recorded', async () => {
      shown = progress(5, { firstTaskCreated: true });
      await setup();

      created.next({} as CreatedTask);
      showTab();
      await settle();

      expect(api.get).toHaveBeenCalledTimes(1);
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

      expect(api.updateChecklist).toHaveBeenCalledWith({ invitationSent: true }, 4);
      expect(store.items()[1]).toEqual({ key: 'invite', done: true });
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

      expect(TestBed.inject(ShellOverlay).isOpen('onboarding.invite-dialog')).toBe(false);
      expect(toasts.toasts()).toEqual([]);
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(api.updateChecklist).not.toHaveBeenCalled();
    });
  });
});
