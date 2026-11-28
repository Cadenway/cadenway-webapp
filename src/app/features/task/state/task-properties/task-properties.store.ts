import { computed, inject, type Signal, type Type } from '@angular/core';
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
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { CwToastService } from '@cadenway/ui/components/toast';
import { firstValueFrom, from, map, type Observable, of, pipe, switchMap, tap, timer } from 'rxjs';

import { hasProblemCode } from '@core/api';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TaskCreateApi } from '../../data-access/services/task-create-api/task-create-api.service';
import { TaskDetailApi } from '../../data-access/services/task-detail-api/task-detail-api.service';
import {
  type CreatedDependency,
  TaskPropertyApi,
} from '../../data-access/services/task-property-api/task-property-api.service';
import type { Person } from '../../models/person/person.interface';
import type { TaskDetailTask } from '../../models/task-detail/task-detail.interface';
import type {
  TaskApproval,
  TaskDependency,
  TaskDependencyDirection,
  TaskDependencyTask,
  TaskStatusTimes,
} from '../../models/task-property/task-property.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { TaskDetailStore } from '../task-detail/task-detail.store';

/**
 * Constant CANDIDATE_DEBOUNCE_MS
 *
 * @description
 * Pause after the last typed letter before the dependency candidates are read again.
 *
 * @type {number}
 */
export const CANDIDATE_DEBOUNCE_MS: number = 200;

/**
 * Constant MAX_APPROVERS
 *
 * @description
 * Reviewers of one approval round at most (`TaskApprovalRequest.reviewerUserIds`).
 *
 * @type {number}
 */
export const MAX_APPROVERS: number = 20;

/**
 * Interface TaskPropertiesState
 *
 * @description
 * The parts of the properties panel the detail aggregate does not carry, and the local values
 * of collection writes in flight.
 */
interface TaskPropertiesState {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the task the parts were read for.
   *
   * @type {string | null}
   * @readonly
   */
  readonly key: string | null;

  /**
   * Property people
   *
   * @description
   * Members who can be assigned (guests excepted), null until read.
   *
   * @type {readonly Person[] | null}
   * @readonly
   */
  readonly people: readonly Person[] | null;

  /**
   * Property peopleFailed
   *
   * @description
   * Whether reading the people failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly peopleFailed: boolean;

  /**
   * Property labelCatalog
   *
   * @description
   * Labels used in the organization, null until read.
   *
   * @type {readonly string[] | null}
   * @readonly
   */
  readonly labelCatalog: readonly string[] | null;

  /**
   * Property labelsFailed
   *
   * @description
   * Whether reading the labels failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly labelsFailed: boolean;

  /**
   * Property watcherIds
   *
   * @description
   * Accounts that follow the task, null until read.
   *
   * @type {readonly string[] | null}
   * @readonly
   */
  readonly watcherIds: readonly string[] | null;

  /**
   * Property watchersFailed
   *
   * @description
   * Whether reading the watchers failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly watchersFailed: boolean;

  /**
   * Property approval
   *
   * @description
   * The current approval round, null until read.
   *
   * @type {TaskApproval | null}
   * @readonly
   */
  readonly approval: TaskApproval | null;

  /**
   * Property approvalFailed
   *
   * @description
   * Whether reading the approval failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly approvalFailed: boolean;

  /**
   * Property dependencies
   *
   * @description
   * Dependencies of the task, null until read.
   *
   * @type {readonly TaskDependency[] | null}
   * @readonly
   */
  readonly dependencies: readonly TaskDependency[] | null;

  /**
   * Property dependenciesFailed
   *
   * @description
   * Whether reading the dependencies failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly dependenciesFailed: boolean;

  /**
   * Property statusTimes
   *
   * @description
   * Time per status, null until read and for a milestone.
   *
   * @type {TaskStatusTimes | null}
   * @readonly
   */
  readonly statusTimes: TaskStatusTimes | null;

  /**
   * Property statusTimesFailed
   *
   * @description
   * Whether reading the time per status failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly statusTimesFailed: boolean;

  /**
   * Property sprintEnd
   *
   * @description
   * Last day of the sprint of the task's list, null for a list that is not a sprint.
   *
   * @type {string | null}
   * @readonly
   */
  readonly sprintEnd: string | null;

  /**
   * Property candidates
   *
   * @description
   * Tasks the dependency dialog offers for the current direction and text.
   *
   * @type {readonly TaskDependencyTask[]}
   * @readonly
   */
  readonly candidates: readonly TaskDependencyTask[];

