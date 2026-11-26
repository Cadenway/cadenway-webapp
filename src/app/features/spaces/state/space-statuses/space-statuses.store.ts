import { DestroyRef, inject, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

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
   * @returns {Promise<boolean>} Whether the change was recorded or needed no write; false when
   * refused, the status then showing its recorded name again.
   */
  rename(key: StatusKey, name: string): Promise<boolean>;

  /**
   * Method setUsed
   *
   * @description
   * Uses a status again or stops using it, at once, then records it. `todo` and `done` stay used.
   *
   * @param {StatusKey} key - The status.
   * @param {boolean} used - Whether the space uses it.
   * @returns {Promise<boolean>} Whether the change was recorded or needed no write; false when
   * refused, the switch then showing the recorded state again.
   */
  setUsed(key: StatusKey, used: boolean): Promise<boolean>;

  /**
   * Method reset
   *
   * @description
   * Puts back every default name and uses every status again (`Reset to defaults`), at once, then
   * records it. Statuses already at their defaults send nothing.
   *
   * @returns {Promise<boolean>} Whether the change was recorded or needed no write; false when
   * refused, the statuses then showing their recorded values again.
   */
  reset(): Promise<boolean>;
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
      // Writes run one after the other, each from the version the previous one recorded.
      let queue: Promise<unknown> = Promise.resolve();
      // The last version known of each space written, for an edit whose space is no longer shown.
      const versions: Map<string, number> = new Map<string, number>();
      // Writes sent since the reads were last refreshed.
      let unsettled: number = 0;
      let running: number = 0;
      const alive: () => boolean = (): boolean => !store._destroyRef.destroyed;
      // Once the last write ends, the list page and the sidebar read the space again, so the
      // status words, the hidden groups and the version `Edit the space` sends follow.
      const settle: () => void = (): void => {
        if (running > 0 || unsettled === 0 || !alive()) return;
        unsettled = 0;
        store._listPage.space.reload();
        store._navigation.refresh();
      };
      const write: (edit: StatusEdit, change: SpaceStatusesChange) => Promise<boolean> = (
        edit: StatusEdit,
        change: SpaceStatusesChange,
      ): Promise<boolean> => {
        const spaceId: string | null = store.spaceId();
        if (spaceId === null || !store.canEdit()) return Promise.resolve(false);
        patchState(store, { _edits: [...store._edits(), edit] });
        running++;
        const shown: () => boolean = (): boolean => alive() && store.spaceId() === spaceId;
        const drop: () => void = (): void => {
          if (shown()) {
            patchState(store, {
              _edits: store._edits().filter((item: StatusEdit): boolean => item !== edit),
            });
          }
        };
        const run: Promise<boolean> = queue.then(async (): Promise<boolean> => {
          if (!alive()) return false;
          const version: number = shown()
            ? store._version()
            : (versions.get(spaceId) ?? store._version());
          unsettled++;
          try {
            const recorded: SpaceDetails = await store._api.update(spaceId, version, change);
            versions.set(spaceId, recorded.version);
            if (shown()) {
              patchState(store, {
                _version: recorded.version,
                _confirmed: recorded.statuses,
                canEdit: recorded.canEdit,
                _edits: store._edits().filter((item: StatusEdit): boolean => item !== edit),
              });
            }
            return true;
          } catch {
            drop();
            return false;
          }
        });
        queue = run.finally((): void => {
          running--;
          settle();
        });
        return run;
      };
      return {
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
        rename(key: StatusKey, name: string): Promise<boolean> {
          const trimmed: string = name.trim().slice(0, STATUS_NAME_MAX).trim();
          const next: string | null = trimmed === '' ? null : trimmed;
          const status: SpaceStatusOption | undefined = store
            .statuses()
            .find((item: SpaceStatusOption): boolean => item.key === key);
          if (!status || status.name === next) return Promise.resolve(true);
          return write({ key, change: { name: next } }, { [key]: { name: next } });
        },
        setUsed(key: StatusKey, used: boolean): Promise<boolean> {
          if (REQUIRED_STATUSES.has(key)) return Promise.resolve(true);
          const status: SpaceStatusOption | undefined = store
            .statuses()
            .find((item: SpaceStatusOption): boolean => item.key === key);
          if (!status || status.hidden === !used) return Promise.resolve(true);
          return write({ key, change: { hidden: !used } }, { [key]: { hidden: !used } });
        },
        reset(): Promise<boolean> {
          const changed: boolean = store
            .statuses()
            .some((status: SpaceStatusOption): boolean => status.name !== null || status.hidden);
          if (!changed) return Promise.resolve(true);
          return write({ key: null, change: {} }, null);
        },
      };
    }),
  );
}

/**
 * Constant SpaceStatusesStore
 *
 * @description
 * The statuses of a space in the `Space statuses` dialog, provided by the dialog. Each rename,
 * switch and reset shows at once and is written through `updateSpace`'s `statuses` member, one
 * write after the other from the version the previous one recorded (`If-Match`); a refused write
 * takes back its own edit only. Once the last write ends, the list page's space and the sidebar are
 * read again. A newer read of the space received while no edit is pending replaces the statuses.
 *
 * @type {ReturnType<typeof createSpaceStatusesStore>}
 */
export const SpaceStatusesStore: ReturnType<typeof createSpaceStatusesStore> =
  createSpaceStatusesStore();
