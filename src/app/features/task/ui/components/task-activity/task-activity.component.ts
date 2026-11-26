import { formatDate } from '@angular/common';
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
import { NgIcon } from '@ng-icons/core';

import { PRIORITY_LABELS } from '../../../constants/task-copy/task-copy.constants';
import type { Person } from '../../../models/person/person.interface';
import type {
  TaskActivityActor,
  TaskActivityChange,
  TaskActivityEntry,
} from '../../../models/task-detail-sections/task-detail-sections.interface';
import type { StatusOption } from '../../../models/status-option/status-option.interface';
import { relativeInstant } from '../../../utils/task-detail-sections/task-detail-sections.util';
import { statusLabel } from '../../../utils/task-status/task-status.util';

/**
 * Interface ActivityRow
 *
 * @description
 * One entry as the feed writes it.
 */
interface ActivityRow {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the entry.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property icon
   *
   * @description
   * Icon of the kind of change.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property who
   *
   * @description
   * The actor's name.
   *
   * @type {string}
   * @readonly
   */
  readonly who: string;

  /**
   * Property text
   *
   * @description
   * What the actor did.
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property quote
   *
   * @description
   * The comment's excerpt, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly quote: string | null;

  /**
   * Property time
   *
   * @description
   * When, in words.
   *
   * @type {string}
   * @readonly
   */
  readonly time: string;
  // #endregion
}

/**
 * Constant KIND_ICONS
 *
 * @description
 * Icon of each kind of change.
 *
 * @type {Readonly<Record<TaskActivityChange['kind'], string>>}
 */
const KIND_ICONS: Readonly<Record<TaskActivityChange['kind'], string>> = {
  create: 'phosphorPlusCircleBold',
  status: 'phosphorArrowsLeftRightBold',
  priority: 'phosphorFlagBold',
  due: 'phosphorCalendarBlankBold',
  assign: 'phosphorUserBold',
  comment: 'phosphorChatCircleBold',
  other: 'phosphorPencilSimpleBold',
};

/**
 * Component TaskActivity
 *
 * @description
 * The `Activity` tab (`App.dc.html` lines 2326-2335, 7690-7701): the log of the task, the most
 * recent first, each entry with its icon, its actor (a person from the member directory, an
 * automation, the Git provider, or a service by name) and what they did (created the task,
 * changed the status or the priority to…, set, moved or removed the due date, assigned or removed
 * someone, commented with the excerpt, or changed the task for a kind this version does not know)
 * and when; `Show more` reads older entries. The loading skeleton while nothing is listed, the
 * inline error with `Retry`, and the empty text.
 */
@Component({
  selector: 'cw-task-activity',
  imports: [CwButton, NgIcon],
  host: { class: 'flex flex-col gap-3' },
  templateUrl: './task-activity.component.html',
})
export class TaskActivity {
  // #region Properties
  /**
   * Property entries
   *
   * @description
   * The entries read, the most recent first.
   *
   * @type {InputSignal<readonly TaskActivityEntry[]>}
   * @readonly
   */
  public readonly entries: InputSignal<readonly TaskActivityEntry[]> =
    input.required<readonly TaskActivityEntry[]>();

  /**
   * Property people
   *
   * @description
   * The member directory, by account.
   *
   * @type {InputSignal<ReadonlyMap<string, Person>>}
   * @readonly
   */
  public readonly people: InputSignal<ReadonlyMap<string, Person>> = input<
    ReadonlyMap<string, Person>
  >(new Map());

  /**
   * Property statuses
   *
   * @description
   * The space's status words.
   *
   * @type {InputSignal<readonly StatusOption[]>}
   * @readonly
   */
  public readonly statuses: InputSignal<readonly StatusOption[]> = input<readonly StatusOption[]>(
    [],
  );

