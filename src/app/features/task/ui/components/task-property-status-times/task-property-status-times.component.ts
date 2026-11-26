import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';

import type { StatusOption } from '../../../models/status-option/status-option.interface';
import type {
  TaskStatusTime,
  TaskStatusTimes,
} from '../../../models/task-property/task-property.interface';
import { formatSpan } from '../../../utils/task-property/task-property.util';
import { statusLabel } from '../../../utils/task-status/task-status.util';

/**
 * Constant STATUS_BAR_TONES
 *
 * @description
 * Fill of each status in the stacked bar: the tone of its icon (`StatutTache.dc.html`, `TONES`).
 *
 * @type {Readonly<Record<StatusKey, string>>}
 */
const STATUS_BAR_TONES: Readonly<Record<StatusKey, string>> = {
  triage: 'bg-amethyste',
  backlog: 'bg-ink-muted',
  todo: 'bg-ink-muted',
  progress: 'bg-balise',
  review: 'bg-cornaline',
  testing: 'bg-jade',
  waiting: 'bg-ink-muted',
  blocked: 'bg-grenat',
  done: 'bg-jade',
  cancelled: 'bg-ink-muted',
};

/**
 * Interface StatusTimeRow
 *
 * @description
 * A status as the section writes it.
 */
interface StatusTimeRow {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * The status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property label
   *
   * @description
   * Its words in the space.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property duration
   *
   * @description
   * Time spent in it, in words.
   *
   * @type {string}
   * @readonly
   */
  readonly duration: string;

  /**
   * Property percent
   *
   * @description
   * Its share of the total, 0 to 100.
   *
   * @type {number}
   * @readonly
   */
  readonly percent: number;

  /**
   * Property width
   *
   * @description
   * Its segment's width in the bar, 2 % at least.
   *
   * @type {string}
   * @readonly
   */
  readonly width: string;

  /**
   * Property tone
   *
   * @description
   * Fill class of its segment.
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;

  /**
   * Property active
   *
   * @description
   * Whether it is the current status, still counting.
   *
   * @type {boolean}
   * @readonly
   */
  readonly active: boolean;

  /**
   * Property longest
   *
   * @description
   * Whether it is the longest open status (emphasized when three statuses or more).
   *
   * @type {boolean}
   * @readonly
   */
  readonly longest: boolean;
  // #endregion
}

/**
 * Component TaskPropertyStatusTimes
 *
 * @description
 * The `Time in status` section of the task detail's properties (`App.dc.html` lines 2594-2602
 * and 5564-5606), shown when the times are read (never for a milestone): `Since creation: {d}`
 * when the history covers the task since its creation, a stacked bar (each segment titled
 * `{label} · {d}`), a row per status (icon, label, `· in progress` on the current status,
 * duration, share) and, from three statuses, `Longest: {label} ({d}).` for the longest status
 * that is not done or cancelled. Durations read `less than 1 h`, `5 h` or `2 d 3 h`.
 */
@Component({
  selector: 'cw-task-property-status-times',
  imports: [CwStatusIcon],
  template: `
    @if (rows().length > 0) {
      <section
        class="mt-2 flex flex-col gap-2 border-t border-border px-2 pt-3"
        [attr.aria-labelledby]="titleId"
      >
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-medium" [id]="titleId" i18n="@@task.properties.status-times">
            Time in status
          </h3>
          @if (times()?.complete) {
            <span
              class="text-xs whitespace-nowrap text-muted-foreground"
              i18n="@@task.properties.status-times-total"
              >Since creation: {{ total() }}</span
            >
          }
        </div>
        <div class="flex h-2 w-full gap-px overflow-hidden rounded-full" aria-hidden="true">
          @for (row of rows(); track row.status) {
            <span
              class="h-full"
              [class]="row.tone"
              [style.width]="row.width"
              [title]="row.label + ' · ' + row.duration"
            ></span>
          }
        </div>
        <ul class="flex flex-col gap-1">
          @for (row of rows(); track row.status) {
            <li class="flex items-center gap-2 text-xs" data-testid="task-property-status-time">
              <cw-status-icon [status]="row.status" size="3" />
              <span
                class="relative top-[0.5px] min-w-0 flex-1 truncate"
                [class.font-medium]="row.longest"
                [class.text-foreground]="row.longest"
                [class.text-muted-foreground]="!row.longest"
                >{{ row.label }}
                @if (row.active) {
                  <span class="ml-1.5 text-primary" i18n="@@task.properties.status-times-current"
                    >· in progress</span
                  >
                }
              </span>
              <span
                class="relative top-[0.5px] shrink-0 whitespace-nowrap tabular-nums"
                [class.font-medium]="row.longest"
                [class.text-foreground]="row.longest"
                [class.text-muted-foreground]="!row.longest"
                >{{ row.duration }}</span
              >
              <span
                class="relative top-[0.5px] min-w-10 shrink-0 text-right whitespace-nowrap text-muted-foreground tabular-nums"
                i18n="@@task.properties.status-times-percent"
                >{{ row.percent }}%</span
              >
            </li>
          }
        </ul>
        @if (longest(); as longest) {
          <p class="text-xs text-muted-foreground" i18n="@@task.properties.status-times-longest">
            Longest: {{ longest.label }} ({{ longest.duration }}).
          </p>
        }
      </section>
    }
  `,
})
export class TaskPropertyStatusTimes {
  // #region Properties
  /**
   * Property times
   *
   * @description
   * Time per status, null while read and for a milestone.
   *
   * @type {InputSignal<TaskStatusTimes | null>}
   * @readonly
   */
  public readonly times: InputSignal<TaskStatusTimes | null> = input<TaskStatusTimes | null>(null);

