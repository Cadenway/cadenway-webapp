import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';
import type { LookColor } from '@features/spaces/utils/space-look';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { OnboardingApi } from '../../data-access/services/onboarding-api/onboarding-api.service';
import type {
  OnboardingInvitationOutcome,
  OnboardingProgress,
  OnboardingSpace,
} from '../../models/onboarding/onboarding.interface';
import type { OnboardingStep } from '../../models/onboarding/onboarding.type';
import { OnboardingWriteDroppedError } from '../onboarding/onboarding-write-dropped.error';
import { OnboardingStore } from '../onboarding/onboarding.store';
import { OnboardingWizardStore } from './onboarding-wizard.store';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization of the mockup.
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
 * Constant RANKS
 *
 * @description
 * Rank of each role, for the faked `can()`.
 *
 * @type {Readonly<Record<WorkspaceRole, number>>}
 */
const RANKS: Readonly<Record<WorkspaceRole, number>> = { guest: 0, member: 1, admin: 2, owner: 3 };

/**
 * Function progress
 *
 * @description
 * An onboarding progress at a version.
 *
 * @param {number} version - The version.
 * @param {Partial<OnboardingProgress['wizard']>} [wizard] - Draft members to change.
 * @param {boolean} [provisioned] - Whether the space exists.
 * @returns {OnboardingProgress} The progress.
 */
function progress(
  version: number,
  wizard: Partial<OnboardingProgress['wizard']> = {},
  provisioned: boolean = false,
): OnboardingProgress {
  return {
    version,
    wizard: {
      status: provisioned ? 'finished' : 'in-progress',
      step: 'space',
      preset: 'dev',
      name: null,
      prefix: null,
      color: 'violet',
      ...wizard,
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
 * A gateway refusal.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The error.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code } });
}

/**
 * Interface Fakes
 *
 * @description
 * The collaborators the store sees.
 */
interface Fakes {
  // #region Properties
  /**
   * Property progress
   *
   * @description
   * The shared store's progress.
   *
   * @type {WritableSignal<OnboardingProgress | null>}
   * @readonly
   */
  readonly progress: WritableSignal<OnboardingProgress | null>;

  /**
   * Property role
   *
   * @description
   * The person's role.
   *
   * @type {WritableSignal<WorkspaceRole>}
   * @readonly
   */
  readonly role: WritableSignal<WorkspaceRole>;

  /**
   * Property saveDraft
   *
   * @description
   * The shared store's draft save.
   *
   * @type {Mock}
   * @readonly
   */
  readonly saveDraft: Mock;

  /**
   * Property dismiss
   *
   * @description
   * The shared store's dismissal.
   *
   * @type {Mock}
   * @readonly
   */
  readonly dismiss: Mock;

  /**
   * Property finish
   *
   * @description
   * The shared store's finish.
   *
   * @type {Mock}
   * @readonly
   */
  readonly finish: Mock;

  /**
   * Property recordInvitation
   *
   * @description
   * The shared store's invitation marker.
   *
   * @type {Mock}
   * @readonly
   */
  readonly recordInvitation: Mock;

  /**
   * Property invite
   *
   * @description
   * The API's invitation batch.
   *
   * @type {Mock}
   * @readonly
   */
  readonly invite: Mock;

  /**
   * Property navigate
   *
   * @description
   * The router's navigation.
   *
   * @type {Mock}
   * @readonly
   */
  readonly navigate: Mock;

  /**
   * Property refresh
   *
   * @description
   * The sidebar refresh.
   *
   * @type {Mock}
   * @readonly
   */
  readonly refresh: Mock;

  /**
   * Property show
   *
   * @description
   * The neutral toast.
   *
   * @type {Mock}
   * @readonly
   */
  readonly show: Mock;

  /**
   * Property error
   *
   * @description
   * The failure toast.
   *
   * @type {Mock}
   * @readonly
   */
  readonly error: Mock;
  // #endregion
}

/**
 * Interface Setup
 *
 * @description
 * The store under test and its fakes.
 */
interface Setup {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The assistant's store.
   *
   * @type {OnboardingWizardStore}
   * @readonly
   */
  readonly store: OnboardingWizardStore;

  /**
   * Property fakes
   *
   * @description
   * Its faked collaborators.
   *
   * @type {Fakes}
   * @readonly
   */
  readonly fakes: Fakes;
  // #endregion
}

/**
 * Function setup
 *
 * @description
 * Provides the assistant's store over faked collaborators, with a read progress.
 *
 * @param {OnboardingProgress | null} [initial] - The progress shown.
 * @returns {Setup} The store and its fakes.
 */
