import { DestroyRef, inject } from '@angular/core';
import type { ResourceLoaderParams, Signal, Type } from '@angular/core';
import { takeUntilDestroyed, rxResource } from '@angular/core/rxjs-interop';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import type { SignalMethod } from '@ngrx/signals';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';

import { BOARD_PAGE_SIZE } from '../../constants/sprint-board/sprint-board.constants';
import { SprintBoardApi } from '../../data-access/services/sprint-board/sprint-board.service';
import {
  allowsBoardStatus,
  BoardOrganizationChanged,
} from '../../models/sprint-board/sprint-board.model';
import type {
  BoardCard,
  BoardCardPage,
  BoardColumn,
  BoardLocation,
  BoardPendingMove,
  BoardPendingMoves,
} from '../../models/sprint-board/sprint-board.model';

/**
 * Constant MOVE_DELAY
 *
 * @description
 * Lets the displayed status settle before moving the card and dispatching the patch.
 *
 * @type {number}
 */
const MOVE_DELAY: number = 460;

/**
 * Interface SprintBoardState
 *
 * @description
 * Owns the route identity and transient commands while the board is open.
 */
interface SprintBoardState {
  // #region Properties
  /**
   * Property _location
   *
   * @description
   * Verified list and organization while the view is open.
   *
   * @type {BoardLocation | undefined}
   * @readonly
   */
  readonly _location: BoardLocation | undefined;

  /**
   * Property _moves
   *
   * @description
   * Tracks the latest requested move per task.
   *
   * @type {BoardPendingMoves}
   * @readonly
   */
  readonly _moves: BoardPendingMoves;

  /**
   * Property _organizationRefused
   *
   * @description
   * Prevents the board from presenting data after a request rejects its organization.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _organizationRefused: boolean;

  /**
   * Property paging
   *
   * @description
   * Column that has a pagination request in progress.
   *
   * @type {StatusKey | null}
   * @readonly
   */
  readonly paging: StatusKey | null;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * A newly opened board has no route scope, pending command or cursor transition.
 *
 * @type {SprintBoardState}
 */
const initialState: SprintBoardState = {
  _location: undefined,
  _moves: {},
  _organizationRefused: false,
  paging: null,
};

/**
 * Function placeCard
 *
 * @description
 * Moves only the affected card between loaded columns and preserves the card page bound.
 *
 * @param {readonly BoardColumn[]} columns - Loaded pages before the move.
 * @param {StatusKey} from - Status of the snapshot used for the version check.
 * @param {BoardCard} card - Optimistic or confirmed destination data.
 * @returns {readonly BoardColumn[]} Updated columns with adjusted counts.
 */
function placeCard(
  columns: readonly BoardColumn[],
  from: StatusKey,
  card: BoardCard,
): readonly BoardColumn[] {
  return columns.map((column) => {
    if (column.status === card.status) {
      return {
        ...column,
        count: column.count + Number(from !== card.status),
        cards: [card, ...column.cards.filter((item) => item.key !== card.key)].slice(
          0,
          BOARD_PAGE_SIZE,
        ),
      };
    }
    if (column.status === from) {
      return {
        ...column,
        count: Math.max(0, column.count - 1),
        cards: column.cards.filter((item) => item.key !== card.key),
      };
    }
    return column;
  });
}

/**
 * Interface SprintBoardStoreInstance
 *
 * @description
 * Public board data and actions consumed by the sprint view.
 */
interface SprintBoardStoreInstance {
  // #region Properties
  /**
   * Property columns
   *
   * @description
   * Current bounded card pages with optimistic placements.
   *
   * @type {Signal<readonly BoardColumn[]>}
   * @readonly
   */
  readonly columns: Signal<readonly BoardColumn[]>;

  /**
   * Property moves
   *
   * @description
   * Selected target until the matching command settles.
   *
   * @type {Signal<BoardPendingMoves>}
   * @readonly
   */
  readonly moves: Signal<BoardPendingMoves>;

