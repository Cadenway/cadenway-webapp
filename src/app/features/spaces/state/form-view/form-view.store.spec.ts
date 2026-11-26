import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { IntakeFormApi } from '../../data-access/services/intake-form-api/intake-form-api.service';
import type {
  IntakeFormConfiguration,
  IntakeFormDraft,
} from '../../models/intake-form/intake-form.interface';
import {
  changeBetween,
  FormViewStore,
  type FormViewStoreInstance,
  rebaseDraft,
} from './form-view.store';

/**
 * Interface Deferred
 *
 * @description
 * A promise settled by the test, for an answer that arrives late.
 */
interface Deferred<T> {
  // #region Properties
  /**
   * Property promise
   *
   * @description
   * The pending answer.
   *
   * @type {Promise<T>}
   * @readonly
   */
  readonly promise: Promise<T>;

  /**
   * Property resolve
   *
   * @description
   * Answers with a value.
   *
   * @type {(value: T) => void}
   * @readonly
   */
  readonly resolve: (value: T) => void;

  /**
   * Property reject
   *
   * @description
   * Answers with a failure.
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
 * Creates an answer the test settles.
 *
 * @returns {Deferred<T>} The pending answer.
 */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = (): void => undefined;
  let reject: (error: unknown) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>(
    (done: (value: T) => void, fail: (error: unknown) => void): void => {
      resolve = done;
      reject = fail;
    },
  );
  return { promise, resolve, reject };
}

/**
 * Constant saved
 *
 * @description
 * The saved Sprint 14 form settings, with the mockup's defaults.
 *
 * @type {IntakeFormDraft}
 */
const saved: IntakeFormDraft = {
  title: 'Request for “Sprint 14”',
  description: null,
  fields: {
    description: 'optional',
    priority: 'optional',
    dueDate: 'optional',
    contactEmail: 'required',
    attachments: 'optional',
  },
  defaultStatus: 'triage',
  defaultAssigneeId: null,
};

/**
 * Function configuration
 *
 * @description
 * The form of Sprint 14 at a version.
 *
 * @param {IntakeFormDraft} settings - Its settings.
 * @param {number} version - Its version.
 * @param {string | null} [publicKey] - Its publication.
 * @returns {IntakeFormConfiguration} The configuration.
 */
function configuration(
  settings: IntakeFormDraft,
  version: number,
  publicKey: string | null = null,
): IntakeFormConfiguration {
  return { settings, publicKey, version };
}

