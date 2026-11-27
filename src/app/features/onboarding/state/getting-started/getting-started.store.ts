import { DOCUMENT } from '@angular/common';
import { computed, inject, type Signal, type Type } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  PRIMARY_OUTLET,
  type Event as RouterEvent,
  Router,
  type UrlSegment,
  type UrlSegmentGroup,
} from '@angular/router';
import { CwToastService, type CwToastOptions } from '@cadenway/ui/components/toast';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { filter, fromEvent, map } from 'rxjs';

import { OrganizationPin, readProblem } from '@core/api';
import { TaskCreate } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import { ShellOverlay } from '@shared/layout-slot';

import {
  isDroppedOnboardingWrite,
  isUncertainOnboardingWrite,
  OnboardingApi,
} from '../../data-access/services/onboarding-api/onboarding-api.service';
import type {
  GettingStartedItem,
  GettingStartedItemKey,
} from '../../models/getting-started/getting-started-item.interface';
import type {
  OnboardingInvitationOutcome,
  OnboardingProgress,
} from '../../models/onboarding/onboarding.interface';
import { OnboardingWriteDroppedError } from '../onboarding/onboarding-write-dropped.error';
import { OnboardingStore } from '../onboarding/onboarding.store';

/**
 * Constant ONBOARDING_WIZARD_OVERLAY
 *
 * @description
 * The `ShellOverlay` id the onboarding assistant holds while it covers the shell (its `overlays`
 * contribution id): the checklist stays hidden under it.
 *
 * @type {string}
 */
const ONBOARDING_WIZARD_OVERLAY: string = 'onboarding.wizard';

/**
 * Constant ONBOARDING_INVITE_OVERLAY
 *
 * @description
 * The `ShellOverlay` id of the checklist's invite dialog, so no other shell overlay opens over it.
 *
 * @type {string}
 */
const ONBOARDING_INVITE_OVERLAY: string = 'onboarding.invite-dialog';

/**
 * Constant BOARD_SEGMENT
 *
 * @description
 * The segment of the `Board` view below `/<slug>/l/<listId>` (Spaces' `LAYOUT_SEGMENTS.board`,
 * mockup line 5301).
 *
 * @type {string}
 */
const BOARD_SEGMENT: string = 'board';

/**
 * Type ToastTone
 *
 * @description
 * The toast methods the store shows.
 *
 * @type {'success' | 'info' | 'warning' | 'error'}
 */
type ToastTone = 'success' | 'info' | 'warning' | 'error';

/**
 * Interface ShownAddress
 *
 * @description
 * One address the router showed: each `NavigationEnd` gives a new one, so the board watcher reacts
 * to a navigation even to the same board.
 */
interface ShownAddress {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the navigation that showed it; 0 for the address shown when the store was created.
   *
   * @type {number}
   * @readonly
   */
  readonly id: number;

  /**
   * Property url
   *
   * @description
   * The address, after redirects.
   *
   * @type {string}
   * @readonly
   */
  readonly url: string;
  // #endregion
}

/**
 * Function isBoardAddress
 *
 * @description
 * Whether an address is a list's `Board` view, `/<slug>/l/<listId>/board`, whatever its query.
 *
 * @param {Router} router - The router, to parse the address.
 * @param {string} url - The address.
 * @returns {boolean} Whether it shows a board.
 */
function isBoardAddress(router: Router, url: string): boolean {
  const children: Record<string, UrlSegmentGroup> = router.parseUrl(url).root.children;
  if (!(PRIMARY_OUTLET in children)) return false;
  const segments: readonly string[] = children[PRIMARY_OUTLET].segments.map(
    (segment: UrlSegment): string => segment.path,
  );
  return segments.length === 4 && segments[1] === 'l' && segments[3] === BOARD_SEGMENT;
}

/**
 * Function takesSingular
 *
 * @description
 * Whether a count takes the singular in the current locale (`1 invitation sent`).
 *
 * @param {number} count - The count.
 * @returns {boolean} Whether it is singular.
 */
function takesSingular(count: number): boolean {
  return new Intl.PluralRules($localize.locale ?? 'en').select(count) === 'one';
}

/**
 * Function checklistApplies
 *
 * @description
 * Whether a progress has a checklist to show: the assistant finished and provisioned the first
 * space, and the checklist was not dismissed.
 *
 * @param {OnboardingProgress | null} progress - The progress, null while unread or unreadable.
 * @returns {boolean} Whether the checklist applies.
 */
