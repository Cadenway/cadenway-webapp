import {
  Component,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  booleanAttribute,
  output,
  type OutputEmitterRef,
  signal,
  type WritableSignal,
} from '@angular/core';
import { parseDuration } from '@cadenway/ui/components/time-tracker';

/**
 * Type SheetEditorKind
 *
 * @description
 * What a sheet cell editor reads: a text (name, text field), a duration (the estimate, a bare
 * number being hours), a number (numeric field) or a calendar date (due date).
 *
 * @type {'text' | 'duration' | 'number' | 'date'}
 */
export type SheetEditorKind = 'text' | 'duration' | 'number' | 'date';

/**
 * Type SheetEditorValue
 *
 * @description
 * A validated value: a text, minutes for a duration, a number, a `YYYY-MM-DD` date, or null for
 * an emptied cell (which clears the value).
 *
 * @type {string | number | null}
 */
export type SheetEditorValue = string | number | null;

/**
 * Constant MAX_ESTIMATE_MINUTES
 *
 * @description
 * Longest estimate the contract takes, in minutes (`estimateMinutes`, 60,000 at most).
 *
 * @type {number}
 */
const MAX_ESTIMATE_MINUTES: number = 60_000;

/**
 * Constant MAX_NAME_LENGTH
 *
 * @description
 * Longest task name the contract takes.
 *
 * @type {number}
 */
const MAX_NAME_LENGTH: number = 300;

/**
 * Function parseSheetValue
 *
 * @description
 * Reads a typed cell value (`tblCommit` of `App.dc.html`): an empty text is null (cleared),
 * except where a value is required; a duration takes the design system's reading with hours for
 * a bare number (`parseEst`), within the contract's 60,000 minutes; a number takes a decimal
 * comma and, when asked, refuses a negative value; undefined is an invalid value.
 *
 * @param {string} text - What the editor holds.
 * @param {SheetEditorKind} kind - What it reads.
 * @param {{ required: boolean; nonNegative: boolean }} rules - The validation rules.
 * @returns {SheetEditorValue | undefined} The value, null when emptied, undefined when invalid.
 */
export function parseSheetValue(
  text: string,
  kind: SheetEditorKind,
  rules: { readonly required: boolean; readonly nonNegative: boolean },
): SheetEditorValue | undefined {
  const trimmed: string = text.trim();
  if (trimmed === '') return rules.required ? undefined : null;
  switch (kind) {
    case 'text':
      return trimmed.length > MAX_NAME_LENGTH && rules.required ? undefined : trimmed;
    case 'duration': {
      const milliseconds: number | null = parseDuration(trimmed, { bareNumber: 'hours' });
      if (milliseconds === null) return undefined;
      const minutes: number = Math.round(milliseconds / 60_000);
      return minutes >= 1 && minutes <= MAX_ESTIMATE_MINUTES ? minutes : undefined;
    }
    case 'number': {
      if (!/^-?\d+(?:[.,]\d+)?$/u.test(trimmed)) return undefined;
      const value: number = Number(trimmed.replace(',', '.'));
      return Number.isFinite(value) && (!rules.nonNegative || value >= 0) ? value : undefined;
    }
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/u.test(trimmed) ? trimmed : undefined;
  }
}

/**
 * Component SheetCellEditor
 *
 * @description
 * The in-cell editor of the `Sheet` view (`App.dc.html` lines 1060-1062), placed in a
 * `cwCellEditor` template of `cw-data-table`, which focuses it on opening, cancels it with
 * Escape and moves to the next editable cell with Tab (after a blur). It holds `value` as its
 * draft. Enter validates: a valid value emits `committed` (the table then closes the editor), an
 * invalid one sets `aria-invalid` and keeps the editor open (`Points` below zero, an unreadable
 * estimate). Leaving the field validates the same way, and an invalid value then emits
 * `cancelled`. `label` names the field (`Estimate of CAD-482`).
 */
@Component({
  selector: 'cw-sheet-cell-editor',
  host: { class: 'flex h-full w-full min-w-0 items-center' },
  templateUrl: './sheet-cell-editor.component.html',
})
export class SheetCellEditor {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The draft the editor opens with.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly value: InputSignal<string> = input<string>('');

  /**
   * Property kind
   *
   * @description
   * What the editor reads.
   *
   * @type {InputSignal<SheetEditorKind>}
   * @readonly
   */
  public readonly kind: InputSignal<SheetEditorKind> = input<SheetEditorKind>('text');

  /**
   * Property label
   *
   * @description
   * Accessible name of the field.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly label: InputSignal<string> = input.required<string>();

  /**
   * Property required
   *
   * @description
   * Whether an empty value is invalid (the name).
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly required: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property nonNegative
   *
   * @description
   * Whether a negative number is invalid (the sprint points).
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly nonNegative: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property alignEnd
   *
   * @description
   * Whether the value is aligned at the end (numbers).
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly alignEnd: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property committed
   *
   * @description
   * A valid value, null for an emptied cell.
   *
   * @type {OutputEmitterRef<SheetEditorValue>}
   * @readonly
   */
  public readonly committed: OutputEmitterRef<SheetEditorValue> = output<SheetEditorValue>();

  /**
   * Property cancelled
   *
   * @description
   * The field was left with an invalid value.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly cancelled: OutputEmitterRef<void> = output();

  /**
   * Property invalid
   *
   * @description
   * Whether Enter met an invalid value; typing clears it.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly invalid: WritableSignal<boolean> = signal<boolean>(false);
  // #endregion

  // #region Methods
  /**
   * Method submit
   *
   * @description
   * Enter: emits a valid value, or marks the field invalid and keeps it open.
   *
   * @param {Event} event - The key event.
   * @param {string} text - What the field holds.
   */
  protected submit(event: Event, text: string): void {
    event.preventDefault();
    const value: SheetEditorValue | undefined = this.parse(text);
    if (value === undefined) {
      this.invalid.set(true);
      return;
    }
    this.committed.emit(value);
  }

  /**
   * Method leave
   *
   * @description
   * Blur: emits a valid value, else cancels the edit.
   *
   * @param {string} text - What the field holds.
   */
  protected leave(text: string): void {
    const value: SheetEditorValue | undefined = this.parse(text);
    if (value === undefined) this.cancelled.emit();
    else this.committed.emit(value);
  }

  /**
   * Method select
   *
   * @description
   * Selects the draft on focus, so typing replaces it.
   *
   * @param {Event} event - The focus event.
   */
  protected select(event: Event): void {
    const target: EventTarget | null = event.target;
    if (target instanceof HTMLInputElement && target.type === 'text') target.select();
  }

  /**
   * Method parse
   *
   * @description
   * Reads the field with the editor's rules.
   *
   * @param {string} text - What the field holds.
   * @returns {SheetEditorValue | undefined} The value, undefined when invalid.
   */
  private parse(text: string): SheetEditorValue | undefined {
    return parseSheetValue(text, this.kind(), {
      required: this.required(),
      nonNegative: this.nonNegative(),
    });
  }
  // #endregion
}