  /**
   * Property statuses
   *
   * @description
   * Statuses of the task's space, for their words.
   *
   * @type {InputSignal<readonly StatusOption[]>}
   * @readonly
   */
  public readonly statuses: InputSignal<readonly StatusOption[]> = input<readonly StatusOption[]>(
    [],
  );

  /**
   * Property titleId
   *
   * @description
   * Id of the heading, unique per panel.
   *
   * @type {string}
   * @readonly
   */
  protected readonly titleId: string = `task-status-times-${crypto.randomUUID()}`;

  /**
   * Property totalMilliseconds
   *
   * @description
   * Sum of the durations (1 at least, so shares stay defined).
   *
   * @type {Signal<number>}
   * @readonly
   */
  private readonly totalMilliseconds: Signal<number> = computed(
    (): number =>
      (this.times()?.durations ?? []).reduce(
        (sum: number, time: TaskStatusTime): number => sum + time.milliseconds,
        0,
      ) || 1,
  );

  /**
   * Property total
   *
   * @description
   * The total in words.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly total: Signal<string> = computed((): string =>
    formatSpan(this.totalMilliseconds()),
  );

  /**
   * Property longestStatus
   *
   * @description
   * The longest status that is not done or cancelled, when three statuses or more were visited.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  private readonly longestStatus: Signal<StatusKey | null> = computed((): StatusKey | null => {
    const durations: readonly TaskStatusTime[] = this.times()?.durations ?? [];
    if (durations.length <= 2) return null;
    const open: TaskStatusTime[] = durations.filter(
      (time: TaskStatusTime): boolean => time.status !== 'done' && time.status !== 'cancelled',
    );
    open.sort((a: TaskStatusTime, b: TaskStatusTime): number => b.milliseconds - a.milliseconds);
    return open[0]?.status ?? null;
  });

  /**
   * Property rows
   *
   * @description
   * The statuses as the section writes them, in order of first appearance.
   *
   * @type {Signal<readonly StatusTimeRow[]>}
   * @readonly
   */
  protected readonly rows: Signal<readonly StatusTimeRow[]> = computed(
    (): readonly StatusTimeRow[] => {
      const total: number = this.totalMilliseconds();
      const longest: StatusKey | null = this.longestStatus();
      return (this.times()?.durations ?? []).map((time: TaskStatusTime): StatusTimeRow => ({
        status: time.status,
        label: statusLabel(time.status, this.statuses(), false),
        duration: formatSpan(time.milliseconds),
        percent: Math.round((time.milliseconds / total) * 100),
        width: `${String(Math.max(2, Math.round((time.milliseconds / total) * 100)))}%`,
        tone: STATUS_BAR_TONES[time.status],
        active: time.active,
        longest: time.status === longest,
      }));
    },
  );

  /**
   * Property longest
   *
   * @description
   * The row of the longest status, for the hint.
   *
   * @type {Signal<StatusTimeRow | null>}
   * @readonly
   */
  protected readonly longest: Signal<StatusTimeRow | null> = computed(
    (): StatusTimeRow | null => this.rows().find((row: StatusTimeRow) => row.longest) ?? null,
  );
  // #endregion
}
