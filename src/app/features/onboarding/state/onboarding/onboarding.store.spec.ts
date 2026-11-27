import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type {
  WorkspaceContextPort,
  WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { OnboardingApi } from '../../data-access/services/onboarding-api/onboarding-api.service';
import type { OnboardingProgress } from '../../models/onboarding/onboarding.interface';
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
 * Function progress
 *
 * @description
 * An onboarding progress at a version: the initial draft, or a finished assistant with its space.
 *
 * @param {number} version - Its version.
 * @param {boolean} provisioned - Whether the first space was provisioned.
 * @returns {OnboardingProgress} The progress.
 */
function progress(version: number, provisioned: boolean = false): OnboardingProgress {
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
      presentation: 'expanded',
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

  /**
   * Function setup
   *
   * @description
   * Creates the store over the fake data access, in Atelier Nord.
   *
   * @returns {OnboardingStore} The store.
   */
  function setup(): OnboardingStore {
    organization = signal(ATELIER_NORD);
    const workspace: Pick<WorkspaceContextPort, 'organization'> = { organization };
    TestBed.configureTestingModule({
      providers: [
        OnboardingStore,
        { provide: OnboardingApi, useValue: api },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
    const store: OnboardingStore = TestBed.inject(OnboardingStore);
    TestBed.tick();
    return store;
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

  it('reads the version again and sends once more after a stale version', async () => {
    const store: OnboardingStore = setup();
    await store.reload();
    api.saveDraft.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce(progress(6));

    await expect(store.saveDraft({ step: 'preset' })).resolves.toMatchObject({ version: 7 });

    expect(api.saveDraft.mock.calls.map((call: unknown[]) => call[1])).toEqual([1, 6]);
    expect(store.progress()?.version).toBe(7);
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

  it('never sends a finish twice by itself after a stale version', async () => {
    const store: OnboardingStore = setup();
    await store.reload();
    api.finish.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce(progress(3));

    await expect(
      store.finish({ name: 'Product', prefix: 'PRO', preset: 'dev', color: 'violet' }, 'key-1'),
    ).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(api.finish).toHaveBeenCalledTimes(1);
    expect(store.progress()?.version).toBe(3);
  });

  it('provisions the first space with the version shown and the key given', async () => {
    const store: OnboardingStore = setup();
    await store.reload();

    await store.finish({ name: 'Product', prefix: 'PRO', preset: 'dev', color: 'violet' }, 'k1');

    expect(api.finish).toHaveBeenCalledWith(
      { name: 'Product', prefix: 'PRO', preset: 'dev', color: 'violet' },
      1,
      'k1',
    );
    expect(store.progress()?.provisioning?.spaceId).toBe('sp-product');
  });

  it('collapses the checklist at once and restores it when the save fails', async () => {
    api.get.mockResolvedValue(progress(4, true));
    const store: OnboardingStore = setup();
    await store.reload();
    let refuse: (error: unknown) => void = (): void => undefined;
    api.updateChecklist.mockReturnValueOnce(
      new Promise((_resolve: unknown, reject: (error: unknown) => void) => {
        refuse = reject;
      }),
    );

    const saving: Promise<void> = store.setPresentation('collapsed');
    expect(store.progress()?.checklist.presentation).toBe('collapsed');
    await vi.waitFor(() => {
      expect(api.updateChecklist).toHaveBeenCalledWith({ presentation: 'collapsed' }, 4);
    });
    refuse(problem(503, 'service.unavailable'));

    await expect(saving).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.progress()?.checklist.presentation).toBe('expanded');
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

  it('drops an answer older than the progress shown', async () => {
    const store: OnboardingStore = setup();
    await store.reload();
    await store.saveDraft({ step: 'preset' });
    api.get.mockResolvedValueOnce(progress(1));

    await store.reload();

    expect(store.progress()?.version).toBe(2);
  });

  it('drops the progress of the previous organization and reads the new one', async () => {
    const store: OnboardingStore = setup();
    await store.reload();
    let answer: (value: OnboardingProgress) => void = (): void => undefined;
    api.saveDraft.mockReturnValueOnce(
      new Promise((resolve: (value: OnboardingProgress) => void) => {
        answer = resolve;
      }),
    );
    const saving: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
    await vi.waitFor(() => {
      expect(api.saveDraft).toHaveBeenCalledTimes(1);
    });
    api.get.mockResolvedValueOnce(progress(9, true));

    organization.set({ ...ATELIER_NORD, id: 'o-studio', slug: 'studio-pixel' });
    TestBed.tick();
    await vi.waitFor(() => {
      expect(store.progress()?.version).toBe(9);
    });
    answer(progress(12));
    await saving;

    expect(store.progress()?.version).toBe(9);
    expect(store.progress()?.provisioning?.spaceId).toBe('sp-product');
  });

  it('never sends a stale write again to the next organization', async () => {
    const store: OnboardingStore = setup();
    await store.reload();
    let refuse: (error: unknown) => void = (): void => undefined;
    api.saveDraft.mockReturnValueOnce(
      new Promise((_resolve: unknown, reject: (error: unknown) => void) => {
        refuse = reject;
      }),
    );
    const saving: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
    await vi.waitFor(() => {
      expect(api.saveDraft).toHaveBeenCalledTimes(1);
    });

    organization.set({ ...ATELIER_NORD, id: 'o-studio', slug: 'studio-pixel' });
    TestBed.tick();
    refuse(problem(412, 'request.version-mismatch'));

    await expect(saving).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(api.saveDraft).toHaveBeenCalledTimes(1);
  });

  it('never sends a write queued for the previous organization', async () => {
    const store: OnboardingStore = setup();
    await store.reload();

    const saving: Promise<OnboardingProgress> = store.saveDraft({ step: 'preset' });
    organization.set({ ...ATELIER_NORD, id: 'o-studio', slug: 'studio-pixel' });
    TestBed.tick();

    await expect(saving).rejects.toThrow('The workspace organization changed');
    expect(api.saveDraft).not.toHaveBeenCalled();
  });
});
