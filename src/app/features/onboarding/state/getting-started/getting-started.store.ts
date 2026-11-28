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
import { filter, fromEvent, map, type Subscription } from 'rxjs';

import {
  isDroppedOrganizationWrite,
  isUnknownWriteOutcome,
  OrganizationPin,
  readProblem,
} from '@core/api';
import { TaskCreate } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import { ShellOverlay } from '@shared/layout-slot';

import {
  ONBOARDING_INVITE_DIALOG_OVERLAY,
  ONBOARDING_WIZARD_OVERLAY,
} from '../../constants/overlays/onboarding-overlays.constants';
import { OnboardingApi } from '../../data-access/services/onboarding-api/onboarding-api.service';
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
 * Constant INVITE_BATCH_SIZE
 *
 * @description
 * Most addresses one `inviteMembers` call accepts; longer lists are sent in batches of this size,
 * as the assistant's `Team` screen does.
 *
 * @type {number}
 */
const INVITE_BATCH_SIZE: number = 50;

/**
 * Constant SHOWN_REFRESH_INTERVAL
 *
 * @description
 * Shortest time, in milliseconds, between two reads of the progress when the tab becomes visible
 * while the checklist applies (a change made in another tab): 30 seconds.
 *
 * @type {number}
 */
const SHOWN_REFRESH_INTERVAL: number = 30_000;

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
 * Interface InviteSend
 *
 * @description
 * What the batches of one send of the invite dialog did, for its toasts.
 */
interface InviteSend {
  // #region Properties
  /**
   * Property invited
   *
   * @description
   * Addresses invited.
   *
   * @type {number}
   */
  invited: number;

  /**
   * Property skipped
   *
   * @description
   * Addresses already members or already invited, which leave the list.
   *
   * @type {number}
   */
  skipped: number;

  /**
   * Property notSent
   *
   * @description
   * Addresses a batch answered with another outcome, which stay in the list.
   *
   * @type {number}
   */
  notSent: number;

  /**
   * Property refusal
   *
   * @description
   * The definite refusal that stopped the batches, or null.
   *
   * @type {unknown}
   */
  refusal: unknown;
  // #endregion
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
   * Property _dialog
   *
   * @description
   * Generation of the invite dialog: each opening gets a new one, and closing it, an organization
   * change or the store's destruction moves it on, so the answer of a batch sent from an earlier
   * opening never closes, empties or toasts over a later one.
   *
   * @type {number}
   * @readonly
   */
  readonly _dialog: number;

  /**
   * Property _sending
   *
   * @description
   * Generation of the dialog whose invitations are being sent, or null.
   *
   * @type {number | null}
   * @readonly
   */
  readonly _sending: number | null;

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
   * Property inviteKept
   *
   * @description
   * The addresses the open invite dialog keeps after a send left some unsent (a refused or
   * unknown batch, or addresses the gateway answered with another outcome), in the order typed;
   * a new array after each such send, empty whenever the dialog opens or closes. The dialog shows
   * them in place of its list, so `Invite` sends only them again.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly inviteKept: readonly string[];
  // #endregion
}

/**
 * Interface GettingStartedLifecycle
 *
 * @description
 * Bookkeeping outside the state, since no view reads it.
 */
interface GettingStartedLifecycle {
  // #region Properties
  /**
   * Property destroyed
   *
   * @description
   * Whether the store was destroyed with its host: an answer arriving later changes no view.
   *
   * @type {boolean}
   */
  destroyed: boolean;

  /**
   * Property shownReadAt
   *
   * @description
   * When the tab becoming visible last read the progress while the checklist applied, as a
   * `performance.now()` time in milliseconds; negative infinity before the first such read.
   *
   * @type {number}
   */
  shownReadAt: number;

  /**
   * Property trailingRead
   *
   * @description
   * The read scheduled for the end of the throttle interval after a visible tab was throttled, or
   * null; cleared on destruction and on an organization change.
   *
   * @type {ReturnType<typeof setTimeout> | null}
   */
  trailingRead: ReturnType<typeof setTimeout> | null;
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

