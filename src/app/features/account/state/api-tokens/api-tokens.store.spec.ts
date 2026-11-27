import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ApiTokensApi } from '../../data-access/services/api-tokens-api/api-tokens-api.service';
import type { ApiToken, ApiTokenDraft } from '../../models/api-token/api-token.interface';
import { ReauthenticationCancelledError } from '../../reauthentication/reauthentication-cancelled.error';
import { ReauthenticationService } from '../../reauthentication/reauthentication.service';
import { ApiTokensStore } from './api-tokens.store';

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
  organization: signal({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
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

describe('ApiTokensStore', () => {
  let api: { list: Mock; create: Mock; revoke: Mock };
  let run: Mock;
  let toasts: { success: Mock; error: Mock };

  beforeEach(() => {
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
});
