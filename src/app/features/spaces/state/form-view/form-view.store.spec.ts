import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { IntakeFormApi } from '../../data-access/services/intake-form-api/intake-form-api.service';
import type {
  IntakeFormConfiguration,
  IntakeFormDraft,
} from '../../models/intake-form/intake-form.interface';
import { changeBetween, FormViewStore, type FormViewStoreInstance } from './form-view.store';

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
});
