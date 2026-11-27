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

import { type ApiProblem, readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { OnboardingApi } from '../../data-access/services/onboarding-api/onboarding-api.service';
import type {
  OnboardingDraft,
  OnboardingProgress,
  OnboardingSpace,
} from '../../models/onboarding/onboarding.interface';
import type { OnboardingChecklistPresentation } from '../../models/onboarding/onboarding.type';

/**
 * Constant REREAD_CODES
 *
 * @description
 * Refusals after which the state shown is out of date: another tab finished or dismissed the
 * assistant, the checklist is not available yet, or the version moved on.
 *
 * @type {ReadonlySet<string>}
 */
const REREAD_CODES: ReadonlySet<string> = new Set([
  'onboarding.wizard-closed',
  'onboarding.checklist-unavailable',
  'request.version-mismatch',
]);

/**
 * Constant ORGANIZATION_CHANGED
 *
 * @description
 * Message of the error a write rejects with when the workspace changed organization before it was
 * sent: it is never sent to the new organization.
 *
 * @type {string}
 */
const ORGANIZATION_CHANGED: string =
  'The workspace organization changed before the write was sent.';

/**
 * Function isVersionMismatch
 *
 * @description
 * Whether a failure is the stale version refusal (`412 request.version-mismatch`), not the
 * organization pin's (`412 organization.context-changed`).
 *
 * @param {ApiProblem | null} problem - The failure read.
 * @returns {boolean} Whether to read again and send once more.
 */
function isVersionMismatch(problem: ApiProblem | null): boolean {
  return problem?.status === 412 && problem.code === 'request.version-mismatch';
}

/**
 * Interface OnboardingStoreState
 *
 * @description
 * Private state of the onboarding store.
 */
interface OnboardingStoreState {
  // #region Properties
  /**
   * Property _confirmed
   *
   * @description
   * The latest progress the gateway answered for the current organization, or null while unread.
   *
   * @type {OnboardingProgress | null}
   * @readonly
   */
  readonly _confirmed: OnboardingProgress | null;

  /**
   * Property _presentation
   *
   * @description
   * The checklist presentation shown before the gateway confirms it, or null.
   *
   * @type {OnboardingChecklistPresentation | null}
   * @readonly
   */
  readonly _presentation: OnboardingChecklistPresentation | null;

  /**
   * Property _organizationId
   *
   * @description
   * Organization the progress belongs to.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;

  /**
   * Property _requested
   *
   * @description
   * Whether a screen asked for the progress; an organization switch then reads it again.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _requested: boolean;

  /**
   * Property _reading
   *
   * @description
   * Whether the latest read is under way.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _reading: boolean;

  /**
   * Property _readFailed
   *
   * @description
   * Whether the latest read failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _readFailed: boolean;
  // #endregion
}

/**
 * Interface OnboardingRuns
 *
 * @description
 * Bookkeeping of the reads and writes under way, outside the state since no view reads it.
 */
interface OnboardingRuns {
  // #region Properties
  /**
   * Property generation
   *
   * @description
   * Moves on with each organization switch; an answer sent for an older one is dropped.
   *
   * @type {number}
   */
  generation: number;

  /**
   * Property reads
   *
   * @description
   * Number of the latest read, so an older read never settles the loading flags.
   *
   * @type {number}
   */
  reads: number;

  /**
   * Property tail
   *
   * @description
   * The last write queued: writes are sent one after the other, each from the version the previous
   * one answered.
   *
   * @type {Promise<unknown>}
   */
  tail: Promise<unknown>;
  // #endregion
}

/**
 * Interface OnboardingStoreInstance
 *
 * @description
 * Public API of the onboarding store.
 */
interface OnboardingStoreInstance {
  // #region Properties
  /**
   * Property progress
   *
   * @description
   * The person's onboarding in the current organization, with a checklist presentation not yet
   * confirmed shown at once; null while unread or when the first read failed. A later failed read
   * keeps the progress shown.
   *
   * @type {Signal<OnboardingProgress | null>}
   * @readonly
   */
  readonly progress: Signal<OnboardingProgress | null>;

  /**
   * Property loading
   *
   * @description
   * Whether the first read of the current organization is under way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the first read of the current organization failed (nothing is shown); `reload()`
   * retries it.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Reads the progress the first time a screen needs it; later calls send nothing. After an
   * organization switch the store reads the new organization's progress by itself.
   */
  load(): void;

  /**
   * Method reload
   *
   * @description
   * Reads the progress again (Retry, a task created, the tab shown again). An answer older than the
   * progress shown is dropped, and a failure keeps it.
   *
   * @returns {Promise<void>} Resolves once settled; never rejects.
   */
  reload(): Promise<void>;

  /**
   * Method saveDraft
   *
   * @description
   * Saves a draft change of the assistant. After `412 request.version-mismatch` it reads the
   * progress and sends once more; after `409 onboarding.wizard-closed` it reads the progress, then
   * rejects.
   *
   * @param {OnboardingDraft} draft - The change.
   * @returns {Promise<OnboardingProgress>} The progress saved.
   * @throws {unknown} The client's error, or an `Error` when the organization changed first.
   */
  saveDraft(draft: OnboardingDraft): Promise<OnboardingProgress>;

  /**
   * Method dismiss
   *
   * @description
   * Closes the assistant for good (`Set up later`), with the same recovery as `saveDraft`.
   *
   * @returns {Promise<OnboardingProgress>} The progress saved.
   * @throws {unknown} The client's error, or an `Error` when the organization changed first.
   */
  dismiss(): Promise<OnboardingProgress>;

  /**
   * Method finish
   *
   * @description
   * Provisions the first space and finishes the assistant. It never sends twice by itself: an
   * idempotency replay can repeat a stored refusal, so after `412` or `409` it reads the progress
   * and rejects, and the caller decides the next key and body.
   *
   * @param {OnboardingSpace} space - The space to provision.
   * @param {string} idempotencyKey - Key of this body; the same key again after an unknown outcome.
   * @returns {Promise<OnboardingProgress>} The finished progress, with its provisioning.
   * @throws {unknown} The client's error, or an `Error` when the organization changed first.
   */
  finish(space: OnboardingSpace, idempotencyKey: string): Promise<OnboardingProgress>;

  /**
   * Method setPresentation
   *
   * @description
   * Expands, collapses or dismisses the checklist at once, then saves it; a failure restores the
   * confirmed presentation and rejects, for the caller's failure toast. Nothing is sent before a
   * space is provisioned, nor when the presentation is already the one shown.
   *
   * @param {OnboardingChecklistPresentation} presentation - The presentation.
   * @returns {Promise<void>} Resolves once saved.
   * @throws {unknown} The client's error, or an `Error` when the organization changed first.
   */
  setPresentation(presentation: OnboardingChecklistPresentation): Promise<void>;

  /**
   * Method recordInvitation
   *
   * @description
   * Records the checklist's invitation marker after an invitation the gateway sent; allowed before
   * provisioning. Nothing is sent when the marker is already recorded.
   *
   * @returns {Promise<void>} Resolves once recorded.
   * @throws {unknown} The client's error, or an `Error` when the organization changed first.
   */
  recordInvitation(): Promise<void>;

  /**
   * Method recordBoardTried
   *
   * @description
   * Records that the `Board` view was opened. Nothing is sent before a space is provisioned, nor
   * when the marker is already recorded.
   *
   * @returns {Promise<void>} Resolves once recorded.
   * @throws {unknown} The client's error, or an `Error` when the organization changed first.
   */
  recordBoardTried(): Promise<void>;
  // #endregion
}

/**
 * Function createOnboardingStore
 *
 * @description
 * Creates the onboarding store.
 *
 * @returns {Type<OnboardingStoreInstance>} Injectable store constructor.
 */
function createOnboardingStore(): Type<OnboardingStoreInstance> {
  return signalStore(
    withState<OnboardingStoreState>({
      _confirmed: null,
      _presentation: null,
      _organizationId: null,
      _requested: false,
      _reading: false,
      _readFailed: false,
    }),
    withProps(() => {
      const api: OnboardingApi = inject(OnboardingApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const runs: OnboardingRuns = { generation: 0, reads: 0, tail: Promise.resolve() };
      return { _api: api, _workspace: workspace, _runs: runs };
    }),
    withComputed((store) => ({
      progress: (): OnboardingProgress | null => {
        const confirmed: OnboardingProgress | null = store._confirmed();
        const presentation: OnboardingChecklistPresentation | null = store._presentation();
        return confirmed === null || presentation === null
          ? confirmed
          : { ...confirmed, checklist: { ...confirmed.checklist, presentation } };
      },
      loading: (): boolean => store._confirmed() === null && store._reading(),
      failed: (): boolean =>
        store._confirmed() === null && !store._reading() && store._readFailed(),
    })),
    withMethods((store) => {
      const runs: OnboardingRuns = store._runs;

      const accept: (incoming: OnboardingProgress, generation: number) => void = (
        incoming: OnboardingProgress,
        generation: number,
      ): void => {
        if (generation !== runs.generation) return;
        const shown: OnboardingProgress | null = store._confirmed();
        if (shown !== null && incoming.version < shown.version) return;
        patchState(store, { _confirmed: incoming });
      };

      const read: () => Promise<OnboardingProgress | null> =
        async (): Promise<OnboardingProgress | null> => {
          const generation: number = runs.generation;
          runs.reads += 1;
          const sequence: number = runs.reads;
          const latest: () => boolean = (): boolean =>
            generation === runs.generation && sequence === runs.reads;
          patchState(store, { _reading: true });
          try {
            accept(await store._api.get(), generation);
            if (latest()) patchState(store, { _reading: false, _readFailed: false });
          } catch (error: unknown) {
            if (latest()) patchState(store, { _reading: false, _readFailed: true });
            throw error;
          }
          return generation === runs.generation ? store._confirmed() : null;
        };

      const write: (
        send: (version: number) => Promise<OnboardingProgress>,
        retryOnStale: boolean,
      ) => Promise<OnboardingProgress> = (
        send: (version: number) => Promise<OnboardingProgress>,
        retryOnStale: boolean,
      ): Promise<OnboardingProgress> => {
        const generation: number = runs.generation;
        const task: () => Promise<OnboardingProgress> = async (): Promise<OnboardingProgress> => {
          const base: OnboardingProgress | null =
            generation === runs.generation ? (store._confirmed() ?? (await read())) : null;
          if (base === null || generation !== runs.generation) {
            throw new Error(ORGANIZATION_CHANGED);
          }
          try {
            const saved: OnboardingProgress = await send(base.version);
            accept(saved, generation);
            return saved;
          } catch (error: unknown) {
            const problem: ApiProblem | null = readProblem(error);
            if (retryOnStale && isVersionMismatch(problem)) {
              const fresh: OnboardingProgress | null = await read();
              if (fresh === null) throw error;
              const saved: OnboardingProgress = await send(fresh.version);
              accept(saved, generation);
              return saved;
            }
            const code: string | null = problem?.code ?? null;
            if (code !== null && REREAD_CODES.has(code)) {
              await read().catch((): null => null);
            }
            throw error;
          }
        };
        const run: Promise<OnboardingProgress> = runs.tail.then(task, task);
        runs.tail = run.catch((): undefined => undefined);
        return run;
      };

      return {
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          runs.generation += 1;
          patchState(store, {
            _organizationId: organizationId,
            _confirmed: null,
            _presentation: null,
            _reading: false,
            _readFailed: false,
          });
          if (store._requested()) void read().catch((): null => null);
        }),
        load(): void {
          if (store._requested()) return;
          patchState(store, { _requested: true });
          void read().catch((): null => null);
        },
        async reload(): Promise<void> {
          patchState(store, { _requested: true });
          await read().catch((): null => null);
        },
        saveDraft(draft: OnboardingDraft): Promise<OnboardingProgress> {
          return write(
            (version: number): Promise<OnboardingProgress> => store._api.saveDraft(draft, version),
            true,
          );
        },
        dismiss(): Promise<OnboardingProgress> {
          return write(
            (version: number): Promise<OnboardingProgress> => store._api.dismiss(version),
            true,
          );
        },
        finish(space: OnboardingSpace, idempotencyKey: string): Promise<OnboardingProgress> {
          return write(
            (version: number): Promise<OnboardingProgress> =>
              store._api.finish(space, version, idempotencyKey),
            false,
          );
        },
        async setPresentation(presentation: OnboardingChecklistPresentation): Promise<void> {
          const shown: OnboardingProgress | null = store.progress();
          if (!shown?.provisioning || shown.checklist.presentation === presentation) return;
          patchState(store, { _presentation: presentation });
          try {
            await write(
              (version: number): Promise<OnboardingProgress> =>
                store._api.updateChecklist({ presentation }, version),
              true,
            );
          } finally {
            if (store._presentation() === presentation) patchState(store, { _presentation: null });
          }
        },
        async recordInvitation(): Promise<void> {
          if (store._confirmed()?.checklist.invitationSent === true) return;
          await write(
            (version: number): Promise<OnboardingProgress> =>
              store._api.updateChecklist({ invitationSent: true }, version),
            true,
          );
        },
        async recordBoardTried(): Promise<void> {
          const shown: OnboardingProgress | null = store._confirmed();
          if (!shown?.provisioning || shown.checklist.boardTried) return;
          await write(
            (version: number): Promise<OnboardingProgress> =>
              store._api.updateChecklist({ boardTried: true }, version),
            true,
          );
        },
      };
    }),
    withHooks({
      onInit(store): void {
        patchState(store, { _organizationId: store._workspace.organization().id });
        store._followOrganization(computed((): string => store._workspace.organization().id));
      },
    }),
  );
}

/**
 * Constant OnboardingStore
 *
 * @description
 * The person's onboarding in the current organization, provided once on the `/:org` route by
 * `provideOnboarding()` and shared by the assistant and the getting-started checklist, so both
 * show the same version and their writes are sent one after the other, each with the `If-Match` of
 * the version the previous one answered. Nothing is read until a screen calls `load()`; an
 * organization switch drops the progress shown and the answers still under way, and reads the new
 * organization's progress when a screen had asked for it. Leaving `/:org` destroys it.
 *
 * @type {Type<OnboardingStoreInstance>}
 */
export const OnboardingStore: Type<OnboardingStoreInstance> = createOnboardingStore();

/**
 * Type OnboardingStore
 *
 * @description
 * Instance type of the onboarding store.
 *
 * @type {OnboardingStoreInstance}
 */
export type OnboardingStore = OnboardingStoreInstance;