  /**
   * Property hasPendingMoves
   *
   * @description
   * Blocks cursor changes during a pending mutation.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasPendingMoves: Signal<boolean>;

  /**
   * Property loading
   *
   * @description
   * True while the current board is being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property loadError
   *
   * @description
   * Indicates that the active board could not be read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loadError: Signal<boolean>;

  /**
   * Property organizationChanged
   *
   * @description
   * Requires the caller to reopen the workspace before using this board again.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly organizationChanged: Signal<boolean>;

  /**
   * Property paging
   *
   * @description
   * The group awaiting its next cursor page.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  readonly paging: Signal<StatusKey | null>;

  /**
   * Property connect
   *
   * @description
   * Binds the store to the page's resolved list.
   *
   * @type {SignalMethod<BoardLocation | undefined>}
   * @readonly
   */
  readonly connect: SignalMethod<BoardLocation | undefined>;
  // #endregion

  // #region Methods
  /**
   * Method reload
   *
   * @description
   * Retries the current board query.
   */
  reload(): void;

  /**
   * Method loadPage
   *
   * @description
   * Replaces one bounded status page.
   *
   * @param {StatusKey} status - The column that owns the cursor.
   * @param {string} [cursor] - The opaque continuation.
   * @returns {Promise<void>} Resolves after the page is loaded or its failure is displayed.
   */
  loadPage(status: StatusKey, cursor?: string): Promise<void>;

