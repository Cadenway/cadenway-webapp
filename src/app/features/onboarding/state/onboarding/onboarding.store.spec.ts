import { HttpErrorResponse } from '@angular/common/http';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  signal,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';
import type {
  WorkspaceContextPort,
  WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { OnboardingApi } from '../../data-access/services/onboarding-api/onboarding-api.service';
import type { OnboardingProgress } from '../../models/onboarding/onboarding.interface';
import type { OnboardingChecklistPresentation } from '../../models/onboarding/onboarding.type';
import { OnboardingWriteDroppedError } from './onboarding-write-dropped.error';
import { OnboardingStore } from './onboarding.store';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization the workspace opens with.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o-atelier',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

/**
 * Constant STUDIO_PIXEL
 *
 * @description
 * The organization the workspace switches to.
 *
 * @type {WorkspaceOrganization}
 */
const STUDIO_PIXEL: WorkspaceOrganization = {
  ...ATELIER_NORD,
  id: 'o-studio',
  slug: 'studio-pixel',
  name: 'Studio Pixel',
  initials: 'SP',
};

/**
 * Constant SPACE
 *
 * @description
 * The first space the assistant provisions.
 *
 * @type {{ name: string; prefix: string; preset: 'dev'; color: 'violet' }}
 */
const SPACE: { name: string; prefix: string; preset: 'dev'; color: 'violet' } = {
  name: 'Product',
  prefix: 'PRO',
  preset: 'dev',
  color: 'violet',
};

/**
 * Function progress
 *
 * @description
 * An onboarding progress at a version: the initial draft, or a finished assistant with its space.
 *
 * @param {number} version - Its version.
 * @param {boolean} provisioned - Whether the first space was provisioned.
 * @param {OnboardingChecklistPresentation} presentation - The checklist presentation.
 * @returns {OnboardingProgress} The progress.
 */
function progress(
  version: number,
  provisioned: boolean = false,
  presentation: OnboardingChecklistPresentation = 'expanded',
): OnboardingProgress {
  return {
    version,
    wizard: {
      status: provisioned ? 'finished' : 'in-progress',
      step: 'space',
      preset: 'dev',
      name: provisioned ? 'Product' : null,
      prefix: provisioned ? 'PRO' : null,
      color: 'violet',
    },
    provisioning: provisioned ? { spaceId: 'sp-product', firstListId: 'l-backlog' } : null,
    checklist: {
      presentation,
      firstTaskCreated: false,
      invitationSent: false,
      boardTried: false,
    },
  };
}

/**
 * Function problem
 *
 * @description
 * A gateway refusal with a problem code.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The refusal.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code } });
}

/**
 * Interface Deferred
 *
 * @description
 * A promise settled by the test.
 */
interface Deferred<T> {
  // #region Properties
  /**
   * Property promise
   *
   * @description
   * The promise.
   *
   * @type {Promise<T>}
   * @readonly
   */
  readonly promise: Promise<T>;

  /**
   * Property resolve
   *
   * @description
   * Fulfils it.
   *
   * @type {(value: T) => void}
   * @readonly
   */
  readonly resolve: (value: T) => void;

  /**
   * Property reject
   *
   * @description
   * Rejects it.
   *
   * @type {(error: unknown) => void}
   * @readonly
   */
  readonly reject: (error: unknown) => void;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * A promise the test settles.
 *
 * @returns {Deferred<T>} The promise and its settlers.
 */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = (): void => undefined;
  let reject: (error: unknown) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>(
    (yes: (value: T) => void, no: (error: unknown) => void) => {
      resolve = yes;
      reject = no;
    },
  );
  return { promise, resolve, reject };
}

/**
 * Interface FakeOnboardingApi
 *
 * @description
 * The data-access methods the store calls.
 */
interface FakeOnboardingApi {
  // #region Properties
  /**
   * Property get
   *
   * @description
   * Read of the progress.
   *
   * @type {Mock}
   */
  get: Mock;

  /**
   * Property saveDraft
   *
   * @description
   * Draft write.
   *
   * @type {Mock}
   */
  saveDraft: Mock;

  /**
   * Property dismiss
   *
   * @description
   * Dismissal.
   *
   * @type {Mock}
   */
  dismiss: Mock;

  /**
   * Property finish
   *
   * @description
   * Provisioning.
   *
   * @type {Mock}
   */
  finish: Mock;

  /**
   * Property updateChecklist
   *
   * @description
   * Checklist write.
   *
   * @type {Mock}
   */
  updateChecklist: Mock;
  // #endregion
}

describe('OnboardingStore', () => {
  let api: FakeOnboardingApi;
  let organization: WritableSignal<WorkspaceOrganization>;
  let pin: OrganizationPin;
  let route: EnvironmentInjector;

  /**
   * Function setup
   *
   * @description
   * Creates the store over the fake data access, in Atelier Nord, in a route injector the test
   * may destroy as leaving `/:org` does.
   *
   * @returns {OnboardingStore} The store.
   */
  function setup(): OnboardingStore {
    organization = signal(ATELIER_NORD);
    const workspace: Pick<WorkspaceContextPort, 'organization'> = { organization };
    TestBed.configureTestingModule({
      providers: [
        { provide: OnboardingApi, useValue: api },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
    pin = TestBed.inject(OrganizationPin);
    pin.set(ATELIER_NORD.id);
    route = createEnvironmentInjector([OnboardingStore], TestBed.inject(EnvironmentInjector));
    const store: OnboardingStore = route.get(OnboardingStore);
    TestBed.tick();
    return store;
  }

  /**
   * Function provisioned
   *
   * @description
   * Creates the store and reads a finished assistant at version 4.
   *
   * @returns {Promise<OnboardingStore>} The store.
   */
  async function provisioned(): Promise<OnboardingStore> {
    api.get.mockResolvedValue(progress(4, true));
    const store: OnboardingStore = setup();
    await store.reload();
    return store;
  }

  /**
   * Function switchOrganization
   *
   * @description
   * Commits Studio Pixel in the workspace and the pin, as the resolver does, then flushes the
   * store's reaction.
   */
  function switchOrganization(): void {
    organization.set(STUDIO_PIXEL);
    pin.set(STUDIO_PIXEL.id);
    TestBed.tick();
  }

  beforeEach(() => {
    api = {
      get: vi.fn(() => Promise.resolve(progress(1))),
      saveDraft: vi.fn((_draft: unknown, version: number) =>
        Promise.resolve(progress(version + 1)),
      ),
      dismiss: vi.fn((version: number) =>
        Promise.resolve({
          ...progress(version + 1),
          wizard: { ...progress(1).wizard, status: 'dismissed' },
        }),
      ),
      finish: vi.fn((_space: unknown, version: number) =>
        Promise.resolve(progress(version + 1, true)),
      ),
      updateChecklist: vi.fn(() => Promise.resolve(progress(5, true))),
    };
  });

  describe('reads', () => {
    it('reads nothing until a screen asks, then reads once', async () => {
      const store: OnboardingStore = setup();
      expect(api.get).not.toHaveBeenCalled();

      store.load();
      expect(store.loading()).toBe(true);
      store.load();
      await vi.waitFor(() => {
        expect(store.progress()?.version).toBe(1);
      });

      expect(api.get).toHaveBeenCalledTimes(1);
      expect(store.loading()).toBe(false);
      expect(store.failed()).toBe(false);
    });

    it('flags a failed first read and reads again on reload', async () => {
      api.get.mockRejectedValueOnce(problem(503, 'service.unavailable'));
      const store: OnboardingStore = setup();

      store.load();
      await vi.waitFor(() => {
        expect(store.failed()).toBe(true);
      });
      expect(store.progress()).toBeNull();

      await store.reload();

      expect(api.get).toHaveBeenCalledTimes(2);
      expect(store.failed()).toBe(false);
      expect(store.progress()?.version).toBe(1);
    });

    it('keeps the progress shown when a later read fails', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      api.get.mockRejectedValueOnce(problem(0, 'network'));

      await store.reload();

      expect(store.progress()?.version).toBe(1);
      expect(store.failed()).toBe(false);
    });

    it('drops an answer older than the progress shown', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      await store.saveDraft({ step: 'preset' });
      api.get.mockResolvedValueOnce(progress(1));

      await store.reload();

      expect(store.progress()?.version).toBe(2);
    });
  });

  describe('writes', () => {
    it('sends writes one after the other, each from the version the previous one answered', async () => {
      const store: OnboardingStore = setup();
      await store.reload();

      await Promise.all([
        store.saveDraft({ step: 'preset', name: 'Product' }),
        store.saveDraft({ step: 'team' }),
      ]);

      expect(api.saveDraft.mock.calls).toEqual([
        [{ step: 'preset', name: 'Product' }, 1],
        [{ step: 'team' }, 2],
      ]);
      expect(store.progress()?.version).toBe(3);
    });

    it('dismisses the assistant from the version shown', async () => {
      const store: OnboardingStore = setup();
      await store.reload();

      await expect(store.dismiss()).resolves.toMatchObject({ version: 2 });

      expect(api.dismiss).toHaveBeenCalledWith(1);
      expect(store.progress()?.wizard.status).toBe('dismissed');
    });

    it('reads the version again and sends once more after a stale version', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      api.saveDraft.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
      api.get.mockResolvedValueOnce(progress(6));

      await expect(store.saveDraft({ step: 'preset' })).resolves.toMatchObject({ version: 7 });

      expect(api.saveDraft.mock.calls.map((call: unknown[]) => call[1])).toEqual([1, 6]);
      expect(store.progress()?.version).toBe(7);
    });

    it('does not send again when the read after a stale version shows the change', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      api.saveDraft.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
      api.get.mockResolvedValueOnce({
        ...progress(6),
        wizard: { ...progress(6).wizard, step: 'preset' },
      });

      await expect(store.saveDraft({ step: 'preset' })).resolves.toMatchObject({ version: 6 });

      expect(api.saveDraft).toHaveBeenCalledTimes(1);
    });

    it('keeps the stale version refusal when the read after it fails', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      const stale: HttpErrorResponse = problem(412, 'request.version-mismatch');
      api.saveDraft.mockRejectedValueOnce(stale);
      api.get.mockRejectedValueOnce(problem(503, 'service.unavailable'));

      await expect(store.saveDraft({ step: 'preset' })).rejects.toBe(stale);

      expect(api.saveDraft).toHaveBeenCalledTimes(1);
    });

    it('reads the progress and rejects when another tab closed the assistant', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      api.dismiss.mockRejectedValueOnce(problem(409, 'onboarding.wizard-closed'));
      api.get.mockResolvedValueOnce(progress(4, true));

      await expect(store.dismiss()).rejects.toBeInstanceOf(HttpErrorResponse);

      expect(store.progress()?.wizard.status).toBe('finished');
      expect(store.progress()?.provisioning?.firstListId).toBe('l-backlog');
    });

    it('drops a write the organization pin blocked or refused', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      api.saveDraft
        .mockRejectedValueOnce(new OrganizationSwitchPendingError())
        .mockRejectedValueOnce(problem(412, 'organization.context-changed'));

      await expect(store.saveDraft({ step: 'preset' })).rejects.toBeInstanceOf(
        OnboardingWriteDroppedError,
      );
      await expect(store.saveDraft({ step: 'preset' })).rejects.toBeInstanceOf(
        OnboardingWriteDroppedError,
      );

      expect(api.saveDraft).toHaveBeenCalledTimes(2);
      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('finish', () => {
    it('provisions the first space with the version shown and the key given', async () => {
      const store: OnboardingStore = setup();
      await store.reload();

      await store.finish(SPACE, 'k1');

      expect(api.finish).toHaveBeenCalledWith(SPACE, 1, 'k1');
      expect(store.progress()?.provisioning?.spaceId).toBe('sp-product');
    });

    it('never sends a finish twice by itself after a stale version', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      api.finish.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
      api.get.mockResolvedValueOnce(progress(3));

      await expect(store.finish(SPACE, 'key-1')).rejects.toBeInstanceOf(HttpErrorResponse);

      expect(api.finish).toHaveBeenCalledTimes(1);
      expect(store.progress()?.version).toBe(3);
    });

    it('reads the progress when another tab closed the assistant before the finish', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      api.finish.mockRejectedValueOnce(problem(409, 'onboarding.wizard-closed'));
      api.get.mockResolvedValueOnce(progress(5, true));

      await expect(store.finish(SPACE, 'key-1')).rejects.toBeInstanceOf(HttpErrorResponse);

      expect(store.progress()?.wizard.status).toBe('finished');
    });

    it('leaves an uncertain finish to its caller, without a read or a second send', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      for (const failure of [
        problem(503, 'service.unavailable'),
        problem(409, 'idempotency.request-in-progress'),
      ]) {
        api.finish.mockRejectedValueOnce(failure);

        await expect(store.finish(SPACE, 'key-1')).rejects.toBe(failure);
      }

      expect(api.finish).toHaveBeenCalledTimes(2);
      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('checklist', () => {
    it('restores the presentation and rejects after a definite refusal', async () => {
      const store: OnboardingStore = await provisioned();
      const refused: HttpErrorResponse = problem(403, 'tasks.write-forbidden');
      api.updateChecklist.mockRejectedValueOnce(refused);

      const saving: Promise<void> = store.setPresentation('collapsed');
      expect(store.progress()?.checklist.presentation).toBe('collapsed');

      await expect(saving).rejects.toBe(refused);
      expect(store.progress()?.checklist.presentation).toBe('expanded');
    });

    it('keeps the presentation when the read after an uncertain outcome shows it', async () => {
      const store: OnboardingStore = await provisioned();
      api.updateChecklist.mockRejectedValueOnce(problem(503, 'service.unavailable'));
      api.get.mockResolvedValueOnce(progress(5, true, 'collapsed'));

      await expect(store.setPresentation('collapsed')).resolves.toBeUndefined();

      expect(store.progress()?.checklist.presentation).toBe('collapsed');
      expect(api.updateChecklist).toHaveBeenCalledTimes(1);
    });

    it('restores the presentation when the read after an uncertain outcome does not show it', async () => {
      const store: OnboardingStore = await provisioned();
      const lost: HttpErrorResponse = problem(503, 'service.unavailable');
      api.updateChecklist.mockRejectedValueOnce(lost);

      await expect(store.setPresentation('collapsed')).rejects.toBe(lost);

      expect(store.progress()?.checklist.presentation).toBe('expanded');
    });

    it('does not reopen a checklist the read after a stale version shows dismissed', async () => {
      const store: OnboardingStore = await provisioned();
      api.updateChecklist.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
      api.get.mockResolvedValueOnce(progress(6, true, 'dismissed'));

      await store.setPresentation('collapsed');

      expect(api.updateChecklist).toHaveBeenCalledTimes(1);
      expect(store.progress()?.checklist.presentation).toBe('dismissed');
    });

    it('reads the progress after the checklist was found unavailable', async () => {
      const store: OnboardingStore = await provisioned();
      api.updateChecklist.mockRejectedValueOnce(problem(409, 'onboarding.checklist-unavailable'));
      api.get.mockResolvedValueOnce(progress(6));

      await expect(store.setPresentation('collapsed')).rejects.toBeInstanceOf(HttpErrorResponse);

      expect(api.get).toHaveBeenCalledTimes(2);
      expect(store.progress()?.provisioning).toBeNull();
    });

    it('keeps the latest presentation shown while an earlier save settles', async () => {
      const store: OnboardingStore = await provisioned();
      const answers: Deferred<OnboardingProgress>[] = [deferred(), deferred(), deferred()];
      for (const answer of answers) api.updateChecklist.mockReturnValueOnce(answer.promise);

      const saves: Promise<void>[] = [
        store.setPresentation('collapsed'),
        store.setPresentation('expanded'),
        store.setPresentation('collapsed'),
      ];
      answers[0]?.resolve(progress(5, true, 'collapsed'));
      await vi.waitFor(() => {
        expect(api.updateChecklist).toHaveBeenCalledTimes(2);
      });
      answers[1]?.resolve(progress(6, true, 'expanded'));
      await vi.waitFor(() => {
        expect(api.updateChecklist).toHaveBeenCalledTimes(3);
      });

      expect(store.progress()?.checklist.presentation).toBe('collapsed');
      answers[2]?.resolve(progress(7, true, 'collapsed'));
      await Promise.all(saves);
      expect(store.progress()?.checklist.presentation).toBe('collapsed');
      expect(store.progress()?.version).toBe(7);
    });

    it('records the checklist markers only when they can and need to be', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      const marked: (
        version: number,
        invitationSent: boolean,
        boardTried: boolean,
      ) => OnboardingProgress = (
        version: number,
        invitationSent: boolean,
        boardTried: boolean,
      ): OnboardingProgress => ({
        ...progress(version, true),
        checklist: { ...progress(version, true).checklist, invitationSent, boardTried },
      });
      api.updateChecklist
        .mockResolvedValueOnce(marked(5, true, false))
        .mockResolvedValueOnce(marked(6, true, true));

      await store.recordBoardTried();
      await store.setPresentation('collapsed');
      expect(api.updateChecklist).not.toHaveBeenCalled();

      await store.recordInvitation();
      await store.recordInvitation();
      await store.recordBoardTried();
      await store.recordBoardTried();

      expect(api.updateChecklist.mock.calls).toEqual([
        [{ invitationSent: true }, 1],
        [{ boardTried: true }, 5],
      ]);
      expect(store.progress()?.checklist).toMatchObject({ invitationSent: true, boardTried: true });
    });
  });

  describe('organization switch', () => {
    it('reads nothing for the next organization when no screen asked', () => {
      setup();

      switchOrganization();

      expect(api.get).not.toHaveBeenCalled();
    });

    it('drops the progress of the previous organization and reads the new one', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      const answer: Deferred<OnboardingProgress> = deferred();
      api.saveDraft.mockReturnValueOnce(answer.promise);
      const saving: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
      await vi.waitFor(() => {
        expect(api.saveDraft).toHaveBeenCalledTimes(1);
      });
      api.get.mockResolvedValueOnce(progress(9, true));

      switchOrganization();
      await vi.waitFor(() => {
        expect(store.progress()?.version).toBe(9);
      });
      answer.resolve(progress(12));

      await expect(saving).rejects.toBeInstanceOf(OnboardingWriteDroppedError);
      expect(store.progress()?.version).toBe(9);
      expect(store.progress()?.provisioning?.spaceId).toBe('sp-product');
    });

    it('drops an answer and the queued writes as soon as the workspace commits another organization', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      const answer: Deferred<OnboardingProgress> = deferred();
      api.saveDraft.mockReturnValueOnce(answer.promise);
      const first: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
      const second: Promise<OnboardingProgress> = store.saveDraft({ step: 'team' });
      await vi.waitFor(() => {
        expect(api.saveDraft).toHaveBeenCalledTimes(1);
      });

      organization.set(STUDIO_PIXEL);
      pin.set(STUDIO_PIXEL.id);
      answer.resolve(progress(2));

      await expect(first).rejects.toBeInstanceOf(OnboardingWriteDroppedError);
      await expect(second).rejects.toBeInstanceOf(OnboardingWriteDroppedError);
      expect(api.saveDraft).toHaveBeenCalledTimes(1);
      expect(store.progress()?.version).toBe(1);
      TestBed.tick();
      await vi.waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2);
      });
    });

    it('never sends a stale write again to the next organization', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      const answer: Deferred<OnboardingProgress> = deferred();
      api.saveDraft.mockReturnValueOnce(answer.promise);
      const saving: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
      await vi.waitFor(() => {
        expect(api.saveDraft).toHaveBeenCalledTimes(1);
      });

      switchOrganization();
      answer.reject(problem(412, 'request.version-mismatch'));

      await expect(saving).rejects.toBeInstanceOf(OnboardingWriteDroppedError);
      expect(api.saveDraft).toHaveBeenCalledTimes(1);
    });

    it('never sends a write queued for the previous organization', async () => {
      const store: OnboardingStore = setup();
      await store.reload();

      const saving: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
      switchOrganization();

      await expect(saving).rejects.toBeInstanceOf(OnboardingWriteDroppedError);
      expect(api.saveDraft).not.toHaveBeenCalled();
    });

    it('sends the next organization’s writes while a previous one is still unanswered', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      const stalled: Deferred<OnboardingProgress> = deferred();
      api.saveDraft.mockReturnValueOnce(stalled.promise);
      const previous: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
      await vi.waitFor(() => {
        expect(api.saveDraft).toHaveBeenCalledTimes(1);
      });
      api.get.mockResolvedValue(progress(3));

      switchOrganization();

      await expect(store.saveDraft({ step: 'team' })).resolves.toMatchObject({ version: 4 });
      expect(api.saveDraft).toHaveBeenLastCalledWith({ step: 'team' }, 3);
      stalled.resolve(progress(2));
      await expect(previous).rejects.toBeInstanceOf(OnboardingWriteDroppedError);
      expect(store.progress()?.version).toBe(4);
    });

    it('aborts the read under way when the organization changes', () => {
      const store: OnboardingStore = setup();
      const signals: AbortSignal[] = [];
      api.get.mockImplementation((signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<OnboardingProgress>(() => undefined);
      });
      store.load();

      switchOrganization();

      expect(signals).toHaveLength(2);
      expect(signals[0]?.aborted).toBe(true);
      expect(signals[1]?.aborted).toBe(false);
    });
  });

  describe('leaving the workspace', () => {
    it('never sends a queued write once the store is destroyed and the pin moved on', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      const answer: Deferred<OnboardingProgress> = deferred();
      api.saveDraft.mockReturnValueOnce(answer.promise);
      const first: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
      const second: Promise<OnboardingProgress> = store.saveDraft({ step: 'team' });
      await vi.waitFor(() => {
        expect(api.saveDraft).toHaveBeenCalledTimes(1);
      });

      route.destroy();
      pin.set(STUDIO_PIXEL.id);
      answer.resolve(progress(2));

      await expect(first).rejects.toBeInstanceOf(OnboardingWriteDroppedError);
      await expect(second).rejects.toBeInstanceOf(OnboardingWriteDroppedError);
      expect(api.saveDraft).toHaveBeenCalledTimes(1);
    });

    it('neither reads nor sends again after a stale version once the store is destroyed', async () => {
      const store: OnboardingStore = setup();
      await store.reload();
      const answer: Deferred<OnboardingProgress> = deferred();
      api.saveDraft.mockReturnValueOnce(answer.promise);
      const saving: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
      await vi.waitFor(() => {
        expect(api.saveDraft).toHaveBeenCalledTimes(1);
      });

      route.destroy();
      pin.set(STUDIO_PIXEL.id);
      answer.reject(problem(412, 'request.version-mismatch'));

      await expect(saving).rejects.toBeInstanceOf(OnboardingWriteDroppedError);
      expect(api.saveDraft).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledTimes(1);
    });

    it('refuses a write while the pin names another organization than the store', async () => {
      const store: OnboardingStore = setup();
      await store.reload();

      pin.set(STUDIO_PIXEL.id);

      await expect(store.saveDraft({ step: 'preset' })).rejects.toBeInstanceOf(
        OnboardingWriteDroppedError,
      );
      expect(organization().id).toBe(ATELIER_NORD.id);
      expect(api.saveDraft).not.toHaveBeenCalled();
    });
  });
});