  /**
   * Property milestone
   *
   * @description
   * Whether the task is a milestone (its status words differ).
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly milestone: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property loading
   *
   * @description
   * Whether the first page is being read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly loading: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property failed
   *
   * @description
   * Whether the first page could not be read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property hasMore
   *
   * @description
   * Whether older entries remain.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly hasMore: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property loadingMore
   *
   * @description
   * Whether older entries are being read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly loadingMore: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property moreFailed
   *
   * @description
   * Whether the last read of older entries failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly moreFailed: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property retried
   *
   * @description
   * Emits when `Retry` is pressed after the first page failed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property moreLoaded
   *
   * @description
   * Emits when `Show more` (or its `Retry`) is pressed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly moreLoaded: OutputEmitterRef<void> = output();

  /**
   * Property rows
   *
   * @description
   * The entries in words.
   *
   * @type {Signal<readonly ActivityRow[]>}
   * @readonly
   */
  protected readonly rows: Signal<readonly ActivityRow[]> = computed((): readonly ActivityRow[] => {
    const now: Date = new Date();
    return this.entries().map((entry: TaskActivityEntry): ActivityRow => ({
      id: entry.id,
      icon: entry.actor.type === 'git' ? 'phosphorGitBranchBold' : KIND_ICONS[entry.change.kind],
      who: this.actorName(entry.actor),
      text: this.describe(entry),
      quote:
        entry.change.kind === 'comment' && entry.change.excerpt !== ''
          ? entry.change.excerpt
          : null,
      time: relativeInstant(entry.at, now, this.locale),
    }));
  });

  /**
   * Property locale
   *
   * @description
   * The active locale, for dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);
  // #endregion

  // #region Methods
  /**
   * Method actorName
   *
   * @description
   * Who made a change, in words.
   *
   * @param {TaskActivityActor} actor - The actor.
   * @returns {string} The name.
   */
  private actorName(actor: TaskActivityActor): string {
    switch (actor.type) {
      case 'user':
        return (
          this.people().get(actor.id)?.name ??
          $localize`:@@task.sections.avatar-unknown:Unknown user`
        );
      case 'git':
        if (actor.provider === 'github') return 'GitHub';
        if (actor.provider === 'gitlab') return 'GitLab';
        return 'Git';
      case 'automation':
        return $localize`:@@task.activity.automation:An automation`;
      default:
        return actor.id;
    }
  }

  /**
   * Method describe
   *
   * @description
   * What an entry records, after its actor's name.
   *
   * @param {TaskActivityEntry} entry - The entry.
   * @returns {string} The words.
   */
  private describe(entry: TaskActivityEntry): string {
    const change: TaskActivityChange = entry.change;
    switch (change.kind) {
      case 'create':
        return $localize`:@@task.activity.created:created the task`;
      case 'status': {
        const label: string = statusLabel(change.to, this.statuses(), this.milestone());
        return $localize`:@@task.activity.status:changed the status to ${label}:status:`;
      }
      case 'priority': {
        const label: string = PRIORITY_LABELS[change.to];
        return $localize`:@@task.activity.priority:changed the priority to ${label}:priority:`;
      }
      case 'due':
        return this.dueText(change.from, change.to);
      case 'assign': {
        const self: boolean = change.userId === entry.actor.id && entry.actor.type === 'user';
        const name: string =
          this.people().get(change.userId)?.name ??
          $localize`:@@task.sections.avatar-unknown:Unknown user`;
        if (change.added) {
          return self
            ? $localize`:@@task.activity.assigned-self:assigned themselves the task`
            : $localize`:@@task.activity.assigned:assigned ${name}:name:`;
        }
        return self
          ? $localize`:@@task.activity.unassigned-self:left the task`
          : $localize`:@@task.activity.unassigned:removed ${name}:name:`;
      }
      case 'comment':
        return $localize`:@@task.activity.commented:commented`;
      default:
        return $localize`:@@task.activity.changed:changed the task`;
    }
  }

  /**
   * Method dueText
   *
   * @description
   * A due date change in words, with its dates.
   *
   * @param {string | null} from - The due date before.
   * @param {string | null} to - The due date after.
   * @returns {string} The words.
   */
  private dueText(from: string | null, to: string | null): string {
    const day: (date: string) => string = (date: string): string =>
      formatDate(date, 'd MMM', this.locale);
    if (from && to) {
      return $localize`:@@task.activity.due-moved:moved the due date ${day(from)}:from: → ${day(to)}:to:`;
    }
    if (to) return $localize`:@@task.activity.due-set:set the due date ${day(to)}:to:`;
    return $localize`:@@task.activity.due-removed:removed the due date`;
  }
  // #endregion
}