  /**
   * Property candidatesLoading
   *
   * @description
   * Whether the candidates are being read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly candidatesLoading: boolean;

  /**
   * Property candidatesFailed
   *
   * @description
   * Whether reading the candidates failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly candidatesFailed: boolean;

  /**
   * Property _assignees
   *
   * @description
   * Assignees shown while their writes are in flight.
   *
   * @type {readonly string[] | null}
   * @readonly
   */
  readonly _assignees: readonly string[] | null;

  /**
   * Property _labels
   *
   * @description
   * Labels shown while their writes are in flight.
   *
   * @type {readonly string[] | null}
   * @readonly
   */
  readonly _labels: readonly string[] | null;
  // #endregion
}

/**
 * Interface CandidateQuery
 *
 * @description
 * What the dependency dialog searches.
 */
interface CandidateQuery {
  // #region Properties
  /**
   * Property direction
   *
   * @description
   * Direction of the link to create.
   *
   * @type {TaskDependencyDirection}
   * @readonly
   */
  readonly direction: TaskDependencyDirection;

  /**
   * Property text
   *
   * @description
   * Typed text.
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property delay
   *
   * @description
   * Whether to wait for the debounce (typing) or read at once (opening, direction).
   *
   * @type {boolean}
   * @readonly
   */
  readonly delay: boolean;
  // #endregion
}

/**
 * Interface TaskPropertiesStoreInstance
 *
 * @description
 * Public API of `TaskPropertiesStore`.
 */
export interface TaskPropertiesStoreInstance {
  // #region Properties
  /**
   * Property people
   *
   * @description
   * Members who can be assigned, null until read.
   *
   * @type {Signal<readonly Person[] | null>}
   * @readonly
   */
  readonly people: Signal<readonly Person[] | null>;

  /**
   * Property peopleFailed
   *
   * @description
   * Whether reading the people failed (`Retry` calls `reloadPeople`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly peopleFailed: Signal<boolean>;

  /**
   * Property labelsFailed
   *
   * @description
   * Whether reading the label catalog failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly labelsFailed: Signal<boolean>;

  /**
   * Property watcherIds
   *
   * @description
   * Accounts that follow the task, null until read.
   *
   * @type {Signal<readonly string[] | null>}
   * @readonly
   */
  readonly watcherIds: Signal<readonly string[] | null>;

  /**
   * Property watchersFailed
   *
   * @description
   * Whether reading the watchers failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly watchersFailed: Signal<boolean>;

  /**
   * Property approval
   *
   * @description
   * The current approval round, null until read.
   *
   * @type {Signal<TaskApproval | null>}
   * @readonly
   */
  readonly approval: Signal<TaskApproval | null>;

  /**
   * Property approvalFailed
   *
   * @description
   * Whether reading the approval failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly approvalFailed: Signal<boolean>;

  /**
   * Property dependencies
   *
   * @description
   * Dependencies of the task, null until read.
   *
   * @type {Signal<readonly TaskDependency[] | null>}
   * @readonly
   */
  readonly dependencies: Signal<readonly TaskDependency[] | null>;

  /**
   * Property dependenciesFailed
   *
   * @description
   * Whether reading the dependencies failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly dependenciesFailed: Signal<boolean>;

  /**
   * Property statusTimes
   *
   * @description
   * Time per status, null until read and for a milestone.
   *
   * @type {Signal<TaskStatusTimes | null>}
   * @readonly
   */
  readonly statusTimes: Signal<TaskStatusTimes | null>;

  /**
   * Property statusTimesFailed
   *
   * @description
   * Whether reading the time per status failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly statusTimesFailed: Signal<boolean>;

  /**
   * Property sprintEnd
   *
   * @description
   * Last day of the list's sprint, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly sprintEnd: Signal<string | null>;

  /**
   * Property candidates
   *
   * @description
   * Tasks the dependency dialog offers, without those already linked.
   *
   * @type {Signal<readonly TaskDependencyTask[]>}
   * @readonly
   */
  readonly candidates: Signal<readonly TaskDependencyTask[]>;

