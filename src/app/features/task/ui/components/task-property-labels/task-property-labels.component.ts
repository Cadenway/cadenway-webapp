import {
  booleanAttribute,
  Component,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  output,
  type OutputEmitterRef,
} from '@angular/core';
import {
  CwMenu,
  CwMenuItem,
  CwMenuItemCheckbox,
  CwMenuLabel,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';

/**
 * Component TaskPropertyLabels
 *
 * @description
 * The `Labels` row of the task detail's properties (`App.dc.html` lines 2504-2517): the trigger
 * shows the task's labels as chips, or `Empty`, and opens the `Labels` menu of the
 * organization's labels with a checkbox each, which stays open while labels are ticked. Each
 * tick emits `toggled` with the label; the container writes it. A failed read of the labels
 * shows the error with `Retry` (`retried`).
 */
@Component({
  selector: 'cw-task-property-labels',
  imports: [CwMenu, CwMenuItem, CwMenuItemCheckbox, CwMenuLabel, CwMenuTriggerFor],
  template: `
    <button
      type="button"
      class="relative isolate flex min-h-8 w-full flex-wrap items-center gap-1 overflow-hidden rounded-md border border-transparent px-2 py-1 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
      [disabled]="disabled()"
      [cwMenuTriggerFor]="menu"
      data-testid="task-property-labels"
    >
      @for (label of labels(); track label) {
        <span
          class="inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
          >{{ label }}</span
        >
      } @empty {
        <span class="text-muted-foreground" i18n="@@task.properties.empty">Empty</span>
      }
    </button>
    <cw-menu #menu align="end" ariaLabel="Labels" i18n-ariaLabel="@@task.properties.labels">
      @if (failed()) {
        <span role="alert" class="block px-2 py-1.5 text-sm" i18n="@@task.create.read-failed"
          >Could not load this information.</span
        >
        <button cwMenuItem type="button" (triggered)="retried.emit()" i18n="@@task.retry">
          Retry
        </button>
      } @else {
        @for (label of options(); track label) {
          <button
            cwMenuItemCheckbox
            type="button"
            [checked]="isOn(label)"
            (checkedChange)="toggled.emit(label)"
          >
            {{ label }}
          </button>
        } @empty {
          <cw-menu-label i18n="@@task.properties.labels-none">No label yet</cw-menu-label>
        }
      }
    </cw-menu>
  `,
})
export class TaskPropertyLabels {
  // #region Properties
  /**
   * Property labels
   *
   * @description
   * The task's labels.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly labels: InputSignal<readonly string[]> = input<readonly string[]>([]);

  /**
   * Property options
   *
   * @description
   * Labels the menu offers.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly options: InputSignal<readonly string[]> = input<readonly string[]>([]);

  /**
   * Property failed
   *
   * @description
   * Whether reading the labels failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input(false);

  /**
   * Property disabled
   *
   * @description
   * Read-only: the trigger opens nothing.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property toggled
   *
   * @description
   * A label ticked or unticked.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly toggled: OutputEmitterRef<string> = output<string>();

  /**
   * Property retried
   *
   * @description
   * `Retry` after a failed read of the labels.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();
  // #endregion

  // #region Methods
  /**
   * Method isOn
   *
   * @description
   * Whether the task has a label, without regard to case.
   *
   * @param {string} label - The label.
   * @returns {boolean} Whether it is ticked.
   */
  protected isOn(label: string): boolean {
    const folded: string = label.toLocaleLowerCase();
    return this.labels().some((item: string): boolean => item.toLocaleLowerCase() === folded);
  }
  // #endregion
}