function setup(initial: OnboardingProgress | null = progress(1)): Setup {
  const role: WritableSignal<WorkspaceRole> = signal<WorkspaceRole>('owner');
  const fakes: Fakes = {
    progress: signal<OnboardingProgress | null>(initial),
    role,
    saveDraft: vi.fn(() => Promise.resolve(progress(2))),
    dismiss: vi.fn(() => Promise.resolve(progress(2, { status: 'dismissed' }))),
    finish: vi.fn(() => Promise.resolve(progress(3, {}, true))),
    recordInvitation: vi.fn(() => Promise.resolve()),
    invite: vi.fn((emails: readonly string[]): Promise<OnboardingInvitationOutcome> =>
      Promise.resolve({ invited: emails.length, skipped: 0 }),
    ),
    navigate: vi.fn(() => Promise.resolve(true)),
    refresh: vi.fn(),
    show: vi.fn(),
    error: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      OnboardingWizardStore,
      {
        provide: OnboardingStore,
        useValue: {
          progress: fakes.progress,
          saveDraft: fakes.saveDraft,
          dismiss: fakes.dismiss,
          finish: fakes.finish,
          recordInvitation: fakes.recordInvitation,
        },
      },
      { provide: OnboardingApi, useValue: { invite: fakes.invite } },
      {
        provide: WORKSPACE_CONTEXT,
        useValue: {
          organization: signal(ATELIER_NORD),
          role,
          can: (needed: WorkspaceRole): boolean => RANKS[role()] >= RANKS[needed],
        },
      },
      { provide: NAVIGATION_REFRESH, useValue: { refresh: fakes.refresh, refreshCounts: vi.fn() } },
      { provide: Router, useValue: { navigate: fakes.navigate } },
      { provide: CwToastService, useValue: { show: fakes.show, error: fakes.error } },
    ],
  });
  const store: OnboardingWizardStore = TestBed.inject(OnboardingWizardStore);
  TestBed.tick();
  return { store, fakes };
}

/**
 * Function moveTo
 *
 * @description
 * Continues until the screen is shown.
 *
 * @param {OnboardingWizardStore} store - The store.
 * @param {OnboardingStep} step - The screen.
 * @returns {Promise<void>} Resolves once shown.
 */
async function moveTo(store: OnboardingWizardStore, step: OnboardingStep): Promise<void> {
  while (store.step() !== step) await store.next();
}

/**
 * Function sentSpaces
 *
 * @description
 * The finish bodies sent, in order.
 *
 * @param {Mock} finish - The faked finish.
 * @returns {OnboardingSpace[]} The bodies.
 */
function sentSpaces(finish: Mock): OnboardingSpace[] {
  return finish.mock.calls.map((call: unknown[]): OnboardingSpace => call[0] as OnboardingSpace);
}

/**
 * Function sentKeys
 *
 * @description
 * The idempotency keys sent, in order.
 *
 * @param {Mock} finish - The faked finish.
 * @returns {string[]} The keys.
 */
function sentKeys(finish: Mock): string[] {
  return finish.mock.calls.map((call: unknown[]): string => call[1] as string);
}

