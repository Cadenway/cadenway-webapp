import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { ApiTokensApi } from '../../data-access/services/api-tokens-api/api-tokens-api.service';
import { ReauthenticationApi } from '../../data-access/services/reauthentication-api/reauthentication-api.service';
import type { ApiToken, ApiTokenDraft } from '../../models/api-token/api-token.interface';
import { ReauthenticationCancelledError } from '../../reauthentication/reauthentication-cancelled.error';
import { ReauthenticationService } from '../../reauthentication/reauthentication.service';
import { ApiTokensStore } from './api-tokens.store';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization the workspace shows first.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o1',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

/**
 * Constant STUDIO_SUD
 *
 * @description
 * The organization another switch makes the workspace show.
 *
 * @type {WorkspaceOrganization}
 */
const STUDIO_SUD: WorkspaceOrganization = {
  ...ATELIER_NORD,
  id: 'o2',
  slug: 'studio-sud',
  name: 'Studio Sud',
  initials: 'SS',
};

/**
 * Constant organization
 *
 * @description
 * The organization the workspace shows, switched by some specs.
 *
 * @type {WritableSignal<WorkspaceOrganization>}
 */
const organization: WritableSignal<WorkspaceOrganization> = signal(ATELIER_NORD);

/**
 * Constant workspace
 *
 * @description
 * Atelier Nord, where Camille Martin is signed in.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u1',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization,
  role: signal('owner'),
  can: () => true,
};

/**
 * Function token
 *
 * @description
 * A token row of the mockup.
 *
 * @param {string} id - Its id.
 * @param {string} name - Its name.
 * @returns {ApiToken} The row.
 */
function token(id: string, name: string): ApiToken {
  return {
    id,
    name,
    prefix: 'cw_pat_4c1e…',
    scopes: ['tasks:read'],
    lastUse: { kind: 'never' },
    expiry: { kind: 'never', soon: false },
  };
}

/**
 * Constant draft
 *
 * @description
 * What the create dialog submits for `GitLab sync`.
 *
 * @type {ApiTokenDraft}
 */
const draft: ApiTokenDraft = { name: 'GitLab sync', scopes: ['tasks:read'], expiration: '30-days' };

/**
 * Constant SECRET
 *
 * @description
 * A fake secret in the contract's shape.
 *
 * @type {string}
 */
const SECRET: string = `cw_pat_${'C'.repeat(36)}`;

/**
 * Function reauthenticationRequired
 *
 * @description
 * The gateway's refusal of a creation outside the window of recent authentication.
 *
 * @returns {HttpErrorResponse} The refusal.
 */
function reauthenticationRequired(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 403,
    error: { code: 'auth.reauthentication-required', details: { methods: ['password'] } },
  });
}

/**
 * Function names
 *
 * @description
 * Names of the listed tokens.
 *
 * @param {InstanceType<typeof ApiTokensStore>} store - The store.
 * @returns {string[]} The names.
 */
function names(store: InstanceType<typeof ApiTokensStore>): string[] {
  return (store.tokens.value() ?? []).map((item: ApiToken): string => item.name);
}

/**
 * Function settle
 *
 * @description
 * Waits until the application is stable.
 *
 * @returns {Promise<void>} Resolves once stable.
 */
async function settle(): Promise<void> {
  await TestBed.inject(ApplicationRef).whenStable();
}

