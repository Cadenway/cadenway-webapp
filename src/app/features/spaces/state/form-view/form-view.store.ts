import {
  computed,
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
import { CwToastService } from '@cadenway/ui/components/toast';
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

import { hasProblemCode } from '@core/api';
import type { IntakeFieldKey, IntakeFieldMode } from '@features/intake';

import { IntakeFormApi } from '../../data-access/services/intake-form-api/intake-form-api.service';
import type {
  IntakeFormChange,
  IntakeFormConfiguration,
  IntakeFormDraft,
} from '../../models/intake-form/intake-form.interface';

/**
 * Constant SAVE_DELAY_MS
 *
 * @description
 * Pause after the last change before the settings are saved, so typing sends one change.
 *
 * @type {number}
 */
const SAVE_DELAY_MS: number = 500;

/**
 * Interface FormViewState
 *
 * @description
 * The list whose form is shown and the settings changed but not saved yet.
 */
interface FormViewState {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list, or null when its form is not read (before the page binds it, or for a list the
   * caller cannot edit).
   *
   * @type {string | null}
   * @readonly
   */
  readonly listId: string | null;

  /**
   * Property publishing
   *
   * @description
   * Whether a publication or a withdrawal is in flight.
   *
   * @type {boolean}
   * @readonly
   */
  readonly publishing: boolean;

  /**
   * Property _draft
   *
   * @description
   * The settings as the editor left them, over the saved ones, or null when nothing changed.
   *
   * @type {IntakeFormDraft | null}
   * @readonly
   */
  readonly _draft: IntakeFormDraft | null;
  // #endregion
}

/**
 * Interface FormViewStoreInstance
 *
 * @description
 * A list's request form: its settings, changed at once and saved shortly after, and its
 * publication.
 */
export interface FormViewStoreInstance {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list whose form is read, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly listId: Signal<string | null>;

  /**
   * Property configuration
   *
   * @description
   * The primary read: a failure rejects with the typed route error.
   *
   * @type {ResourceRef<IntakeFormConfiguration | undefined>}
   * @readonly
   */
  readonly configuration: ResourceRef<IntakeFormConfiguration | undefined>;

  /**
   * Property settings
   *
   * @description
   * The settings shown, the editor's changes included, or null before the read.
   *
   * @type {Signal<IntakeFormDraft | null>}
   * @readonly
   */
  readonly settings: Signal<IntakeFormDraft | null>;

  /**
   * Property publicKey
   *
   * @description
   * Key of the publication, or null when the form is not published.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly publicKey: Signal<string | null>;

  /**
   * Property publishing
   *
   * @description
   * Whether a publication or a withdrawal is in flight.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly publishing: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Follows the list whose form to read (null reads none); another list forgets the changes.
   *
   * @param {Signal<string | null> | string | null} listId - The list.
   */
  load(listId: Signal<string | null> | string | null): void;

  /**
   * Method edit
   *
   * @description
   * Changes settings at once and saves them 500 ms after the last change.
   *
   * @param {IntakeFormChange} change - The changed settings.
   */
  edit(change: IntakeFormChange): void;

  /**
   * Method publish
   *
   * @description
   * Publishes the form.
   *
   * @returns {Promise<boolean>} Whether it is published.
   */
  publish(): Promise<boolean>;

  /**
   * Method disable
   *
   * @description
   * Withdraws the publication: the public link stops working.
   *
   * @returns {Promise<boolean>} Whether it is withdrawn.
   */
  disable(): Promise<boolean>;
  // #endregion
}

/**
 * Function normalizedDescription
 *
 * @description
 * An introduction as saved: a blank one is none.
 *
 * @param {string | null} description - The introduction.
 * @returns {string | null} The introduction, or null.
 */
function normalizedDescription(description: string | null): string | null {
  return description?.trim() ? description : null;
}

/**
 * Function changeBetween
 *
 * @description
 * What differs between the saved settings and the editor's: a blank title is not sent (the
 * contract requires one), and a title is compared as the service trims it.
 *
 * @param {IntakeFormDraft} saved - The saved settings.
 * @param {IntakeFormDraft} draft - The editor's settings.
 * @returns {IntakeFormChange} The settings to send.
 */
export function changeBetween(saved: IntakeFormDraft, draft: IntakeFormDraft): IntakeFormChange {
  const title: string = draft.title.trim();
  const description: string | null = normalizedDescription(draft.description);
  const fields: Partial<Record<IntakeFieldKey, IntakeFieldMode>> = {};
  for (const key of Object.keys(draft.fields) as IntakeFieldKey[]) {
    if (draft.fields[key] !== saved.fields[key]) fields[key] = draft.fields[key];
  }
  return {
    ...(title !== '' && title !== saved.title ? { title } : {}),
    ...(description !== normalizedDescription(saved.description) ? { description } : {}),
    ...(Object.keys(fields).length > 0 ? { fields } : {}),
    ...(draft.defaultStatus !== saved.defaultStatus ? { defaultStatus: draft.defaultStatus } : {}),
    ...(draft.defaultAssigneeId !== saved.defaultAssigneeId
      ? { defaultAssigneeId: draft.defaultAssigneeId }
      : {}),
  };
}

/**
 * Function sameSettings
 *
 * @description
 * Whether two settings are identical, character for character.
 *
 * @param {IntakeFormDraft} first - Some settings.
 * @param {IntakeFormDraft} second - Other settings.
 * @returns {boolean} Whether they are the same.
 */
function sameSettings(first: IntakeFormDraft, second: IntakeFormDraft): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * Function rebaseDraft
 *
 * @description
 * The editor's settings over newly recorded ones, after a write that failed: each setting the
 * editor did not change again since that write (it still holds the value the write sent, or the
 * value the write started from) takes the recorded value back; a setting edited again keeps the
 * editor's value, to be sent against the recorded settings.
 *
 * @param {IntakeFormDraft} latest - The editor's settings now.
 * @param {IntakeFormDraft} base - The settings the failed write started from.
 * @param {IntakeFormDraft} sent - The editor's settings the failed write sent.
 * @param {IntakeFormDraft} recorded - The settings recorded now.
 * @returns {IntakeFormDraft} The editor's settings to keep.
 */
export function rebaseDraft(
  latest: IntakeFormDraft,
  base: IntakeFormDraft,
  sent: IntakeFormDraft,
  recorded: IntakeFormDraft,
): IntakeFormDraft {
  const untouched: (now: unknown, before: unknown, wrote: unknown) => boolean = (
    now,
    before,
    wrote,
  ) => now === before || now === wrote;
  const fields: Record<IntakeFieldKey, IntakeFieldMode> = { ...latest.fields };
  for (const key of Object.keys(fields) as IntakeFieldKey[]) {
    if (untouched(latest.fields[key], base.fields[key], sent.fields[key])) {
      fields[key] = recorded.fields[key];
    }
  }
  return {
    title: untouched(latest.title, base.title, sent.title) ? recorded.title : latest.title,
    description: untouched(latest.description, base.description, sent.description)
      ? recorded.description
      : latest.description,
    fields,
    defaultStatus: untouched(latest.defaultStatus, base.defaultStatus, sent.defaultStatus)
      ? recorded.defaultStatus
      : latest.defaultStatus,
    defaultAssigneeId: untouched(
      latest.defaultAssigneeId,
      base.defaultAssigneeId,
      sent.defaultAssigneeId,
    )
      ? recorded.defaultAssigneeId
      : latest.defaultAssigneeId,
  };
}

/**
 * Function createFormViewStore
 *
 * @description
 * Creates the `Form` view's store.
 *
 * @returns {Type<FormViewStoreInstance>} Injectable store constructor.
 */
function createFormViewStore(): Type<FormViewStoreInstance> {
  return signalStore(
    withState<FormViewState>({ listId: null, publishing: false, _draft: null }),
    withProps((store) => {
      const api: IntakeFormApi = inject(IntakeFormApi);
      return {
        _api: api,
        _toasts: inject(CwToastService),
        _destroyRef: inject(DestroyRef),
        configuration: resource({
          params: (): { listId: string } | undefined => {
            const listId: string | null = store.listId();
            return listId === null ? undefined : { listId };
          },
          loader: ({
            params,
            abortSignal,
          }: {
            params: { listId: string };
            abortSignal: AbortSignal;
          }): Promise<IntakeFormConfiguration> => api.configuration(params.listId, abortSignal),
        }),
      };
    }),
    withComputed((store) => {
      const saved: Signal<IntakeFormConfiguration | null> = computed(
        (): IntakeFormConfiguration | null =>
          store.configuration.hasValue() ? store.configuration.value() : null,
      );
      return {
        settings: computed(
          (): IntakeFormDraft | null => store._draft() ?? saved()?.settings ?? null,
        ),
        publicKey: computed((): string | null => saved()?.publicKey ?? null),
      };
    }),
    withMethods((store) => {
      // Every write (a settings change, a publication, a withdrawal) runs on this queue, one
      // after the other, each from the version the previous one recorded. A write accepted by
      // the queue is sent even once the view is gone; only the shown state waits for the store.
      let queue: Promise<unknown> = Promise.resolve();
      // The newest settings known to the queue, with their list: kept here so that a write
      // still has them once the view and its resource are gone.
      let recorded: { listId: string; configuration: IntakeFormConfiguration } | null = null;
      // The save waiting for the end of a burst of changes, with its list and the editor's
      // settings, which stay known once the view is gone.
      let timer: ReturnType<typeof setTimeout> | undefined;
      let pending: { listId: string; draft: IntakeFormDraft } | null = null;
      const shown: (listId: string) => boolean = (listId: string): boolean =>
        !store._destroyRef.destroyed && store.listId() === listId;
      const enqueue: <T>(job: () => Promise<T>) => Promise<T> = <T>(
        job: () => Promise<T>,
      ): Promise<T> => {
        const run: Promise<T> = queue.then(job);
        queue = run.catch((): undefined => undefined);
        return run;
      };
      // The newest settings known of a list: the shown ones or the last recorded, by version.
      const baseOf: (listId: string) => IntakeFormConfiguration | null = (
        listId: string,
      ): IntakeFormConfiguration | null => {
        const known: IntakeFormConfiguration | null =
          recorded?.listId === listId ? recorded.configuration : null;
        const visible: IntakeFormConfiguration | null =
          shown(listId) && store.configuration.hasValue() ? store.configuration.value() : null;
        if (known === null) return visible;
        if (visible === null) return known;
        return known.version > visible.version ? known : visible;
      };
      // Records an answer, unless it is older than the version already known.
      const record: (listId: string, next: IntakeFormConfiguration) => void = (
        listId: string,
        next: IntakeFormConfiguration,
      ): void => {
        const base: IntakeFormConfiguration | null = baseOf(listId);
        if (base !== null && next.version < base.version) return;
        recorded = { listId, configuration: next };
        if (shown(listId)) store.configuration.set(next);
      };
      const failureOf: (error: unknown) => string = (error: unknown): string =>
        hasProblemCode(error, 'intake-form.defaults-invalid')
          ? $localize`:@@spaces.form.defaults-invalid:This status or assignee cannot be used in this list`
          : $localize`:@@spaces.form.save-failed:The form settings could not be saved`;
      const save: (listId: string, draftOf: () => IntakeFormDraft | null) => Promise<void> = (
        listId: string,
        draftOf: () => IntakeFormDraft | null,
      ): Promise<void> =>
        enqueue(async (): Promise<void> => {
          const base: IntakeFormConfiguration | null = baseOf(listId);
          const sent: IntakeFormDraft | null = draftOf();
          if (base === null || sent === null) return;
          const change: IntakeFormChange = changeBetween(base.settings, sent);
          if (Object.keys(change).length === 0) return;
          try {
            record(listId, await store._api.update(listId, change, base.version));
            const latest: IntakeFormDraft | null = shown(listId) ? store._draft() : null;
            const now: IntakeFormConfiguration | null = baseOf(listId);
            if (latest !== null && now !== null && sameSettings(latest, now.settings)) {
              patchState(store, { _draft: null });
            }
          } catch (error: unknown) {
            store._toasts.error(failureOf(error));
            let fresh: IntakeFormConfiguration | null;
            try {
              fresh = await store._api.configuration(listId);
              record(listId, fresh);
            } catch {
              fresh = null;
            }
            if (!shown(listId)) return;
            const latest: IntakeFormDraft | null = store._draft();
            if (latest === null) return;
            const target: IntakeFormDraft = (baseOf(listId) ?? base).settings;
            const kept: IntakeFormDraft = rebaseDraft(latest, base.settings, sent, target);
            patchState(store, { _draft: sameSettings(kept, target) ? null : kept });
            if (fresh !== null && Object.keys(changeBetween(target, kept)).length > 0) {
              void save(listId, (): IntakeFormDraft | null =>
                shown(listId) ? store._draft() : null,
              );
            }
          }
        });
      // Sends the pending change now, with the settings it was made on, which stay known to the
      // queue once the view is gone.
      const send: (waiting: { listId: string; draft: IntakeFormDraft }) => void = ({
        listId,
        draft,
      }: {
        listId: string;
        draft: IntakeFormDraft;
      }): void => {
        void save(listId, (): IntakeFormDraft | null => (shown(listId) ? store._draft() : draft));
      };
      const flush: () => void = (): void => {
        if (timer === undefined || pending === null) return;
        clearTimeout(timer);
        timer = undefined;
        const waiting: { listId: string; draft: IntakeFormDraft } = pending;
        pending = null;
        send(waiting);
      };
      const schedule: (listId: string, draft: IntakeFormDraft) => void = (
        listId: string,
        draft: IntakeFormDraft,
      ): void => {
        if (pending !== null && pending.listId !== listId) flush();
        const base: IntakeFormConfiguration | null = baseOf(listId);
        if (base !== null) recorded = { listId, configuration: base };
        clearTimeout(timer);
        pending = { listId, draft };
        timer = setTimeout((): void => {
          timer = undefined;
          const waiting: { listId: string; draft: IntakeFormDraft } | null = pending;
          pending = null;
          if (waiting !== null) send(waiting);
        }, SAVE_DELAY_MS);
      };
      const publication: (
        write: (listId: string) => Promise<IntakeFormConfiguration>,
        failure: string,
      ) => Promise<boolean> = (write, failure) => {
        const listId: string | null = store.listId();
        if (listId === null || store.publishing()) return Promise.resolve(false);
        flush();
        patchState(store, { publishing: true });
        return enqueue(async (): Promise<boolean> => {
          try {
            record(listId, await write(listId));
            return true;
          } catch {
            store._toasts.error(failure);
            return false;
          } finally {
            if (shown(listId)) patchState(store, { publishing: false });
          }
        });
      };
      return {
        _flush: flush,
        load: signalMethod<string | null>((listId: string | null): void => {
          if (listId === store.listId()) return;
          flush();
          patchState(store, { listId, publishing: false, _draft: null });
        }),
        edit(change: IntakeFormChange): void {
          const listId: string | null = store.listId();
          const current: IntakeFormDraft | null = store.settings();
          if (listId === null || current === null) return;
          const draft: IntakeFormDraft = {
            ...current,
            ...change,
            fields: { ...current.fields, ...change.fields },
          };
          patchState(store, { _draft: draft });
          schedule(listId, draft);
        },
        publish(): Promise<boolean> {
          return publication(
            (listId: string) => store._api.publish(listId),
            $localize`:@@spaces.form.publish-failed:The form could not be published`,
          );
        },
        disable(): Promise<boolean> {
          return publication(
            (listId: string) => store._api.disable(listId),
            $localize`:@@spaces.form.disable-failed:The form could not be unpublished`,
          );
        },
      };
    }),
    withHooks({
      onDestroy(store): void {
        store._flush();
      },
    }),
  );
}

/**
 * Constant FormViewStore
 *
 * @description
 * The state of the `Form` view (`l/:listId/form`), route-scoped through `FORM_VIEW_PROVIDERS`:
 * the list's request form (`getIntakeFormConfiguration`, the primary read). A change shows at
 * once in the preview and the settings; 500 ms after the last one, what differs from the newest
 * recorded settings is sent against their version. Settings changes, publications and
 * withdrawals share one queue: they are sent one after the other, and an answer older than the
 * version already known is ignored. A change still waiting when the view is left (or another
 * list is shown) is sent at once and its write completes after the store is gone. A refused
 * change shows a failure toast and reads the settings again; the settings it sent go back to the
 * recorded values unless edited since, and the newer edits are sent against the settings read.
 *
 * @type {Type<FormViewStoreInstance>}
 */
export const FormViewStore: Type<FormViewStoreInstance> = createFormViewStore();
