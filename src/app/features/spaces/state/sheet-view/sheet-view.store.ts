import {
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
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
import { merge } from 'rxjs';

import { type TaskBulkEntry, TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { SheetTasksApi } from '../../data-access/services/sheet-tasks-api/sheet-tasks-api.service';
import type { ListMember } from '../../models/list-member/list-member.interface';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import type {
  ListGroupBy,
  ListViewPresentation,
  SheetColumn,
} from '../../models/list-view-config/list-view-config.interface';
import type {
  SheetColumnKey,
  SheetCustomField,
  SheetFactChanges,
  SheetFieldValue,
  SheetOrder,
  SheetRow,
  SheetTaskFacts,
  SheetTotals,
} from '../../models/sheet-view/sheet-view.interface';
import type { ViewTaskOutcome } from '../../models/view-task-write/view-task-write.interface';
import {
  collapsedGroupsOf,
  fieldIdOf,
  groupSheetRows,
  isTableColumn,
  presentationOfOrder,
  sheetOrderOf,
  sheetTotals,
  type SheetGroups,
  sortSheetRows,
} from '../../utils/sheet-view/sheet-view.util';
import { ListPageStore } from '../list-page/list-page.store';
import { ListTasksStore, type ListTasksStoreInstance } from '../list-tasks/list-tasks.store';
import { ListViewStore } from '../list-view/list-view.store';

/**
 * Constant SPENT_CONCURRENCY
 *
 * @description
 * Time summaries read at the same time (gap G6: one `getTaskTimeSummary` per shown row).
 *
 * @type {number}
 */
export const SPENT_CONCURRENCY: number = 4;

/**
 * Interface FactEdit
 *
 * @description
 * An estimate or custom field edit of the sheet: shown while pending, then until a read of the
 * task reaches the version the gateway returned (or, without one, until the next read of the
 * task); removed when the write is refused or its outcome is uncertain.
 */
interface FactEdit {
  // #region Properties
  /**
   * Property seq
   *
   * @description
   * Sequence number of the edit.
   *
   * @type {number}
   * @readonly
   */
  readonly seq: number;

  /**
   * Property pending
   *
   * @description
   * Whether the write is not answered yet.
   *
   * @type {boolean}
   * @readonly
   */
  readonly pending: boolean;

  /**
   * Property until
   *
   * @description
   * Once confirmed, the version the gateway returned; null when it returned none.
   *
   * @type {number | null}
   * @readonly
   */
  readonly until: number | null;

  /**
   * Property changes
   *
   * @description
   * The edited values.
   *
   * @type {SheetFactChanges}
   * @readonly
   */
  readonly changes: SheetFactChanges;
  // #endregion
}

/**
 * Interface SheetViewState
 *
 * @description
 * The sheet's own data next to the shared reader's tasks.
 */
interface SheetViewState {
  // #region Properties
  /**
   * Property _listId
   *
   * @description
   * The list shown, null before `load`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _listId: string | null;

  /**
   * Property _facts
   *
   * @description
   * Estimate and custom field values of each task read, by key.
   *
   * @type {Readonly<Partial<Record<string, SheetTaskFacts>>>}
   * @readonly
   */
  readonly _facts: Readonly<Partial<Record<string, SheetTaskFacts>>>;

  /**
   * Property _edits
   *
   * @description
   * Edits of the sheet still shown, by task key, oldest first.
   *
   * @type {Readonly<Partial<Record<string, readonly FactEdit[]>>>}
   * @readonly
   */
  readonly _edits: Readonly<Partial<Record<string, readonly FactEdit[]>>>;

  /**
   * Property _spent
   *
   * @description
   * Time spent of each task read so far, in minutes, by key.
   *
   * @type {Readonly<Partial<Record<string, number>>>}
   * @readonly
   */
  readonly _spent: Readonly<Partial<Record<string, number>>>;

  /**
   * Property _collapsed
   *
   * @description
   * Groups the user folded, by grouping (`all` without one).
   *
   * @type {Readonly<Partial<Record<string, readonly string[]>>>}
   * @readonly
   */
  readonly _collapsed: Readonly<Partial<Record<string, readonly string[]>>>;

  /**
   * Property _spentFailed
   *
   * @description
   * Tasks whose last time summary read failed, by key; read again only on `retrySpent`.
   *
   * @type {Readonly<Partial<Record<string, true>>>}
   * @readonly
   */
  readonly _spentFailed: Readonly<Partial<Record<string, true>>>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing read.
 *
 * @type {SheetViewState}
 */
const initialState: SheetViewState = {
  _listId: null,
  _facts: {},
  _edits: {},
  _spent: {},
  _collapsed: {},
  _spentFailed: {},
};

/**
 * Function withoutKey
 *
 * @description
 * A copy of a record without one of its keys.
 *
 * @param {Readonly<Partial<Record<string, T>>>} record - The record.
 * @param {string} key - The key to leave out.
 * @returns {Readonly<Partial<Record<string, T>>>} The copy.
 */
function withoutKey<T>(
  record: Readonly<Partial<Record<string, T>>>,
  key: string,
): Readonly<Partial<Record<string, T>>> {
  const copy: Partial<Record<string, T>> = {};
  for (const [name, value] of Object.entries(record)) {
    if (name !== key) copy[name] = value;
  }
  return copy;
}

/**
 * Function withChanges
 *
 * @description
 * Applies edits to a task's facts, in their order.
 *
 * @param {Pick<SheetRow, 'estimateMinutes' | 'customFieldValues'>} facts - The read values.
 * @param {readonly FactEdit[]} edits - The edits shown.
 * @returns {Pick<SheetRow, 'estimateMinutes' | 'customFieldValues'>} The values shown.
 */
function withChanges(
  facts: Pick<SheetRow, 'estimateMinutes' | 'customFieldValues'>,
  edits: readonly FactEdit[],
): Pick<SheetRow, 'estimateMinutes' | 'customFieldValues'> {
  let estimateMinutes: number | null = facts.estimateMinutes;
  let values: Readonly<Partial<Record<string, SheetFieldValue>>> = facts.customFieldValues;
  for (const edit of edits) {
    if (edit.changes.estimateMinutes !== undefined) estimateMinutes = edit.changes.estimateMinutes;
    for (const [id, value] of Object.entries(edit.changes.customFieldValues ?? {})) {
      values = value === null ? withoutKey(values, id) : { ...values, [id]: value };
    }
  }
  return { estimateMinutes, customFieldValues: values };
}

/**
 * Interface SheetViewStoreInstance
 *
 * @description
 * Public API of `SheetViewStore`.
 */
export interface SheetViewStoreInstance {
  // #region Properties
  /**
   * Property fields
   *
   * @description
   * The read of the list's custom fields, a secondary read: a failure keeps the built-in columns
   * and shows an inline error whose Retry calls `reloadFields`.
   *
   * @type {ResourceRef<readonly SheetCustomField[] | undefined>}
   * @readonly
   */
  readonly fields: ResourceRef<readonly SheetCustomField[] | undefined>;

  /**
   * Property customFields
   *
   * @description
   * The list's custom fields in their order, empty until read.
   *
   * @type {Signal<readonly SheetCustomField[]>}
   * @readonly
   */
  readonly customFields: Signal<readonly SheetCustomField[]>;

  /**
   * Property fieldsFailed
   *
   * @description
   * Whether the custom fields could not be read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly fieldsFailed: Signal<boolean>;

  /**
   * Property order
   *
   * @description
   * The order shown, from the presentation; null for the read order.
   *
   * @type {Signal<SheetOrder | null>}
   * @readonly
   */
  readonly order: Signal<SheetOrder | null>;

  /**
   * Property rows
   *
   * @description
   * The rows of the sheet in the order shown: the reader's tasks as shown, their estimate and
   * custom field values with the sheet's edits applied, their time spent once read.
   *
   * @type {Signal<readonly SheetRow[]>}
   * @readonly
   */
  readonly rows: Signal<readonly SheetRow[]>;

  /**
   * Property totals
   *
   * @description
   * The footer's and the title's aggregates.
   *
   * @type {Signal<SheetTotals>}
   * @readonly
   */
  readonly totals: Signal<SheetTotals>;

  /**
   * Property hiddenColumns
   *
   * @description
   * The columns the presentation hides among those the sheet draws (built-in columns and the
   * list's custom fields).
   *
   * @type {Signal<readonly SheetColumnKey[]>}
   * @readonly
   */
  readonly hiddenColumns: Signal<readonly SheetColumnKey[]>;

  /**
   * Property groupBy
   *
   * @description
   * The view's grouping (`Group by`), null for none.
   *
   * @type {Signal<ListGroupBy>}
   * @readonly
   */
  readonly groupBy: Signal<ListGroupBy>;

  /**
   * Property groups
   *
   * @description
   * The table's rows in their groups, the groups' order and their counts.
   *
   * @type {Signal<SheetGroups>}
   * @readonly
   */
  readonly groups: Signal<SheetGroups>;

  /**
   * Property collapsed
   *
   * @description
   * The folded groups of the grouping shown (`Cancelled` by default under the status grouping).
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly collapsed: Signal<readonly string[]>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Follows the list: another one forgets the facts, edits and time spent of the previous one.
   *
   * @param {Signal<string> | string} listId - The list.
   */
  load(listId: Signal<string> | string): void;

  /**
   * Method reloadFields
   *
   * @description
   * Reads the custom fields again (the inline error's Retry).
   */
  reloadFields(): void;

  /**
   * Method editFacts
   *
   * @description
   * An estimate or custom field edit: starts its write at once (`write`, given the values its
   * `Undo` puts back) and shows the edit while the write runs; a confirmed edit stays until a read
   * reaches the version the gateway returned, a refused or uncertain one goes away. The values
   * given to `write` are the confirmed ones the write replaces: they are read once the earlier
   * edits of the task settle (the shared writes send them first), from what the gateway confirmed
   * (reads and confirmed edits), never from an edit still pending or refused.
   *
   * @param {string} taskKey - The task.
   * @param {SheetFactChanges} changes - The edited values.
   * @param {(previous: SheetFactChanges) => Promise<ViewTaskOutcome>} write - Starts the write
   * (`ViewTaskWritesStore.updateFields`); `previous` is read when its `Undo` runs.
   */
  editFacts(
    taskKey: string,
    changes: SheetFactChanges,
    write: (previous: SheetFactChanges) => Promise<ViewTaskOutcome>,
  ): void;

  /**
   * Method requestSpent
   *
   * @description
   * Asks for the time spent of a shown row once (its cell rendered); reads run four at a time
   * after the current rendering. A failed read is not asked again until `retrySpent`.
   *
   * @param {string} taskKey - The task.
   */
  requestSpent(taskKey: string): void;

  /**
   * Method retrySpent
   *
   * @description
   * Reads the time spent of a row whose read failed again (the cell's `Retry`).
   *
   * @param {string} taskKey - The task.
   */
  retrySpent(taskKey: string): void;

  /**
   * Method setOrder
   *
   * @description
   * Stores the sheet's order in the presentation (`sheetSort` or `customFieldSort`); null goes
   * back to the read order.
   *
   * @param {SheetOrder | null} order - The order.
   */
  setOrder(order: SheetOrder | null): void;

  /**
   * Method setColumnShown
   *
   * @description
   * Shows or hides a column in the presentation (`hiddenSheetColumns`,
   * `hiddenCustomFieldIds`); the name always shows.
   *
   * @param {SheetColumnKey} key - The column.
   * @param {boolean} shown - Whether it shows.
   */
  setColumnShown(key: SheetColumnKey, shown: boolean): void;

  /**
   * Method showAllColumns
   *
   * @description
   * `Show all`: no hidden column.
   */
  showAllColumns(): void;

  /**
   * Method setCollapsed
   *
   * @description
   * Remembers the folded groups of the grouping shown, while the view lives.
   *
   * @param {readonly string[]} values - The folded group values.
   */
  setCollapsed(values: readonly string[]): void;
  // #endregion
}

/**
 * Function createSheetViewStore
 *
 * @description
 * Creates the `Sheet` view's store.
 *
 * @returns {Type<SheetViewStoreInstance>} Injectable store constructor.
 */
function createSheetViewStore(): Type<SheetViewStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: SheetTasksApi = inject(SheetTasksApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const fields: ResourceRef<readonly SheetCustomField[] | undefined> = resource({
        params: (): { listId: string; organizationId: string } | undefined => {
          const listId: string | null = store._listId();
          return listId === null
            ? undefined
            : { listId, organizationId: workspace.organization().id };
        },
        loader: ({
          params,
          abortSignal,
        }: {
          params: { listId: string; organizationId: string };
          abortSignal: AbortSignal;
        }): Promise<readonly SheetCustomField[]> => api.customFields(params.listId, abortSignal),
      });
      return {
        _api: api,
        _tasks: inject<ListTasksStoreInstance>(ListTasksStore),
        _view: inject(ListViewStore),
        _page: inject(ListPageStore),
        _detail: inject(TaskDetailOpener),
        _destroyRef: inject(DestroyRef),
        _locale: inject(LOCALE_ID),
        _spentQueue: [] as string[],
        _spentAsked: new Set<string>(),
        _spentRunning: { count: 0, aborts: new AbortController() },
        _spentReads: new Map<string, number>(),
        _editSeq: { value: 0 },
        _editChains: new Map<string, Promise<void>>(),
        fields,
      };
    }),
    withComputed((store) => ({
      customFields: (): readonly SheetCustomField[] =>
        store.fields.hasValue() ? store.fields.value() : [],
      fieldsFailed: (): boolean => store.fields.status() === 'error',
    })),
    withComputed((store) => ({
      order: (): SheetOrder | null =>
        sheetOrderOf(store._view.presentation(), store.customFields()),
      hiddenColumns: (): readonly SheetColumnKey[] => {
        const presentation: ListViewPresentation = store._view.presentation();
        return [
          ...presentation.hiddenSheetColumns.filter(
            (column: SheetColumn): boolean => column !== 'name' && isTableColumn(column),
          ),
          ...store
            .customFields()
            .filter((field: SheetCustomField) =>
              presentation.hiddenCustomFieldIds.includes(field.id),
            )
            .map((field: SheetCustomField): SheetColumnKey => `field:${field.id}`),
        ];
      },
    })),
    withComputed((store) => {
      const names: Signal<ReadonlyMap<string, string>> = computed(
        (): ReadonlyMap<string, string> =>
          new Map(
            (store._page.organizationMembers.hasValue()
              ? store._page.organizationMembers.value()
              : []
            ).map((member: ListMember): [string, string] => [member.userId, member.name ?? '']),
          ),
      );
      const rows: Signal<readonly SheetRow[]> = computed((): readonly SheetRow[] => {
        const facts: SheetViewState['_facts'] = store._facts();
        const edits: SheetViewState['_edits'] = store._edits();
        const spent: SheetViewState['_spent'] = store._spent();
        const spentFailed: SheetViewState['_spentFailed'] = store._spentFailed();
        const read: readonly SheetRow[] = store._tasks.items().map((item: ListTaskItem) => {
          const known: SheetTaskFacts | undefined = facts[item.task.key];
          const shown: Pick<SheetRow, 'estimateMinutes' | 'customFieldValues'> = withChanges(
            {
              estimateMinutes: known?.estimateMinutes ?? null,
              customFieldValues: known?.customFieldValues ?? {},
            },
            edits[item.task.key] ?? [],
          );
          return {
            id: item.task.key,
            group: '',
            task: item.task,
            status: item.status,
            ...shown,
            spentMinutes: spent[item.task.key] ?? null,
            spentFailed: spentFailed[item.task.key] === true,
          };
        });
        const list: { id: string; name: string } | null = store._page.list.hasValue()
          ? store._page.list.value()
          : null;
        return sortSheetRows(read, store.order(), {
          locale: store._locale,
          personName: (userId: string): string => names().get(userId) ?? '',
          listName: (listId: string): string => (list?.id === listId ? list.name : ''),
        });
      });
      const groupBy: Signal<ListGroupBy> = computed(
        (): ListGroupBy => store._view.config().groupBy,
      );
      return {
        rows,
        groupBy,
        groups: (): SheetGroups => groupSheetRows(rows(), groupBy()),
        collapsed: (): readonly string[] => collapsedGroupsOf(store._collapsed(), groupBy()),
        totals: (): SheetTotals => sheetTotals(rows(), store.customFields()),
      };
    }),
    withMethods((store) => {
      const pumpSpent: () => void = (): void => {
        const running: { count: number; aborts: AbortController } = store._spentRunning;
        while (running.count < SPENT_CONCURRENCY && store._spentQueue.length > 0) {
          const key: string | undefined = store._spentQueue.shift();
          if (key === undefined) return;
          const listId: string | null = store._listId();
          const aborts: AbortController = running.aborts;
          const read: number = (store._spentReads.get(key) ?? 0) + 1;
          store._spentReads.set(key, read);
          const current: () => boolean = (): boolean =>
            !aborts.signal.aborted &&
            store._listId() === listId &&
            store._spentReads.get(key) === read;
          running.count++;
          store._api
            .spentMinutes(key, aborts.signal)
            .then(
              (minutes: number): void => {
                if (!current()) return;
                patchState(store, (state: SheetViewState) => ({
                  _spent: { ...state._spent, [key]: minutes },
                  _spentFailed: withoutKey(state._spentFailed, key),
                }));
              },
              (): void => {
                if (!current()) return;
                patchState(store, (state: SheetViewState) => ({
                  _spentFailed: { ...state._spentFailed, [key]: true as const },
                }));
              },
            )
            .finally((): void => {
              if (aborts === store._spentRunning.aborts) running.count--;
              pumpSpent();
            });
        }
      };
      const queueSpent: (keys: readonly string[]) => void = (keys: readonly string[]): void => {
        for (const key of keys) {
          if (!store._spentQueue.includes(key)) store._spentQueue.push(key);
        }
        queueMicrotask(pumpSpent);
      };
      const resetSpent: () => void = (): void => {
        store._spentRunning.aborts.abort();
        store._spentRunning.aborts = new AbortController();
        store._spentRunning.count = 0;
        store._spentQueue.length = 0;
        store._spentAsked.clear();
        store._spentReads.clear();
        store._editChains.clear();
      };
      const confirmedOf: (
        taskKey: string,
        seq: number,
        changes: SheetFactChanges,
      ) => SheetFactChanges = (
        taskKey: string,
        seq: number,
        changes: SheetFactChanges,
      ): SheetFactChanges => {
        const known: SheetTaskFacts | undefined = store._facts()[taskKey];
        const confirmed: Pick<SheetRow, 'estimateMinutes' | 'customFieldValues'> = withChanges(
          {
            estimateMinutes: known?.estimateMinutes ?? null,
            customFieldValues: known?.customFieldValues ?? {},
          },
          (store._edits()[taskKey] ?? []).filter(
            (edit: FactEdit): boolean => edit.seq < seq && !edit.pending,
          ),
        );
        const values: Record<string, SheetFieldValue | null> = {};
        for (const id of Object.keys(changes.customFieldValues ?? {})) {
          values[id] = confirmed.customFieldValues[id] ?? null;
        }
        return {
          ...(changes.estimateMinutes === undefined
            ? {}
            : { estimateMinutes: confirmed.estimateMinutes }),
          ...(changes.customFieldValues === undefined ? {} : { customFieldValues: values }),
        };
      };
      const dropEdit: (taskKey: string, seq: number) => void = (
        taskKey: string,
        seq: number,
      ): void => {
        patchState(store, (state: SheetViewState) => {
          const left: readonly FactEdit[] = (state._edits[taskKey] ?? []).filter(
            (edit: FactEdit): boolean => edit.seq !== seq,
          );
          return {
            _edits:
              left.length > 0
                ? { ...state._edits, [taskKey]: left }
                : withoutKey(state._edits, taskKey),
          };
        });
      };
      return {
        _resetSpent: resetSpent,
        _merge(batch: readonly SheetTaskFacts[]): void {
          if (batch.length === 0) return;
          patchState(store, (state: SheetViewState) => {
            let facts: SheetViewState['_facts'] = state._facts;
            let edits: SheetViewState['_edits'] = state._edits;
            for (const fact of batch) {
              const known: SheetTaskFacts | undefined = facts[fact.key];
              if (known && known.version > fact.version) continue;
              facts = { ...facts, [fact.key]: fact };
              const shown: readonly FactEdit[] | undefined = edits[fact.key];
              if (!shown) continue;
              const kept: readonly FactEdit[] = shown.filter(
                (edit: FactEdit): boolean =>
                  edit.pending || (edit.until !== null && fact.version < edit.until),
              );
              edits =
                kept.length > 0 ? { ...edits, [fact.key]: kept } : withoutKey(edits, fact.key);
            }
            return { _facts: facts, _edits: edits };
          });
        },
        _refreshSpent(): void {
          const keys: readonly string[] = Object.keys(store._spent());
          if (keys.length === 0) return;
          queueSpent(keys);
        },
        _publishFields: signalMethod<readonly SheetCustomField[] | null>(
          (fields: readonly SheetCustomField[] | null): void => {
            if (fields === null) return;
            store._view.followCustomFields(
              fields.map((field: SheetCustomField) => ({ id: field.id, name: field.name })),
            );
          },
        ),
        load: signalMethod<string>((listId: string): void => {
          if (listId === store._listId()) return;
          resetSpent();
          patchState(store, {
            _listId: listId,
            _facts: {},
            _edits: {},
            _spent: {},
            _spentFailed: {},
          });
        }),
        reloadFields(): void {
          store.fields.reload();
        },
        editFacts(
          taskKey: string,
          changes: SheetFactChanges,
          write: (previous: SheetFactChanges) => Promise<ViewTaskOutcome>,
        ): void {
          const seq: number = ++store._editSeq.value;
          const listId: string | null = store._listId();
          const earlier: Promise<void> = store._editChains.get(taskKey) ?? Promise.resolve();
          let confirmed: SheetFactChanges = {};
          const previous: SheetFactChanges = {};
          for (const name of ['estimateMinutes', 'customFieldValues'] as const) {
            if (changes[name] === undefined) continue;
            Object.defineProperty(previous, name, {
              enumerable: true,
              get: (): SheetFactChanges[typeof name] => confirmed[name],
            });
          }
          patchState(store, (state: SheetViewState) => ({
            _edits: {
              ...state._edits,
              [taskKey]: [
                ...(state._edits[taskKey] ?? []),
                { seq, pending: true, until: null, changes },
              ],
            },
          }));
          const result: Promise<ViewTaskOutcome> = write(previous);
          const captured: Promise<void> = earlier.then((): void => {
            confirmed = confirmedOf(taskKey, seq, changes);
          });
          const settled: Promise<void> = result.then(
            (outcome: ViewTaskOutcome): void => {
              if (store._destroyRef.destroyed || store._listId() !== listId) return;
              const done: TaskBulkEntry | undefined = outcome.done.find(
                (entry: TaskBulkEntry): boolean => entry.taskKey === taskKey,
              );
              if (!done) {
                dropEdit(taskKey, seq);
                return;
              }
              const read: SheetTaskFacts | undefined = store._facts()[taskKey];
              if (done.version !== null && read && read.version >= done.version) {
                dropEdit(taskKey, seq);
                return;
              }
              patchState(store, (state: SheetViewState) => ({
                _edits: {
                  ...state._edits,
                  [taskKey]: (state._edits[taskKey] ?? []).map((edit: FactEdit): FactEdit =>
                    edit.seq === seq ? { ...edit, pending: false, until: done.version } : edit,
                  ),
                },
              }));
            },
            (): void => {
              if (!store._destroyRef.destroyed) dropEdit(taskKey, seq);
            },
          );
          const tail: Promise<void> = Promise.all([captured, settled]).then((): void => undefined);
          store._editChains.set(taskKey, tail);
          void tail.then((): void => {
            if (store._editChains.get(taskKey) === tail) store._editChains.delete(taskKey);
          });
        },
        requestSpent(taskKey: string): void {
          if (store._spentAsked.has(taskKey)) return;
          store._spentAsked.add(taskKey);
          queueSpent([taskKey]);
        },
        retrySpent(taskKey: string): void {
          patchState(store, (state: SheetViewState) => ({
            _spentFailed: withoutKey(state._spentFailed, taskKey),
          }));
          store._spentAsked.add(taskKey);
          queueSpent([taskKey]);
        },
        setOrder(order: SheetOrder | null): void {
          store._view.setPresentation(presentationOfOrder(order));
        },
        setColumnShown(key: SheetColumnKey, shown: boolean): void {
          const presentation: ListViewPresentation = store._view.presentation();
          const fieldId: string | null = fieldIdOf(key);
          if (fieldId !== null) {
            const others: readonly string[] = presentation.hiddenCustomFieldIds.filter(
              (id: string): boolean => id !== fieldId,
            );
            store._view.setPresentation({
              hiddenCustomFieldIds: shown ? others : [...others, fieldId],
            });
            return;
          }
          if (key === 'name') return;
          const others: readonly SheetColumn[] = presentation.hiddenSheetColumns.filter(
            (column: SheetColumn): boolean => column !== key,
          );
          store._view.setPresentation({
            hiddenSheetColumns: shown ? others : [...others, key as SheetColumn],
          });
        },
        showAllColumns(): void {
          store._view.setPresentation({ hiddenSheetColumns: [], hiddenCustomFieldIds: [] });
        },
        setCollapsed(values: readonly string[]): void {
          patchState(store, (state: SheetViewState) => ({
            _collapsed: { ...state._collapsed, [store.groupBy() ?? 'all']: values },
          }));
        },
      };
    }),
    withHooks({
      onInit(store): void {
        const facts: { unsubscribe: () => void } = store._api.facts.subscribe(
          (batch: readonly SheetTaskFacts[]): void => {
            store._merge(batch);
          },
        );
        const detail: { unsubscribe: () => void } = merge(
          store._detail.closed,
          store._detail.changed,
        ).subscribe((): void => {
          store._refreshSpent();
        });
        store._publishFields(
          computed((): readonly SheetCustomField[] | null =>
            store.fields.hasValue() ? store.fields.value() : null,
          ),
        );
        store._destroyRef.onDestroy((): void => {
          facts.unsubscribe();
          detail.unsubscribe();
          store._resetSpent();
        });
      },
    }),
  );
}