describe('ApiTokensStore', () => {
  let api: { list: Mock; create: Mock; revoke: Mock };
  let run: Mock;
  let toasts: { success: Mock; error: Mock };

  beforeEach(() => {
    organization.set(ATELIER_NORD);
    api = {
      list: vi.fn(() =>
        Promise.resolve([
          token('t1', 'GitLab continuous integration'),
          token('t2', 'Trello import script'),
        ]),
      ),
      create: vi.fn(() => Promise.resolve({ token: token('t4', 'GitLab sync'), secret: SECRET })),
      revoke: vi.fn(() => Promise.resolve()),
    };
    run = vi.fn((operation: () => Promise<unknown>) => operation());
    toasts = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        ApiTokensStore,
        { provide: ApiTokensApi, useValue: api },
        { provide: ReauthenticationService, useValue: { run } },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
  });

  /**
   * Function loaded
   *
   * @description
   * Creates the store and waits for its first read.
   *
   * @returns {Promise<InstanceType<typeof ApiTokensStore>>} The store.
   */
  async function loaded(): Promise<InstanceType<typeof ApiTokensStore>> {
    const store: InstanceType<typeof ApiTokensStore> = TestBed.inject(ApiTokensStore);
    await TestBed.inject(ApplicationRef).whenStable();
    return store;
  }

  it('reads the tokens and tells an empty list apart from a failed read', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    expect(names(store)).toEqual(['GitLab continuous integration', 'Trello import script']);
    expect(store.isEmpty()).toBe(false);

    api.list.mockResolvedValueOnce([]);
    store.tokens.reload();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(store.isEmpty()).toBe(true);

    api.list.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    store.tokens.reload();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(store.tokens.error()).toBeDefined();
    expect(store.isEmpty()).toBe(false);
  });

  it('creates through the reauthentication, heads the list and forgets the secret on dismiss', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();

    await store.create(draft);

    expect(run).toHaveBeenCalledOnce();
    expect(api.create).toHaveBeenCalledWith(draft);
    expect(names(store)[0]).toBe('GitLab sync');
    expect(store.secret()).toBe(SECRET);
    expect(store.creating()).toBe(false);

    store.dismissSecret();
    expect(store.secret()).toBeNull();
  });

  it('creates nothing and says nothing when the reauthentication is cancelled', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    run.mockRejectedValueOnce(new ReauthenticationCancelledError());

    await store.create(draft);

    expect(store.secret()).toBeNull();
    expect(store.creating()).toBe(false);
    expect(names(store)).toHaveLength(2);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('shows the failure toast when the gateway refuses the creation', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    api.create.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    await store.create(draft);

    expect(store.secret()).toBeNull();
    expect(store.creating()).toBe(false);
    expect(toasts.error).toHaveBeenCalledWith('The token could not be created', {
      description: 'Try again in a moment.',
    });
  });

  it('removes a revoked token and names it in the toast', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();

    await store.revoke(token('t2', 'Trello import script'));

    expect(api.revoke).toHaveBeenCalledWith('t2');
    expect(names(store)).toEqual(['GitLab continuous integration']);
    expect(store.revokingId()).toBeNull();
    expect(toasts.success).toHaveBeenCalledWith('Token revoked', {
      description: 'Trello import script can no longer call the API.',
    });
  });

  it('keeps a token whose revocation fails and shows the failure toast', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    api.revoke.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    await store.revoke(token('t2', 'Trello import script'));

    expect(names(store)).toHaveLength(2);
    expect(store.revokingId()).toBeNull();
    expect(toasts.success).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledOnce();
  });

  it('removes a token the gateway no longer knows', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    api.revoke.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 404, error: { code: 'api-token.not-found' } }),
    );

    await store.revoke(token('t2', 'Trello import script'));

    expect(names(store)).toEqual(['GitLab continuous integration']);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('sends no creation and says nothing when the organization changed before the send', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    run.mockImplementationOnce((operation: () => Promise<unknown>) => {
      organization.set(STUDIO_SUD);
      return operation();
    });

    await store.create(draft);

    expect(api.create).not.toHaveBeenCalled();
    expect(store.secret()).toBeNull();
    expect(store.creating()).toBe(false);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('stays silent when the organization pin refuses the creation', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    api.create.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 412, error: { code: 'organization.context-changed' } }),
    );

    await store.create(draft);

    expect(store.secret()).toBeNull();
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('sends no revocation for a token of the list shown before an organization switch', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    const stale: ApiToken = token('t2', 'Trello import script');
    api.list.mockResolvedValueOnce([token('t9', 'Studio Sud backup')]);
    organization.set(STUDIO_SUD);
    await settle();

    expect(await store.revoke(stale)).toBe(false);

    expect(api.revoke).not.toHaveBeenCalled();
    expect(names(store)).toEqual(['Studio Sud backup']);
    expect(toasts.success).not.toHaveBeenCalled();
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('does not count a 404 as revoked when the organization changed during the revocation', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    let refuse: (error: unknown) => void = (): void => undefined;
    api.revoke.mockReturnValueOnce(
      new Promise<void>((_resolve: () => void, reject: (error: unknown) => void): void => {
        refuse = reject;
      }),
    );

    const revoked: Promise<boolean> = store.revoke(token('t2', 'Trello import script'));
    organization.set(STUDIO_SUD);
    refuse(new HttpErrorResponse({ status: 404, error: { code: 'api-token.not-found' } }));

    expect(await revoked).toBe(false);
    expect(toasts.success).not.toHaveBeenCalled();
    expect(toasts.error).not.toHaveBeenCalled();
    expect(store.revokingId()).toBeNull();
  });

  it('keeps a token on a 404 with another code and shows the failure toast', async () => {
    const store: InstanceType<typeof ApiTokensStore> = await loaded();
    api.revoke.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 404, error: { code: 'route.not-found' } }),
    );

    expect(await store.revoke(token('t2', 'Trello import script'))).toBe(false);

    expect(names(store)).toHaveLength(2);
    expect(toasts.error).toHaveBeenCalledOnce();
  });
});

