import { formatDate, formatNumber } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import { CwProgress } from '@cadenway/ui/components/progress';
import { NgIcon } from '@ng-icons/core';

import type { KeyResult, MilestoneState } from '../../../models/goal/goal.interface';
import { takesSingular } from '../../../utils/plural/plural.util';
import { toLocalDate } from '../../../utils/quarter/quarter.util';

/**
 * Constant KIND_ICONS
 *
 * @description
 * The Bold icon of each kind of key result (`KR_ICONS`, `App.dc.html` line 4258).
 *
 * @type {Readonly<Record<KeyResult['kind'], string>>}
 */
const KIND_ICONS: Readonly<Record<KeyResult['kind'], string>> = {
  'list-progress': 'phosphorListChecksBold',
  number: 'phosphorHashBold',
  checkbox: 'phosphorCheckSquareBold',
  milestone: 'phosphorDiamondBold',
};

/**
 * Component KeyResultRow
 *
 * @description
 * One key result of an open goal (`App.dc.html` lines 1608-1617): its kind's icon, its label and
 * hint, the control of its kind, a mini progress bar with its percentage and the `Remove` button.
 * A number shows `−` and `+` around `current / target`; a checkbox ticks `Done` or `To do`; a
 * milestone opens its task and shows `Reached`, `Late`, `Upcoming` or `Milestone not found`; a
 * list-progress result opens its list and shows `done / total tasks`. Without the right to change
 * the goal (`canWrite`), the number buttons, the checkbox and `Remove` are not rendered. The
 * `Remove` button shows on hover or focus from 768 px, always below. Presentational: every action
 * is an output.
 */
@Component({
  selector: 'cw-key-result-row',
  imports: [CwButton, CwCheckbox, CwProgress, NgIcon],
  host: {
    role: 'listitem',
    class:
      'group/kr flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2.5 sm:flex-nowrap sm:px-4 sm:pl-14',
  },
  templateUrl: './key-result-row.component.html',
})
export class KeyResultRow {
  // #region Properties
  /**
   * Property result
   *
   * @description
   * The key result, with the value being sent.
   *
   * @type {InputSignal<KeyResult>}
   * @readonly
   */
  public readonly result: InputSignal<KeyResult> = input.required<KeyResult>();

  /**
   * Property canWrite
   *
   * @description
   * Whether the caller may change the goal.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canWrite: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property listName
   *
   * @description
   * Name of the list of a list-progress result, or null when the sidebar does not show it (an
   * archived list, gap G-G2).
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly listName: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property milestone
   *
   * @description
   * What is known of a milestone's task; `unknown` while it is read.
   *
   * @type {InputSignal<MilestoneState>}
   * @readonly
   */
  public readonly milestone: InputSignal<MilestoneState> = input<MilestoneState>('unknown');

  /**
   * Property today
   *
   * @description
   * The caller's day, `YYYY-MM-DD`, to tell a late milestone.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly today: InputSignal<string> = input.required<string>();

  /**
   * Property stepped
   *
   * @description
   * Emits `1` for `Increase` and `-1` for `Decrease` of a number.
   *
   * @type {OutputEmitterRef<1 | -1>}
   * @readonly
   */
  public readonly stepped: OutputEmitterRef<1 | -1> = output<1 | -1>();