function checklistApplies(progress: OnboardingProgress | null): progress is OnboardingProgress {
  return (
    progress !== null &&
    progress.wizard.status === 'finished' &&
    progress.provisioning !== null &&
    progress.checklist.presentation !== 'dismissed'
  );
}

/**
 * Interface GettingStartedState
 *
 * @description
 * Private state of the getting-started store.
 */
interface GettingStartedState {
  // #region Properties
  /**
   * Property _inviting
   *
   * @description
   * Whether the invite dialog's invitations are being sent.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _inviting: boolean;

  /**
   * Property _inviteOrganization
   *
   * @description
   * Organization the open invite dialog was opened in, or null while it is closed: its addresses
   * are never sent to another one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _inviteOrganization: string | null;

  /**
   * Property _invitationOwed
   *
   * @description
   * Whether an invitation went out but recording the checklist's invitation marker failed: the
   * marker is recorded again on the next refresh or when the panel shows again.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _invitationOwed: boolean;
  // #endregion
}

/**
 * Interface GettingStartedStoreInstance
 *
 * @description
 * Public API of the getting-started store.
 */
interface GettingStartedStoreInstance {
  // #region Properties
  /**
   * Property visible
   *
   * @description
   * Whether the panel shows: the assistant finished and provisioned the first space, the checklist
   * is not dismissed and the assistant does not cover the shell. False while the progress is
   * unread, and when its first read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly visible: Signal<boolean>;

  /**
   * Property expanded
   *
   * @description
   * Whether the item list shows (`expanded`), rather than the header alone (`collapsed`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly expanded: Signal<boolean>;

  /**
   * Property items
   *
   * @description
   * The items in the mockup's order, `invite` only for an owner or an administrator (who alone may
   * invite); empty while the checklist does not apply.
   *
   * @type {Signal<readonly GettingStartedItem[]>}
   * @readonly
   */
  readonly items: Signal<readonly GettingStartedItem[]>;

  /**
   * Property inviteOpen
   *
   * @description
   * Whether the invite dialog is open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly inviteOpen: Signal<boolean>;

  /**
   * Property inviting
   *
   * @description
   * Whether the invitations are being sent.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly inviting: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method toggle
   *
   * @description
   * Collapses or expands the list at once and saves it. A refusal restores it with a failure toast,
   * an unknown outcome the read did not settle with a neutral one; a write dropped for a changed
   * organization stays silent.
   *
   * @returns {Promise<void>} Resolves once settled; never rejects.
   */
  toggle(): Promise<void>;

  /**
   * Method dismiss
   *
   * @description
   * Hides the checklist for good, at once, and saves it; failures are reported as `toggle` does,
   * and a refusal shows the checklist again.
   *
   * @returns {Promise<void>} Resolves once settled; never rejects.
   */
  dismiss(): Promise<void>;

  /**
   * Method start
   *
   * @description
   * Acts on an item: `task` opens the task create dialog on the first list, `invite` opens the
   * invite dialog, `board` opens the first list's `Board` view.
   *
   * @param {GettingStartedItemKey} key - The item.
   */
  start(key: GettingStartedItemKey): void;

  /**
   * Method setInviteOpen
   *
   * @description
   * Opens the invite dialog in the current organization (not over another shell overlay), or
   * closes it.
   *
   * @param {boolean} open - Whether it is open.
   */
  setInviteOpen(open: boolean): void;

