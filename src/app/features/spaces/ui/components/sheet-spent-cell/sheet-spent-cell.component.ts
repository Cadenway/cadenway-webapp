import {
  Component,
  computed,
  input,
  type InputSignal,
  type OnInit,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { formatDuration } from '@cadenway/ui/components/time-tracker';

/**
 * Component SheetSpentCell
 *
 * @description
 * The `Time spent` cell of the `Sheet` view (`App.dc.html` lines 3573, 7633-7637): the time
 * logged (`1 h 30`, `45 min`), `—` when none or not read yet, in the grenat text color once it
 * goes over the estimate. It emits `shown` once it is created, so the page reads the row's time
 * summary only for the rows the virtual table renders (gap G6).
 */
@Component({
  selector: 'cw-sheet-spent-cell',
  host: { class: 'flex w-full min-w-0 justify-end tabular-nums' },
  template: `<span
    class="min-w-0 truncate whitespace-nowrap"
    [class.text-muted-foreground]="!minutes()"
    [class.text-grenat-text]="over()"
    >{{ text() }}</span
  >`,
})
export class SheetSpentCell implements OnInit {
  // #region Properties
  /**
   * Property minutes
   *
   * @description
   * Minutes logged, null until read.
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly minutes: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property estimate
   *
   * @description
   * The task's estimate in minutes, null without one.
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly estimate: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property shown
   *
   * @description
   * The cell was rendered: its time summary may be read.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly shown: OutputEmitterRef<void> = output();

  /**
   * Property text
   *
   * @description
   * The duration shown.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly text: Signal<string> = computed((): string => {
    const minutes: number | null = this.minutes();
    return minutes ? formatDuration(minutes * 60_000) : '—';
  });

  /**
   * Property over
   *
   * @description
   * Whether the time logged goes over the estimate.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly over: Signal<boolean> = computed((): boolean => {
    const minutes: number | null = this.minutes();
    const estimate: number | null = this.estimate();
    return !!minutes && !!estimate && minutes > estimate;
  });
  // #endregion

  // #region Methods
  /**
   * Method ngOnInit
   *
   * @description
   * Tells the page the row shows.
   */
  public ngOnInit(): void {
    this.shown.emit();
  }
  // #endregion
}