/**
 * Constant SheetViewStore
 *
 * @description
 * The state of the `Sheet` view (`l/:listId/sheet`), route-scoped through
 * `SHEET_VIEW_PROVIDERS` next to the shared flat reader (`ListTasksStore`) and the sheet's data
 * access (`SheetTasksApi`, which also stands for `ListTasksApi` there). It keeps what a task
 * summary does not carry: the estimate and custom field values of every task read (`facts` of
 * each page, an older version never replacing a newer one), the list's custom fields (a
 * secondary read, published to the frame with `ListViewStore.followCustomFields` once read), and
 * the time spent of the rows shown (gap G6: one time summary per row, four at a time, read again
 * when a task detail closes or changes; a failed read waits for `retrySpent`; of two reads of
 * one task in flight, only the newer one's answer counts). It builds the rows in the presentation's order
 * (`sheetSort`, or `customFieldSort` while the list has the field; empty cells last) and the
 * totals of the footer, files the rows into the view's groups (`Group by`, `Cancelled` folded by
 * default), shows the sheet's estimate and custom field edits at once until a read reaches
 * their version (at once gone when a read already did), and writes the sort and the hidden
 * columns to the presentation
 * (`ListViewStore.setPresentation`). Another list forgets everything but the fields' read.
 *
 * @type {Type<SheetViewStoreInstance>}
 */
export const SheetViewStore: Type<SheetViewStoreInstance> = createSheetViewStore();