  /**
   * Property toggled
   *
   * @description
   * Emits when the checkbox is clicked.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly toggled: OutputEmitterRef<void> = output();

  /**
   * Property milestoneOpened
   *
   * @description
   * Emits the key of the milestone task to open.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly milestoneOpened: OutputEmitterRef<string> = output<string>();

  /**
   * Property listOpened
   *
   * @description
   * Emits the id of the list to open.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly listOpened: OutputEmitterRef<string> = output<string>();

  /**
   * Property removed
   *
   * @description
   * Emits when `Remove` is clicked.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly removed: OutputEmitterRef<void> = output();

  /**
   * Property locale
   *
   * @description
   * Locale of the numbers and dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property icon
   *
   * @description
   * Icon of the key result's kind.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly icon: Signal<string> = computed((): string => KIND_ICONS[this.result().kind]);

  /**
   * Property percent
   *
   * @description
   * Rounded progress of the key result.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly percent: Signal<number> = computed((): number =>
    Math.round(this.result().progressPercent),
  );

  /**
   * Property percentText
   *
   * @description
   * The percentage beside the mini bar.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly percentText: Signal<string> = computed(
    (): string => $localize`:@@goals.result.percent:${this.percent()}:percent:%`,
  );

  /**
   * Property value
   *
   * @description
   * The text of the key result's control.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly value: Signal<string> = computed((): string => {
    const result: KeyResult = this.result();
    switch (result.kind) {
      case 'number':
        return $localize`:@@goals.result.number-value:${this.number(result.currentValue)}:current: / ${this.number(result.targetValue)}:target:`;
      case 'checkbox':
        return result.checked
          ? $localize`:@@goals.result.done:Done`
          : $localize`:@@goals.result.to-do:To do`;
      case 'list-progress': {
        const done: number = result.doneTaskCount;
        const total: number = result.eligibleTaskCount;
        return takesSingular(total)
          ? $localize`:@@goals.result.tasks-one:${done}:done: / ${total}:total: task`
          : $localize`:@@goals.result.tasks-other:${done}:done: / ${total}:total: tasks`;
      }
      case 'milestone': {
        const task: MilestoneState = this.milestone();
        if (result.reached) return $localize`:@@goals.result.reached:Reached`;
        if (task === 'missing') return $localize`:@@goals.result.missing:Milestone not found`;
        if (task !== 'unknown' && task.dueDate !== null && task.dueDate < this.today())
          return $localize`:@@goals.result.late:Late`;
        return $localize`:@@goals.result.upcoming:Upcoming`;
      }
    }
  });

  /**
   * Property hint
   *
   * @description
   * The line under the label.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly hint: Signal<string> = computed((): string => {
    const result: KeyResult = this.result();
    switch (result.kind) {
      case 'number': {
        const start: string = this.number(result.startValue);
        const target: string = this.number(result.targetValue);
        return result.targetValue < result.startValue
          ? $localize`:@@goals.result.hint-down:Target: down from ${start}:start: to ${target}:target:`
          : $localize`:@@goals.result.hint-up:Start ${start}:start:, target ${target}:target:`;
      }
      case 'checkbox':
        return $localize`:@@goals.result.hint-checkbox:Achieved or not`;
      case 'list-progress': {
        const list: string | null = this.listName();
        return list === null
          ? $localize`:@@goals.result.hint-list-unknown:Calculated from its list`
          : $localize`:@@goals.result.hint-list:Calculated from “${list}:list:”`;
      }
      case 'milestone': {
        const task: MilestoneState = this.milestone();
        if (task === 'missing') return '';
        if (task === 'unknown' || task.dueDate === null) return result.taskKey;
        return `${result.taskKey} · ${formatDate(toLocalDate(task.dueDate), 'd MMM', this.locale)}`;
      }
    }
  });

  /**
   * Property openListLabel
   *
   * @description
   * Accessible name of the button that opens a list-progress result's list.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly openListLabel: Signal<string> = computed((): string => {
    const list: string | null = this.listName();
    return list === null
      ? $localize`:@@goals.result.open-list-unknown:Open the list`
      : $localize`:@@goals.result.open-list:Open ${list}:list:`;
  });

  /**
   * Property decreaseLabel
   *
   * @description
   * Accessible name of `−`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly decreaseLabel: Signal<string> = computed(
    (): string => $localize`:@@goals.result.decrease:Decrease “${this.result().label}:label:”`,
  );

  /**
   * Property increaseLabel
   *
   * @description
   * Accessible name of `+`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly increaseLabel: Signal<string> = computed(
    (): string => $localize`:@@goals.result.increase:Increase “${this.result().label}:label:”`,
  );

  /**
   * Property removeLabel
   *
   * @description
   * Accessible name of `Remove`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly removeLabel: Signal<string> = computed(
    (): string => $localize`:@@goals.result.remove:Remove “${this.result().label}:label:”`,
  );

  /**
   * Property progressLabel
   *
   * @description
   * Accessible name of the mini bar, the key result's label.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly progressLabel: Signal<string> = computed((): string => this.result().label);
  // #endregion

  // #region Methods
  /**
   * Method number
   *
   * @description
   * A value in the running locale, with up to two decimals.
   *
   * @param {number} value - The value.
   * @returns {string} The formatted value.
   */
  private number(value: number): string {
    return formatNumber(value, this.locale, '1.0-2');
  }
  // #endregion
}
