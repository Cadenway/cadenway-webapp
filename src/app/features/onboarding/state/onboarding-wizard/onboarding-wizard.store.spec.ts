import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
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
 * Constant STUDIO_PIXEL
 *
 * @description
 * Another organization the person belongs to.
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
   * Resolves the promise.
   *
   * @type {(value: T) => void}
   * @readonly
   */
  readonly resolve: (value: T) => void;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * A promise the test resolves.
 *
 * @template T
 * @returns {Deferred<T>} The promise and its resolver.
 */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>((yes: (value: T) => void) => {
    resolve = yes;
  });
  return { promise, resolve };
}

/**
 * Function rejected
 *
 * @description
 * A promise rejected with a client failure, as the generated client rejects.
 *
 * @param {unknown} error - The failure.
 * @returns {Promise<never>} The rejected promise.
 */
async function rejected(error: unknown): Promise<never> {
  await Promise.resolve();
  throw error;
}

/**
 * Function order
 *
 * @description
 * Whether each fake was first called after the previous one.
 *
 * @param {...Mock} fakes - The fakes, in the expected order.
 * @returns {boolean} Whether they were called in that order.
 */
function order(...fakes: Mock[]): boolean {
  const firsts: number[] = fakes.map(
    (fake: Mock): number => fake.mock.invocationCallOrder[0] ?? Number.NaN,
  );
  return firsts.every(
    (first: number, index: number): boolean => index === 0 || first > (firsts[index - 1] ?? 0),
  );
}

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
   * Property organization
   *
   * @description
   * The workspace's organization.
   *
   * @type {WritableSignal<WorkspaceOrganization>}
   * @readonly
   */
  readonly organization: WritableSignal<WorkspaceOrganization>;

  /**
   * Property pin
   *
   * @description
   * The organization pin's organization.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  readonly pin: WritableSignal<string | null>;

  /**
   * Property failed
   *
   * @description
   * The shared store's failed first read.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly failed: WritableSignal<boolean>;

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
    organization: signal<WorkspaceOrganization>(ATELIER_NORD),
    pin: signal<string | null>(ATELIER_NORD.id),
    failed: signal<boolean>(false),
    saveDraft: vi.fn(() => Promise.resolve(progress(2))),
    dismiss: vi.fn(() => Promise.resolve(progress(2, { status: 'dismissed' }))),
    finish: vi.fn(() => Promise.resolve(progress(3, {}, true))),
    recordInvitation: vi.fn(() => Promise.resolve()),
    invite: vi.fn((emails: readonly string[]): Promise<OnboardingInvitationOutcome> =>
      Promise.resolve({ invited: emails.length, skipped: 0, alreadyInvited: 0 }),
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
          failed: fakes.failed,
          saveDraft: fakes.saveDraft,
          dismiss: fakes.dismiss,
          finish: fakes.finish,
          recordInvitation: fakes.recordInvitation,
        },
      },
      { provide: OnboardingApi, useValue: { invite: fakes.invite } },
      { provide: OrganizationPin, useValue: { current: fakes.pin } },
      {
        provide: WORKSPACE_CONTEXT,
        useValue: {
          organization: fakes.organization,
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

  it('invites first, then creates the space, records the invitation, refreshes, navigates, toasts and closes', async () => {
    const { store, fakes }: Setup = setup();
    await moveTo(store, 'team');
    store.changeEmails(['ines.robert@ateliernord.fr', 'marc.roux@ateliernord.fr']);
    await moveTo(store, 'import');

    await store.next();

    expect(fakes.invite).toHaveBeenCalledWith([
      'ines.robert@ateliernord.fr',
      'marc.roux@ateliernord.fr',
    ]);
    expect(sentSpaces(fakes.finish)).toEqual([
      { name: 'Product', prefix: 'PRO', preset: 'dev', color: 'violet' },
    ]);
    expect(fakes.recordInvitation).toHaveBeenCalledTimes(1);
    expect(fakes.navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'l', 'l-backlog']);
    expect(fakes.show).toHaveBeenCalledWith('Space “Product” created', {
      description: '3 lists · 2 invitations sent',
    });
    expect(order(fakes.invite, fakes.finish, fakes.recordInvitation)).toBe(true);
    expect(order(fakes.recordInvitation, fakes.refresh, fakes.navigate, fakes.show)).toBe(true);
    expect(fakes.error).not.toHaveBeenCalled();
    expect(store.closed()).toBe(true);
    expect(store.finishing()).toBe(false);
  });

  it('sends nothing more while a finish runs', async () => {
    const { store, fakes }: Setup = setup();
    const pending: Deferred<OnboardingProgress> = deferred<OnboardingProgress>();
    fakes.finish.mockReturnValueOnce(pending.promise);

    const first: Promise<void> = store.finish();
    await vi.waitFor(() => {
      expect(fakes.finish).toHaveBeenCalledTimes(1);
    });
    await store.finish();
    await store.next();
    store.back();
    pending.resolve(progress(3, {}, true));
    await first;

    expect(fakes.finish).toHaveBeenCalledTimes(1);
    expect(fakes.saveDraft).not.toHaveBeenCalled();
    expect(store.closed()).toBe(true);
  });

  it('counts only the invited addresses and records nothing when none was invited', async () => {
    const { store, fakes }: Setup = setup();
    fakes.invite.mockResolvedValue({ invited: 0, skipped: 1, alreadyInvited: 0 });
    store.pickPreset('blank');
    store.changeEmails(['ines.robert@ateliernord.fr']);

    await store.finish();

    expect(fakes.recordInvitation).not.toHaveBeenCalled();
    expect(fakes.show).toHaveBeenCalledWith('Space “Product” created', { description: '1 list' });
  });

  it('records the invitation marker for an address already invited, without counting it as sent', async () => {
    const { store, fakes }: Setup = setup();
    fakes.invite.mockResolvedValue({ invited: 0, skipped: 1, alreadyInvited: 1 });
    store.changeEmails(['ines.robert@ateliernord.fr']);

    await store.finish();

    expect(fakes.recordInvitation).toHaveBeenCalledTimes(1);
    expect(fakes.show).toHaveBeenCalledWith('Space “Product” created', {
      description: '3 lists',
    });
  });

  it('saves the initial draft of a launch at version 1 only', async () => {
    const { store, fakes }: Setup = setup(progress(1, { color: 'gris' as LookColor }));

    await store.saveStart();

    expect(fakes.saveDraft).toHaveBeenCalledWith({
      step: 'space',
      name: 'Product',
      prefix: 'PRO',
      color: 'violet',
      preset: 'dev',
    });

    fakes.progress.set(progress(2));
    fakes.saveDraft.mockClear();
    await store.saveStart();
    fakes.saveDraft.mockRejectedValueOnce(new OnboardingWriteDroppedError());
    fakes.progress.set(progress(1));
    await expect(store.saveStart()).resolves.toBeUndefined();

    expect(fakes.saveDraft).toHaveBeenCalledTimes(1);
  });

  it('sends more than 50 addresses in batches of 50', async () => {
    const { store, fakes }: Setup = setup();
    const emails: string[] = Array.from(
      { length: 120 },
      (_email: unknown, index: number) => `member${String(index)}@ateliernord.fr`,
    );
    store.changeEmails(emails);

    await store.finish();

    expect(fakes.invite.mock.calls.map((call: unknown[]) => (call[0] as string[]).length)).toEqual([
      50, 50, 20,
    ]);
    expect(fakes.show).toHaveBeenCalledWith('Space “Product” created', {
      description: '3 lists · 120 invitations sent',
    });
  });

  it('still creates the space when the invitations fail, and says so', async () => {
    const { store, fakes }: Setup = setup();
    fakes.invite.mockRejectedValue(problem(429, 'invitation.daily-limit-reached'));
    store.changeEmails(['ines.robert@ateliernord.fr']);

    await store.finish();

    expect(fakes.error).toHaveBeenCalledWith('The invitations could not be sent', {
      description: 'You can invite your team later.',
    });
    expect(fakes.finish).toHaveBeenCalledTimes(1);
    expect(fakes.navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'l', 'l-backlog']);
    expect(fakes.show).toHaveBeenCalledWith('Space “Product” created', {
      description: '3 lists',
    });
    expect(fakes.recordInvitation).not.toHaveBeenCalled();
    expect(store.closed()).toBe(true);
  });

  it('does not invite again when the finish is retried, but sends a failed batch again', async () => {
    const { store, fakes }: Setup = setup();
    const emails: string[] = Array.from(
      { length: 60 },
      (_email: unknown, index: number) => `member${String(index)}@ateliernord.fr`,
    );
    fakes.invite
      .mockResolvedValueOnce({ invited: 50, skipped: 0, alreadyInvited: 0 })
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    fakes.finish.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    store.changeEmails(emails);

    await store.finish();
    expect(store.failure()).toBe('unknown');

    await store.finish();

    expect(fakes.invite.mock.calls.map((call: unknown[]) => (call[0] as string[]).length)).toEqual([
      50, 10, 10,
    ]);
    expect(fakes.invite.mock.calls[2]?.[0]).toEqual(emails.slice(50));
    expect(fakes.show).toHaveBeenCalledWith('Space “Product” created', {
      description: '3 lists · 60 invitations sent',
    });
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

  it('tries each fallback prefix once, skips the base, then asks for another name', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish.mockRejectedValue(problem(409, 'space.prefix-taken'));
    store.rename('Abx');

    await store.finish();

    const prefixes: string[] = sentSpaces(fakes.finish).map(
      (space: OnboardingSpace) => space.prefix,
    );
    expect(prefixes).toHaveLength(26);
    expect(new Set(prefixes).size).toBe(26);
    expect(prefixes[0]).toBe('ABX');
    expect(prefixes.at(-1)).toBe('ABZ');
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

    await store.finish();

    expect(store.failure()).toBeNull();
    expect(store.finishing()).toBe(false);
    expect(fakes.show).not.toHaveBeenCalled();
    expect(fakes.error).not.toHaveBeenCalled();
    expect(fakes.navigate).not.toHaveBeenCalled();
  });

  it('applies nothing of a finish once the organization changed, and starts over', async () => {
    const { store, fakes }: Setup = setup();
    const pending: Deferred<OnboardingProgress> = deferred<OnboardingProgress>();
    fakes.finish.mockReturnValueOnce(pending.promise);
    await moveTo(store, 'team');
    store.changeEmails(['ines.robert@ateliernord.fr']);

    const running: Promise<void> = store.finish();
    await vi.waitFor(() => {
      expect(fakes.finish).toHaveBeenCalledTimes(1);
    });
    fakes.organization.set(STUDIO_PIXEL);
    fakes.pin.set(STUDIO_PIXEL.id);
    TestBed.tick();
    pending.resolve(progress(3, {}, true));
    await running;

    expect(fakes.recordInvitation).not.toHaveBeenCalled();
    expect(fakes.refresh).not.toHaveBeenCalled();
    expect(fakes.navigate).not.toHaveBeenCalled();
    expect(fakes.show).not.toHaveBeenCalled();
    expect(store.step()).toBe('space');
    expect(store.emails()).toEqual([]);
    expect(store.finishing()).toBe(false);
    expect(store.closed()).toBe(false);
  });

  it('applies nothing once the pin moved to another organization', async () => {
    const { store, fakes }: Setup = setup();
    const pending: Deferred<OnboardingProgress> = deferred<OnboardingProgress>();
    fakes.finish.mockReturnValueOnce(pending.promise);

    const running: Promise<void> = store.finish();
    await vi.waitFor(() => {
      expect(fakes.finish).toHaveBeenCalledTimes(1);
    });
    fakes.pin.set(STUDIO_PIXEL.id);
    pending.resolve(progress(3, {}, true));
    await running;

    expect(fakes.navigate).not.toHaveBeenCalled();
    expect(fakes.show).not.toHaveBeenCalled();
  });

  it('sends, refreshes, navigates and toasts nothing once destroyed while inviting', async () => {
    const { store, fakes }: Setup = setup();
    const pending: Deferred<OnboardingInvitationOutcome> = deferred<OnboardingInvitationOutcome>();
    fakes.invite.mockReturnValueOnce(pending.promise);
    store.changeEmails(['ines.robert@ateliernord.fr']);

    const running: Promise<void> = store.finish();
    await vi.waitFor(() => {
      expect(fakes.invite).toHaveBeenCalledTimes(1);
    });
    TestBed.resetTestingModule();
    pending.resolve({ invited: 1, skipped: 0, alreadyInvited: 0 });
    await running;

    expect(fakes.finish).not.toHaveBeenCalled();
    expect(fakes.refresh).not.toHaveBeenCalled();
    expect(fakes.navigate).not.toHaveBeenCalled();
    expect(fakes.show).not.toHaveBeenCalled();
    expect(fakes.error).not.toHaveBeenCalled();
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

  it('closes at once and dismisses for good on Set up later', async () => {
    const { store, fakes }: Setup = setup();

    const skipped: Promise<void> = store.skip();

    expect(store.closed()).toBe(true);
    await skipped;
    expect(fakes.dismiss).toHaveBeenCalledTimes(1);
    expect(fakes.error).not.toHaveBeenCalled();
    expect(fakes.navigate).not.toHaveBeenCalled();
  });

  it('waits for the read in flight, then dismisses, on Set up later during the skeleton', async () => {
    const { store, fakes }: Setup = setup(null);

    await store.skip();

    expect(store.closed()).toBe(true);
    expect(fakes.dismiss).toHaveBeenCalledTimes(1);
  });

  it('only closes on Set up later when the progress read failed', async () => {
    const { store, fakes }: Setup = setup(null);
    fakes.failed.set(true);

    await store.skip();

    expect(store.closed()).toBe(true);
    expect(fakes.dismiss).not.toHaveBeenCalled();
  });

  it('says the choice was not saved when the dismissal is refused', async () => {
    const { store, fakes }: Setup = setup();
    fakes.dismiss.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));

    await store.skip();

    expect(store.closed()).toBe(true);
    expect(fakes.error).toHaveBeenCalledWith('Your choice could not be saved', {
      description: 'The setup assistant may come back on your next visit.',
    });
  });

  it('says the choice was not saved when an unknown dismissal still reads in progress', async () => {
    const { store, fakes }: Setup = setup();
    fakes.dismiss.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    await store.skip();

    expect(fakes.error).toHaveBeenCalledWith('Your choice could not be saved', {
      description: 'The setup assistant may come back on your next visit.',
    });
  });

  it('says nothing when an unknown dismissal reads the assistant closed, or is dropped', async () => {
    const { store, fakes }: Setup = setup();
    fakes.dismiss.mockImplementationOnce(() => {
      fakes.progress.set(progress(3, { status: 'dismissed' }));
      return rejected(new HttpErrorResponse({ status: 503 }));
    });

    await store.skip();

    expect(fakes.error).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    const again: Setup = setup();
    again.fakes.dismiss.mockRejectedValueOnce(new OnboardingWriteDroppedError());

    await again.store.skip();

    expect(again.fakes.error).not.toHaveBeenCalled();
  });

  it('opens the space an unknown finish created when Set up later follows', async () => {
    const { store, fakes }: Setup = setup();
    fakes.finish.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    fakes.dismiss.mockImplementationOnce(() => {
      fakes.progress.set(progress(4, {}, true));
      return rejected(problem(409, 'onboarding.wizard-closed'));
    });

    await store.finish();
    expect(store.failure()).toBe('unknown');
    await store.skip();

    expect(fakes.error).not.toHaveBeenCalled();
    expect(fakes.refresh).toHaveBeenCalledTimes(1);
    expect(fakes.navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'l', 'l-backlog']);
    expect(store.closed()).toBe(true);
  });
});
