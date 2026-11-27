import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  viewChild,
} from '@angular/core';
import {
  type PriorityKey,
  STATUS_CATEGORIES,
  type StatusCategory,
  type StatusKey,
} from '@cadenway/contracts';
import {
  CwMenu,
  CwMenuGroup,
  CwMenuItem,
  CwMenuItemCheckbox,
  CwMenuLabel,
  CwMenuSeparator,
  CwMenuShortcut,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import {
  MILESTONE_STATUS_HINTS,
  PRIORITY_LABELS,
  STATUS_CATEGORY_LABELS,
  STATUS_HINTS,
} from '../../../constants/task-copy/task-copy.constants';
import type { Person } from '../../../models/person/person.interface';
import type { StatusOption } from '../../../models/status-option/status-option.interface';
import type { TaskMoveTarget } from '../../../models/task-move-target/task-move-target.interface';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { isMilestoneStatus, pickableStatuses } from '../../../utils/task-status/task-status.util';

/**
 * Constant PRIORITY_ORDER
 *
 * @description
 * The four priorities of the task menu, from the most urgent.
 *
 * @type {readonly PriorityKey[]}
 */
const PRIORITY_ORDER: readonly PriorityKey[] = ['urgente', 'haute', 'moyenne', 'basse'];

/**
 * Interface StatusMenuGroup
 *
 * @description
 * The statuses of one category of the task menu's `Status`, under its heading, each with its
 * hint; a milestone's menu has one group without a heading.
 */
interface StatusMenuGroup {
  // #region Properties
  /**
   * Property category
   *
   * @description
   * Category of the statuses, or null for a milestone's single group.
   *
   * @type {StatusCategory | null}
   * @readonly
   */
  readonly category: StatusCategory | null;

  /**
   * Property heading
   *
   * @description
   * `Not started`, `Active` or `Closed`; empty for a milestone.
   *
   * @type {string}
   * @readonly
   */
  readonly heading: string;

  /**
   * Property entries
   *
   * @description
   * The statuses with their hint, in workflow order.
   *
   * @type {readonly { option: StatusOption; hint: string }[]}
   * @readonly
   */
  readonly entries: readonly { readonly option: StatusOption; readonly hint: string }[];
  // #endregion
}

/**
 * Component TaskMenu
 *
 * @description
 * The menu of a task, or of a selection of several tasks, shared by every task view (`List`
 * rows, board cards, calendar items, Gantt rows and bars, workload chips, sheet rows):
 * `Open` (one task), `Status` (by category, with hints; a milestone's four), `Priority`,
 * `Assign` (ticked when every task has the person; `(me)` after the signed-in member),
 * `Move to` (the lists not every task already sits in), `Remind me tomorrow morning`,
 * `Duplicate`, `Copy the link`, `Copy the identifier` and `Delete`. Presentational: it emits
 * what was picked, and the view writes it (Spaces' `ViewTaskWritesStore` in a list view,
 * `TaskRowActionsStore` on a page whose rows belong to no list). It renders nothing in place:
 * the view opens `menu()` from its own triggers (`[cwContextMenuTriggerFor]="taskMenu.menu()"`,
 * right click, Menu key, Shift F10 or long press) and sets `tasks` when one opens.
 */
@Component({
  selector: 'cw-task-menu',
  imports: [
    CwMenu,
    CwMenuGroup,
    CwMenuItem,
    CwMenuItemCheckbox,
    CwMenuLabel,
    CwMenuSeparator,
    CwMenuShortcut,
    CwMenuTriggerFor,
    CwPriorityIcon,
    CwStatusIcon,
    NgIcon,
  ],
  templateUrl: './task-menu.component.html',
})
export class TaskMenu {
  // #region Properties
  /**
   * Property tasks
   *
   * @description
   * What the menu acts on: one task, or the selection the task belongs to.
   *
   * @type {InputSignal<readonly TaskSummary[]>}
   * @readonly
   */
  public readonly tasks: InputSignal<readonly TaskSummary[]> = input<readonly TaskSummary[]>([]);

  /**
   * Property status
   *
   * @description
   * The status every task shows (a pending change included), ticked in `Status`; null when they
   * differ.
   *
   * @type {InputSignal<StatusKey | null>}
   * @readonly
   */
  public readonly status: InputSignal<StatusKey | null> = input<StatusKey | null>(null);

  /**
   * Property statuses
   *
   * @description
   * The statuses of the list's space (names and hidden ones), offered under `Status`.
   *
   * @type {InputSignal<readonly StatusOption[]>}
   * @readonly
   */
  public readonly statuses: InputSignal<readonly StatusOption[]> = input<readonly StatusOption[]>(
    [],
  );

  /**
   * Property people
   *
   * @description
   * The members offered under `Assign`; `Assign` is disabled without any.
   *
   * @type {InputSignal<readonly Person[]>}
   * @readonly
   */
  public readonly people: InputSignal<readonly Person[]> = input<readonly Person[]>([]);

  /**
   * Property userId
   *
   * @description
   * The signed-in member, who reads `Name (me)`.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly userId: InputSignal<string> = input<string>('');

  /**
   * Property lists
   *
   * @description
   * The lists the tasks may move to; those every task already sits in are left out, and
   * `Move to` is disabled when none is left.
   *
   * @type {InputSignal<readonly TaskMoveTarget[]>}
   * @readonly
   */
  public readonly lists: InputSignal<readonly TaskMoveTarget[]> = input<readonly TaskMoveTarget[]>(
    [],
  );

  /**
   * Property openRequested
   *
   * @description
   * `Open` of a single task.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly openRequested: OutputEmitterRef<TaskSummary> = output<TaskSummary>();

  /**
   * Property statusPicked
   *
   * @description
   * A status of `Status`; `Cancelled` included, whose reason the view asks.
   *
   * @type {OutputEmitterRef<StatusKey>}
   * @readonly
   */
  public readonly statusPicked: OutputEmitterRef<StatusKey> = output<StatusKey>();

  /**
   * Property priorityPicked
   *
   * @description
   * A priority of `Priority`.
   *
   * @type {OutputEmitterRef<PriorityKey>}
   * @readonly
   */
  public readonly priorityPicked: OutputEmitterRef<PriorityKey> = output<PriorityKey>();

  /**
   * Property assigneeToggled
   *
   * @description
   * A person of `Assign`: added to every task, or removed when every task has them.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly assigneeToggled: OutputEmitterRef<string> = output<string>();

  /**
   * Property moved
   *
   * @description
   * A list of `Move to`.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly moved: OutputEmitterRef<string> = output<string>();

  /**
   * Property remindRequested
   *
   * @description
   * `Remind me tomorrow morning`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly remindRequested: OutputEmitterRef<void> = output();

  /**
   * Property duplicateRequested
   *
   * @description
   * `Duplicate`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly duplicateRequested: OutputEmitterRef<void> = output();

  /**
   * Property copyLinkRequested
   *
   * @description
   * `Copy the link`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly copyLinkRequested: OutputEmitterRef<void> = output();

  /**
   * Property copyKeyRequested
   *
   * @description
   * `Copy the identifier`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly copyKeyRequested: OutputEmitterRef<void> = output();

  /**
   * Property deleteRequested
   *
   * @description
   * `Delete`, which the view confirms.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly deleteRequested: OutputEmitterRef<void> = output();

  /**
   * Property menu
   *
   * @description
   * The menu the view's triggers open.
   *
   * @type {Signal<CwMenu>}
   * @readonly
   */
  public readonly menu: Signal<CwMenu> = viewChild.required<CwMenu>('menu');

  /**
   * Property priorities
   *
   * @description
   * The priorities of `Priority`, from the most urgent.
   *
   * @type {readonly PriorityKey[]}
   * @readonly
   */
  protected readonly priorities: readonly PriorityKey[] = PRIORITY_ORDER;

  /**
   * Property title
   *
   * @description
   * Heading of the menu: `CAD-482 · name` or `n tasks selected`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string => {
    const tasks: readonly TaskSummary[] = this.tasks();
    const count: number = tasks.length;
    if (count > 1) return $localize`:@@spaces.rows.menu-many:${count}:count: tasks selected`;
    return count === 1 ? `${tasks[0].key} · ${tasks[0].name}` : '';
  });

  /**
   * Property milestone
   *
   * @description
   * Whether every task is a milestone, which offers a milestone's four statuses.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly milestone: Signal<boolean> = computed((): boolean => {
    const tasks: readonly TaskSummary[] = this.tasks();
    return tasks.length > 0 && tasks.every((task: TaskSummary): boolean => task.milestone);
  });

  /**
   * Property priority
   *
   * @description
   * The priority every task has, or null when they differ.
   *
   * @type {Signal<PriorityKey | null>}
   * @readonly
   */
  protected readonly priority: Signal<PriorityKey | null> = computed((): PriorityKey | null => {
    const priorities: Set<PriorityKey> = new Set<PriorityKey>(
      this.tasks().map((task: TaskSummary) => task.priority),
    );
    return priorities.size === 1 ? [...priorities][0] : null;
  });

  /**
   * Property statusGroups
   *
   * @description
   * `Status`: the statuses under `Not started`, `Active` and `Closed`, each with its hint
   * (`App.dc.html` near line 3406); a milestone's four in one group.
   *
   * @type {Signal<readonly StatusMenuGroup[]>}
   * @readonly
   */
  protected readonly statusGroups: Signal<readonly StatusMenuGroup[]> = computed(
    (): readonly StatusMenuGroup[] => {
      const milestone: boolean = this.milestone();
      const entries: { option: StatusOption; hint: string }[] = pickableStatuses(
        this.statuses(),
        this.status() ?? 'todo',
        milestone,
      ).map((option: StatusOption) => ({
        option,
        hint:
          milestone && isMilestoneStatus(option.key)
            ? MILESTONE_STATUS_HINTS[option.key]
            : STATUS_HINTS[option.key],
      }));
      if (milestone) return [{ category: null, heading: '', entries }];
      return STATUS_CATEGORIES.map((category: StatusCategory): StatusMenuGroup => ({
        category,
        heading: STATUS_CATEGORY_LABELS[category],
        entries: entries.filter((entry) => entry.option.category === category),
      })).filter((group: StatusMenuGroup) => group.entries.length > 0);
    },
  );

  /**
   * Property targets
   *
   * @description
   * `Move to`: the lists not every task already sits in.
   *
   * @type {Signal<readonly TaskMoveTarget[]>}
   * @readonly
   */
  protected readonly targets: Signal<readonly TaskMoveTarget[]> = computed(
    (): readonly TaskMoveTarget[] => {
      const tasks: readonly TaskSummary[] = this.tasks();
      return this.lists().filter(
        (target: TaskMoveTarget): boolean =>
          !tasks.every((task: TaskSummary): boolean => task.listId === target.listId),
      );
    },
  );

  /**
   * Property remindLabel
   *
   * @description
   * `Remind me tomorrow morning`, or `Remind me of these tasks tomorrow morning` for several.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly remindLabel: Signal<string> = computed((): string =>
    this.tasks().length > 1
      ? $localize`:@@spaces.rows.remind-many:Remind me of these tasks tomorrow morning`
      : $localize`:@@spaces.rows.remind:Remind me tomorrow morning`,
  );

  /**
   * Property deleteLabel
   *
   * @description
   * `Delete the task`, or `Delete the N tasks` for several.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly deleteLabel: Signal<string> = computed((): string => {
    const count: number = this.tasks().length;
    return count > 1
      ? $localize`:@@spaces.rows.delete-many:Delete the ${count}:count: tasks`
      : $localize`:@@spaces.bulk.delete-action-one:Delete the task`;
  });
  // #endregion

  // #region Methods
  /**
   * Method personLabel
   *
   * @description
   * A person of `Assign`: the signed-in member reads `Name (me)`.
   *
   * @param {Person} person - The person.
   * @returns {string} The label.
   */
  protected personLabel(person: Person): string {
    const name: string = person.name;
    return person.id === this.userId()
      ? $localize`:@@spaces.rows.assign-me:${name}:name: (me)`
      : name;
  }

  /**
   * Method assignedToAll
   *
   * @description
   * Whether every task has the person.
   *
   * @param {string} userId - The person.
   * @returns {boolean} Whether all have it.
   */
  protected assignedToAll(userId: string): boolean {
    const tasks: readonly TaskSummary[] = this.tasks();
    return (
      tasks.length > 0 &&
      tasks.every((task: TaskSummary): boolean => task.assigneeIds.includes(userId))
    );
  }

  /**
   * Method priorityLabel
   *
   * @description
   * The localized priority word.
   *
   * @param {PriorityKey} priority - The priority.
   * @returns {string} Its label.
   */
  protected priorityLabel(priority: PriorityKey): string {
    return PRIORITY_LABELS[priority];
  }
  // #endregion
}