describe('FormViewStore', () => {
  let api: { configuration: Mock; update: Mock; publish: Mock; disable: Mock };
  let toasts: { show: Mock; error: Mock };
  let store: FormViewStoreInstance;

  beforeEach(() => {
    api = {
      configuration: vi.fn(() => Promise.resolve(configuration(saved, 3))),
      update: vi.fn((_listId: string, _change: unknown, version: number) =>
        Promise.resolve(
          configuration(
            { ...saved, fields: { ...saved.fields, dueDate: 'required' } },
            version + 1,
          ),
        ),
      ),
      publish: vi.fn(() => Promise.resolve(configuration(saved, 4, 'k'.repeat(43)))),
      disable: vi.fn(() => Promise.resolve(configuration(saved, 5))),
    };
    toasts = { show: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        FormViewStore,
        { provide: IntakeFormApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    store = TestBed.inject(FormViewStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Function open
   *
   * @description
   * Opens the form of Sprint 14 and waits for its settings.
   *
   * @returns {Promise<void>} Resolves once read.
   */
  async function open(): Promise<void> {
    store.load('list-sprint-14');
    await expect.poll(() => store.settings()).toEqual(saved);
  }

  it('reads nothing for a list it cannot edit, then the form of an editable one', async () => {
    store.load(null);
    TestBed.tick();
    expect(api.configuration).not.toHaveBeenCalled();
    expect(store.settings()).toBeNull();

    await open();

    expect(api.configuration).toHaveBeenCalledWith('list-sprint-14', expect.any(AbortSignal));
    expect(store.publicKey()).toBeNull();
  });

  it('shows a change at once and saves the last of a burst only, against its version', async () => {
    await open();
    vi.useFakeTimers();

    store.edit({ fields: { dueDate: 'optional' } });
    store.edit({ fields: { dueDate: 'required' } });
    expect(store.settings()?.fields.dueDate).toBe('required');
    await vi.advanceTimersByTimeAsync(500);

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith(
      'list-sprint-14',
      { fields: { dueDate: 'required' } },
      3,
    );
    expect(store.settings()?.fields.dueDate).toBe('required');
    expect(store.configuration.value()?.version).toBe(4);
  });

  it('restores the saved settings, reads them again and says so when a save is refused', async () => {
    await open();
    vi.useFakeTimers();
    api.update.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 422,
        error: { status: 422, code: 'intake-form.defaults-invalid' },
      }),
    );

    store.edit({ defaultStatus: 'todo' });
    expect(store.settings()?.defaultStatus).toBe('todo');
    await vi.advanceTimersByTimeAsync(500);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);

    expect(store.settings()?.defaultStatus).toBe('triage');
    expect(api.configuration).toHaveBeenCalledTimes(2);
    expect(toasts.error).toHaveBeenCalledWith(
      'This status or assignee cannot be used in this list',
    );
  });

  it('sends nothing for a blank title or a change made undone', async () => {
    await open();
    vi.useFakeTimers();

    store.edit({ title: '  ' });
    await vi.advanceTimersByTimeAsync(500);
    store.edit({ title: saved.title, description: '' });
    await vi.advanceTimersByTimeAsync(500);

    expect(api.update).not.toHaveBeenCalled();
    expect(changeBetween(saved, { ...saved, title: ' Bug report ' })).toEqual({
      title: 'Bug report',
    });
  });

  it('publishes and withdraws the form, and says when it cannot', async () => {
    await open();

    expect(await store.publish()).toBe(true);
    expect(store.publicKey()).toBe('k'.repeat(43));
    expect(await store.disable()).toBe(true);
    expect(store.publicKey()).toBeNull();

    api.publish.mockRejectedValueOnce(new HttpErrorResponse({ status: 409 }));
    expect(await store.publish()).toBe(false);
    expect(store.publishing()).toBe(false);
    expect(toasts.error).toHaveBeenCalledWith('The form could not be published');
  });

  it('sends a change made just before the view is left', async () => {
    const injector: EnvironmentInjector = createEnvironmentInjector(
      [FormViewStore],
      TestBed.inject(EnvironmentInjector),
    );
    const view: FormViewStoreInstance = injector.get(FormViewStore);
    view.load('list-sprint-14');
    await expect.poll(() => view.settings()).toEqual(saved);
    vi.useFakeTimers();

    view.edit({ fields: { dueDate: 'required' } });
    await vi.advanceTimersByTimeAsync(200);
    injector.destroy();
    await vi.advanceTimersByTimeAsync(0);

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith(
      'list-sprint-14',
      { fields: { dueDate: 'required' } },
      3,
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it('keeps the edits made during a refused save and sends them against the settings read', async () => {
    await open();
    vi.useFakeTimers();
    const refused: Deferred<IntakeFormConfiguration> = deferred<IntakeFormConfiguration>();
    api.update.mockReturnValueOnce(refused.promise);
    api.configuration.mockResolvedValueOnce(configuration({ ...saved, title: 'Bug report' }, 4));
    api.update.mockResolvedValueOnce(
      configuration(
        { ...saved, title: 'Bug report', fields: { ...saved.fields, dueDate: 'required' } },
        5,
      ),
    );

    store.edit({ defaultStatus: 'todo' });
    await vi.advanceTimersByTimeAsync(500);
    store.edit({ fields: { dueDate: 'required' } });
    refused.reject(
      new HttpErrorResponse({
        status: 422,
        error: { status: 422, code: 'intake-form.defaults-invalid' },
      }),
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(store.settings()?.defaultStatus).toBe('triage');
    expect(store.settings()?.fields.dueDate).toBe('required');
    expect(store.settings()?.title).toBe('Bug report');
    expect(api.update).toHaveBeenCalledTimes(2);
    expect(api.update).toHaveBeenLastCalledWith(
      'list-sprint-14',
      { fields: { dueDate: 'required' } },
      4,
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.update).toHaveBeenCalledTimes(2);
  });

  it('publishes after the change made before it, from the version that change recorded', async () => {
    await open();
    vi.useFakeTimers();
    const saving: Deferred<IntakeFormConfiguration> = deferred<IntakeFormConfiguration>();
    const publishing: Deferred<IntakeFormConfiguration> = deferred<IntakeFormConfiguration>();
    const changed: IntakeFormDraft = { ...saved, fields: { ...saved.fields, dueDate: 'required' } };
    api.update.mockReturnValueOnce(saving.promise);
    api.publish.mockReturnValueOnce(publishing.promise);

    store.edit({ fields: { dueDate: 'required' } });
    const published: Promise<boolean> = store.publish();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.publish).not.toHaveBeenCalled();

    saving.resolve(configuration(changed, 4));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.publish).toHaveBeenCalledTimes(1);
    publishing.resolve(configuration(changed, 5, 'k'.repeat(43)));

    expect(await published).toBe(true);
    expect(store.publicKey()).toBe('k'.repeat(43));
    expect(store.configuration.value()?.version).toBe(5);
    expect(store.settings()?.fields.dueDate).toBe('required');
  });

  it('sends a change after a late withdrawal, and ignores an answer older than the one shown', async () => {
    await open();
    vi.useFakeTimers();
    const withdrawing: Deferred<IntakeFormConfiguration> = deferred<IntakeFormConfiguration>();
    api.disable.mockReturnValueOnce(withdrawing.promise);

    const withdrawn: Promise<boolean> = store.disable();
    store.edit({ title: 'Bug report' });
    await vi.advanceTimersByTimeAsync(500);
    expect(api.update).not.toHaveBeenCalled();

    withdrawing.resolve(configuration(saved, 6));
    expect(await withdrawn).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(api.update).toHaveBeenCalledWith('list-sprint-14', { title: 'Bug report' }, 6);
    expect(store.configuration.value()?.version).toBe(7);

    api.publish.mockResolvedValueOnce(configuration(saved, 2, 'k'.repeat(43)));
    expect(await store.publish()).toBe(true);
    expect(store.publicKey()).toBeNull();
    expect(store.configuration.value()?.version).toBe(7);
  });

  it('rebases only the settings not edited again after a failed write', () => {
    const sent: IntakeFormDraft = { ...saved, defaultStatus: 'todo' };
    const latest: IntakeFormDraft = { ...sent, description: 'New intro' };
    const recorded: IntakeFormDraft = { ...saved, title: 'Bug report' };

    expect(rebaseDraft(latest, saved, sent, recorded)).toEqual({
      ...recorded,
      description: 'New intro',
    });
  });
});
