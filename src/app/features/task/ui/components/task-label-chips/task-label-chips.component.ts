import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import { CwBadge } from '@cadenway/ui/components/badge';

/**
 * Constant VISIBLE_LABELS
 *
 * @description
 * Labels a row shows before `+n` (`App.dc.html`, list row).
 *
 * @type {number}
 */
const VISIBLE_LABELS: number = 2;

/**
 * Component TaskLabelChips
 *
 * @description
 * The labels of a row or a card: the first two as bordered pills, then `+n` for the rest, whose
 * names are its tooltip and accessible name.
 */
@Component({
  selector: 'cw-task-label-chips',
  imports: [CwBadge],
  host: { class: 'flex min-w-0 items-center gap-1' },
  template: `
    @for (label of shown(); track label) {
      <span cwBadge variant="outline" class="shrink-0">{{ label }}</span>
    }
    @if (rest().length > 0) {
      <span
        class="text-xs text-muted-foreground"
        [title]="restNames()"
        [attr.aria-label]="restNames()"
        >+{{ rest().length }}</span
      >
    }
  `,
})
export class TaskLabelChips {
  // #region Properties
  /**
   * Property labels
   *
   * @description
   * Names of the labels, in the task's order.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly labels: InputSignal<readonly string[]> = input.required<readonly string[]>();

  /**
   * Property shown
   *
   * @description
   * The labels drawn as pills.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  protected readonly shown: Signal<readonly string[]> = computed((): readonly string[] =>
    this.labels().slice(0, VISIBLE_LABELS),
  );

  /**
   * Property rest
   *
   * @description
   * The labels counted in `+n`.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  protected readonly rest: Signal<readonly string[]> = computed((): readonly string[] =>
    this.labels().slice(VISIBLE_LABELS),
  );

  /**
   * Property restNames
   *
   * @description
   * Names of the labels counted in `+n`, comma-separated.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly restNames: Signal<string> = computed((): string => this.rest().join(', '));
  // #endregion
}
