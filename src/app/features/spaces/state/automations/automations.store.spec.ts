import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { AutomationsApi } from '../../data-access/services/automations-api/automations-api.service';
import { ListsApi } from '../../data-access/services/lists-api/lists-api.service';
import type {
  AutomationDraft,
  AutomationRule,
  AutomationWriteOutcome,
} from '../../models/automation-rule/automation-rule.interface';
import { AutomationsStore } from './automations.store';

/**
 * Constant HUGO
 *
 * @description
 * User id of Hugo Dubois, an Atelier Nord member.
 *
 * @type {string}
 */
const HUGO: string = 'u-hugo';

/**
 * Constant NOTIFY_ON_DONE
 *
 * @description
 * `When the status becomes “Done”, notify Hugo Dubois`, enabled (`AUTOS_INIT` a1).
 *
 * @type {AutomationRule}
 */
const NOTIFY_ON_DONE: AutomationRule = {
  id: 'a1',
  trigger: { type: 'status', status: 'done' },
  action: { type: 'notify', userId: HUGO },
  enabled: true,
  version: 1,
};

/**
 * Constant URGENT_ON_BLOCKED
 *
 * @description
 * `When the status becomes “Blocked”, set the priority to urgent`, enabled (`AUTOS_INIT` a2).
 *
 * @type {AutomationRule}
 */
const URGENT_ON_BLOCKED: AutomationRule = {
  id: 'a2',
  trigger: { type: 'status', status: 'blocked' },
  action: { type: 'priority', priority: 'urgente' },
  enabled: true,
  version: 4,
};

/**
 * Constant COMMENT_DRAFT
 *
 * @description
 * A rule to create: comment on every new task.
 *
 * @type {AutomationDraft}
 */
const COMMENT_DRAFT: AutomationDraft = {
  trigger: { type: 'created' },
  action: { type: 'comment', body: 'Welcome' },
};

/**
 * Function refusal
 *
 * @description
 * A refused write.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The error.
 */
function refusal(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { type: 'about:blank', title: '', status, code } });
}