  /**
   * Property candidatesLoading
   *
   * @description
   * Whether the candidates are being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly candidatesLoading: Signal<boolean>;

  /**
   * Property candidatesFailed
   *
   * @description
   * Whether reading the candidates failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly candidatesFailed: Signal<boolean>;

  /**
   * Property assigneeIds
   *
   * @description
   * Assignees shown: the local value while writes are in flight, else the task's.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly assigneeIds: Signal<readonly string[]>;

  /**
   * Property labels
   *
   * @description
   * Labels shown: the local value while writes are in flight, else the task's.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly labels: Signal<readonly string[]>;

  /**
   * Property labelOptions
   *
   * @description
   * Labels the menu offers: the organization's and the task's, alphabetical.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly labelOptions: Signal<readonly string[]>;
  // #endregion

  // #region Methods
  /**
   * Method reloadPeople
   *
   * @description
   * Reads the people and the label catalog again (`Retry` of the menus).
   *
   * @returns {Promise<void>} Resolves once read.
   */
  reloadPeople(): Promise<void>;

  /**
   * Method reloadWatchers
   *
   * @description
   * Reads the watchers again.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  reloadWatchers(): Promise<void>;

  /**
   * Method reloadApproval
   *
   * @description
   * Reads the approval again.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  reloadApproval(): Promise<void>;

  /**
   * Method reloadDependencies
   *
   * @description
   * Reads the dependencies again.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  reloadDependencies(): Promise<void>;

  /**
   * Method reloadStatusTimes
   *
   * @description
   * Reads the time per status again.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  reloadStatusTimes(): Promise<void>;

  /**
   * Method toggleAssignee
   *
   * @description
   * Assigns a person, or removes them, at once; the writes go one after the other and confirm
   * the task they return (an unassignment its new version). A refusal puts the confirmed
   * assignees back with the failure toast. The watchers are read again after (assignees follow
   * by default).
   *
   * @param {string} userId - Account of the person.
   * @returns {Promise<void>} Resolves once the write settled.
   */
  toggleAssignee(userId: string): Promise<void>;

  /**
   * Method toggleLabel
   *
   * @description
   * Adds a label, or removes it, at once; same rules as `toggleAssignee`.
   *
   * @param {string} label - The label.
   * @returns {Promise<void>} Resolves once the write settled.
   */
  toggleLabel(label: string): Promise<void>;

  /**
   * Method toggleWatcher
   *
   * @description
   * Makes a person follow the task, or stop following it, at once (another person than the
   * caller needs `edit`); the header's count is read again; a refusal puts the watchers back.
   *
   * @param {string} userId - Account of the person.
   * @returns {Promise<void>} Resolves once the write settled.
   */
  toggleWatcher(userId: string): Promise<void>;

  /**
   * Method toggleApprover
   *
   * @description
   * Adds a reviewer, or removes one, by starting a new round with the new set (the gateway
   * replaces the round, so every vote is cleared, not only the removed reviewer's). The last
   * reviewer cannot be removed: a round needs one. Quick ticks are shown at once and sent one
   * round at a time through the detail's write path, each against the newest version; the last
   * selection decides. A refusal puts back the round shown before the ticks; a version conflict
   * also reads the detail and the approval again and warns.
   *
   * @param {string} userId - Account of the reviewer.
   * @returns {Promise<void>} Resolves once the write settled.
   */
  toggleApprover(userId: string): Promise<void>;

  /**
   * Method searchCandidates
   *
   * @description
   * Reads the dependency candidates for a direction and a text; typing waits for
   * `CANDIDATE_DEBOUNCE_MS`, the latest request wins.
   *
   * @param {TaskDependencyDirection} direction - Direction of the link.
   * @param {string} text - Typed text.
   * @param {boolean} delay - Whether to wait for the debounce.
   */
  searchCandidates(direction: TaskDependencyDirection, text: string, delay: boolean): void;

  /**
   * Method addDependency
   *
   * @description
   * Links the task to another one; the toast `Dependency added` offers `Undo`, which removes it.
   *
   * @param {TaskDependencyTask} task - The other task.
   * @param {TaskDependencyDirection} direction - Whether the open task is blocked by it or blocks it.
   * @returns {Promise<boolean>} Whether it was linked.
   */
  addDependency(task: TaskDependencyTask, direction: TaskDependencyDirection): Promise<boolean>;

