import {
  computed,
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
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { concatMap, debounceTime, from, pipe } from 'rxjs';

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
      const saved: () => IntakeFormConfiguration | null = () =>
        store.configuration.hasValue() ? store.configuration.value() : null;
      const send: () => Promise<void> = async (): Promise<void> => {
        const listId: string | null = store.listId();
        const current: IntakeFormConfiguration | null = saved();
        const draft: IntakeFormDraft | null = store._draft();
        if (listId === null || current === null || draft === null) return;
        const change: IntakeFormChange = changeBetween(current.settings, draft);
        if (Object.keys(change).length === 0) return;
        try {
          const next: IntakeFormConfiguration = await store._api.update(
            listId,
            change,
            current.version,
          );
          if (store.listId() !== listId) return;
          store.configuration.set(next);
          const latest: IntakeFormDraft | null = store._draft();
          if (latest !== null && sameSettings(latest, next.settings)) {
            patchState(store, { _draft: null });
          }
        } catch (error: unknown) {
          if (store.listId() !== listId) return;
          patchState(store, { _draft: null });
          store.configuration.reload();
          store._toasts.error(
            hasProblemCode(error, 'intake-form.defaults-invalid')
              ? $localize`:@@spaces.form.defaults-invalid:This status or assignee cannot be used in this list`
              : $localize`:@@spaces.form.save-failed:The form settings could not be saved`,
          );
        }
      };
      const save: (draft: IntakeFormDraft) => void = rxMethod<IntakeFormDraft>(
        pipe(
          debounceTime(SAVE_DELAY_MS),
          concatMap(() => from(send())),
        ),
      );
      const publication: (
        write: (listId: string) => Promise<IntakeFormConfiguration>,
        failure: string,
      ) => Promise<boolean> = async (write, failure) => {
        const listId: string | null = store.listId();
        if (listId === null || store.publishing()) return false;
        patchState(store, { publishing: true });
        try {
          const next: IntakeFormConfiguration = await write(listId);
          if (store.listId() !== listId) return false;
          store.configuration.set(next);
          patchState(store, { publishing: false });
          return true;
        } catch {
          if (store.listId() === listId) {
            patchState(store, { publishing: false });
            store._toasts.error(failure);
          }
          return false;
        }
      };
      return {
        load: signalMethod<string | null>((listId: string | null): void => {
          if (listId === store.listId()) return;
          patchState(store, { listId, publishing: false, _draft: null });
        }),
        edit(change: IntakeFormChange): void {
          const current: IntakeFormDraft | null = store.settings();
          if (current === null) return;
          const draft: IntakeFormDraft = {
            ...current,
            ...change,
            fields: { ...current.fields, ...change.fields },
          };
          patchState(store, { _draft: draft });
          save(draft);
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
  );
}

/**
 * Constant FormViewStore
 *
 * @description
 * The state of the `Form` view (`l/:listId/form`), route-scoped through `FORM_VIEW_PROVIDERS`:
 * the list's request form (`getIntakeFormConfiguration`, the primary read). A change shows at
 * once in the preview and the settings; 500 ms after the last one, what differs from the saved
 * settings is sent against their version, one write after the other. A refused write forgets the
 * changes, reads the settings again and shows a failure toast. Publishing and withdrawing replace
 * the saved settings with the answer. Another list starts over, and late answers for the
 * previous one are dropped.
 *
 * @type {Type<FormViewStoreInstance>}
 */
export const FormViewStore: Type<FormViewStoreInstance> = createFormViewStore();
