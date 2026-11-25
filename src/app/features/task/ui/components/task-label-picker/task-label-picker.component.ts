import {
  booleanAttribute,
  Component,
  computed,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { CwCombobox, CwComboboxEmpty, CwComboboxOption } from '@cadenway/ui/components/combobox';
import { CwButton } from '@cadenway/ui/components/button';

import { TASK_COMBOBOX_LABELS } from '../../../constants/task-brick-labels/task-brick-labels.constants';

/**
 * Component TaskLabelPicker
 *
 * @description
 * The labels property (`App.dc.html` near line 2950): a multi-check `cw-combobox` of the
 * organization's labels that also creates one from the typed text (`Create “…”`). The trigger
 * reads `Labels` when none is chosen. The chosen names are a two-way `value`; a created name
 * is added to it and offered with the others.
 */
@Component({
  selector: 'cw-task-label-picker',
  imports: [CwButton, CwCombobox, CwComboboxEmpty, CwComboboxOption],
  providers: [TASK_COMBOBOX_LABELS],
  template: `
    <cw-combobox
      multiple
      [creatable]="!failed()"
      size="sm"
      [value]="value()"
      (valueChange)="choose($event)"
      (create)="create($event)"
      [loading]="loading()"
      [disabled]="disabled()"
      placeholder="Labels"
      i18n-placeholder="@@task.label-picker.placeholder"
      searchPlaceholder="Search or create a label…"
      i18n-searchPlaceholder="@@task.label-picker.search"
      ariaLabel="Labels"
      i18n-ariaLabel="@@task.label-picker.placeholder"
    >
      @if (failed()) {
        <cw-combobox-empty
          ><span role="alert" i18n="@@task.create.read-failed"
            >Could not load this information.</span
          >
          <button cwButton type="button" size="xs" (click)="retry.emit()">
            {{ retryLabel }}
          </button></cw-combobox-empty
        >
      }
      @for (label of failed() ? [] : choices(); track label) {
        <cw-combobox-option [value]="label">{{ label }}</cw-combobox-option>
      }
    </cw-combobox>
  `,
})
export class TaskLabelPicker {
  // #region Properties
  /**
   * Property retryLabel
   *
   * @description
   * Label of the `Retry` button of a failed read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = $localize`:@@task.retry:Retry`;

  /**
   * Property failed
   *
   * @description
   * Whether the labels could not be loaded.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input(false);

  /**
   * Property retry
   *
   * @description
   * Requests another labels read.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retry: OutputEmitterRef<void> = output();

  /**
   * Property labels
   *
   * @description
   * Label names the organization already has.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly labels: InputSignal<readonly string[]> = input<readonly string[]>([]);

  /**
   * Property loading
   *
   * @description
   * Whether the labels are still being read.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly loading: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property disabled
   *
   * @description
   * Whether the choice cannot be changed.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property value
   *
   * @description
   * Names of the chosen labels, two-way.
   *
   * @type {ModelSignal<readonly string[]>}
   * @readonly
   */
  public readonly value: ModelSignal<readonly string[]> = model<readonly string[]>([]);

  /**
   * Property choices
   *
   * @description
   * The organization's labels followed by chosen names it does not have yet, without duplicates.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  protected readonly choices: Signal<readonly string[]> = computed((): readonly string[] => [
    ...new Set([...this.labels(), ...this.value()]),
  ]);
  // #endregion

  // #region Methods
  /**
   * Method choose
   *
   * @description
   * Takes the combobox's new choice as the value.
   *
   * @param {unknown} value - What the combobox emits: the chosen names.
   */
  protected choose(value: unknown): void {
    this.value.set(
      Array.isArray(value) ? value.filter((name: unknown) => typeof name === 'string') : [],
    );
  }

  /**
   * Method create
   *
   * @description
   * Adds a typed name to the chosen labels, ignoring case against the names already offered.
   *
   * @param {string} query - Typed name.
   */
  protected create(query: string): void {
    const name: string = query.trim();
    if (name === '') return;
    const existing: string | undefined = this.choices().find(
      (label: string) => label.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    const chosen: string = existing ?? name;
    if (!this.value().includes(chosen)) this.value.set([...this.value(), chosen]);
  }
  // #endregion
}