  /**
   * Property inviteKept
   *
   * @description
   * The addresses the open invite dialog keeps after a send left some unsent, so `Invite` sends
   * only them again; empty whenever the dialog opens or closes.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly inviteKept: Signal<readonly string[]>;
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
   * Invites the addresses as members of the organization the dialog was opened in, in batches of
   * 50 (the `inviteMembers` limit), toasts the outcome and closes the dialog. Right after the first
   * batch that reaches an address (invited now, or already invited), it records the checklist's
   * invitation marker. The batches go on while the organization is the one the dialog was opened
   * in, even once the host is destroyed; an organization change, a batch the organization pin
   * dropped and a definite refusal stop them. Only the dialog that sent them, still shown, is
   * closed, emptied or toasted. When addresses are left unsent (a refused batch and the ones after
   * it, a batch whose outcome is unknown, or addresses a batch answered with another outcome), the
   * dialog stays open with only those (`inviteKept`), so `Invite` sends only them again, and one
   * failure summary says why; a sent summary counts the invited ones. When the host was destroyed
   * meanwhile, in the same organization, the summaries still show, outliving the store, and the
   * failure one counts the addresses not invited and says where to invite them again. An
   * organization change says nothing.
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
      _dialog: 0,
      _sending: null,
      _inviteOrganization: null,
      inviteKept: [],
    }),
    withProps(() => {
      const router: Router = inject(Router);
      const lifecycle: GettingStartedLifecycle = {
        destroyed: false,
        shownReadAt: Number.NEGATIVE_INFINITY,
        trailingRead: null,
      };
      return {
        _onboarding: inject(OnboardingStore),
        _workspace: inject<WorkspaceContextPort>(WORKSPACE_CONTEXT),
        _pin: inject(OrganizationPin),
        _api: inject(OnboardingApi),
        _overlay: inject(ShellOverlay),
        _taskCreate: inject(TaskCreate),
        _toasts: inject(CwToastService),
        _shownToasts: new Set<string>(),
        _lifecycle: lifecycle,
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
        inviteOpen: (): boolean => store._overlay.isOpen(ONBOARDING_INVITE_DIALOG_OVERLAY),
        inviting: (): boolean => store._sending() === store._dialog(),
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

      // `tracked` toasts are dismissed with the store (an organization change, its destruction); a
      // toast shown once the host is gone is not.
      const show: (
        tone: ToastTone,
        title: string,
        options?: CwToastOptions,
        tracked?: boolean,
      ) => void = (
        tone: ToastTone,
        title: string,
        options?: CwToastOptions,
        tracked: boolean = true,
      ): void => {
        if (!tracked) {
          if (options) store._toasts[tone](title, options);
          else store._toasts[tone](title);
          return;
        }
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
          if (store._overlay.isOpen(ONBOARDING_INVITE_DIALOG_OVERLAY)) return;
          if (store._overlay.open(ONBOARDING_INVITE_DIALOG_OVERLAY)) {
            patchState(store, {
              _dialog: store._dialog() + 1,
              _inviteOrganization: store._workspace.organization().id,
              inviteKept: [],
            });
          }
          return;
        }
        store._overlay.close(ONBOARDING_INVITE_DIALOG_OVERLAY);
        patchState(store, {
          _dialog: store._dialog() + 1,
          _inviteOrganization: null,
          inviteKept: [],
        });
      };

      const clearTrailingRead: () => void = (): void => {
        if (store._lifecycle.trailingRead !== null) clearTimeout(store._lifecycle.trailingRead);
        store._lifecycle.trailingRead = null;
      };

      const leaveOrganization: () => void = (): void => {
        clearTrailingRead();
        setInviteOpen(false);
        dismissToasts();
      };

      const reportFailure: (error: unknown, title: string) => void = (
        error: unknown,
        title: string,
      ): void => {
        if (error instanceof OnboardingWriteDroppedError) return;
        if (isUnknownWriteOutcome(error)) {
          show(
            'warning',
            $localize`:@@onboarding.getting-started.presentation-uncertain:Your change to “Getting started” may not have been saved`,
          );
          return;
        }
        show('error', title);
      };

      // `skipped` counts the addresses already members or already invited only: the ones a batch
      // left unsent have their own toast.
      const toastOutcome: (
        outcome: Pick<OnboardingInvitationOutcome, 'invited' | 'skipped'>,
        tracked?: boolean,
      ) => void = (
        outcome: Pick<OnboardingInvitationOutcome, 'invited' | 'skipped'>,
        tracked: boolean = true,
      ): void => {
        const skipped: string =
          outcome.skipped === 0
            ? ''
            : takesSingular(outcome.skipped)
              ? $localize`:@@onboarding.getting-started.invite-skipped-one:${outcome.skipped}:count: address skipped: already a member or invited.`
              : $localize`:@@onboarding.getting-started.invite-skipped:${outcome.skipped}:count: addresses skipped: already members or invited.`;
        if (outcome.invited === 0) {
          show(
            'info',
            $localize`:@@onboarding.getting-started.invite-none:No invitation sent`,
            { description: skipped },
            tracked,
          );
          return;
        }
        show(
          'success',
          takesSingular(outcome.invited)
            ? $localize`:@@onboarding.getting-started.invite-sent-one:${outcome.invited}:count: invitation sent`
            : $localize`:@@onboarding.getting-started.invite-sent:${outcome.invited}:count: invitations sent`,
          { description: skipped },
          tracked,
        );
      };

      // The summary of a send whose host was destroyed while its batches went on: the dialog is
      // gone and cannot keep the addresses left unsent, so the failure toast counts them and says
      // where to invite them again. These toasts outlive the store.
      const toastDetached: (send: InviteSend, unsent: number) => void = (
        send: InviteSend,
        unsent: number,
      ): void => {
        if (send.invited > 0 || unsent === 0) {
          toastOutcome({ invited: send.invited, skipped: send.skipped }, false);
        }
        if (unsent === 0) return;
        const lines: string[] = [];
        if (send.invited === 0 && send.skipped > 0) {
          lines.push(
            takesSingular(send.skipped)
              ? $localize`:@@onboarding.getting-started.invite-skipped-one:${send.skipped}:count: address skipped: already a member or invited.`
              : $localize`:@@onboarding.getting-started.invite-skipped:${send.skipped}:count: addresses skipped: already members or invited.`,
          );
        }
        if (readProblem(send.refusal)?.code === 'invitation.daily-limit-reached') {
          lines.push(
            $localize`:@@onboarding.getting-started.invite-failed-limit:The daily invitation limit is reached: try again later.`,
          );
        }
        lines.push(
          $localize`:@@onboarding.getting-started.invite-not-sent-later:Invite them again from “Getting started” or the Members page.`,
        );
        show(
          'error',
          takesSingular(unsent)
            ? $localize`:@@onboarding.getting-started.invite-not-sent-one:${unsent}:count: address could not be invited`
            : $localize`:@@onboarding.getting-started.invite-not-sent-other:${unsent}:count: addresses could not be invited`,
          { description: lines.join(' ') },
          false,
        );
      };

      // `shown` is the tab becoming visible: while the checklist applies, it also reads a progress
      // whose first task is recorded, so a dismissal, an invitation or a board visit made in
      // another tab shows here; at most once per `SHOWN_REFRESH_INTERVAL`, and never by polling. A
      // visible tab inside the interval schedules one read at its end, made only if the tab is
      // still visible and the checklist still applies then.
      const refresh: (shown?: boolean) => Promise<void> = async (
        shown: boolean = false,
      ): Promise<void> => {
        const due: boolean = store._onboarding.failed() || store._taskToRefresh();
        if (shown && store._checklist() !== null) {
          const now: number = performance.now();
          const wait: number = store._lifecycle.shownReadAt + SHOWN_REFRESH_INTERVAL - now;
          if (due || wait <= 0) {
            clearTrailingRead();
            store._lifecycle.shownReadAt = now;
            await store._onboarding.reload();
          } else {
            store._lifecycle.trailingRead ??= setTimeout((): void => {
              store._lifecycle.trailingRead = null;
              if (store._lifecycle.destroyed) return;
              if (store._document.visibilityState !== 'visible' || store._checklist() === null) {
                return;
              }
              store._lifecycle.shownReadAt = performance.now();
              void store._onboarding
                .reload()
                .then((): Promise<void> => store._onboarding.retryOwedInvitation());
            }, wait);
          }
        } else if (due) {
          await store._onboarding.reload();
        }
        await store._onboarding.retryOwedInvitation();
      };

      // The summary of a send that left addresses in the dialog: the invited ones when there are
      // some, then one failure summary. When nothing was invited, the addresses already members or
      // invited, which leave the list, are counted in the failure summary. `uncertain`: other
      // batches, or addresses, have an unknown outcome, which a refusal or not-sent summary says too.
      const toastKept: (send: InviteSend, uncertain: boolean) => void = (
        send: InviteSend,
        uncertain: boolean,
      ): void => {
        if (send.invited > 0) toastOutcome({ invited: send.invited, skipped: send.skipped });
        const lines: string[] = [];
        if (send.invited === 0 && send.skipped > 0) {
          lines.push(
            takesSingular(send.skipped)
              ? $localize`:@@onboarding.getting-started.invite-skipped-one:${send.skipped}:count: address skipped: already a member or invited.`
              : $localize`:@@onboarding.getting-started.invite-skipped:${send.skipped}:count: addresses skipped: already members or invited.`,
          );
        }
        let tone: ToastTone = 'error';
        let title: string;
        if (send.refusal !== null) {
          title = $localize`:@@onboarding.getting-started.invite-failed:The invitations could not be sent`;
          if (readProblem(send.refusal)?.code === 'invitation.daily-limit-reached') {
            lines.push(
              $localize`:@@onboarding.getting-started.invite-failed-limit:The daily invitation limit is reached: try again later.`,
            );
          }
          if (uncertain) {
            lines.push(
              $localize`:@@onboarding.getting-started.invite-uncertain-part:Some may already have been sent: sending again is safe.`,
            );
          }
        } else if (send.notSent > 0) {
          title = takesSingular(send.notSent)
            ? $localize`:@@onboarding.getting-started.invite-not-sent-one:${send.notSent}:count: address could not be invited`
            : $localize`:@@onboarding.getting-started.invite-not-sent-other:${send.notSent}:count: addresses could not be invited`;
          if (uncertain) {
            lines.push(
              $localize`:@@onboarding.getting-started.invite-uncertain-part:Some may already have been sent: sending again is safe.`,
            );
          }
          lines.push(
            $localize`:@@onboarding.getting-started.invite-not-sent-text:The addresses stay in the list: press Invite to try again.`,
          );
        } else {
          tone = 'warning';
          title = $localize`:@@onboarding.getting-started.invite-uncertain:The invitations may not have been sent`;
          lines.push(
            $localize`:@@onboarding.getting-started.invite-uncertain-text:Sending again is safe.`,
          );
        }
        if (lines.length === 0) show(tone, title);
        else show(tone, title, { description: lines.join(' ') });
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
          if (visible) void store._onboarding.retryOwedInvitation();
        }),
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (followed !== null && followed !== organizationId) leaveOrganization();
          followed = organizationId;
        }),
        _leaveOrganization: leaveOrganization,
        _clearTrailingRead: clearTrailingRead,
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
          const dialog: number = store._dialog();
          if (store._sending() === dialog || emails.length === 0) return;
          const organization: string | null = store._inviteOrganization();
          // Set once another organization is committed while the batches run, and never cleared:
          // a switch away and back still stops them. It is heard until the loop ends, even once
          // the host is destroyed.
          let switched: boolean = false;
          const moved: () => boolean = (): boolean =>
            switched ||
            organization === null ||
            store._workspace.organization().id !== organization ||
            store._pin.current() !== organization;
          // The dialog that sent the batch is still the one shown, in its organization: only then
          // may its answer close it, empty it or toast.
          const current: () => boolean = (): boolean =>
            !store._lifecycle.destroyed && store._dialog() === dialog && !moved();
          if (!current()) {
            if (!store._lifecycle.destroyed && store._dialog() === dialog) setInviteOpen(false);
            return;
          }
          patchState(store, { _sending: dialog });
          const changes: Subscription = store._pin.organizationChanges.subscribe((): void => {
            switched = true;
          });
          // Addresses a batch settled (invited, already invited or already a member), in lower
          // case: never sent again. Every other address of the list stays in the dialog.
          const settled: Set<string> = new Set<string>();
          const send: InviteSend = { invited: 0, skipped: 0, notSent: 0, refusal: null };
          let uncertain: boolean = false;
          let dropped: boolean = false;
          let recorded: boolean = false;
          for (let start: number = 0; start < emails.length; start += INVITE_BATCH_SIZE) {
            // Never sent to another organization; a destroyed host does not stop the batches the
            // person asked for.
            if (moved()) break;
            const batch: readonly string[] = emails.slice(start, start + INVITE_BATCH_SIZE);
            try {
              const outcome: OnboardingInvitationOutcome = await store._api.invite(batch);
              const unsent: ReadonlySet<string> = new Set(
                (outcome.notSent ?? []).map((email: string): string => email.toLowerCase()),
              );
              // Addresses the answer left out or gave conflicting results: as unknown as a lost
              // answer, so they stay unsent and the summary says the outcome is unknown.
              const unknown: ReadonlySet<string> = new Set(
                (outcome.unknown ?? []).map((email: string): string => email.toLowerCase()),
              );
              if (unknown.size > 0) uncertain = true;
              for (const email of batch) {
                const address: string = email.toLowerCase();
                if (!unsent.has(address) && !unknown.has(address)) settled.add(address);
              }
              send.invited += outcome.invited;
              send.notSent += unsent.size;
              send.skipped += Math.max(0, outcome.skipped - unsent.size);
              if (!recorded && !moved() && outcome.invited + outcome.alreadyInvited > 0) {
                // The invitations are out, whatever becomes of the dialog: the route's
                // `OnboardingStore` records the marker for the organization they went to (never
                // for one shown since), and a failed write stays owed there, surviving a shell
                // change, for this store's refresh occasions. It is not awaited: a slow marker
                // write never holds the next batches back.
                recorded = true;
                void store._onboarding.recordInvitation().catch((): undefined => undefined);
              }
            } catch (error: unknown) {
              if (isDroppedOrganizationWrite(error)) {
                dropped = true;
                break;
              }
              if (isUnknownWriteOutcome(error)) {
                uncertain = true;
                continue;
              }
              // A definite refusal (a daily limit, a role) would refuse the next batches too.
              send.refusal = error;
              break;
            }
          }
          changes.unsubscribe();
          if (store._sending() === dialog) patchState(store, { _sending: null });
          // Another organization is shown: nothing about this one is said there.
          if (moved()) return;
          const kept: readonly string[] = emails.filter(
            (email: string): boolean => !settled.has(email.toLowerCase()),
          );
          if (store._lifecycle.destroyed) {
            if (!dropped) toastDetached(send, kept.length);
            return;
          }
          if (!current()) return;
          if (dropped) {
            setInviteOpen(false);
            return;
          }
          if (kept.length === 0 && !uncertain) {
            toastOutcome({ invited: send.invited, skipped: send.skipped });
            setInviteOpen(false);
            return;
          }
          toastKept(send, uncertain);
          patchState(store, { inviteKept: kept });
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._onboarding.load();
        // The route's progress may be older than this host (a task created in a settings shell):
        // read it again when it already shows a checklist waiting for the first task, or failed,
        // and record an invitation marker still owed.
        void store._refresh();
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
            void store._refresh(true);
          });
      },
      onDestroy(store): void {
        store._lifecycle.destroyed = true;
        store._clearTrailingRead();
        store._overlay.close(ONBOARDING_INVITE_DIALOG_OVERLAY);
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
 * set or the first read failed (no realtime fact exists, gap G8). While the checklist applies, the
 * tab showing again also reads it once `firstTaskCreated` is set, at most once every 30 seconds,
 * so a change made in another tab shows; it never polls. An organization change closes
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
