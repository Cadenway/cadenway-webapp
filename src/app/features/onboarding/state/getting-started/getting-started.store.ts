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
import { CwToastService } from '@cadenway/ui/components/toast';
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

import { readProblem } from '@core/api';
import { TaskCreate } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import { ShellOverlay } from '@shared/layout-slot';

import {
  isDroppedOnboardingWrite,
  OnboardingApi,
} from '../../data-access/services/onboarding-api/onboarding-api.service';
import type {
  OnboardingInvitationOutcome,
  OnboardingProgress,
} from '../../models/onboarding/onboarding.interface';
import { OnboardingWriteDroppedError } from '../onboarding/onboarding-write-dropped.error';
import { OnboardingStore } from '../onboarding/onboarding.store';
import type { GettingStartedItem, GettingStartedItemKey } from './getting-started-item.interface';

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
   * Collapses or expands the list at once and saves it; a refusal restores it with a failure toast,
   * a write dropped for a changed organization stays silent.
   *
   * @returns {Promise<void>} Resolves once settled; never rejects.
   */
  toggle(): Promise<void>;

  /**
   * Method dismiss
   *
   * @description
   * Hides the checklist for good, at once, and saves it; a refusal shows it again with a failure
   * toast, a write dropped for a changed organization stays silent.
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
   * Opens or closes the invite dialog; it does not open over another shell overlay.
   *
   * @param {boolean} open - Whether it is open.
   */
  setInviteOpen(open: boolean): void;

  /**
   * Method invite
   *
   * @description
   * Invites the addresses as members, toasts the outcome and closes the dialog, then records the
   * checklist's invitation marker when at least one address was invited. A failure keeps the
   * dialog open with a failure toast; nothing shows when the organization changed meanwhile.
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
    withState<GettingStartedState>({ _inviting: false }),
    withProps(() => {
      const router: Router = inject(Router);
      return {
        _onboarding: inject(OnboardingStore),
        _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
        _api: inject(OnboardingApi),
        _overlay: inject(ShellOverlay),
        _taskCreate: inject(TaskCreate),
        _toasts: inject(CwToastService),
        _document: inject(DOCUMENT),
        _router: router,
        _url: toSignal(
          router.events.pipe(
            filter((event: RouterEvent): event is NavigationEnd => event instanceof NavigationEnd),
            map((event: NavigationEnd): string => event.urlAfterRedirects),
          ),
          { initialValue: router.url },
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
      return {
        _checklist: checklist,
        visible: (): boolean =>
          checklist() !== null && !store._overlay.isOpen(ONBOARDING_WIZARD_OVERLAY),
        expanded: (): boolean => checklist()?.checklist.presentation === 'expanded',
        items,
        inviteOpen: (): boolean => store._overlay.isOpen(ONBOARDING_INVITE_OVERLAY),
        inviting: (): boolean => store._inviting(),
        _boardToRecord: (): boolean => {
          const progress: OnboardingProgress | null = checklist();
          return (
            progress !== null &&
            !progress.checklist.boardTried &&
            isBoardAddress(store._router, store._url())
          );
        },
        _taskToRefresh: (): boolean => {
          const progress: OnboardingProgress | null = checklist();
          return progress !== null && !progress.checklist.firstTaskCreated;
        },
      };
    }),
    withMethods((store) => {
      const reportFailure: (error: unknown, title: string) => void = (
        error: unknown,
        title: string,
      ): void => {
        if (error instanceof OnboardingWriteDroppedError) return;
        store._toasts.error(title);
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
          store._toasts.info(
            $localize`:@@onboarding.getting-started.invite-none:No invitation sent`,
            { description: skipped },
          );
          return;
        }
        store._toasts.success(
          takesSingular(outcome.invited)
            ? $localize`:@@onboarding.getting-started.invite-sent-one:${outcome.invited}:count: invitation sent`
            : $localize`:@@onboarding.getting-started.invite-sent:${outcome.invited}:count: invitations sent`,
          { description: skipped },
        );
      };

      const setInviteOpen: (open: boolean) => void = (open: boolean): void => {
        if (open) store._overlay.open(ONBOARDING_INVITE_OVERLAY);
        else store._overlay.close(ONBOARDING_INVITE_OVERLAY);
      };

      return {
        _recordBoard: signalMethod<boolean>((onBoard: boolean): void => {
          // A dropped write (the organization changed with this navigation) or a refusal stays
          // silent: the marker is a background fact, recorded again on the next board visit.
          if (onBoard) void store._onboarding.recordBoardTried().catch((): undefined => undefined);
        }),
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
          const organization: string = store._workspace.organization().id;
          const moved: () => boolean = (): boolean =>
            store._workspace.organization().id !== organization;
          patchState(store, { _inviting: true });
          let outcome: OnboardingInvitationOutcome;
          try {
            outcome = await store._api.invite(emails);
          } catch (error: unknown) {
            if (moved() || isDroppedOnboardingWrite(error)) return;
            store._toasts.error(
              $localize`:@@onboarding.getting-started.invite-failed:The invitations could not be sent`,
              readProblem(error)?.code === 'invitation.daily-limit-reached'
                ? {
                    description: $localize`:@@onboarding.getting-started.invite-failed-limit:The daily invitation limit is reached: try again later.`,
                  }
                : {},
            );
            return;
          } finally {
            patchState(store, { _inviting: false });
          }
          if (moved()) return;
          toastOutcome(outcome);
          setInviteOpen(false);
          if (outcome.invited > 0) {
            // The invitations are sent: a marker write that fails or is dropped shows nothing more.
            await store._onboarding.recordInvitation().catch((): undefined => undefined);
          }
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._onboarding.load();
        store._recordBoard(store._boardToRecord);
        store._taskCreate.created.pipe(takeUntilDestroyed()).subscribe((): void => {
          if (store._taskToRefresh()) void store._onboarding.reload();
        });
        fromEvent(store._document, 'visibilitychange')
          .pipe(
            filter((): boolean => store._document.visibilityState === 'visible'),
            takeUntilDestroyed(),
          )
          .subscribe((): void => {
            if (store._taskToRefresh()) void store._onboarding.reload();
          });
      },
      onDestroy(store): void {
        store._overlay.close(ONBOARDING_INVITE_OVERLAY);
      },
    }),
  );
}

/**
 * Constant GettingStartedStore
 *
 * @description
 * The `Getting started` checklist (`App.dc.html` lines 2712-2727, behaviour 5299-5319), provided
 * by `GettingStartedHost` and reading the route's `OnboardingStore`, which it asks to load. It
 * derives the panel's visibility, items and counter from the progress, saves the presentation
 * (optimistic, rolled back with a toast on a refusal, silent when the write was dropped for a
 * changed organization), acts on the items, sends the invite dialog's invitations, records
 * `boardTried` when the address is a list's `Board` view (on each `NavigationEnd`, and the
 * address shown when the progress arrives) while the marker is not recorded, and reads the
 * progress again after a task is created through `TaskCreate` and when the tab shows again, while
 * `firstTaskCreated` is not set (no realtime fact exists, gap G8). A failed read shows nothing.
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