  /**
   * Method invite
   *
   * @description
   * Invites the addresses as members of the organization the dialog was opened in, toasts the
   * outcome and closes the dialog, then records the checklist's invitation marker when an
   * invitation is out for at least one address (invited now, or already invited). Nothing is sent
   * once the organization changed; a write the organization pin dropped closes the dialog
   * silently. A refusal keeps the dialog open with a failure toast, an unknown outcome with a toast
   * saying that sending again is safe.
   *
   * @param {readonly string[]} emails - The addresses.
   * @returns {Promise<void>} Resolves once settled; never rejects.
   */
  invite(emails: readonly string[]): Promise<void>;
  // #endregion
}

/**
 * Function createGettingStartedStore
 *
 * @description
 * Creates the getting-started store.
 *
 * @returns {Type<GettingStartedStoreInstance>} Injectable store constructor.
 */
function createGettingStartedStore(): Type<GettingStartedStoreInstance> {
  return signalStore(
    withState<GettingStartedState>({
      _inviting: false,
      _inviteOrganization: null,
      _invitationOwed: false,
    }),
    withProps(() => {
      const router: Router = inject(Router);
      return {
        _onboarding: inject(OnboardingStore),
        _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
        _pin: inject(OrganizationPin),
        _api: inject(OnboardingApi),
        _overlay: inject(ShellOverlay),
        _taskCreate: inject(TaskCreate),
        _toasts: inject(CwToastService),
        _shownToasts: new Set<string>(),
        _document: inject(DOCUMENT),
        _router: router,
        _address: toSignal(
          router.events.pipe(
            filter((event: RouterEvent): event is NavigationEnd => event instanceof NavigationEnd),
            map((event: NavigationEnd): ShownAddress => ({
              id: event.id,
              url: event.urlAfterRedirects,
            })),
          ),
          { initialValue: { id: 0, url: router.url } satisfies ShownAddress },
        ),
      };
    }),
    withComputed((store) => {
      const checklist: Signal<OnboardingProgress | null> = computed(
        (): OnboardingProgress | null => {
          const progress: OnboardingProgress | null = store._onboarding.progress();
          return checklistApplies(progress) ? progress : null;
        },
      );
      const items: Signal<readonly GettingStartedItem[]> = computed(
        (): readonly GettingStartedItem[] => {
          const progress: OnboardingProgress | null = checklist();
          if (progress === null) return [];
          const markers: OnboardingProgress['checklist'] = progress.checklist;
          return [
            { key: 'task', done: markers.firstTaskCreated },
            ...(store._workspace.can('admin')
              ? [{ key: 'invite', done: markers.invitationSent } satisfies GettingStartedItem]
              : []),
            { key: 'board', done: markers.boardTried },
          ];
        },
      );
      const visible: Signal<boolean> = computed(
        (): boolean => checklist() !== null && !store._overlay.isOpen(ONBOARDING_WIZARD_OVERLAY),
      );
      return {
        _checklist: checklist,
        visible,
        expanded: (): boolean => checklist()?.checklist.presentation === 'expanded',
        items,
        inviteOpen: (): boolean => store._overlay.isOpen(ONBOARDING_INVITE_OVERLAY),
        inviting: (): boolean => store._inviting(),
        _boardShown: (): ShownAddress | null => {
          const progress: OnboardingProgress | null = checklist();
          const address: ShownAddress = store._address();
          return progress !== null &&
            !progress.checklist.boardTried &&
            isBoardAddress(store._router, address.url)
            ? address
            : null;
        },
        _taskToRefresh: (): boolean => {
          const progress: OnboardingProgress | null = checklist();
          return progress !== null && !progress.checklist.firstTaskCreated;
        },
        _organizationId: (): string => store._workspace.organization().id,
      };
    }),
    withMethods((store) => {
      let followed: string | null = null;

      const show: (tone: ToastTone, title: string, options?: CwToastOptions) => void = (
        tone: ToastTone,
        title: string,
        options?: CwToastOptions,
      ): void => {
        const live: ReadonlySet<string> = new Set(
          store._toasts.toasts().map((item: { readonly id: string }): string => item.id),
        );
        for (const kept of store._shownToasts) if (!live.has(kept)) store._shownToasts.delete(kept);
        store._shownToasts.add(
          options ? store._toasts[tone](title, options) : store._toasts[tone](title),
        );
      };

      const dismissToasts: () => void = (): void => {
        for (const id of store._shownToasts) store._toasts.dismiss(id);
        store._shownToasts.clear();
      };

      const setInviteOpen: (open: boolean) => void = (open: boolean): void => {
        if (open) {
          if (store._overlay.open(ONBOARDING_INVITE_OVERLAY)) {
            patchState(store, { _inviteOrganization: store._workspace.organization().id });
          }
          return;
        }
        store._overlay.close(ONBOARDING_INVITE_OVERLAY);
        patchState(store, { _inviteOrganization: null });
      };

      const leaveOrganization: () => void = (): void => {
        setInviteOpen(false);
        dismissToasts();
        patchState(store, { _invitationOwed: false });
      };

      const reportFailure: (error: unknown, title: string) => void = (
        error: unknown,
        title: string,
      ): void => {
        if (error instanceof OnboardingWriteDroppedError) return;
        if (isUncertainOnboardingWrite(error)) {
          show(
            'warning',
            $localize`:@@onboarding.getting-started.presentation-uncertain:Your change to “Getting started” may not have been saved`,
          );
          return;
        }
        show('error', title);
      };

      const toastOutcome: (outcome: OnboardingInvitationOutcome) => void = (
        outcome: OnboardingInvitationOutcome,
      ): void => {
        const skipped: string =
          outcome.skipped === 0
            ? ''
            : takesSingular(outcome.skipped)
              ? $localize`:@@onboarding.getting-started.invite-skipped-one:${outcome.skipped}:count: address skipped: already a member or invited.`
              : $localize`:@@onboarding.getting-started.invite-skipped:${outcome.skipped}:count: addresses skipped: already members or invited.`;
        if (outcome.invited === 0) {
          show('info', $localize`:@@onboarding.getting-started.invite-none:No invitation sent`, {
            description: skipped,
          });
          return;
        }
        show(
          'success',
          takesSingular(outcome.invited)
            ? $localize`:@@onboarding.getting-started.invite-sent-one:${outcome.invited}:count: invitation sent`
            : $localize`:@@onboarding.getting-started.invite-sent:${outcome.invited}:count: invitations sent`,
          { description: skipped },
        );
      };

      const recordInvitation: () => Promise<void> = async (): Promise<void> => {
        patchState(store, { _invitationOwed: true });
        try {
          await store._onboarding.recordInvitation();
          patchState(store, { _invitationOwed: false });
        } catch (error: unknown) {
          // The invitations are out: a refused or unknown marker write is owed and recorded again
          // later; one dropped for another organization is not.
          if (error instanceof OnboardingWriteDroppedError) {
            patchState(store, { _invitationOwed: false });
          }
        }
      };

      const settleOwedInvitation: () => Promise<void> = async (): Promise<void> => {
        if (!store._invitationOwed()) return;
        const progress: OnboardingProgress | null = store._onboarding.progress();
        if (progress === null) return;
        if (progress.checklist.invitationSent) {
          patchState(store, { _invitationOwed: false });
          return;
        }
        await recordInvitation();
      };

      const refresh: () => Promise<void> = async (): Promise<void> => {
        if (store._onboarding.failed() || store._taskToRefresh()) {
          await store._onboarding.reload();
        }
        await settleOwedInvitation();
      };

      return {
        _recordBoard: signalMethod<ShownAddress | null>((address: ShownAddress | null): void => {
          // Silent: a write dropped because this navigation changed the organization is not this
          // organization's, and a refused one is sent again on the next board navigation.
          if (address !== null) {
            void store._onboarding.recordBoardTried().catch((): undefined => undefined);
          }
        }),
        _settleOnShow: signalMethod<boolean>((visible: boolean): void => {
          if (visible) void settleOwedInvitation();
        }),
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (followed !== null && followed !== organizationId) leaveOrganization();
          followed = organizationId;
        }),
        _leaveOrganization: leaveOrganization,
        _refresh: refresh,
        _dismissToasts: dismissToasts,
        async toggle(): Promise<void> {
          const progress: OnboardingProgress | null = store._checklist();
          if (progress === null) return;
          try {
            await store._onboarding.setPresentation(
              progress.checklist.presentation === 'expanded' ? 'collapsed' : 'expanded',
            );
          } catch (error: unknown) {
            reportFailure(
              error,
              $localize`:@@onboarding.getting-started.toggle-failed:The list could not be updated`,
            );
          }
        },
        async dismiss(): Promise<void> {
          if (store._checklist() === null) return;
          try {
            await store._onboarding.setPresentation('dismissed');
          } catch (error: unknown) {
            reportFailure(
              error,
              $localize`:@@onboarding.getting-started.dismiss-failed:“Getting started” could not be hidden`,
            );
          }
        },
        start(key: GettingStartedItemKey): void {
          const firstListId: string | undefined = store._checklist()?.provisioning?.firstListId;
          if (firstListId === undefined) return;
          switch (key) {
            case 'task':
              store._taskCreate.open({ listId: firstListId });
              return;
            case 'invite':
              setInviteOpen(true);
              return;
            case 'board':
              void store._router.navigate([
                '/',
                store._workspace.organization().slug,
                'l',
                firstListId,
                BOARD_SEGMENT,
              ]);
              return;
          }
        },
        setInviteOpen,
        async invite(emails: readonly string[]): Promise<void> {
          if (store._inviting() || emails.length === 0) return;
          const organization: string | null = store._inviteOrganization();
          const moved: () => boolean = (): boolean =>
            organization === null ||
            store._workspace.organization().id !== organization ||
            store._pin.current() !== organization;
          if (moved()) {
            setInviteOpen(false);
            return;
          }
          patchState(store, { _inviting: true });
          let outcome: OnboardingInvitationOutcome;
          try {
            outcome = await store._api.invite(emails);
          } catch (error: unknown) {
            if (moved() || isDroppedOnboardingWrite(error)) {
              setInviteOpen(false);
              return;
            }
            if (isUncertainOnboardingWrite(error)) {
              show(
                'warning',
                $localize`:@@onboarding.getting-started.invite-uncertain:The invitations may not have been sent`,
                {
                  description: $localize`:@@onboarding.getting-started.invite-uncertain-text:Sending again is safe.`,
                },
              );
              return;
            }
            show(
              'error',
              $localize`:@@onboarding.getting-started.invite-failed:The invitations could not be sent`,
              readProblem(error)?.code === 'invitation.daily-limit-reached'
                ? {
                    description: $localize`:@@onboarding.getting-started.invite-failed-limit:The daily invitation limit is reached: try again later.`,
                  }
                : undefined,
            );
            return;
          } finally {
            patchState(store, { _inviting: false });
          }
          if (moved()) return;
          toastOutcome(outcome);
          setInviteOpen(false);
          if (outcome.invited > 0 || outcome.alreadyInvited > 0) await recordInvitation();
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._onboarding.load();
        // The route's progress may be older than this host (a task created in a settings shell):
        // read it again when it already shows a checklist waiting for the first task, or failed.
        if (store._onboarding.failed() || store._taskToRefresh()) void store._onboarding.reload();
        store._followOrganization(store._organizationId);
        store._recordBoard(store._boardShown);
        store._settleOnShow(store.visible);
        store._pin.organizationChanges.pipe(takeUntilDestroyed()).subscribe((): void => {
          store._leaveOrganization();
        });
        store._taskCreate.created.pipe(takeUntilDestroyed()).subscribe((): void => {
          void store._refresh();
        });
        fromEvent(store._document, 'visibilitychange')
          .pipe(
            filter((): boolean => store._document.visibilityState === 'visible'),
            takeUntilDestroyed(),
          )
          .subscribe((): void => {
            void store._refresh();
          });
      },
      onDestroy(store): void {
        store._overlay.close(ONBOARDING_INVITE_OVERLAY);
        store._dismissToasts();
      },
    }),
  );
}