/**
 * Interface PendingCreation
 *
 * @description
 * A creation waiting for the reauthentication question to be answered.
 */
interface PendingCreation {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The store creating the token.
   *
   * @type {InstanceType<typeof ApiTokensStore>}
   * @readonly
   */
  readonly store: InstanceType<typeof ApiTokensStore>;

  /**
   * Property service
   *
   * @description
   * The real reauthentication service asking the question.
   *
   * @type {ReauthenticationService}
   * @readonly
   */
  readonly service: ReauthenticationService;

  /**
   * Property done
   *
   * @description
   * Settles once the creation ended.
   *
   * @type {Promise<void>}
   * @readonly
   */
  readonly done: Promise<void>;
  // #endregion
}

describe('ApiTokensStore with the real reauthentication', () => {
  let create: Mock;
  let reauthenticate: Mock;
  let toasts: { success: Mock; error: Mock };

  beforeEach(() => {
    organization.set(ATELIER_NORD);
    create = vi
      .fn()
      .mockRejectedValueOnce(reauthenticationRequired())
      .mockResolvedValue({ token: token('t4', 'GitLab sync'), secret: SECRET });
    reauthenticate = vi.fn(() => Promise.resolve());
    toasts = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ApiTokensStore,
        ReauthenticationService,
        { provide: ReauthenticationApi, useValue: { reauthenticate } },
        {
          provide: ApiTokensApi,
          useValue: {
            list: () => Promise.resolve([token('t1', 'GitLab continuous integration')]),
            create,
            revoke: vi.fn(),
          },
        },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
  });

  /**
   * Function asked
   *
   * @description
   * Starts a creation and waits until the reauthentication question is open, as the dialog would
   * show it.
   *
   * @returns {Promise<PendingCreation>} The store, the service and the creation.
   */
  async function asked(): Promise<PendingCreation> {
    const store: InstanceType<typeof ApiTokensStore> = TestBed.inject(ApiTokensStore);
    const service: ReauthenticationService = TestBed.inject(ReauthenticationService);
    await settle();
    const done: Promise<void> = store.create(draft);
    await vi.waitFor(() => {
      expect(service.prompt()).not.toBeNull();
    });
    return { store, service, done };
  }

  it('retries the creation once the password is confirmed', async () => {
    const { store, service, done }: PendingCreation = await asked();
    expect(store.creating()).toBe(true);

    await service.answer({ password: 'correct horse' });
    await done;

    expect(reauthenticate).toHaveBeenCalledWith({ password: 'correct horse' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(store.secret()).toBe(SECRET);
    expect(names(store)).toEqual(['GitLab sync', 'GitLab continuous integration']);
  });

  it('sends no retry when the organization changed while the dialog was open', async () => {
    const { store, service, done }: PendingCreation = await asked();

    organization.set(STUDIO_SUD);
    await service.answer({ password: 'correct horse' });
    await done;

    expect(create).toHaveBeenCalledOnce();
    expect(store.secret()).toBeNull();
    expect(store.creating()).toBe(false);
    expect(toasts.error).not.toHaveBeenCalled();
  });
});