/**
 * Function deferred
 *
 * @description
 * A promise settled by the spec.
 *
 * @returns {{ promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }}
 * The promise and its settlers.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve: (value: T) => void = (): void => undefined;
  let reject: (error: unknown) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('AutomationsStore', () => {
  let api: Record<string, Mock>;
  let members: Mock;
  let organization: WritableSignal<{ id: string }>;
  let store: InstanceType<typeof AutomationsStore>;

  beforeEach(() => {
    organization = signal({ id: 'org-atelier-nord' });
    api = {
      rules: vi.fn(() => Promise.resolve([NOTIFY_ON_DONE, URGENT_ON_BLOCKED])),
      runs: vi.fn(() => Promise.resolve([])),
      create: vi.fn(),
      setEnabled: vi.fn(),
      delete: vi.fn(() => Promise.resolve()),
    };
    members = vi.fn(() => Promise.resolve([{ userId: HUGO, name: 'Hugo Dubois' }]));
    TestBed.configureTestingModule({
      providers: [
        AutomationsStore,
        { provide: WORKSPACE_CONTEXT, useValue: { organization } },
        { provide: AutomationsApi, useValue: api },
        { provide: ListsApi, useValue: { organizationMembers: members } },
      ],
    });
    store = TestBed.inject(AutomationsStore);
  });

  /**
   * Function loaded
   *
   * @description
   * Opens the store and waits for the rules.
   *
   * @returns {Promise<void>} Resolves once the rules are read.
   */
  async function loaded(): Promise<void> {
    store.load();
    await expect.poll(() => store.rules.hasValue()).toBe(true);
  }

  /**
   * Function shownEnabled
   *
   * @description
   * Whether a shown rule is enabled.
   *
   * @param {string} id - The rule.
   * @returns {boolean | undefined} Its shown state, undefined when hidden.
   */
  function shownEnabled(id: string): boolean | undefined {
    return store.shownRules().find((rule: AutomationRule): boolean => rule.id === id)?.enabled;
  }

  it('reads nothing until the dialog opens, then the rules, the runs and the members', async () => {
    TestBed.tick();
    expect(api['rules']).not.toHaveBeenCalled();

    await loaded();
    await expect.poll(() => store.members.hasValue()).toBe(true);

    expect(store.shownRules().map((rule: AutomationRule): string => rule.id)).toEqual(['a1', 'a2']);
    expect(store.activeCount()).toBe(2);
    expect(api['runs']).toHaveBeenCalledTimes(1);
  });

  it('reads the rules and the runs again on each opening, the members once', async () => {
    await loaded();
    await expect.poll(() => store.members.hasValue()).toBe(true);

    store.load();
    await expect.poll(() => api['rules'].mock.calls.length).toBe(2);
    expect(api['runs']).toHaveBeenCalledTimes(2);
    expect(members).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed read apart from an empty one and reads again on retry', async () => {
    api['rules'].mockRejectedValueOnce(refusal(503, 'upstream.unavailable'));
    store.load();
    await expect.poll(() => store.rules.status()).toBe('error');
    expect(store.shownRules()).toEqual([]);

    api['rules'].mockResolvedValueOnce([]);
    store.rules.reload();
    await expect.poll(() => store.rules.status()).toBe('resolved');
    expect(store.confirmedRules()).toEqual([]);
  });

  it('disables a rule at once and keeps the version the gateway recorded', async () => {
    await loaded();
    const write: ReturnType<typeof deferred<AutomationRule>> = deferred<AutomationRule>();
    api['setEnabled'].mockReturnValueOnce(write.promise);

    const recorded: Promise<AutomationWriteOutcome> = store.toggle(NOTIFY_ON_DONE);
    expect(shownEnabled('a1')).toBe(false);
    expect(store.activeCount()).toBe(1);

    write.resolve({ ...NOTIFY_ON_DONE, enabled: false, version: 2 });
    expect(await recorded).toBe('applied');
    expect(api['setEnabled']).toHaveBeenCalledWith(NOTIFY_ON_DONE, false);
    expect(store.confirmedRules()?.[0]).toMatchObject({ enabled: false, version: 2 });
    expect(shownEnabled('a1')).toBe(false);
  });

  it('restores the recorded state when the gateway refuses the switch', async () => {
    await loaded();
    api['setEnabled'].mockRejectedValueOnce(refusal(403, 'organization.role-forbidden'));

    const recorded: Promise<AutomationWriteOutcome> = store.toggle(NOTIFY_ON_DONE);
    expect(shownEnabled('a1')).toBe(false);

    expect(await recorded).toBe('refused');
    expect(shownEnabled('a1')).toBe(true);
    expect(api['rules']).toHaveBeenCalledTimes(1);
  });

  it('reads the rules again after a lost switch answer and shows what applied', async () => {
    await loaded();
    api['setEnabled'].mockRejectedValueOnce(refusal(503, 'upstream.unavailable'));
    const reread: ReturnType<typeof deferred<readonly AutomationRule[]>> =
      deferred<readonly AutomationRule[]>();
    api['rules'].mockReturnValueOnce(reread.promise);

    const recorded: Promise<AutomationWriteOutcome> = store.toggle(NOTIFY_ON_DONE);
    await expect.poll(() => api['rules'].mock.calls.length).toBe(2);
    expect(shownEnabled('a1')).toBe(false);

    reread.resolve([{ ...NOTIFY_ON_DONE, enabled: false, version: 2 }, URGENT_ON_BLOCKED]);
    expect(await recorded).toBe('applied');
    expect(shownEnabled('a1')).toBe(false);
    expect(store.confirmedRules()?.[0]?.version).toBe(2);
  });

  it('shows the rule still enabled when the rules read again after a timeout say so', async () => {
    await loaded();
    api['setEnabled'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));

    expect(await store.toggle(NOTIFY_ON_DONE)).toBe('not-applied');
    expect(shownEnabled('a1')).toBe(true);
    expect(store.activeCount()).toBe(2);
  });

  it('reports an unknown outcome when the rules cannot be read again either', async () => {
    await loaded();
    api['setEnabled'].mockRejectedValueOnce(refusal(504, 'upstream.timeout'));
    api['rules'].mockRejectedValueOnce(refusal(503, 'upstream.unavailable'));

    expect(await store.toggle(NOTIFY_ON_DONE)).toBe('unknown');
    await expect.poll(() => api['rules'].mock.calls.length).toBe(3);
  });

  it('reads the rules again when a switch was refused on an older version', async () => {
    await loaded();
    api['setEnabled'].mockRejectedValueOnce(refusal(412, 'request.version-mismatch'));

    expect(await store.toggle(NOTIFY_ON_DONE)).toBe('refused');
    await expect.poll(() => api['rules'].mock.calls.length).toBe(2);
  });

  it('sends nothing when two quick clicks come back to the recorded state', async () => {
    await loaded();

    const first: Promise<AutomationWriteOutcome> = store.toggle(NOTIFY_ON_DONE);
    const second: Promise<AutomationWriteOutcome> = store.toggle(NOTIFY_ON_DONE);
    expect(shownEnabled('a1')).toBe(true);

    expect(await Promise.all([first, second])).toEqual(['applied', 'applied']);
    expect(api['setEnabled']).not.toHaveBeenCalled();
  });

  it('sends a second change from the version the first one left', async () => {
    await loaded();
    const write: ReturnType<typeof deferred<AutomationRule>> = deferred<AutomationRule>();
    api['setEnabled']
      .mockReturnValueOnce(write.promise)
      .mockResolvedValueOnce({ ...NOTIFY_ON_DONE, enabled: true, version: 3 });

    const first: Promise<AutomationWriteOutcome> = store.toggle(NOTIFY_ON_DONE);
    await Promise.resolve();
    const second: Promise<AutomationWriteOutcome> = store.toggle(NOTIFY_ON_DONE);
    write.resolve({ ...NOTIFY_ON_DONE, enabled: false, version: 2 });

    expect(await Promise.all([first, second])).toEqual(['applied', 'applied']);
    expect(api['setEnabled']).toHaveBeenLastCalledWith(
      { ...NOTIFY_ON_DONE, enabled: false, version: 2 },
      true,
    );
    expect(shownEnabled('a1')).toBe(true);
  });

  it('hides a deleted rule at once and brings it back when refused', async () => {
    await loaded();
    const removal: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    api['delete'].mockReturnValueOnce(removal.promise);

    const gone: Promise<AutomationWriteOutcome> = store.remove(URGENT_ON_BLOCKED);
    expect(shownEnabled('a2')).toBeUndefined();

    removal.reject(refusal(403, 'organization.role-forbidden'));
    expect(await gone).toBe('refused');
    expect(shownEnabled('a2')).toBe(true);

    expect(await store.remove(URGENT_ON_BLOCKED)).toBe('applied');
    expect(store.confirmedRules()?.map((rule: AutomationRule): string => rule.id)).toEqual(['a1']);
  });

  it('learns from the rules read again whether a deletion with a lost answer applied', async () => {
    await loaded();
    api['delete']
      .mockRejectedValueOnce(refusal(502, 'upstream.failed'))
      .mockRejectedValueOnce(refusal(502, 'upstream.failed'));
    api['rules']
      .mockResolvedValueOnce([NOTIFY_ON_DONE, URGENT_ON_BLOCKED])
      .mockResolvedValueOnce([NOTIFY_ON_DONE]);

    expect(await store.remove(URGENT_ON_BLOCKED)).toBe('not-applied');
    expect(shownEnabled('a2')).toBe(true);
    expect(await store.remove(URGENT_ON_BLOCKED)).toBe('applied');
    expect(shownEnabled('a2')).toBeUndefined();
  });

  it('adds a created rule last and reuses the key for a retry of the same draft', async () => {
    await loaded();
    api['create']
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }))
      .mockResolvedValueOnce({
        id: 'a3',
        trigger: COMMENT_DRAFT.trigger,
        action: COMMENT_DRAFT.action,
        enabled: true,
        version: 1,
      })
      .mockResolvedValueOnce({ ...NOTIFY_ON_DONE, id: 'a4' });

    expect(await store.create(COMMENT_DRAFT)).toBeNull();
    expect(store.creating()).toBe(false);
    expect((await store.create(COMMENT_DRAFT))?.id).toBe('a3');
    const keys: unknown[] = api['create'].mock.calls.map((call: unknown[]): unknown => call[1]);
    const firstKey: unknown = keys[0];
    expect(keys[1]).toBe(firstKey);
    expect(store.shownRules().at(-1)?.id).toBe('a3');

    await store.create(COMMENT_DRAFT);
    expect(api['create'].mock.calls[2]?.[1]).not.toBe(firstKey);
  });

  it('takes a new key for another draft or once the builder is closed', async () => {
    await loaded();
    api['create'].mockRejectedValue(new HttpErrorResponse({ status: 0 }));

    await store.create(COMMENT_DRAFT);
    await store.create({ ...COMMENT_DRAFT, action: { type: 'comment', body: 'Hello' } });
    store.discardDraft();
    await store.create({ ...COMMENT_DRAFT, action: { type: 'comment', body: 'Hello' } });

    const keys: unknown[] = api['create'].mock.calls.map((call: unknown[]): unknown => call[1]);
    expect(new Set(keys).size).toBe(3);
  });

  it('reads everything again for another organization', async () => {
    await loaded();
    await expect.poll(() => store.members.hasValue()).toBe(true);

    organization.set({ id: 'org-other' });
    expect(store.confirmedRules()).toBeUndefined();
    await expect.poll(() => api['rules'].mock.calls.length).toBe(2);
    await expect.poll(() => members.mock.calls.length).toBe(2);
  });

  it('sends a deletion while the rules are read again, and reports it once confirmed', async () => {
    await loaded();
    const reread: ReturnType<typeof deferred<readonly AutomationRule[]>> =
      deferred<readonly AutomationRule[]>();
    api['rules'].mockReturnValueOnce(reread.promise);
    store.load();
    await expect.poll(() => api['rules'].mock.calls.length).toBe(2);
    expect(store.rules.hasValue()).toBe(false);
    expect(store.confirmedRules()?.length).toBe(2);
    const removal: ReturnType<typeof deferred<undefined>> = deferred<undefined>();
    api['delete'].mockReturnValueOnce(removal.promise);

    let settled: AutomationWriteOutcome | undefined;
    void store.remove(URGENT_ON_BLOCKED).then((gone: AutomationWriteOutcome): void => {
      settled = gone;
    });
    await expect.poll(() => api['delete'].mock.calls.length).toBe(1);
    expect(api['delete']).toHaveBeenCalledWith(URGENT_ON_BLOCKED);
    expect(settled).toBeUndefined();

    removal.resolve(undefined);
    await expect.poll(() => settled).toBe('applied');
    reread.resolve([NOTIFY_ON_DONE]);
    await expect.poll(() => store.rules.hasValue()).toBe(true);
    expect(store.confirmedRules()?.map((rule: AutomationRule): string => rule.id)).toEqual(['a1']);
  });

  it('applies the writes settled during a read over that older read', async () => {
    await loaded();
    const reread: ReturnType<typeof deferred<readonly AutomationRule[]>> =
      deferred<readonly AutomationRule[]>();
    api['rules'].mockReturnValueOnce(reread.promise);
    store.load();
    await expect.poll(() => api['rules'].mock.calls.length).toBe(2);
    const created: AutomationRule = {
      id: 'a3',
      trigger: COMMENT_DRAFT.trigger,
      action: COMMENT_DRAFT.action,
      enabled: true,
      version: 1,
    };
    api['setEnabled'].mockResolvedValueOnce({ ...NOTIFY_ON_DONE, enabled: false, version: 2 });
    api['create'].mockResolvedValueOnce(created);

    expect(await store.toggle(NOTIFY_ON_DONE)).toBe('applied');
    expect(await store.remove(URGENT_ON_BLOCKED)).toBe('applied');
    await store.create(COMMENT_DRAFT);
    reread.resolve([NOTIFY_ON_DONE, URGENT_ON_BLOCKED]);
    await expect.poll(() => store.rules.hasValue()).toBe(true);

    expect(store.confirmedRules()).toEqual([
      { ...NOTIFY_ON_DONE, enabled: false, version: 2 },
      created,
    ]);
    api['setEnabled'].mockResolvedValueOnce({ ...NOTIFY_ON_DONE, enabled: true, version: 3 });
    await store.toggle(NOTIFY_ON_DONE);
    expect(api['setEnabled']).toHaveBeenLastCalledWith(
      { ...NOTIFY_ON_DONE, enabled: false, version: 2 },
      true,
    );
  });

  it('trusts a read started after a creation, which no longer holds the rule', async () => {
    await loaded();
    api['create'].mockResolvedValueOnce({ ...NOTIFY_ON_DONE, id: 'a3' });
    await store.create(COMMENT_DRAFT);
    expect(store.confirmedRules()?.map((rule: AutomationRule): string => rule.id)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);

    store.load();
    await expect.poll(() => api['rules'].mock.calls.length).toBe(2);
    await expect.poll(() => store.rules.hasValue()).toBe(true);
    expect(store.confirmedRules()?.map((rule: AutomationRule): string => rule.id)).toEqual([
      'a1',
      'a2',
    ]);
  });
});
