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

import { type ApiProblem, OrganizationPin, readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import {
  isDroppedOnboardingWrite,
  isUncertainOnboardingWrite,
  OnboardingApi,
} from '../../data-access/services/onboarding-api/onboarding-api.service';
import type {
  OnboardingDraft,
  OnboardingProgress,
  OnboardingSpace,
} from '../../models/onboarding/onboarding.interface';
import type { OnboardingChecklistPresentation } from '../../models/onboarding/onboarding.type';
import { OnboardingWriteDroppedError } from './onboarding-write-dropped.error';

/**
 * Constant REREAD_CODES
 *
 * @description
 * Definite refusals after which the state shown is out of date: another tab finished or dismissed
 * the assistant, the checklist is not available yet, or the version moved on.
 *
 * @type {ReadonlySet<string>}
 */
const REREAD_CODES: ReadonlySet<string> = new Set([
  'onboarding.wizard-closed',
  'onboarding.checklist-unavailable',
  'request.version-mismatch',
]);

/**
 * Function isVersionMismatch
 *
 * @description
 * Whether a failure is the stale version refusal (`412 request.version-mismatch`), not the
 * organization pin's (`412 organization.context-changed`, a dropped write).
 *
 * @param {ApiProblem | null} problem - The failure read.
 * @returns {boolean} Whether the version was stale.
 */
function isVersionMismatch(problem: ApiProblem | null): boolean {
  return problem?.status === 412 && problem.code === 'request.version-mismatch';
}

/**
 * Function draftShown
 *
 * @description
 * Whether a progress leaves nothing to send for a draft change: the assistant is closed (a draft
 * would be refused), or every member the change gives already has its value.
 *
 * @param {OnboardingProgress} progress - The progress read.
 * @param {OnboardingDraft} draft - The change.
 * @returns {boolean} Whether the change is settled.
 */
function draftShown(progress: OnboardingProgress, draft: OnboardingDraft): boolean {
  const wizard: OnboardingProgress['wizard'] = progress.wizard;
  return (
    wizard.status !== 'in-progress' ||
    ((draft.step === undefined || draft.step === wizard.step) &&
      (draft.preset === undefined || draft.preset === wizard.preset) &&
      (draft.name === undefined || draft.name === wizard.name) &&
      (draft.prefix === undefined || draft.prefix === wizard.prefix) &&
      (draft.color === undefined || draft.color === wizard.color))
  );
}

/**
 * Interface OnboardingWrite
 *
 * @description
 * One write of the store: how to send it, and when a progress read shows nothing left to send.
 */
interface OnboardingWrite {
  // #region Properties
  /**
   * Property send
   *
   * @description
   * Sends the write from a version.
   *
   * @type {(version: number) => Promise<OnboardingProgress>}
   * @readonly
   */
  readonly send: (version: number) => Promise<OnboardingProgress>;

  /**
   * Property settled
   *
   * @description
   * Whether a progress read shows the write applied, or makes it moot (a closed assistant, a
   * dismissed checklist): it is then not sent again.
   *
   * @type {(progress: OnboardingProgress) => boolean}
   * @readonly
   */
  readonly settled: (progress: OnboardingProgress) => boolean;

  /**
   * Property recovers
   *
   * @description
   * Whether the store reads and sends again by itself: once after a stale version, and a read
   * after an uncertain outcome. False for `finish`, whose caller owns the idempotency key.
   *
   * @type {boolean}
   * @readonly
   */
  readonly recovers: boolean;
  // #endregion
}

/**
 * Interface PendingPresentation
 *
 * @description
 * A checklist presentation shown before the gateway confirms it.
 */
interface PendingPresentation {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The presentation shown.
   *
   * @type {OnboardingChecklistPresentation}
   * @readonly
   */
  readonly value: OnboardingChecklistPresentation;

  /**
   * Property sequence
   *
   * @description
   * Number of the `setPresentation` call that showed it; only that call clears it.
   *
   * @type {number}
   * @readonly
   */
  readonly sequence: number;
  // #endregion
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
   * @type {PendingPresentation | null}
   * @readonly
   */
  readonly _presentation: PendingPresentation | null;

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
   * Property presentations
   *
   * @description
   * Number of the latest `setPresentation` call.
   *
   * @type {number}
   */
  presentations: number;

  /**
   * Property tail
   *
   * @description
   * The last write queued in this organization: writes are sent one after the other, each from the
   * version the previous one answered. A switch starts a new queue.
   *
   * @type {Promise<unknown>}
   */
  tail: Promise<unknown>;

  /**
   * Property reading
   *
   * @description
   * Aborts the reads of this organization; a switch aborts it and starts a new one.
   *
   * @type {AbortController}
   */
  reading: AbortController;

  /**
   * Property destroyed
   *
   * @description
   * Whether the store's route was destroyed (the person left the workspace): nothing more is sent
   * or applied.
   *
   * @type {boolean}
   */
  destroyed: boolean;
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
   * progress and sends once more, unless the read shows the change or a closed assistant. After an
   * uncertain outcome it reads the progress and resolves when the read shows the change. After
   * `409 onboarding.wizard-closed` it reads the progress, then rejects.
   *
   * @param {OnboardingDraft} draft - The change.
   * @returns {Promise<OnboardingProgress>} The progress saved, or read.
   * @throws {OnboardingWriteDroppedError} When the organization changed, or the write was dropped
   * for another session organization.
   * @throws {unknown} The client's error otherwise (`isUncertainOnboardingWrite` tells an unknown
   * outcome from a refusal).
   */
  saveDraft(draft: OnboardingDraft): Promise<OnboardingProgress>;

  /**
   * Method dismiss
   *
   * @description
   * Closes the assistant for good (`Set up later`), with the same recovery as `saveDraft`; an
   * assistant already closed counts as done.
   *
   * @returns {Promise<OnboardingProgress>} The progress saved, or read.
   * @throws {OnboardingWriteDroppedError} When the organization changed, or the write was dropped
   * for another session organization.
   * @throws {unknown} The client's error otherwise.
   */
  dismiss(): Promise<OnboardingProgress>;

  /**
   * Method finish
   *
   * @description
   * Provisions the first space and finishes the assistant. It never sends twice by itself: after an
   * uncertain outcome (`isUncertainOnboardingWrite`, `409 idempotency.request-in-progress`
   * included) it rejects at once, and the caller sends again with the same key. After `412` or
   * `409 onboarding.wizard-closed` it reads the progress, then rejects, and the caller decides the
   * next key and body.
   *
   * @param {OnboardingSpace} space - The space to provision.
   * @param {string} idempotencyKey - Key of this body; the same key again after an unknown outcome.
   * @returns {Promise<OnboardingProgress>} The finished progress, with its provisioning.
   * @throws {OnboardingWriteDroppedError} When the organization changed, or the write was dropped
   * for another session organization.
   * @throws {unknown} The client's error otherwise.
   */
  finish(space: OnboardingSpace, idempotencyKey: string): Promise<OnboardingProgress>;

  /**
   * Method setPresentation
   *
   * @description
   * Expands, collapses or dismisses the checklist at once, then saves it. A definite refusal
   * restores the confirmed presentation and rejects, for the caller's failure toast; an uncertain
   * outcome reads the progress and keeps the presentation when the read shows it. Nothing is sent
   * before a space is provisioned, nor when the presentation is already the one shown; after a
   * stale version it is not sent again when the read shows it or a dismissed checklist.
   *
   * @param {OnboardingChecklistPresentation} presentation - The presentation.
   * @returns {Promise<void>} Resolves once saved, or once a read shows it.
   * @throws {OnboardingWriteDroppedError} When the organization changed, or the write was dropped
   * for another session organization.
   * @throws {unknown} The client's error otherwise.
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
   * @throws {OnboardingWriteDroppedError} When the organization changed, or the write was dropped
   * for another session organization.
   * @throws {unknown} The client's error otherwise.
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
   * @throws {OnboardingWriteDroppedError} When the organization changed, or the write was dropped
   * for another session organization.
   * @throws {unknown} The client's error otherwise.
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
      const pin: OrganizationPin = inject(OrganizationPin);
      const runs: OnboardingRuns = {
        generation: 0,
        reads: 0,
        presentations: 0,
        tail: Promise.resolve(),
        reading: new AbortController(),
        destroyed: false,
      };
      return { _api: api, _workspace: workspace, _pin: pin, _runs: runs };
    }),
    withComputed((store) => ({
      progress: (): OnboardingProgress | null => {
        const confirmed: OnboardingProgress | null = store._confirmed();
        const pending: PendingPresentation | null = store._presentation();
        return confirmed === null || pending === null
          ? confirmed
          : { ...confirmed, checklist: { ...confirmed.checklist, presentation: pending.value } };
      },
      loading: (): boolean => store._confirmed() === null && store._reading(),
      failed: (): boolean =>
        store._confirmed() === null && !store._reading() && store._readFailed(),
    })),
    withMethods((store) => {
      const runs: OnboardingRuns = store._runs;

      // The resolver commits another organization (workspace context and pin) synchronously,
      // before the `_followOrganization` effect moves the generation, and a destroyed store keeps
      // its last context while the global pin moves on: check all of them, so nothing is sent
      // under another organization's pin or applied in between.
      const live: (generation: number) => boolean = (generation: number): boolean => {
        const organizationId: string | null = store._organizationId();
        return (
          !runs.destroyed &&
          generation === runs.generation &&
          store._workspace.organization().id === organizationId &&
          store._pin.current() === organizationId
        );
      };

      const accept: (incoming: OnboardingProgress, generation: number) => void = (
        incoming: OnboardingProgress,
        generation: number,
      ): void => {
        if (!live(generation)) return;
        const shown: OnboardingProgress | null = store._confirmed();
        if (shown !== null && incoming.version < shown.version) return;
        patchState(store, { _confirmed: incoming });
      };

      const read: () => Promise<OnboardingProgress | null> =
        async (): Promise<OnboardingProgress | null> => {
          const generation: number = runs.generation;
          if (!live(generation)) return null;
          runs.reads += 1;
          const sequence: number = runs.reads;
          const latest: () => boolean = (): boolean => live(generation) && sequence === runs.reads;
          patchState(store, { _reading: true });
          try {
            accept(await store._api.get(runs.reading.signal), generation);
            if (latest()) patchState(store, { _reading: false, _readFailed: false });
          } catch (error: unknown) {
            if (latest()) patchState(store, { _reading: false, _readFailed: true });
            throw error;
          }
          return live(generation) ? store._confirmed() : null;
        };

      const reread: (
        generation: number,
        error?: unknown,
      ) => Promise<OnboardingProgress | null> = async (
        generation: number,
        error?: unknown,
      ): Promise<OnboardingProgress | null> => {
        const fresh: OnboardingProgress | null = await read().catch((): null => null);
        if (!live(generation)) throw new OnboardingWriteDroppedError(error);
        return fresh;
      };

      const attempt: (
        write: OnboardingWrite,
        version: number,
        generation: number,
        mayResend: boolean,
      ) => Promise<OnboardingProgress> = async (
        write: OnboardingWrite,
        version: number,
        generation: number,
        mayResend: boolean,
      ): Promise<OnboardingProgress> => {
        if (!live(generation)) throw new OnboardingWriteDroppedError();
        let saved: OnboardingProgress;
        try {
          saved = await write.send(version);
        } catch (error: unknown) {
          if (!live(generation) || isDroppedOnboardingWrite(error)) {
            throw new OnboardingWriteDroppedError(error);
          }
          if (isUncertainOnboardingWrite(error)) {
            if (!write.recovers) throw error;
            const fresh: OnboardingProgress | null = await reread(generation, error);
            if (fresh !== null && write.settled(fresh)) return fresh;
            throw error;
          }
          const problem: ApiProblem | null = readProblem(error);
          if (write.recovers && mayResend && isVersionMismatch(problem)) {
            const fresh: OnboardingProgress | null = await reread(generation, error);
            if (fresh === null) throw error;
            if (write.settled(fresh)) return fresh;
            return attempt(write, fresh.version, generation, false);
          }
          const code: string | null = problem?.code ?? null;
          if (code !== null && REREAD_CODES.has(code)) {
            await reread(generation, error);
          }
          throw error;
        }
        if (!live(generation)) throw new OnboardingWriteDroppedError();
        accept(saved, generation);
        return saved;
      };

      const queue: (write: OnboardingWrite) => Promise<OnboardingProgress> = (
        write: OnboardingWrite,
      ): Promise<OnboardingProgress> => {
        const generation: number = runs.generation;
        const task: () => Promise<OnboardingProgress> = async (): Promise<OnboardingProgress> => {
          if (!live(generation)) throw new OnboardingWriteDroppedError();
          const base: OnboardingProgress | null = store._confirmed() ?? (await read());
          if (base === null || !live(generation)) throw new OnboardingWriteDroppedError();
          return attempt(write, base.version, generation, true);
        };
        const run: Promise<OnboardingProgress> = runs.tail.then(task, task);
        runs.tail = run.catch((): undefined => undefined);
        return run;
      };

      return {
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          runs.generation += 1;
          runs.tail = Promise.resolve();
          runs.reading.abort();
          runs.reading = new AbortController();
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
          return queue({
            send: (version: number): Promise<OnboardingProgress> =>
              store._api.saveDraft(draft, version),
            settled: (progress: OnboardingProgress): boolean => draftShown(progress, draft),
            recovers: true,
          });
        },
        dismiss(): Promise<OnboardingProgress> {
          return queue({
            send: (version: number): Promise<OnboardingProgress> => store._api.dismiss(version),
            settled: (progress: OnboardingProgress): boolean =>
              progress.wizard.status !== 'in-progress',
            recovers: true,
          });
        },
        finish(space: OnboardingSpace, idempotencyKey: string): Promise<OnboardingProgress> {
          return queue({
            send: (version: number): Promise<OnboardingProgress> =>
              store._api.finish(space, version, idempotencyKey),
            settled: (): boolean => false,
            recovers: false,
          });
        },
        async setPresentation(presentation: OnboardingChecklistPresentation): Promise<void> {
          const shown: OnboardingProgress | null = store.progress();
          if (!shown?.provisioning || shown.checklist.presentation === presentation) return;
          runs.presentations += 1;
          const sequence: number = runs.presentations;
          const generation: number = runs.generation;
          patchState(store, { _presentation: { value: presentation, sequence } });
          try {
            await queue({
              send: (version: number): Promise<OnboardingProgress> =>
                store._api.updateChecklist({ presentation }, version),
              settled: (progress: OnboardingProgress): boolean =>
                progress.checklist.presentation === presentation ||
                progress.checklist.presentation === 'dismissed',
              recovers: true,
            });
          } finally {
            if (live(generation) && store._presentation()?.sequence === sequence) {
              patchState(store, { _presentation: null });
            }
          }
        },
        async recordInvitation(): Promise<void> {
          if (store._confirmed()?.checklist.invitationSent === true) return;
          await queue({
            send: (version: number): Promise<OnboardingProgress> =>
              store._api.updateChecklist({ invitationSent: true }, version),
            settled: (progress: OnboardingProgress): boolean => progress.checklist.invitationSent,
            recovers: true,
          });
        },
        async recordBoardTried(): Promise<void> {
          const shown: OnboardingProgress | null = store._confirmed();
          if (!shown?.provisioning || shown.checklist.boardTried) return;
          await queue({
            send: (version: number): Promise<OnboardingProgress> =>
              store._api.updateChecklist({ boardTried: true }, version),
            settled: (progress: OnboardingProgress): boolean => progress.checklist.boardTried,
            recovers: true,
          });
        },
      };
    }),
    withHooks({
      onInit(store): void {
        patchState(store, { _organizationId: store._workspace.organization().id });
        store._followOrganization(computed((): string => store._workspace.organization().id));
      },
      onDestroy(store): void {
        const runs: OnboardingRuns = store._runs;
        runs.destroyed = true;
        runs.generation += 1;
        runs.tail = Promise.resolve();
        runs.reading.abort();
      },
    }),
  );
}

/**
 * Constant OnboardingStore
 *
 * @description
 * The person's onboarding in the current organization, provided once on the `/:org` route by
 * `provideOnboarding()` and shared by the assistant and the getting-started checklist (both step
 * 9 packages), so both show the same version and their writes are sent one after the other, each
 * with the `If-Match` of the version the previous one answered. Nothing is read until a screen
 * calls `load()`. Every write and answer is fenced on the organization it started in: once the
 * workspace or `OrganizationPin` (whose organization stamps the requests) shows another
 * organization, or the store is destroyed, nothing more of it is sent or applied, and its caller
 * gets `OnboardingWriteDroppedError`. A switch then drops the progress, aborts the reads, starts a
 * new write queue and reads the new organization's progress when a screen had asked for it.
 * Leaving `/:org` destroys it: its reads are aborted and its queued and unanswered writes are
 * dropped. The reads are hand-rolled rather than a `resource()`: the writes share their version
 * and queue, a failed refresh must keep the progress shown, and nothing reads until a screen asks.
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
