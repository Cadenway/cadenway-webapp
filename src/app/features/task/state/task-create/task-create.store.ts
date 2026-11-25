import { inject, type ResourceRef, type Signal, type Type } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { TaskCreateApi } from '../../data-access/services/task-create-api/task-create-api.service';
import type { Person } from '../../models/person/person.interface';
import type { StatusOption } from '../../models/status-option/status-option.interface';
import type {
  CreatedTask,
  ListDestination,
  SpaceSetup,
  TaskDraft,
  TaskTemplateOption,
} from '../../models/task-create/task-create.interface';

/**
 * Interface TaskCreateState
 *
 * @description
 * Whether the dialog asked for its data, the chosen destination, and the creation in flight.
 */
interface TaskCreateState {
  // #region Properties
  /**
   * Property _active
   *
   * @description
   * Whether the dialog opened once, which starts the reads.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _active: boolean;

  /**
   * Property _organizationId
   *
   * @description
   * Committed organization that owns the resources.
   *
   * @type {string}
   * @readonly
   */
  readonly _organizationId: string;

  /**
   * Property _listId
   *
   * @description
   * Chosen destination list, or null for the first one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _listId: string | null;

  /**
   * Property creating
   *
   * @description
   * Whether a creation is in flight.
   *
   * @type {boolean}
   * @readonly
   */
  readonly creating: boolean;

  /**
   * Property _attempt
   *
   * @description
   * Idempotency key and body of the last creation that did not succeed, reused when the same body
   * is sent again.
   *
   * @type {{ readonly key: string; readonly body: string } | null}
   * @readonly
   */
  readonly _attempt: { readonly key: string; readonly body: string } | null;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing read yet.
 *
 * @type {TaskCreateState}
 */
const initialState: TaskCreateState = {
  _active: false,
  _organizationId: '',
  _listId: null,
  creating: false,
  _attempt: null,
};

/**
 * Function valueOf
 *
 * @description
 * The value of a resource, or a fallback while it has none.
 *
 * @param {ResourceRef<T | undefined>} resource - The resource.
 * @param {T} fallback - Value without one.
 * @returns {T} The value.
 */
function valueOf<T>(resource: ResourceRef<T | undefined>, fallback: T): T {
  return resource.hasValue() ? (resource.value() ?? fallback) : fallback;
}

/**
 * Interface TaskCreateStoreInstance
 *
 * @description
 * The data of the task create dialog and its creation.
 */
interface TaskCreateStoreInstance {
  // #region Properties
  /**
   * Property destinations
   *
   * @description
   * Lists the task can be created in.
   *
   * @type {Signal<readonly ListDestination[]>}
   * @readonly
   */
  readonly destinations: Signal<readonly ListDestination[]>;

  /**
   * Property destinationsLoading
   *
   * @description
   * Whether the lists are being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly destinationsLoading: Signal<boolean>;

  /**
   * Property destinationsFailed
   *
   * @description
   * Whether reading the lists failed; the dialog shows `Retry`.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly destinationsFailed: Signal<boolean>;

  /**
   * Property destination
   *
   * @description
   * The chosen list, the first one by default, or null without any.
   *
   * @type {Signal<ListDestination | null>}
   * @readonly
   */
  readonly destination: Signal<ListDestination | null>;

  /**
   * Property nextKey
   *
   * @description
   * Key the task will take, or null while unknown.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly nextKey: Signal<string | null>;

  /**
   * Property statuses
   *
   * @description
   * Statuses of the destination's space, empty while unknown.
   *
   * @type {Signal<readonly StatusOption[]>}
   * @readonly
   */
  readonly statuses: Signal<readonly StatusOption[]>;

  /**
   * Property templates
   *
   * @description
   * Templates saved in the destination's space.
   *
   * @type {Signal<readonly TaskTemplateOption[]>}
   * @readonly
   */
  readonly templates: Signal<readonly TaskTemplateOption[]>;