  /**
   * Method move
   *
   * @description
   * Selects the latest ordinary status for a card.
   *
   * @param {string} key - The visible task key.
   * @param {StatusKey | null} status - The selected target status.
   */
  move(key: string, status: StatusKey | null): void;
  // #endregion
}

/**
 * Function createSprintBoardStore
 *
 * @description
 * Keeps the board resource, versioned changes and undo within one page scope.
 *
 * @returns {Type<SprintBoardStoreInstance>} Provider for the sprint board.
 */
function createSprintBoardStore(): Type<SprintBoardStoreInstance> {
  return signalStore(
    withState(initialState),
    withComputed((store) => ({
      moves: () => store._moves(),
      hasPendingMoves: () => Object.keys(store._moves()).length > 0,
    })),
    withProps((store, api = inject(SprintBoardApi)) => ({
      _board: rxResource<readonly BoardColumn[], BoardLocation | undefined>({
        params: () => store._location(),
        stream: ({ params }: ResourceLoaderParams<BoardLocation | undefined>) => api.load(params),
      }),
    })),
    withComputed((store) => ({
      loading: () => store._board.isLoading(),
      loadError: () => store._board.error() !== undefined,
      organizationChanged: () =>
        store._organizationRefused() || store._board.error() instanceof BoardOrganizationChanged,
      columns: () => {
        if (store._organizationRefused()) return [];
        const columns: readonly BoardColumn[] = store._board.hasValue() ? store._board.value() : [];
        return Object.values(store._moves()).reduce(
          (view, move) =>
            move?.writing
              ? placeCard(view, move.card.status, { ...move.card, status: move.status })
              : view,
          columns,
        );
      },
    })),
    withMethods(
      (
        store,
        api = inject(SprintBoardApi),
        toasts = inject(CwToastService),
        destroyRef = inject(DestroyRef),
      ) => {
        const scopeChanges: Subject<void> = new Subject<void>();
        const timers: Map<string, ReturnType<typeof setTimeout>> = new Map<
          string,
          ReturnType<typeof setTimeout>
        >();
        const clearTimers: () => void = () => {
          timers.forEach((timer) => {
            clearTimeout(timer);
          });
          timers.clear();
        };
        destroyRef.onDestroy(() => {
          scopeChanges.complete();
          clearTimers();
        });

        const clearMove: (key: string) => void = (key) => {
          const moves: BoardPendingMoves = Object.fromEntries(
            Object.entries(store._moves()).filter(
              ([taskKey]: [string, BoardPendingMove | undefined]) => taskKey !== key,
            ),
          );
          patchState(store, { _moves: moves });
        };

        const showRefusal: () => void = () => {
          toasts.error('Impossible de modifier le statut', { duration: 6000 });
        };

        const isCurrent: (location: BoardLocation) => boolean = (location) =>
          store._location() === location && !destroyRef.destroyed && !store.organizationChanged();

        const refuseOrganization: () => void = () => {
          patchState(store, { _organizationRefused: true, _moves: {}, paging: null });
          store._board.set(undefined);
          scopeChanges.next();
          clearTimers();
          toasts.dismiss();
        };

        const commitMove: (
          location: BoardLocation,
          move: BoardPendingMove,
          showUndo: boolean,
        ) => Promise<void> = async (location, move, showUndo) => {
          if (!isCurrent(location)) return;
          patchState(store, {
            _moves: { ...store._moves(), [move.card.key]: { ...move, writing: true } },
          });
          try {
            const confirmed: BoardCard = await firstValueFrom(
              api
                .changeStatus(location, move.card, move.status)
                .pipe(takeUntil(scopeChanges), takeUntilDestroyed(destroyRef)),
            );
            if (!isCurrent(location)) return;
            store._board.update(
              (columns) => columns && placeCard(columns, move.card.status, confirmed),
            );
            if (showUndo) {
              const label: string | undefined = store
                .columns()
                .find((column) => column.status === confirmed.status)?.label;
              toasts.success(`${confirmed.key} déplacée`, {
                description: `Statut : ${label ?? confirmed.status}.`,
                undo: () => {
                  if (!isCurrent(location)) return;
                  if (
                    store._moves()[confirmed.key] ||
                    store.paging() ||
                    !allowsBoardStatus(confirmed, move.card.status)
                  ) {
                    showRefusal();
                    return;
                  }
                  void commitMove(
                    location,
                    { card: confirmed, status: move.card.status, writing: false },
                    false,
                  );
                },
                duration: 6000,
              });
            }
          } catch (error) {
            if (isCurrent(location)) {
              if (error instanceof BoardOrganizationChanged) refuseOrganization();
              else showRefusal();
            }
          } finally {
            if (isCurrent(location)) {
              clearMove(move.card.key);
              if (!Object.keys(store._moves()).length) store._board.reload();
            }
          }
        };

        return {
          connect: signalMethod<BoardLocation | undefined>((location) => {
            scopeChanges.next();
            clearTimers();
            toasts.dismiss();
            patchState(store, { ...initialState, _location: location });
          }),
          reload(): void {
            store._board.reload();
          },
          async loadPage(status: StatusKey, cursor?: string): Promise<void> {
            const location: BoardLocation | undefined = store._location();
            if (
              !location ||
              !isCurrent(location) ||
              store.loading() ||
              store.paging() ||
              Object.keys(store._moves()).length
            )
              return;
            patchState(store, { paging: status });
            try {
              const page: BoardCardPage = await firstValueFrom(
                api
                  .loadPage(location, status, cursor)
                  .pipe(takeUntil(scopeChanges), takeUntilDestroyed(destroyRef)),
              );
              if (!isCurrent(location)) return;
              store._board.update((columns) =>
                columns?.map((column) =>
                  column.status === status
                    ? { ...column, ...page, hasPreviousPage: cursor !== undefined }
                    : column,
                ),
              );
            } catch (error) {
              if (isCurrent(location)) {
                if (error instanceof BoardOrganizationChanged) refuseOrganization();
                else {
                  toasts.error('Impossible de charger les tâches', { duration: 6000 });
                  store._board.reload();
                }
              }
            } finally {
              if (isCurrent(location)) patchState(store, { paging: null });
            }
          },
          move(key: string, status: StatusKey | null): void {
            const location: BoardLocation | undefined = store._location();
            const pending: BoardPendingMove | undefined = store._moves()[key];
            if (
              !location?.mayEdit ||
              !isCurrent(location) ||
              !status ||
              pending?.writing ||
              store.paging() ||
              store.loading()
            )
              return;

            const columns: readonly BoardColumn[] = store._board.hasValue()
              ? store._board.value()
              : [];
            const card: BoardCard | undefined = columns
              .flatMap((column) => column.cards)
              .find((task) => task.key === key);
            if (
              !card ||
              !allowsBoardStatus(card, status) ||
              !columns.some((column) => column.status === status)
            )
              return;

            clearTimeout(timers.get(key));
            timers.delete(key);
            if (card.status === status) {
              clearMove(key);
              return;
            }

            const move: BoardPendingMove = { card, status, writing: false };
            patchState(store, { _moves: { ...store._moves(), [key]: move } });
            timers.set(
              key,
              setTimeout(() => {
                timers.delete(key);
                void commitMove(location, move, true);
              }, MOVE_DELAY),
            );
          },
        };
      },
    ),
  );
}

/**
 * Constant SprintBoardStore
 *
 * @description
 * Provides a fresh board resource and command state for each board page.
 *
 * @type {Type<SprintBoardStoreInstance>}
 */
export const SprintBoardStore: Type<SprintBoardStoreInstance> = createSprintBoardStore();
