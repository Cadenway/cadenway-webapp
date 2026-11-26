import { DestroyRef, inject, type ResourceStatus, type Signal, type Type } from '@angular/core';
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

import { type ApiProblem, readProblem } from '@core/api';

import { SpaceStatusesApi } from '../../data-access/services/space-statuses-api/space-statuses-api.service';
import type { StatusKey } from '../../models/list-view-config/list-view-config.interface';
import type { SpaceDetails, SpaceStatusOption } from '../../models/space/space.interface';
import type {
  SpaceStatusChange,
  SpaceStatusesChange,
} from '../../models/space-status-change/space-status-change.interface';
import { ListPageStore } from '../list-page/list-page.store';
import { SpacesNavigationStore } from '../spaces-navigation/spaces-navigation.store';

/**
 * Constant REQUIRED_STATUSES
 *
 * @description
 * The statuses a space always uses (`ST_REQUIRED` of `App.dc.html` line 3634); the gateway refuses
 * to hide them (`422 space.status-required`).
 *
 * @type {ReadonlySet<StatusKey>}
 */
export const REQUIRED_STATUSES: ReadonlySet<StatusKey> = new Set<StatusKey>(['todo', 'done']);

/**
 * Constant STATUS_NAME_MAX
 *
 * @description
 * Longest status name the contract accepts, in characters, after trimming.
 *
 * @type {number}
 */
export const STATUS_NAME_MAX: number = 24;

/**
 * Type SpaceStatusesOutcome
 *
 * @description
 * How a change ended: `saved` (recorded, or found recorded by the read that follows an unknown
 * outcome, or a change that needed no write), `refused` (refused by the gateway, or not found by
 * that read: the recorded value shows again) or `unknown` (no answer and the read failed too: the
 * recorded value shows again until the space is read).
 *
 * @type {'saved' | 'refused' | 'unknown'}
 */
export type SpaceStatusesOutcome = 'saved' | 'refused' | 'unknown';

/**
 * Interface StatusEdit
 *
 * @description
 * A change shown at once and not confirmed yet: one status, or every status for a reset.
 */
interface StatusEdit {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The status changed, or null for `Reset to defaults`.
   *
   * @type {StatusKey | null}
   * @readonly
   */
  readonly key: StatusKey | null;

  /**
   * Property change
   *
   * @description
   * What changes in that status; empty for a reset.
   *
   * @type {SpaceStatusChange}
   * @readonly
   */
  readonly change: SpaceStatusChange;
  // #endregion
}

/**
 * Interface SpaceStatusesState
 *
 * @description
 * The statuses of the space the dialog edits, as recorded, and the edits in flight or queued.
 */
interface SpaceStatusesState {
  // #region Properties
  /**
   * Property spaceId
   *
   * @description
   * The space followed, or null before the dialog binds one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly spaceId: string | null;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may change the space's statuses (`edit` on the space).
   *
   * @type {boolean}
   * @readonly
   */
  readonly canEdit: boolean;

  /**
   * Property _version
   *
   * @description
   * Version of the statuses recorded, sent as `If-Match` by the next write.
   *
   * @type {number}
   * @readonly
   */
  readonly _version: number;

  /**
   * Property _confirmed
   *
   * @description
   * The statuses as last recorded, in workflow order.
   *
   * @type {readonly SpaceStatusOption[]}
   * @readonly
   */
  readonly _confirmed: readonly SpaceStatusOption[];

  /**
   * Property _edits
   *
   * @description
   * The edits shown over the recorded statuses, oldest first, until the gateway answers.
   *
   * @type {readonly StatusEdit[]}
   * @readonly
   */
  readonly _edits: readonly StatusEdit[];
  // #endregion
}

/**
 * Interface SpaceStatusesStoreInstance
 *
 * @description
 * The names and use of a space's statuses, changed optimistically and written one after the other.
 */