  /**
   * Property people
   *
   * @description
   * People who can be assigned.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  readonly people: Signal<readonly Person[]>;

  /**
   * Property peopleLoading
   *
   * @description
   * Whether the people are being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly peopleLoading: Signal<boolean>;

  /**
   * Property labels
   *
   * @description
   * Label names of the organization.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly labels: Signal<readonly string[]>;

  /**
   * Property labelsLoading
   *
   * @description
   * Whether the labels are being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly labelsLoading: Signal<boolean>;

  /**
   * Property creating
   *
   * @description
   * Whether a creation is in flight.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly creating: Signal<boolean>;

  /**
   * Property peopleFailed
   *
   * @description
   * Whether the people read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly peopleFailed: Signal<boolean>;

  /**
   * Property labelsFailed
   *
   * @description
   * Whether the labels read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly labelsFailed: Signal<boolean>;

  /**
   * Property spaceFailed
   *
   * @description
   * Whether the space setup read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly spaceFailed: Signal<boolean>;

  /**
   * Property templatesFailed
   *
   * @description
   * Whether the templates read failed.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly templatesFailed: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method activate
   *
   * @description
   * Starts the reads the first time the dialog opens and picks the preset destination.
   *
   * @param {string | null} listId - Preset list, or null for the first one.
   */
  activate(listId: string | null): void;

  /**
   * Method reset
   *
   * @description
   * Resets data for a committed organization change.
   *
   * @param {string} organizationId - Committed organization id.
   */
  reset(organizationId: string): void;

  /**
   * Method chooseList
   *
   * @description
   * Chooses the destination list.
   *
   * @param {string} listId - The list.
   */
  chooseList(listId: string): void;

  /**
   * Method retry
   *
   * @description
   * `Retry` after the lists could not be read.
   */
  retry(): void;

  /**
   * Method retrySecondary
   *
   * @description
   * Retries one failed secondary read.
   *
   * @param {'people' | 'labels' | 'space' | 'templates'} read - Resource to reload.
   */
  retrySecondary(read: 'people' | 'labels' | 'space' | 'templates'): void;