/**
 * Constant GettingStartedStore
 *
 * @description
 * The `Getting started` checklist (`App.dc.html` lines 2712-2727, behaviour 5299-5319), provided
 * by `GettingStartedHost` (component scope: it lives with the application shell) and reading the
 * route's `OnboardingStore`, which it asks to load. It derives the panel's visibility, items and
 * counter from the progress, saves the presentation (optimistic, rolled back with a toast on a
 * refusal, silent when the write was dropped for a changed organization), acts on the items,
 * sends the invite dialog's invitations to the organization it was opened in, records
 * `boardTried` on each navigation to a list's `Board` view (and for the address shown when the
 * progress arrives) while the marker is not recorded, and reads the progress again after a task
 * is created through `TaskCreate` and when the tab shows again, while `firstTaskCreated` is not
 * set or the first read failed (no realtime fact exists, gap G8). An organization change closes
 * the invite dialog and dismisses the toasts it showed, as its destruction does.
 *
 * @type {Type<GettingStartedStoreInstance>}
 */
export const GettingStartedStore: Type<GettingStartedStoreInstance> = createGettingStartedStore();

/**
 * Type GettingStartedStore
 *
 * @description
 * Instance type of the getting-started store.
 *
 * @type {GettingStartedStoreInstance}
 */
export type GettingStartedStore = GettingStartedStoreInstance;
