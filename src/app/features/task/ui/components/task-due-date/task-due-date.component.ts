import { DatePipe } from '@angular/common';
import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import { NgIcon } from '@ng-icons/core';

import { isClosedStatus } from '../../../utils/task-status/task-status.util';

/**
 * Type DueTone
 *
 * @description
 * How a due date reads: late (garnet, with a warning icon), today (violet) or plain (muted).
 *
 * @type {'late' | 'today' | 'plain' | 'none'}
 */
type DueTone = 'late' | 'today' | 'plain' | 'none';

/**
 * Function localDay
 *
 * @description
 * The ISO calendar date of a moment in local time.
 *
 * @param {Date} date - The moment.
 * @returns {string} `yyyy-mm-dd`.
 */
function localDay(date: Date): string {
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/**
 * Function dayNumber
 *
 * @description
 * Days since the epoch of an ISO calendar date, ignoring time zones.
 *
 * @param {string} iso - `yyyy-mm-dd`.
 * @returns {number} The day number.
 */
function dayNumber(iso: string): number {
  const [year, month, day]: number[] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * Component TaskDueDate
 *
 * @description
 * The due date of a row or a property (`dueInfo` of `App.dc.html`): « Aujourd’hui », « Demain »,
 * else the short date (« 12 nov. », with the year when it is not the current one), « — » without
 * a date. A date before today on a task that is not closed is late: garnet with a warning icon;
 * today on an open task is violet; the rest is muted. The full date is its tooltip.
 */
@Component({
  selector: 'cw-task-due-date',
  imports: [DatePipe, NgIcon],
  host: {
    class: 'inline-flex items-center gap-1 text-xs whitespace-nowrap',
    '[class.text-grenat-text]': "tone() === 'late'",
    '[class.text-primary]': "tone() === 'today'",
    '[class.text-muted-foreground]': "tone() === 'plain' || tone() === 'none'",
    '[attr.data-tone]': 'tone()',
  },
  template: `
    @if (due(); as date) {
      @if (tone() === 'late') {
        <ng-icon
          name="phosphorWarningCircleFill"
          class="text-destructive"
          size="0.875rem"
          aria-hidden="true"
        />
      }
      <span [title]="date | date: 'fullDate'">
        @switch (offset()) {
          @case (0) {
            <ng-container i18n="@@task.due.today">Today</ng-container>
          }
          @case (1) {
            <ng-container i18n="@@task.due.tomorrow">Tomorrow</ng-container>
          }
          @default {
            {{ date | date: (sameYear() ? 'd MMM' : 'd MMM y') }}
          }
        }
      </span>
      @if (tone() === 'late') {
        <span class="sr-only" i18n="@@task.due.late">(late)</span>
      }
    } @else {
      <span aria-hidden="true">—</span>
      <span class="sr-only" i18n="@@task.due.none">No due date</span>
    }
  `,
})
export class TaskDueDate {
  // #region Properties
  /**
   * Property due
   *
   * @description
   * Due date as an ISO calendar date, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly due: InputSignal<string | null> = input.required<string | null>();

  /**
   * Property status
   *
   * @description
   * Status shown for the task: a closed task is never late.
   *
   * @type {InputSignal<StatusKey>}
   * @readonly
   */
  public readonly status: InputSignal<StatusKey> = input<StatusKey>('todo');

  /**
   * Property today
   *
   * @description
   * Today as an ISO calendar date; the local date when the component is created by default.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly today: InputSignal<string> = input<string>(localDay(new Date()));

  /**
   * Property offset
   *
   * @description
   * Days from today to the due date, negative when it has passed; null without a date.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  protected readonly offset: Signal<number | null> = computed((): number | null => {
    const due: string | null = this.due();
    return due === null ? null : dayNumber(due) - dayNumber(this.today());
  });

  /**
   * Property sameYear
   *
   * @description
   * Whether the due date falls in the current year, so its year is left out.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly sameYear: Signal<boolean> = computed(
    (): boolean => this.due()?.slice(0, 4) === this.today().slice(0, 4),
  );

  /**
   * Property tone
   *
   * @description
   * How the date reads.
   *
   * @type {Signal<DueTone>}
   * @readonly
   */
  protected readonly tone: Signal<DueTone> = computed((): DueTone => {
    const offset: number | null = this.offset();
    if (offset === null) return 'none';
    const closed: boolean = isClosedStatus(this.status());
    if (offset < 0 && !closed) return 'late';
    if (offset === 0 && !closed) return 'today';
    return 'plain';
  });
  // #endregion
}