export interface SpaceStatusesStoreInstance {
  // #region Properties
  /**
   * Property spaceId
   *
   * @description
   * The space followed.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly spaceId: Signal<string | null>;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may change the statuses.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canEdit: Signal<boolean>;

  /**
   * Property statuses
   *
   * @description
   * The ten statuses as shown: recorded, with the pending edits applied in order.
   *
   * @type {Signal<readonly SpaceStatusOption[]>}
   * @readonly
   */
  readonly statuses: Signal<readonly SpaceStatusOption[]>;

  /**
   * Property usedCount
   *
   * @description
   * Statuses shown as used (`N statuses used out of 10`).
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly usedCount: Signal<number>;

  /**
   * Property saving
   *
   * @description
   * Whether an edit is in flight or queued.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly saving: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method follow
   *
   * @description
   * Follows the space of the dialog. Another space starts over from its statuses; a newer read of
   * the same space replaces the recorded statuses only while no edit is pending, so a refresh
   * never overwrites a change being written.
   *
   * @param {Signal<SpaceDetails | null> | SpaceDetails | null} space - The space, or null.
   */
  follow(space: Signal<SpaceDetails | null> | SpaceDetails | null): void;

  /**
   * Method rename
   *
   * @description
   * Renames a status at once, then records it. The name is trimmed and cut to 24 characters; an
   * empty name puts back the default label. A name equal to the one shown sends nothing.
   *
   * @param {StatusKey} key - The status.
   * @param {string} name - The name typed.
   * @returns {Promise<SpaceStatusesOutcome>} How it ended; the recorded name shows again unless
   * `saved`.
   */
  rename(key: StatusKey, name: string): Promise<SpaceStatusesOutcome>;

  /**
   * Method setUsed
   *
   * @description
   * Uses a status again or stops using it, at once, then records it. `todo` and `done` stay used.
   *
   * @param {StatusKey} key - The status.
   * @param {boolean} used - Whether the space uses it.
   * @returns {Promise<SpaceStatusesOutcome>} How it ended; the recorded state shows again unless
   * `saved`.
   */
  setUsed(key: StatusKey, used: boolean): Promise<SpaceStatusesOutcome>;