describe('OnboardingWizardStore', () => {
  let keys: number;

  beforeEach(() => {
    keys = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      keys += 1;
      return `00000000-0000-4000-8000-${String(keys).padStart(12, '0')}`;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('takes the draft from the progress once, with the default name and a swatch color', () => {
    const { store, fakes }: Setup = setup(progress(1, { color: 'gris' as LookColor }));

    expect(store.seeded()).toBe(true);
    expect(store.step()).toBe('space');
    expect(store.name()).toBe('Product');
    expect(store.color()).toBe('violet');
    expect(store.preset()).toBe('dev');

    store.rename('Design');
    fakes.progress.set(progress(4, { name: 'Other', step: 'team' }));
    TestBed.tick();

    expect(store.name()).toBe('Design');
    expect(store.step()).toBe('space');
  });

  it('resumes a saved draft at its screen', () => {
    const { store }: Setup = setup(
      progress(3, { step: 'team', name: 'Design', color: 'azur', preset: 'agency' }),
    );

    expect(store.step()).toBe('team');
    expect(store.stepIndex()).toBe(2);
    expect(store.name()).toBe('Design');
    expect(store.color()).toBe('azur');
    expect(store.preset()).toBe('agency');
  });

  it('waits for the progress before showing the screens', () => {
    const { store, fakes }: Setup = setup(null);

    expect(store.seeded()).toBe(false);
    fakes.progress.set(progress(1));
    TestBed.tick();

    expect(store.seeded()).toBe(true);
  });

  it('moves between screens and saves the whole draft after each move', async () => {
    const { store, fakes }: Setup = setup();

    store.pickColor('azur');
    await store.next();
    expect(store.step()).toBe('preset');
    store.pickPreset('mkt');
    await store.next();
    store.back();

    expect(store.step()).toBe('preset');
    expect(fakes.saveDraft.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      { step: 'preset', name: 'Product', prefix: 'PRO', color: 'azur', preset: 'dev' },
      { step: 'team', name: 'Product', prefix: 'PRO', color: 'azur', preset: 'mkt' },
      { step: 'preset', name: 'Product', prefix: 'PRO', color: 'azur', preset: 'mkt' },
    ]);
  });

  it('does not leave the first screen while the name is blank, nor go back from it', async () => {
    const { store, fakes }: Setup = setup();

    store.rename('   ');
    expect(store.nameBlank()).toBe(true);
    await store.next();
    store.back();

    expect(store.step()).toBe('space');
    expect(fakes.saveDraft).not.toHaveBeenCalled();
  });

  it('keeps the screen shown when a draft save fails', async () => {
    const { store, fakes }: Setup = setup();
    fakes.saveDraft.mockRejectedValue(new HttpErrorResponse({ status: 503 }));

    await store.next();
    await Promise.resolve();

    expect(store.step()).toBe('preset');
    expect(store.closed()).toBe(false);
  });

  it('opens the first list when a draft save finds the assistant finished in another tab', async () => {
    const { store, fakes }: Setup = setup();
    fakes.progress.set(progress(5, {}, true));
    fakes.saveDraft.mockRejectedValue(problem(409, 'onboarding.wizard-closed'));

    await store.next();
    await vi.waitFor(() => {
      expect(fakes.navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'l', 'l-backlog']);
    });
    expect(fakes.refresh).toHaveBeenCalled();
    expect(store.closed()).toBe(true);
  });

  it('offers Skip on the team screen without invitations, then Create the space', async () => {
    const { store }: Setup = setup();

    await moveTo(store, 'team');
    expect(store.nextAction()).toBe('skip');
    store.changeEmails(['ines.robert@ateliernord.fr']);
    expect(store.nextAction()).toBe('continue');
    await store.next();

    expect(store.step()).toBe('import');
    expect(store.nextAction()).toBe('create');
  });

  it('creates the space, invites, refreshes the navigation, opens the first list and closes', async () => {
    const { store, fakes }: Setup = setup();
    await moveTo(store, 'team');
    store.changeEmails(['ines.robert@ateliernord.fr', 'marc.roux@ateliernord.fr']);
    await moveTo(store, 'import');

    await store.next();

    expect(sentSpaces(fakes.finish)).toEqual([
      { name: 'Product', prefix: 'PRO', preset: 'dev', color: 'violet' },
    ]);
    expect(fakes.invite).toHaveBeenCalledWith([
      'ines.robert@ateliernord.fr',
      'marc.roux@ateliernord.fr',
    ]);
    expect(fakes.recordInvitation).toHaveBeenCalledTimes(1);
    expect(fakes.refresh).toHaveBeenCalledTimes(1);
    expect(fakes.navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'l', 'l-backlog']);
    expect(fakes.show).toHaveBeenCalledWith('Space “Product” created', {
      description: '3 lists · 2 invitations sent',
    });
    expect(fakes.error).not.toHaveBeenCalled();
    expect(store.closed()).toBe(true);
    expect(store.finishing()).toBe(false);
  });

  it('counts only the invited addresses and records nothing when none was invited', async () => {
    const { store, fakes }: Setup = setup();
    fakes.invite.mockResolvedValue({ invited: 0, skipped: 1 });
    store.pickPreset('blank');
    store.changeEmails(['ines.robert@ateliernord.fr']);

    await store.finish();

    expect(fakes.recordInvitation).not.toHaveBeenCalled();
    expect(fakes.show).toHaveBeenCalledWith('Space “Product” created', { description: '1 list' });
  });

  it('keeps the space and says so when the invitations fail', async () => {
    const { store, fakes }: Setup = setup();
    fakes.invite.mockRejectedValue(problem(429, 'invitation.daily-limit-reached'));
    store.changeEmails(['ines.robert@ateliernord.fr']);

    await store.finish();

    expect(fakes.navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'l', 'l-backlog']);
    expect(fakes.show).toHaveBeenCalledWith('Space “Product” created', {
      description: '3 lists',
    });
    expect(fakes.error).toHaveBeenCalledWith('The invitations could not be sent', {
      description: 'You can invite your team later.',
    });
    expect(fakes.recordInvitation).not.toHaveBeenCalled();
    expect(store.closed()).toBe(true);
  });

  it('sends no invitation for a person who may not invite', async () => {
    const { store, fakes }: Setup = setup();
    fakes.role.set('member');
    store.changeEmails(['ines.robert@ateliernord.fr']);

    expect(store.canInvite()).toBe(false);
    await store.finish();

    expect(fakes.invite).not.toHaveBeenCalled();
  });

  it('sends the same key again after an unknown outcome', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    await store.finish();

    expect(store.failure()).toBe('unknown');
    expect(store.finishing()).toBe(false);
    expect(store.closed()).toBe(false);
    expect(fakes.show).not.toHaveBeenCalled();

    await store.finish();

    expect(sentKeys(fakes.finish)).toHaveLength(2);
    expect(sentKeys(fakes.finish)[1]).toBe(sentKeys(fakes.finish)[0]);
    expect(sentSpaces(fakes.finish)[1]).toEqual(sentSpaces(fakes.finish)[0]);
    expect(store.failure()).toBeNull();
    expect(store.closed()).toBe(true);
  });

  it('takes a new key once the body changed after an unknown outcome', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    await store.finish();
    store.rename('Design');
    await store.finish();

    expect(sentKeys(fakes.finish)[1]).not.toBe(sentKeys(fakes.finish)[0]);
    expect(sentSpaces(fakes.finish)[1]).toMatchObject({ name: 'Design', prefix: 'DES' });
  });

  it('takes a new key after a definite refusal', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish.mockRejectedValueOnce(problem(429, 'request.rate-limited'));

    await store.finish();

    expect(store.failure()).toBe('refused');
    expect(fakes.finish).toHaveBeenCalledTimes(1);

    await store.finish();

    expect(sentKeys(fakes.finish)[1]).not.toBe(sentKeys(fakes.finish)[0]);
    expect(store.closed()).toBe(true);
  });

  it('tries the next prefix with a new key when the prefix is taken', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish
      .mockRejectedValueOnce(problem(409, 'space.prefix-taken'))
      .mockRejectedValueOnce(problem(409, 'space.prefix-taken'));

    await store.finish();

    expect(sentSpaces(fakes.finish).map((space: OnboardingSpace) => space.prefix)).toEqual([
      'PRO',
      'PRA',
      'PRB',
    ]);
    expect(new Set(sentKeys(fakes.finish)).size).toBe(3);
    expect(store.failure()).toBeNull();
    expect(store.closed()).toBe(true);
  });

  it('stops after the 26 fallback prefixes and asks for another name', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish.mockRejectedValue(problem(409, 'space.prefix-taken'));

    await store.finish();

    expect(fakes.finish).toHaveBeenCalledTimes(27);
    expect(sentSpaces(fakes.finish).at(-1)?.prefix).toBe('PRZ');
    expect(store.failure()).toBe('prefix');
    expect(store.finishing()).toBe(false);
  });

  it('retries once with a new key after a stale version', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish
      .mockRejectedValueOnce(problem(412, 'request.version-mismatch'))
      .mockRejectedValueOnce(problem(412, 'request.version-mismatch'));

    await store.finish();

    expect(fakes.finish).toHaveBeenCalledTimes(2);
    expect(sentKeys(fakes.finish)[1]).not.toBe(sentKeys(fakes.finish)[0]);
    expect(store.failure()).toBe('refused');
  });

  it('says a guest may not create the space', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish.mockRejectedValueOnce(problem(403, 'organization.role-forbidden'));

    await store.finish();

    expect(store.failure()).toBe('forbidden');
  });

  it('shows nothing for a dropped finish', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish.mockRejectedValueOnce(new OnboardingWriteDroppedError());
    store.changeEmails(['ines.robert@ateliernord.fr']);

    await store.finish();

    expect(store.failure()).toBeNull();
    expect(store.finishing()).toBe(false);
    expect(fakes.show).not.toHaveBeenCalled();
    expect(fakes.error).not.toHaveBeenCalled();
    expect(fakes.invite).not.toHaveBeenCalled();
    expect(fakes.navigate).not.toHaveBeenCalled();
  });

  it('opens the space another tab created when the assistant is already closed', async () => {
    const { store, fakes }: Setup = setup();
    fakes.progress.set(progress(6, {}, true));
    fakes.finish.mockRejectedValueOnce(problem(409, 'onboarding.wizard-closed'));

    await store.finish();

    expect(fakes.navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'l', 'l-backlog']);
    expect(fakes.show).not.toHaveBeenCalled();
    expect(store.closed()).toBe(true);
  });

  it('closes at once and dismisses for good on Set up later', () => {
    const { store, fakes }: Setup = setup();

    store.skip();

    expect(store.closed()).toBe(true);
    expect(fakes.dismiss).toHaveBeenCalledTimes(1);
  });

  it('only closes on Set up later when the progress could not be read', () => {
    const { store, fakes }: Setup = setup(null);

    store.skip();

    expect(store.closed()).toBe(true);
    expect(fakes.dismiss).not.toHaveBeenCalled();
  });
});