  /**
   * Method removeDependency
   *
   * @description
   * Removes a dependency at once; a refusal puts it back. The toast `Dependency removed` offers
   * `Undo`, which links the tasks again.
   *
   * @param {TaskDependency} dependency - The dependency.
   * @returns {Promise<boolean>} Whether it was removed.
   */
  removeDependency(dependency: TaskDependency): Promise<boolean>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing read yet.
 *
 * @type {TaskPropertiesState}
 */
const initialState: TaskPropertiesState = {
  key: null,
  people: null,
  peopleFailed: false,
  labelCatalog: null,
  labelsFailed: false,
  watcherIds: null,
  watchersFailed: false,
  approval: null,
  approvalFailed: false,
  dependencies: null,
  dependenciesFailed: false,
  statusTimes: null,
  statusTimesFailed: false,
  sprintEnd: null,
  candidates: [],
  candidatesLoading: false,
  candidatesFailed: false,
  _assignees: null,
  _labels: null,
};

/**
 * Function toggled
 *
 * @description
 * A set with a value added at its end, or removed.
 *
 * @param {readonly string[]} values - The set.
 * @param {string} value - The value.
 * @returns {readonly string[]} The new set.
 */
function toggled(values: readonly string[], value: string): readonly string[] {
  return values.includes(value)
    ? values.filter((item: string): boolean => item !== value)
    : [...values, value];
}

/**
 * Function createTaskPropertiesStore
 *
 * @description
 * Builds the properties panel store.
 *
 * @returns {Type<TaskPropertiesStoreInstance>} Injectable store constructor.
 */
function createTaskPropertiesStore(): Type<TaskPropertiesStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _detail: inject(TaskDetailStore),
      _api: inject(TaskPropertyApi),
      _detailApi: inject(TaskDetailApi),
      _createApi: inject(TaskCreateApi),
      _toasts: inject(CwToastService),
      _workspace: inject(WORKSPACE_CONTEXT),
    })),
    withComputed((store) => ({
      assigneeIds: computed(
        (): readonly string[] => store._assignees() ?? store._detail.task()?.assigneeIds ?? [],
      ),
      labels: computed(
        (): readonly string[] => store._labels() ?? store._detail.task()?.labels ?? [],
      ),
      labelOptions: computed((): readonly string[] => {
        const names: Map<string, string> = new Map<string, string>();
        for (const label of [
          ...(store.labelCatalog() ?? []),
          ...(store._detail.task()?.labels ?? []),
        ]) {
          if (!names.has(label.toLocaleLowerCase())) names.set(label.toLocaleLowerCase(), label);
        }
        return [...names.values()].sort((a: string, b: string): number =>
          a.localeCompare(b, undefined, { sensitivity: 'base' }),
        );
      }),
    })),
    withMethods((store) => {
      let assigneeWrites: Promise<unknown> = Promise.resolve();
      let assigneeCount: number = 0;
      let labelWrites: Promise<unknown> = Promise.resolve();
      let labelCount: number = 0;
      const current: (key: string) => boolean = (key: string): boolean =>
        store._detail.taskKey() === key && store.key() === key;

      const failed: (title: string, error: unknown) => void = (
        title: string,
        error: unknown,
      ): void => {
        const conflict: boolean = error instanceof TaskVersionConflict;
        store._toasts.error(title, {
          description: conflict
            ? $localize`:@@task.properties.conflict-text:The task changed in the meantime; its latest version is shown.`
            : $localize`:@@task.properties.failed-text:The server did not answer. Try again in a moment.`,
        });
        if (conflict) void store._detail.reload();
      };

      const read: <T>(
        key: string,
        load: () => Promise<T>,
        apply: (value: T) => Partial<TaskPropertiesState>,
        failure: Partial<TaskPropertiesState>,
      ) => Promise<void> = async <T>(
        key: string,
        load: () => Promise<T>,
        apply: (value: T) => Partial<TaskPropertiesState>,
        failure: Partial<TaskPropertiesState>,
      ): Promise<void> => {
        try {
          const value: T = await load();
          if (current(key)) patchState(store, apply(value));
        } catch {
          if (current(key)) patchState(store, failure);
        }
      };

      const readWatchers: (key: string) => Promise<void> = (key: string): Promise<void> =>
        read(
          key,
          () => store._api.watchers(key),
          (watcherIds: readonly string[]) => ({ watcherIds, watchersFailed: false }),
          { watchersFailed: true },
        );
      const readApproval: (key: string) => Promise<void> = (key: string): Promise<void> =>
        read(
          key,
          () => store._api.approval(key),
          (approval: TaskApproval) => ({ approval, approvalFailed: false }),
          { approvalFailed: true },
        );
      const readDependencies: (key: string) => Promise<void> = (key: string): Promise<void> =>
        read(
          key,
          () => store._api.dependencies(key),
          (dependencies: readonly TaskDependency[]) => ({
            dependencies,
            dependenciesFailed: false,
          }),
          { dependenciesFailed: true },
        );
      const readStatusTimes: (key: string) => Promise<void> = (key: string): Promise<void> =>
        read(
          key,
          () => store._api.statusTimes(key),
          (statusTimes: TaskStatusTimes | null) => ({ statusTimes, statusTimesFailed: false }),
          { statusTimesFailed: true },
        );
      const readPeople: (key: string) => Promise<void> = async (key: string): Promise<void> => {
        patchState(store, { peopleFailed: false, labelsFailed: false });
        await Promise.all([
          read(
            key,
            () => firstValueFrom(store._createApi.people()),
            (people: readonly Person[]) => ({ people, peopleFailed: false }),
            { peopleFailed: true },
          ),
          read(
            key,
            () => firstValueFrom(store._createApi.labels()),
            (labelCatalog: readonly string[]) => ({ labelCatalog, labelsFailed: false }),
            { labelsFailed: true },
          ),
        ]);
      };

      const linkedKeys: () => ReadonlySet<string> = (): ReadonlySet<string> =>
        new Set<string>((store.dependencies() ?? []).map((edge: TaskDependency) => edge.task.key));

      const loadCandidates: ReturnType<typeof rxMethod<CandidateQuery>> = rxMethod<CandidateQuery>(
        pipe(
          tap((): void => {
            patchState(store, { candidatesLoading: true, candidatesFailed: false });
          }),
          switchMap(({ direction, text, delay }: CandidateQuery): Observable<void> =>
            (delay ? timer(CANDIDATE_DEBOUNCE_MS) : of(0)).pipe(
              switchMap((): Observable<void> => {
                const key: string | null = store.key();
                if (key === null) return of(undefined);
                return from(
                  store._api.candidates(key, direction, text).then(
                    (candidates: readonly TaskDependencyTask[]): void => {
                      if (!current(key)) return;
                      const linked: ReadonlySet<string> = linkedKeys();
                      patchState(store, {
                        candidates: candidates.filter(
                          (task: TaskDependencyTask): boolean =>
                            task.key !== key && !linked.has(task.key),
                        ),
                        candidatesLoading: false,
                        candidatesFailed: false,
                      });
                    },
                    (): void => {
                      if (current(key)) {
                        patchState(store, { candidatesLoading: false, candidatesFailed: true });
                      }
                    },
                  ),
                );
              }),
              map((): void => undefined),
            ),
          ),
        ),
      );

      const blockText: (
        direction: TaskDependencyDirection,
        key: string,
        other: string,
      ) => string = (direction: TaskDependencyDirection, key: string, other: string): string =>
        direction === 'blocked-by'
          ? $localize`:@@task.properties.dependency-blocks:${other}:blocker: blocks ${key}:blocked:.`
          : $localize`:@@task.properties.dependency-blocks:${key}:blocker: blocks ${other}:blocked:.`;

      const link: (
        key: string,
        task: TaskDependencyTask,
        direction: TaskDependencyDirection,
      ) => Promise<TaskDependency | null> = async (
        key: string,
        task: TaskDependencyTask,
        direction: TaskDependencyDirection,
      ): Promise<TaskDependency | null> => {
        try {
          const created: CreatedDependency = await store._detail.write(
            key,
            async (): Promise<CreatedDependency> => {
              const answer: CreatedDependency = await store._api.addDependency(
                key,
                task.key,
                direction,
                crypto.randomUUID(),
              );
              if (answer.version !== null) store._detail.acceptVersion(answer.version, {}, key);
              return answer;
            },
            0,
          );
          if (!current(key)) return null;
          patchState(store, {
            dependencies: [
              ...(store.dependencies() ?? []).filter(
                (edge: TaskDependency): boolean => edge.id !== created.dependency.id,
              ),
              created.dependency,
            ],
          });
          return created.dependency;
        } catch (error: unknown) {
          if (!current(key)) return null;
          store._toasts.error(
            $localize`:@@task.properties.dependency-failed:Could not change the dependencies`,
            {
              description: hasProblemCode(error, 'dependency.cycle')
                ? $localize`:@@task.properties.dependency-cycle:This link would create a loop.`
                : $localize`:@@task.properties.failed-text:The server did not answer. Try again in a moment.`,
            },
          );
          void readDependencies(key);
          return null;
        }
      };

      const unlink: (key: string, dependency: TaskDependency) => Promise<boolean> = async (
        key: string,
        dependency: TaskDependency,
      ): Promise<boolean> => {
        const before: readonly TaskDependency[] = store.dependencies() ?? [];
        patchState(store, {
          dependencies: before.filter((edge: TaskDependency): boolean => edge.id !== dependency.id),
        });
        try {
          await store._detail.write(
            key,
            async (): Promise<void> => {
              const version: number | null = await store._api.removeDependency(key, dependency.id);
              if (version !== null) store._detail.acceptVersion(version, {}, key);
            },
            0,
          );
          return true;
        } catch (error: unknown) {
          if (!current(key)) return false;
          patchState(store, { dependencies: before });
          failed(
            $localize`:@@task.properties.dependency-failed:Could not change the dependencies`,
            error,
          );
          return false;
        }
      };

      let approverWrites: number = 0;
      let approverToken: number = 0;
      let approverTarget: readonly string[] | null = null;
      let approverTicks: number = 0;
      let approverRun: Promise<void> | null = null;
      let approverBefore: TaskApproval | null = null;

      const approverFailed: (error: unknown) => void = (error: unknown): void => {
        store._toasts.error(
          $localize`:@@task.properties.approvers-failed:Could not change the approvers`,
          {
            description: hasProblemCode(error, 'approval.reviewer-invalid')
              ? $localize`:@@task.properties.approvers-invalid:Approvers need edit access to the task.`
              : error instanceof TaskVersionConflict
                ? $localize`:@@task.properties.conflict-text:The task changed in the meantime; its latest version is shown.`
                : $localize`:@@task.properties.failed-text:The server did not answer. Try again in a moment.`,
          },
        );
      };

      const sendApprovers: (key: string, token: number) => Promise<void> = async (
        key: string,
        token: number,
      ): Promise<void> => {
        approverWrites++;
        try {
          while (approverTarget !== null && token === approverToken) {
            const ids: readonly string[] = approverTarget;
            const tick: number = approverTicks;
            approverTarget = null;
            try {
              const approval: TaskApproval = await store._detail.write(
                key,
                async (version: number): Promise<TaskApproval> => {
                  const answer: TaskApproval = await store._api.requestApproval(key, version, ids);
                  store._detail.acceptVersion(answer.taskVersion, {}, key);
                  return answer;
                },
              );
              if (token === approverToken && tick === approverTicks && current(key)) {
                patchState(store, { approval });
              }
            } catch (error: unknown) {
              if (token !== approverToken || !current(key)) return;
              approverTarget = null;
              patchState(store, { approval: approverBefore });
              approverFailed(error);
              if (error instanceof TaskVersionConflict) void readApproval(key);
              return;
            }
          }
        } finally {
          approverWrites--;
          if (token === approverToken) {
            approverRun = null;
            approverBefore = null;
          }
        }
      };

      const sprintEnd: { key: string | null; listId: string | null } = {
        key: null,
        listId: null,
      };
      const readSprintEnd: (key: string, listId: string) => void = (
        key: string,
        listId: string,
      ): void => {
        if (sprintEnd.key === key && sprintEnd.listId === listId) return;
        sprintEnd.key = key;
        sprintEnd.listId = listId;
        void read(
          key,
          () => store._api.sprintEnd(listId),
          (end: string | null) =>
            sprintEnd.key === key && sprintEnd.listId === listId ? { sprintEnd: end } : {},
          { sprintEnd: null },
        );
      };

      return {
        _followList(listId: string | null): void {
          const key: string | null = store.key();
          if (key !== null && listId !== null && store._detail.taskKey() === key) {
            readSprintEnd(key, listId);
          }
        },

        _refreshApproval(version: number | null): void {
          const key: string | null = store.key();
          const approval: TaskApproval | null = store.approval();
          if (key === null || version === null || approval === null || approverWrites > 0) return;
          if (approval.taskVersion < version) void readApproval(key);
        },

        _load(key: string | null): void {
          if (key === store.key()) return;
          patchState(store, {
            ...initialState,
            people: store.people(),
            labelCatalog: store.labelCatalog(),
            key,
          });
          approverToken++;
          approverTarget = null;
          approverRun = null;
          approverBefore = null;
          sprintEnd.key = null;
          sprintEnd.listId = null;
          if (key === null) return;
          if (store.people() === null || store.labelCatalog() === null) void readPeople(key);
          void readWatchers(key);
          void readApproval(key);
          void readDependencies(key);
          const listId: string | undefined = store._detail.confirmedTask()?.listId;
          if (listId) readSprintEnd(key, listId);
        },

        async reloadPeople(): Promise<void> {
          const key: string | null = store.key();
          if (key !== null) await readPeople(key);
        },

        async reloadWatchers(): Promise<void> {
          const key: string | null = store.key();
          if (key !== null) await readWatchers(key);
        },

        async reloadApproval(): Promise<void> {
          const key: string | null = store.key();
          if (key !== null) await readApproval(key);
        },

        async reloadDependencies(): Promise<void> {
          const key: string | null = store.key();
          if (key !== null) await readDependencies(key);
        },

        async reloadStatusTimes(): Promise<void> {
          const key: string | null = store.key();
          if (key !== null) await readStatusTimes(key);
        },

        toggleAssignee(userId: string): Promise<void> {
          const key: string | null = store.key();
          if (key === null) return Promise.resolve();
          const on: boolean = !store.assigneeIds().includes(userId);
          patchState(store, { _assignees: toggled(store.assigneeIds(), userId) });
          assigneeCount++;
          assigneeWrites = assigneeWrites.then(async (): Promise<void> => {
            try {
              await store._detail.write(
                key,
                async (): Promise<void> => {
                  if (on) {
                    store._detail.accept(await store._api.assign(key, userId));
                    return;
                  }
                  const version: number | null = await store._api.unassign(key, userId);
                  const confirmed: TaskDetailTask | null = store._detail.confirmedTask();
                  if (version !== null) {
                    store._detail.acceptVersion(
                      version,
                      confirmed?.key === key
                        ? {
                            assigneeIds: confirmed.assigneeIds.filter(
                              (id: string): boolean => id !== userId,
                            ),
                          }
                        : {},
                      key,
                    );
                  } else if (current(key)) {
                    void store._detail.reload();
                  }
                },
                0,
              );
            } catch (error: unknown) {
              if (current(key)) {
                assigneeCount = 0;
                patchState(store, { _assignees: null });
                failed(
                  $localize`:@@task.properties.assignees-failed:Could not change the assignees`,
                  error,
                );
              }
              return;
            } finally {
              assigneeCount = Math.max(0, assigneeCount - 1);
            }
            if (assigneeCount === 0 && current(key)) {
              patchState(store, { _assignees: null });
              void readWatchers(key);
            }
          });
          return assigneeWrites.then((): void => undefined);
        },

        toggleLabel(label: string): Promise<void> {
          const key: string | null = store.key();
          if (key === null) return Promise.resolve();
          const shown: readonly string[] = store.labels();
          const existing: string | undefined = shown.find(
            (item: string): boolean => item.toLocaleLowerCase() === label.toLocaleLowerCase(),
          );
          const on: boolean = existing === undefined;
          patchState(store, {
            _labels: on
              ? [...shown, label]
              : shown.filter((item: string): boolean => item !== existing),
          });
          labelCount++;
          labelWrites = labelWrites.then(async (): Promise<void> => {
            try {
              await store._detail.write(
                key,
                async (): Promise<void> => {
                  store._detail.accept(await store._api.label(key, existing ?? label, on));
                },
                0,
              );
            } catch (error: unknown) {
              if (current(key)) {
                labelCount = 0;
                patchState(store, { _labels: null });
                failed(
                  $localize`:@@task.properties.labels-failed:Could not change the labels`,
                  error,
                );
              }
              return;
            } finally {
              labelCount = Math.max(0, labelCount - 1);
            }
            if (labelCount === 0 && current(key)) patchState(store, { _labels: null });
          });
          return labelWrites.then((): void => undefined);
        },

        async toggleWatcher(userId: string): Promise<void> {
          const key: string | null = store.key();
          const before: readonly string[] | null = store.watcherIds();
          if (key === null || before === null) return;
          const following: boolean = !before.includes(userId);
          patchState(store, { watcherIds: toggled(before, userId) });
          try {
            await store._detail.write(
              key,
              async (): Promise<void> => {
                const version: number | null = await store._detailApi.follow(
                  key,
                  userId,
                  following,
                );
                if (version !== null) store._detail.acceptVersion(version, {}, key);
              },
              0,
            );
            if (!current(key)) return;
            void store._detail.reloadWatchers();
          } catch (error: unknown) {
            if (!current(key)) return;
            patchState(store, { watcherIds: before });
            failed(
              $localize`:@@task.properties.watchers-failed:Could not change the followers`,
              error,
            );
          }
        },

        toggleApprover(userId: string): Promise<void> {
          const key: string | null = store.key();
          const shown: TaskApproval | null = store.approval();
          if (key === null || shown === null || store._detail.confirmedTask() === null) {
            return Promise.resolve();
          }
          const ids: readonly string[] = toggled(
            shown.reviewers.map((reviewer) => reviewer.userId),
            userId,
          );
          if (ids.length === 0 || ids.length > MAX_APPROVERS) return Promise.resolve();
          approverBefore ??= shown;
          patchState(store, {
            approval: {
              ...shown,
              reviewers: ids.map((id: string) => ({ userId: id, decision: null })),
            },
          });
          approverTarget = ids;
          approverTicks++;
          approverRun ??= sendApprovers(key, approverToken);
          return approverRun;
        },

        searchCandidates(direction: TaskDependencyDirection, text: string, delay: boolean): void {
          loadCandidates({ direction, text, delay });
        },

        async addDependency(
          task: TaskDependencyTask,
          direction: TaskDependencyDirection,
        ): Promise<boolean> {
          const key: string | null = store.key();
          if (key === null) return false;
          const created: TaskDependency | null = await link(key, task, direction);
          if (!created) return false;
          store._toasts.show($localize`:@@task.properties.dependency-added:Dependency added`, {
            description: blockText(direction, key, task.key),
            undo: (): void => {
              if (current(key)) void unlink(key, created);
            },
          });
          return true;
        },

        async removeDependency(dependency: TaskDependency): Promise<boolean> {
          const key: string | null = store.key();
          if (key === null) return false;
          const removed: boolean = await unlink(key, dependency);
          if (!removed) return false;
          const [blocker, blocked]: [string, string] =
            dependency.direction === 'blocked-by'
              ? [dependency.task.key, key]
              : [key, dependency.task.key];
          store._toasts.show($localize`:@@task.properties.dependency-removed:Dependency removed`, {
            description: $localize`:@@task.properties.dependency-unblocks:${blocker}:blocker: no longer blocks ${blocked}:blocked:.`,
            undo: (): void => {
              if (current(key)) void link(key, dependency.task, dependency.direction);
            },
          });
          return true;
        },
      };
    }),
    withMethods((store) => ({
      _follow: signalMethod<string | null>((key: string | null): void => {
        store._load(key);
      }),
      _followStatus: signalMethod<string | null>((signature: string | null): void => {
        if (signature !== null) void store.reloadStatusTimes();
      }),
      _followAssignees: signalMethod<string | null>((signature: string | null): void => {
        if (signature !== null && store.watcherIds() !== null) void store.reloadWatchers();
      }),
      _followVersion: signalMethod<number | null>((version: number | null): void => {
        store._refreshApproval(version);
      }),
      _followListId: signalMethod<string | null>((listId: string | null): void => {
        store._followList(listId);
      }),
      _followWatchers: signalMethod<number>((revision: number): void => {
        if (revision > 0 && store.watcherIds() !== null) void store.reloadWatchers();
      }),
    })),
    withHooks({
      onInit(store): void {
        store._follow(
          computed((): string | null => (store._detail.ready() ? store._detail.taskKey() : null)),
        );
        store._followStatus(
          computed((): string | null => {
            const task: TaskDetailTask | null = store._detail.confirmedTask();
            return task ? `${task.key}:${task.status}:${String(task.milestone)}` : null;
          }),
        );
        store._followAssignees(
          computed((): string | null => {
            const task: TaskDetailTask | null = store._detail.confirmedTask();
            return task ? `${task.key}:${task.assigneeIds.join(',')}` : null;
          }),
        );
        store._followVersion(
          computed((): number | null => store._detail.confirmedTask()?.version ?? null),
        );
        store._followListId(
          computed((): string | null => store._detail.confirmedTask()?.listId ?? null),
        );
        store._followWatchers(store._detail.watchersRevision);
      },
    }),
  );
}

/**
 * Constant TaskPropertiesStore
 *
 * @description
 * The parts of the task detail's properties panel beyond the detail aggregate, provided by the
 * panel so they die with it: the people and labels the menus offer, the watchers, the approval
 * round, the dependencies and their candidates, the time per status and the sprint end (read
 * again when the task moves to another list). It
 * follows the open task of `TaskDetailStore` (reading everything again for another key, the
 * time per status again after a confirmed status or milestone change, the watchers after a
 * confirmed assignee change or a follow change from the header, the approval once the confirmed
 * version moves past the one it was read at, as the tabs' approval card does, so a vote there
 * shows here too), and writes the collections the task patch does not carry through the
 * detail's per-task write path (`TaskDetailStore.write`): assignees and labels (shown at once,
 * confirmed through `accept`), watchers, approvers and dependencies (their new task version
 * through `acceptVersion`, adopted only when it follows the confirmed one). A refusal restores
 * what it changed and shows the failure toast; a dependency change offers `Undo`.
 *
 * @type {Type<TaskPropertiesStoreInstance>}
 */
export const TaskPropertiesStore: Type<TaskPropertiesStoreInstance> = createTaskPropertiesStore();