  /**
   * Method create
   *
   * @description
   * Creates the draft in the chosen list, or as a subtask of `parentKey`. A creation sent again
   * with the same body reuses its `Idempotency-Key`, so a retry never creates a second task. On
   * success the next key is read again.
   *
   * @param {TaskDraft} draft - Submitted draft.
   * @param {string | null} parentKey - Parent of a subtask, or null.
   * @returns {Promise<CreatedTask>} The created task; rejects when the gateway refuses it.
   */
  create(draft: TaskDraft, parentKey: string | null): Promise<CreatedTask>;
  // #endregion
}

/**
 * Function createTaskCreateStore
 *
 * @description
 * Creates the store of the task create dialog.
 *
 * @returns {Type<TaskCreateStoreInstance>} Injectable store constructor.
 */
function createTaskCreateStore(): Type<TaskCreateStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store, api: TaskCreateApi = inject(TaskCreateApi)) => ({
      _destinations: rxResource<readonly ListDestination[], string | undefined>({
        params: () => (store._active() ? store._organizationId() : undefined),
        stream: () => api.destinations(),
      }),
      _people: rxResource<readonly Person[], string | undefined>({
        params: () => (store._active() ? store._organizationId() : undefined),
        stream: () => api.people(),
      }),
      _labels: rxResource<readonly string[], string | undefined>({
        params: () => (store._active() ? store._organizationId() : undefined),
        stream: () => api.labels(),
      }),
    })),
    withComputed((store) => {
      const destinations: () => readonly ListDestination[] = (): readonly ListDestination[] =>
        valueOf(store._destinations, []);
      return {
        destinations,
        destinationsLoading: (): boolean => store._destinations.isLoading(),
        destinationsFailed: (): boolean => store._destinations.error() !== undefined,
        destination: (): ListDestination | null => {
          const all: readonly ListDestination[] = destinations();
          return (
            all.find((list: ListDestination) => list.listId === store._listId()) ??
            all.at(0) ??
            null
          );
        },
        people: (): readonly Person[] => valueOf(store._people, []),
        peopleLoading: (): boolean => store._people.isLoading(),
        peopleFailed: (): boolean => store._people.error() !== undefined,
        labels: (): readonly string[] => valueOf(store._labels, []),
        labelsLoading: (): boolean => store._labels.isLoading(),
        labelsFailed: (): boolean => store._labels.error() !== undefined,
      };
    }),
    withProps((store, api: TaskCreateApi = inject(TaskCreateApi)) => ({
      _space: rxResource<SpaceSetup, { organizationId: string; spaceId: string } | undefined>({
        params: () => {
          const spaceId: string | undefined = store.destination()?.spaceId;
          return spaceId ? { organizationId: store._organizationId(), spaceId } : undefined;
        },
        stream: ({ params }: { params: { organizationId: string; spaceId: string } }) =>
          api.space(params.spaceId),
      }),
      _templates: rxResource<
        readonly TaskTemplateOption[],
        { organizationId: string; spaceId: string } | undefined
      >({
        params: () => {
          const spaceId: string | undefined = store.destination()?.spaceId;
          return spaceId ? { organizationId: store._organizationId(), spaceId } : undefined;
        },
        stream: ({ params }: { params: { organizationId: string; spaceId: string } }) =>
          api.templates(params.spaceId),
      }),
    })),
    withComputed((store) => ({
      nextKey: (): string | null => valueOf<SpaceSetup | null>(store._space, null)?.nextKey ?? null,
      statuses: (): readonly StatusOption[] =>
        valueOf<SpaceSetup | null>(store._space, null)?.statuses ?? [],
      templates: (): readonly TaskTemplateOption[] => valueOf(store._templates, []),
      spaceFailed: (): boolean => store._space.error() !== undefined,
      templatesFailed: (): boolean => store._templates.error() !== undefined,
    })),
    withMethods((store, api: TaskCreateApi = inject(TaskCreateApi)) => ({
      activate(listId: string | null): void {
        if (store._active()) store._destinations.reload();
        patchState(store, {
          _active: true,
          _listId: listId ?? store._listId(),
          creating: false,
        });
      },
      reset(organizationId: string): void {
        patchState(store, { ...initialState, _organizationId: organizationId });
      },
      chooseList(listId: string): void {
        patchState(store, { _listId: listId });
      },
      retry(): void {
        store._destinations.reload();
      },
      retrySecondary(read: 'people' | 'labels' | 'space' | 'templates'): void {
        if (read === 'people') store._people.reload();
        else if (read === 'labels') store._labels.reload();
        else if (read === 'space') store._space.reload();
        else store._templates.reload();
      },
      async create(draft: TaskDraft, parentKey: string | null): Promise<CreatedTask> {
        const listId: string | undefined = store.destination()?.listId;
        if (!listId && parentKey === null) throw new Error('No destination list.');
        const body: string = JSON.stringify({ listId, parentKey, draft });
        const attempt: { readonly key: string; readonly body: string } | null = store._attempt();
        const key: string = attempt?.body === body ? attempt.key : crypto.randomUUID();
        const organizationId: string = store._organizationId();
        const submittedAttempt: { readonly key: string; readonly body: string } = { key, body };
        patchState(store, { creating: true, _attempt: submittedAttempt });
        try {
          const created: CreatedTask = await firstValueFrom(
            parentKey === null
              ? api.create(listId ?? '', draft, key)
              : api.createSubtask(parentKey, draft, key),
          );
          if (organizationId === store._organizationId() && store._attempt() === submittedAttempt) {
            patchState(store, { creating: false, _attempt: null });
            store._space.reload();
          }
          return created;
        } catch (error: unknown) {
          if (organizationId === store._organizationId() && store._attempt() === submittedAttempt)
            patchState(store, { creating: false });
          throw error;
        }
      },
    })),
  );
}

/**
 * Constant TaskCreateStore
 *
 * @description
 * Data of the task create dialog, provided by the dialog so it lives with the shell. It reads the
 * destinations, the people and the labels the first time the dialog opens; the statuses, the
 * next key and the templates follow the chosen destination's space. A failed read of the lists is
 * a flag with a retry, never an empty answer.
 *
 * @type {Type<TaskCreateStoreInstance>}
 */
export const TaskCreateStore: Type<TaskCreateStoreInstance> = createTaskCreateStore();