  /**
   * Method reset
   *
   * @description
   * Puts back every default name and uses every status again (`Reset to defaults`), at once, then
   * records it. Statuses already at their defaults send nothing.
   *
   * @returns {Promise<SpaceStatusesOutcome>} How it ended; the recorded values show again unless
   * `saved`.
   */
  reset(): Promise<SpaceStatusesOutcome>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * No space followed.
 *
 * @type {SpaceStatusesState}
 */
const initialState: SpaceStatusesState = {
  spaceId: null,
  canEdit: false,
  _version: 0,
  _confirmed: [],
  _edits: [],
};

/**
 * Function applyEdit
 *
 * @description
 * The statuses with one edit applied.
 *
 * @param {readonly SpaceStatusOption[]} statuses - The statuses before the edit.
 * @param {StatusEdit} edit - The edit.
 * @returns {readonly SpaceStatusOption[]} The statuses after it.
 */
function applyEdit(
  statuses: readonly SpaceStatusOption[],
  edit: StatusEdit,
): readonly SpaceStatusOption[] {
  return statuses.map((status: SpaceStatusOption): SpaceStatusOption => {
    if (edit.key === null) return { key: status.key, name: null, hidden: false };
    if (status.key !== edit.key) return status;
    return {
      key: status.key,
      name: edit.change.name === undefined ? status.name : edit.change.name,
      hidden: edit.change.hidden ?? status.hidden,
    };
  });
}

/**
 * Function isRefusal
 *
 * @description
 * Whether a failed write was refused for sure: a 4xx answer with a problem code. A network failure
 * (status 0), a timeout, a 5xx or an answer without a code leaves the outcome unknown.
 *
 * @param {unknown} error - The failure.
 * @returns {boolean} Whether the gateway refused the write.
 */
function isRefusal(error: unknown): boolean {
  const problem: ApiProblem | null = readProblem(error);
  return problem !== null && problem.code !== null && problem.status >= 400 && problem.status < 500;
}

/**
 * Function reached
 *
 * @description
 * Whether recorded statuses hold what an edit asked for.
 *
 * @param {readonly SpaceStatusOption[]} statuses - The statuses as recorded.
 * @param {StatusEdit} edit - The edit.
 * @returns {boolean} Whether the edit is recorded.
 */
function reached(statuses: readonly SpaceStatusOption[], edit: StatusEdit): boolean {
  if (edit.key === null) {
    return statuses.every(
      (status: SpaceStatusOption): boolean => status.name === null && !status.hidden,
    );
  }
  const status: SpaceStatusOption | undefined = statuses.find(
    (item: SpaceStatusOption): boolean => item.key === edit.key,
  );
  return (
    status !== undefined &&
    (edit.change.name === undefined || status.name === edit.change.name) &&
    (edit.change.hidden === undefined || status.hidden === edit.change.hidden)
  );
}

/**
 * Function createSpaceStatusesStore
 *
 * @description
 * Creates the space statuses store.
 *
 * @returns {Type<SpaceStatusesStoreInstance>} Injectable store constructor.
 */
function createSpaceStatusesStore(): Type<SpaceStatusesStoreInstance> {
  return signalStore(
    withState(initialState),
    withComputed((store) => ({
      statuses: (): readonly SpaceStatusOption[] =>
        store._edits().reduce(applyEdit, store._confirmed()),
      saving: (): boolean => store._edits().length > 0,
    })),
    withComputed((store) => ({
      usedCount: (): number =>
        store.statuses().filter((status: SpaceStatusOption): boolean => !status.hidden).length,
    })),
    withProps(() => ({
      _api: inject(SpaceStatusesApi),
      _listPage: inject(ListPageStore),
      _navigation: inject(SpacesNavigationStore),
      _destroyRef: inject(DestroyRef),
    })),
    withMethods((store) => {
      // Writes run one after the other, each from the version the previous one recorded. An
      // accepted edit is always sent, even once the dialog or the page is gone: only the updates
      // of the shown state wait for the store to be alive.
      let queue: Promise<unknown> = Promise.resolve();
      // The last version known of each space written, for an edit whose space is no longer shown.
      const versions: Map<string, number> = new Map<string, number>();
      // Writes sent since the reads were last refreshed.
      let unsettled: number = 0;
      let running: number = 0;
      // A list page read was in flight when the writes ended: it is read once more after it.
      let spaceReloadQueued: boolean = false;
      const alive: () => boolean = (): boolean => !store._destroyRef.destroyed;
      // Once the last write ends, the list page and the sidebar read the space again, so the
      // status words, the hidden groups and the version `Edit the space` sends follow. Both run
      // after the dialog is gone too; a destroyed resource ignores the reload.
      const settle: () => void = (): void => {
        if (running > 0 || unsettled === 0) return;
        unsettled = 0;
        if (!store._listPage.space.reload() && store._listPage.space.isLoading()) {
          spaceReloadQueued = true;
        }
        store._navigation.refresh();
      };
      const write: (
        edit: StatusEdit,
        change: SpaceStatusesChange,
      ) => Promise<SpaceStatusesOutcome> = (
        edit: StatusEdit,
        change: SpaceStatusesChange,
      ): Promise<SpaceStatusesOutcome> => {
        const spaceId: string | null = store.spaceId();
        if (spaceId === null || !store.canEdit()) return Promise.resolve('refused');
        patchState(store, { _edits: [...store._edits(), edit] });
        running++;
        const shown: () => boolean = (): boolean => alive() && store.spaceId() === spaceId;
        // Ends the edit: drops it from the shown edits and takes the space as recorded, if known.
        const close: (recorded: SpaceDetails | null) => void = (
          recorded: SpaceDetails | null,
        ): void => {
          if (recorded !== null) versions.set(spaceId, recorded.version);
          if (!shown()) return;
          patchState(store, {
            ...(recorded === null
              ? {}
              : {
                  _version: recorded.version,
                  _confirmed: recorded.statuses,
                  canEdit: recorded.canEdit,
                }),
            _edits: store._edits().filter((item: StatusEdit): boolean => item !== edit),
          });
        };
        const run: Promise<SpaceStatusesOutcome> = queue.then(
          async (): Promise<SpaceStatusesOutcome> => {
            const version: number = shown()
              ? store._version()
              : (versions.get(spaceId) ?? store._version());
            unsettled++;
            try {
              close(await store._api.update(spaceId, version, change));
              return 'saved';
            } catch (error: unknown) {
              if (isRefusal(error)) {
                close(null);
                return 'refused';
              }
            }
            // No answer: the space read again tells whether the write was recorded, and gives the
            // version the next edits are sent from.
            try {
              const recorded: SpaceDetails = await store._api.read(spaceId);
              close(recorded);
              return reached(recorded.statuses, edit) ? 'saved' : 'refused';
            } catch {
              close(null);
              return 'unknown';
            }
          },
        );
        queue = run.finally((): void => {
          running--;
          settle();
        });
        return run;
      };
      return {
        _flushSpaceReload: signalMethod<ResourceStatus>((status: ResourceStatus): void => {
          if (status === 'loading' || !spaceReloadQueued) return;
          spaceReloadQueued = false;
          store._listPage.space.reload();
        }),
        follow: signalMethod<SpaceDetails | null>((space: SpaceDetails | null): void => {
          if (space === null) return;
          if (space.id !== store.spaceId()) {
            versions.set(space.id, space.version);
            patchState(store, {
              spaceId: space.id,
              canEdit: space.canEdit,
              _version: space.version,
              _confirmed: space.statuses,
              _edits: [],
            });
            return;
          }
          if (store._edits().length > 0 || space.version < store._version()) return;
          versions.set(space.id, space.version);
          patchState(store, {
            canEdit: space.canEdit,
            _version: space.version,
            _confirmed: space.statuses,
          });
        }),
        rename(key: StatusKey, name: string): Promise<SpaceStatusesOutcome> {
          const trimmed: string = name.trim().slice(0, STATUS_NAME_MAX).trim();
          const next: string | null = trimmed === '' ? null : trimmed;
          const status: SpaceStatusOption | undefined = store
            .statuses()
            .find((item: SpaceStatusOption): boolean => item.key === key);
          if (!status || status.name === next) return Promise.resolve('saved');
          return write({ key, change: { name: next } }, { [key]: { name: next } });
        },
        setUsed(key: StatusKey, used: boolean): Promise<SpaceStatusesOutcome> {
          if (REQUIRED_STATUSES.has(key)) return Promise.resolve('saved');
          const status: SpaceStatusOption | undefined = store
            .statuses()
            .find((item: SpaceStatusOption): boolean => item.key === key);
          if (!status || status.hidden === !used) return Promise.resolve('saved');
          return write({ key, change: { hidden: !used } }, { [key]: { hidden: !used } });
        },
        reset(): Promise<SpaceStatusesOutcome> {
          const changed: boolean = store
            .statuses()
            .some((status: SpaceStatusOption): boolean => status.name !== null || status.hidden);
          if (!changed) return Promise.resolve('saved');
          return write({ key: null, change: {} }, null);
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._flushSpaceReload(store._listPage.space.status);
      },
    }),
  );
}

/**
 * Constant SpaceStatusesStore
 *
 * @description
 * The statuses of a space in the `Space statuses` dialog, provided by the dialog. Each rename,
 * switch and reset shows at once and is written through `updateSpace`'s `statuses` member, one
 * write after the other from the version the previous one recorded (`If-Match`). An accepted edit
 * is sent even after the dialog or the page is destroyed. A refusal (a 4xx with a problem code)
 * takes back its own edit only. Without an answer (network, timeout, 5xx) the space is read again
 * before the next edit: the edit counts as saved when that read holds it, else it is taken back,
 * and the next edits are sent from the version read. Once the last write ends, the list page's
 * space (once more after a read in flight) and the sidebar are read again, even after teardown. A
 * newer read of the space received while no edit is pending replaces the statuses.
 *
 * @type {ReturnType<typeof createSpaceStatusesStore>}
 */
export const SpaceStatusesStore: ReturnType<typeof createSpaceStatusesStore> =
  createSpaceStatusesStore();
