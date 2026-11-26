import { formatDate } from '@angular/common';
import {
  Component,
  computed,
  inject,
  LOCALE_ID,
  linkedSignal,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
import {
  CwActivityDetailDef,
  type CwActivityActor,
  type CwActivityEntry,
  CwActivityFeed,
  CwActivityFeedEmpty,
  type CwActivitySegment,
  CwActivitySummaryDef,
  provideCwActivityFeedLabels,
} from '@cadenway/ui/components/activity-feed';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwSelect, CwSelectOption, provideCwSelectLabels } from '@cadenway/ui/components/select';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwToggleGroup, CwToggleGroupItem } from '@cadenway/ui/components/toggle-group';
import { NgIcon } from '@ng-icons/core';

import {
  defaultStatusOptions,
  PRIORITY_LABELS,
  type StatusOption,
  statusLabel,
  TaskCancelDialog,
  TaskDetailOpener,
  type TaskSummary,
} from '@features/task';

import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import {
  LIST_ACTIVITY_KINDS,
  type ListActivityActor,
  type ListActivityChange,
  type ListActivityEntry,
  type ListActivityKind,
  type ListActivityTask,
} from '../../../models/list-activity/list-activity.interface';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import type { ListTaskItem, ListTasksRead } from '../../../models/list-tasks/list-tasks.interface';
import type { Space, SpaceStatusOption } from '../../../models/space/space.interface';
import { ActivityViewStore } from '../../../state/activity-view/activity-view.store';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import {
  ListTasksStore,
  type ListTasksStoreInstance,
} from '../../../state/list-tasks/list-tasks.store';
import {
  ViewTaskWritesStore,
  type ViewTaskWritesStoreInstance,
} from '../../../state/view-task-writes/view-task-writes.store';
import { VIEW_TASK_WRITER } from '../../../state/view-task-writes/view-task-writer.token';
import { TaskMenu } from '../../components/task-menu/task-menu.component';

/**
 * Constant EVERYONE
 *
 * @description
 * Value of the select's `Everyone` option.
 *
 * @type {string}
 */
const EVERYONE: string = 'all';

/**
 * Constant ALL_KINDS
 *
 * @description
 * Value of the `All` chip, on when no kind filters.
 *
 * @type {string}
 */
const ALL_KINDS: string = 'all';

/**
 * Constant NEAR_END_PX
 *
 * @description
 * Distance to the end of the scrolled feed, in pixels, under which the next page is read.
 *
 * @type {number}
 */
const NEAR_END_PX: number = 200;

/**
 * Interface KindChip
 *
 * @description
 * A type chip of the toolbar.
 */
interface KindChip {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The kind, or `all`.
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;

  /**
   * Property label
   *
   * @description
   * Its word.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property icon
   *
   * @description
   * Its icon.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;
  // #endregion
}

/**
 * Interface PersonOption
 *
 * @description
 * An option of the person select.
 */
interface PersonOption {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The account, or `all` for everyone.
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;

  /**
   * Property label
   *
   * @description
   * The name.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Interface StatusPart
 *
 * @description
 * A status written in an entry, with its icon.
 */
interface StatusPart {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly key: StatusKey;

  /**
   * Property label
   *
   * @description
   * Its word in the list's space.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Interface ActivityDetail
 *
 * @description
 * What the feed's templates draw of an entry: the verb, the details of its kind and its task.
 */
interface ActivityDetail {
  // #region Properties
  /**
   * Property verb
   *
   * @description
   * What the actor did, after their name.
   *
   * @type {string}
   * @readonly
   */
  readonly verb: string;

  /**
   * Property status
   *
   * @description
   * The status before and after, for a status change.
   *
   * @type {{ readonly from: StatusPart; readonly to: StatusPart } | null}
   * @readonly
   */
  readonly status: { readonly from: StatusPart; readonly to: StatusPart } | null;

  /**
   * Property priority
   *
   * @description
   * The new priority and its word, for a priority change.
   *
   * @type {{ readonly key: PriorityKey; readonly label: string } | null}
   * @readonly
   */
  readonly priority: { readonly key: PriorityKey; readonly label: string } | null;

  /**
   * Property due
   *
   * @description
   * The dates of a due date change (`16 Nov → 18 Nov`), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly due: string | null;

  /**
   * Property task
   *
   * @description
   * The task of the chip.
   *
   * @type {ListActivityTask}
   * @readonly
   */
  readonly task: ListActivityTask;
  // #endregion
}

/**
 * Component ActivityViewPage
 *
 * @description
 * The `Activity` view at `/:org/l/:listId/activity`, below the list frame, without the view
 * tools (`App.dc.html` lines 1299-1361, 7676-7720, 7985-8001): a person select (`Everyone` and
 * the members), the type chips (`All`, `Statuses`, `Assignments`, `Creations`, `Comments`,
 * `Priorities`, `Due dates`; `All` is on when none is) and the count of matching events, then
 * the log in `cw-activity-feed`, grouped by local day (`Today`, `Yesterday` or the long day, with
 * its count). An entry shows its actor (a member's avatar, or an icon for an automation, the Git
 * provider or a service), the verb and its details (the status from and to with their icons, the
 * priority with its icon, the due dates), the comment's excerpt, the task chip that opens Task's
 * detail (`TaskDetailOpener`, `?task=<KEY>`) and the time. The chip of a task of the list opens
 * the shared task menu (`cw-task-menu`: right click, Menu key, Shift F10, long press), whose writes
 * go through the page-scoped `ViewTaskWritesStore` over `ListTasksStore` (`VIEW_TASK_WRITER`),
 * which reads every task of the list, unfiltered, for the menu; the chip then shows the task's
 * status as the list shows it, a write included. A task no longer in the list has no menu: the
 * entry names its key, name and status only, which the menu's writes cannot act on. The feed reads the next page as it
 * scrolls near its end, or with `Show more`. States: the skeleton while the filters are read, the
 * empty state (`No activity matches`, with `Clear filters` when filtered), the route's error
 * boundary when the first read of the list fails, and an inline error with `Retry` for a later
 * read or an older page. The toolbar wraps under 768 px.
 */
@Component({
  selector: 'cw-activity-view-page',
  imports: [
    CwActivityDetailDef,
    CwActivityFeed,
    CwActivityFeedEmpty,
    CwActivitySummaryDef,
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwContextMenuTriggerFor,
    CwPriorityIcon,
    CwSelect,
    CwSelectOption,
    CwStatusIcon,
    CwToggleGroup,
    CwToggleGroupItem,
    NgIcon,
    TaskCancelDialog,
    TaskMenu,
  ],
  providers: [
    ViewTaskWritesStore,
    { provide: VIEW_TASK_WRITER, useExisting: ListTasksStore },
    provideCwActivityFeedLabels(() => ({
      today: $localize`:@@spaces.activity.today:Today`,
      yesterday: $localize`:@@spaces.activity.yesterday:Yesterday`,
      count: (count: number): string => $localize`:@@spaces.activity.group-count:· ${count}:count:`,
      emptyText: $localize`:@@spaces.activity.empty:No activity matches`,
      loading: $localize`:@@spaces.activity.loading:Loading the activity`,
    })),
    provideCwSelectLabels(() => ({
      placeholder: $localize`:@@spaces.activity.select-placeholder:Choose…`,
      emptyText: $localize`:@@spaces.activity.select-empty:No result`,
    })),
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './activity-view-page.component.html',
})
export class ActivityViewPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The view's entries, filters and reads.
   *
   * @type {InstanceType<typeof ActivityViewStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof ActivityViewStore> = inject(ActivityViewStore);

  /**
   * Property tasks
   *
   * @description
   * Every task of the list, unfiltered, as the task menu acts on them.
   *
   * @type {ListTasksStoreInstance}
   * @readonly
   */
  protected readonly tasks: ListTasksStoreInstance = inject(ListTasksStore);

  /**
   * Property writes
   *
   * @description
   * The task menu's writes, with their toasts, `Undo`, cancellation reason and deletion
   * confirmation, page-scoped over `ListTasksStore` (`VIEW_TASK_WRITER`).
   *
   * @type {ViewTaskWritesStoreInstance}
   * @readonly
   */
  protected readonly writes: ViewTaskWritesStoreInstance = inject(ViewTaskWritesStore);

  /**
   * Property shownTasks
   *
   * @description
   * The tasks of the list as shown (a write applied at once), by key.
   *
   * @type {Signal<ReadonlyMap<string, ListTaskItem>>}
   * @readonly
   */
  protected readonly shownTasks: Signal<ReadonlyMap<string, ListTaskItem>> = computed(
    (): ReadonlyMap<string, ListTaskItem> =>
      new Map(this.tasks.items().map((item: ListTaskItem) => [item.task.key, item])),
  );

  /**
   * Property menuKey
   *
   * @description
   * Key of the task whose chip opened the task menu.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly menuKey: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property menuItem
   *
   * @description
   * The task the menu acts on, as shown, or null.
   *
   * @type {Signal<ListTaskItem | null>}
   * @readonly
   */
  protected readonly menuItem: Signal<ListTaskItem | null> = computed((): ListTaskItem | null => {
    const key: string | null = this.menuKey();
    return key === null ? null : (this.shownTasks().get(key) ?? null);
  });

  /**
   * Property menuTasks
   *
   * @description
   * What the task menu acts on: the chip's task.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly menuTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const item: ListTaskItem | null = this.menuItem();
      return item ? [item.task] : [];
    },
  );

  /**
   * Property retryLabel
   *
   * @description
   * Word of the `Retry` buttons.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = SPACES_RETRY;

  /**
   * Property chips
   *
   * @description
   * The type chips, `All` first, then the kinds in the mockup's order.
   *
   * @type {readonly KindChip[]}
   * @readonly
   */
  protected readonly chips: readonly KindChip[] = [
    {
      value: ALL_KINDS,
      label: $localize`:@@spaces.activity.kind-all:All`,
      icon: 'phosphorPulseBold',
    },
    ...LIST_ACTIVITY_KINDS.map((kind: ListActivityKind): KindChip => ({
      value: kind,
      label: this.kindLabel(kind),
      icon: this.kindIcon(kind),
    })),
  ];

  /**
   * Property chipValue
   *
   * @description
   * The chips that are on, set again after each click so a click on `All` while it is on keeps it
   * on.
   *
   * @type {WritableSignal<readonly string[]>}
   * @readonly
   */
  protected readonly chipValue: WritableSignal<readonly string[]> = linkedSignal(
    (): readonly string[] => {
      const kinds: readonly ListActivityKind[] = this.store.filter().kinds;
      return kinds.length === 0 ? [ALL_KINDS] : kinds;
    },
  );

  /**
   * Property personValue
   *
   * @description
   * The person chosen in the select, `all` for everyone.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly personValue: Signal<string> = computed(
    (): string => this.store.filter().actorId ?? EVERYONE,
  );

  /**
   * Property people
   *
   * @description
   * The member directory, by account; empty until it is read.
   *
   * @type {Signal<ReadonlyMap<string, string | null>>}
   * @readonly
   */
  protected readonly people: Signal<ReadonlyMap<string, string | null>> = computed(
    (): ReadonlyMap<string, string | null> => {
      const members: readonly ListMember[] = this.listPage.organizationMembers.hasValue()
        ? this.listPage.organizationMembers.value()
        : [];
      return new Map(members.map((member: ListMember) => [member.userId, member.name]));
    },
  );

  /**
   * Property personOptions
   *
   * @description
   * The select's options: `Everyone`, then the members with a name, then the chosen person when
   * the directory does not list them. The mockup's `Public form` is not offered: the contract has
   * no intake actor (G8).
   *
   * @type {Signal<readonly PersonOption[]>}
   * @readonly
   */
  protected readonly personOptions: Signal<readonly PersonOption[]> = computed(
    (): readonly PersonOption[] => {
      const options: PersonOption[] = [
        { value: EVERYONE, label: $localize`:@@spaces.activity.everyone:Everyone` },
      ];
      for (const [userId, name] of this.people()) {
        if (name) options.push({ value: userId, label: name });
      }
      const chosen: string | null = this.store.filter().actorId;
      if (chosen !== null && !options.some((option: PersonOption) => option.value === chosen)) {
        options.push({ value: chosen, label: this.personName(chosen) });
      }
      return options;
    },
  );

  /**
   * Property countLabel
   *
   * @description
   * The count of matching events (`18 events`), empty until it is read.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly countLabel: Signal<string> = computed((): string => {
    const count: number | null = this.store.total();
    if (count === null) return '';
    return count === 1
      ? $localize`:@@spaces.activity.count-one:${count}:count: event`
      : $localize`:@@spaces.activity.count-many:${count}:count: events`;
  });

  /**
   * Property statusOptions
   *
   * @description
   * The statuses of the list's space, with its names; the default words until it is read.
   *
   * @type {Signal<readonly StatusOption[]>}
   * @readonly
   */
  protected readonly statusOptions: Signal<readonly StatusOption[]> = computed(
    (): readonly StatusOption[] => {
      const space: Space | null = this.listPage.space.hasValue()
        ? this.listPage.space.value()
        : null;
      return defaultStatusOptions().map((option: StatusOption): StatusOption => {
        const own: SpaceStatusOption | undefined = space?.statuses.find(
          (status: SpaceStatusOption): boolean => status.key === option.key,
        );
        return own ? { ...option, label: own.name ?? option.label } : option;
      });
    },
  );

  /**
   * Property feed
   *
   * @description
   * The entries as `cw-activity-feed` draws them.
   *
   * @type {Signal<readonly CwActivityEntry<ActivityDetail>[]>}
   * @readonly
   */
  protected readonly feed: Signal<readonly CwActivityEntry<ActivityDetail>[]> = computed(
    (): readonly CwActivityEntry<ActivityDetail>[] =>
      this.store.entries().map((entry: ListActivityEntry): CwActivityEntry<ActivityDetail> => {
        const detail: ActivityDetail = this.detailOf(entry);
        return {
          id: entry.id,
          at: entry.at,
          actor: this.actorOf(entry.actor),
          summary: this.segmentsOf(detail),
          ...(entry.change.kind === 'comment' && entry.change.excerpt !== ''
            ? { quote: entry.change.excerpt }
            : {}),
          data: detail,
        };
      }),
  );

  /**
   * Property listPage
   *
   * @description
   * The open list: its member directory and its space's status names.
   *
   * @type {InstanceType<typeof ListPageStore>}
   * @readonly
   */
  private readonly listPage: InstanceType<typeof ListPageStore> = inject(ListPageStore);

  /**
   * Property taskDetail
   *
   * @description
   * Opens a task's detail over the view.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly taskDetail: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property locale
   *
   * @description
   * The active locale, for the due dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the first page again when the error boundary runs the route again after a failed first
   * read, and reads every task of the list, unfiltered, for the task menu (its failure only leaves
   * the chips without a menu).
   *
   * @constructor
   */
  public constructor() {
    if (this.store.primary.error()) this.store.reload();
    this.tasks.load(
      computed((): ListTasksRead => ({
        listId: this.listPage.listId() ?? '',
        query: { level: 'all', sort: 'manual' },
      })),
    );
  }
  // #endregion

  // #region Methods
  /**
   * Method pickPerson
   *
   * @description
   * Keeps one person's entries, or everyone's.
   *
   * @param {string | null} value - The option chosen.
   */
  protected pickPerson(value: string | null): void {
    this.store.filterPerson(value === null || value === EVERYONE ? null : value);
  }

  /**
   * Method pickKinds
   *
   * @description
   * The chips' rule (`actTypeChips` of `App.dc.html`): turning `All` on, or every kind off,
   * shows every kind; turning a kind on turns `All` off.
   *
   * @param {string | null | readonly string[]} value - The chips that are on, in click order.
   */
  protected pickKinds(value: string | null | readonly string[]): void {
    const next: readonly string[] = Array.isArray(value) ? value : [];
    const before: readonly string[] = this.chipValue();
    const all: boolean =
      (next.includes(ALL_KINDS) && !before.includes(ALL_KINDS)) ||
      next.every((chip: string): boolean => chip === ALL_KINDS);
    const kinds: readonly ListActivityKind[] = all
      ? []
      : LIST_ACTIVITY_KINDS.filter((kind: ListActivityKind): boolean => next.includes(kind));
    this.store.filterKinds(kinds);
    this.chipValue.set(kinds.length === 0 ? [ALL_KINDS] : [...kinds]);
  }

  /**
   * Method openTask
   *
   * @description
   * Opens the task's detail over the view (`?task=<KEY>`, Task's `TaskDetailOpener`). No preview
   * is given: the entry does not say whether the task is a milestone, whose status words differ.
   *
   * @param {ListActivityTask} task - The task of the chip.
   */
  protected openTask(task: ListActivityTask): void {
    void this.taskDetail.open(task.key);
  }

  /**
   * Method scrolled
   *
   * @description
   * Reads the next page when the feed is scrolled near its end.
   *
   * @param {Event} event - The scroll of the feed's container.
   */
  protected scrolled(event: Event): void {
    const target: HTMLElement = event.target as HTMLElement;
    if (target.scrollHeight - target.scrollTop - target.clientHeight > NEAR_END_PX) return;
    if (this.store.hasMore() && !this.store.loadingMore() && !this.store.moreFailed()) {
      void this.store.loadMore();
    }
  }

  /**
   * Method personName
   *
   * @description
   * A person's name from the member directory.
   *
   * @param {string} userId - Account of the person.
   * @returns {string} The name, `Unknown user` when the directory does not name them.
   */
  private personName(userId: string): string {
    return this.people().get(userId) ?? $localize`:@@spaces.activity.unknown-person:Unknown user`;
  }

  /**
   * Method actorOf
   *
   * @description
   * Who made a change, as the feed draws it: a member with their avatar, an automation, the Git
   * provider or a service with an icon.
   *
   * @param {ListActivityActor} actor - The actor.
   * @returns {CwActivityActor} The feed's actor.
   */
  private actorOf(actor: ListActivityActor): CwActivityActor {
    switch (actor.type) {
      case 'user':
        return { name: this.personName(actor.id) };
      case 'automation':
        return {
          name: $localize`:@@spaces.activity.automation:An automation`,
          icon: 'phosphorLightningBold',
        };
      case 'git':
        return {
          name:
            actor.provider === 'github' ? 'GitHub' : actor.provider === 'gitlab' ? 'GitLab' : 'Git',
          icon: 'phosphorGitBranchBold',
        };
      case 'system':
        return { name: $localize`:@@spaces.activity.system:System`, icon: 'phosphorGearBold' };
      default:
        return { name: actor.id, icon: 'phosphorGearBold' };
    }
  }

  /**
   * Method detailOf
   *
   * @description
   * What an entry records, in words (`actVm` of `App.dc.html` lines 7691-7705).
   *
   * @param {ListActivityEntry} entry - The entry.
   * @returns {ActivityDetail} The verb, the details and the task.
   */
  private detailOf(entry: ListActivityEntry): ActivityDetail {
    const change: ListActivityChange = entry.change;
    const base: ActivityDetail = {
      verb: '',
      status: null,
      priority: null,
      due: null,
      task: entry.task,
    };
    switch (change.kind) {
      case 'create':
        return { ...base, verb: $localize`:@@spaces.activity.created:created the task` };
      case 'status':
        return {
          ...base,
          verb: $localize`:@@spaces.activity.status:changed the status`,
          status: {
            from: { key: change.from, label: this.statusWord(change.from) },
            to: { key: change.to, label: this.statusWord(change.to) },
          },
        };
      case 'priority':
        return {
          ...base,
          verb: $localize`:@@spaces.activity.priority:changed the priority to`,
          priority: { key: change.to, label: PRIORITY_LABELS[change.to] },
        };
      case 'due':
        return { ...base, verb: this.dueVerb(change.from, change.to), due: this.dueText(change) };
      case 'assign':
        return { ...base, verb: this.assignVerb(entry.actor, change.userId, change.added) };
      case 'comment':
        return { ...base, verb: $localize`:@@spaces.activity.commented:commented` };
      default:
        return { ...base, verb: $localize`:@@spaces.activity.changed:changed the task` };
    }
  }

  /**
   * Method segmentsOf
   *
   * @description
   * The summary as plain segments: the verb, then the emphasized details; the summary template
   * draws them with their icons.
   *
   * @param {ActivityDetail} detail - The entry's detail.
   * @returns {readonly CwActivitySegment[]} The segments.
   */
  private segmentsOf(detail: ActivityDetail): readonly CwActivitySegment[] {
    const segments: CwActivitySegment[] = [detail.verb];
    if (detail.status) {
      segments.push(detail.status.from.label, { text: detail.status.to.label });
    }
    if (detail.priority) segments.push({ text: detail.priority.label });
    if (detail.due) segments.push({ text: detail.due });
    return segments;
  }

  /**
   * Method statusWord
   *
   * @description
   * A status's word in the list's space.
   *
   * @param {StatusKey} status - The status.
   * @returns {string} The word.
   */
  private statusWord(status: StatusKey): string {
    return statusLabel(status, this.statusOptions(), false);
  }

  /**
   * Method assignVerb
   *
   * @description
   * An assignment change in words: the actor took or left the task, or assigned or removed
   * someone.
   *
   * @param {ListActivityActor} actor - Who changed it.
   * @param {string} userId - Who was assigned or removed.
   * @param {boolean} added - Whether they were assigned.
   * @returns {string} The verb.
   */
  private assignVerb(actor: ListActivityActor, userId: string, added: boolean): string {
    const self: boolean = actor.type === 'user' && actor.id === userId;
    const name: string = this.personName(userId);
    if (added) {
      return self
        ? $localize`:@@spaces.activity.assigned-self:assigned themselves the task`
        : $localize`:@@spaces.activity.assigned:assigned ${name}:name:`;
    }
    return self
      ? $localize`:@@spaces.activity.unassigned-self:left the task`
      : $localize`:@@spaces.activity.unassigned:removed ${name}:name:`;
  }

  /**
   * Method dueVerb
   *
   * @description
   * A due date change in words: moved, set or removed.
   *
   * @param {string | null} from - The due date before.
   * @param {string | null} to - The due date after.
   * @returns {string} The verb.
   */
  private dueVerb(from: string | null, to: string | null): string {
    if (to === null) return $localize`:@@spaces.activity.due-removed:removed the due date`;
    return from === null
      ? $localize`:@@spaces.activity.due-set:set the due date`
      : $localize`:@@spaces.activity.due-moved:moved the due date`;
  }

  /**
   * Method dueText
   *
   * @description
   * The dates of a due date change: both when it moved, the new one when set, the old one when
   * removed.
   *
   * @param {{ readonly from: string | null; readonly to: string | null }} change - The dates.
   * @returns {string | null} The text, null without a date.
   */
  private dueText(change: {
    readonly from: string | null;
    readonly to: string | null;
  }): string | null {
    const day: (date: string) => string = (date: string): string =>
      formatDate(date, 'd MMM', this.locale);
    if (change.from && change.to) return `${day(change.from)} → ${day(change.to)}`;
    if (change.to) return day(change.to);
    return change.from ? day(change.from) : null;
  }

  /**
   * Method kindLabel
   *
   * @description
   * The word of a type chip (`ACT_KINDS` of `App.dc.html`).
   *
   * @param {ListActivityKind} kind - The kind.
   * @returns {string} The word.
   */
  private kindLabel(kind: ListActivityKind): string {
    switch (kind) {
      case 'status':
        return $localize`:@@spaces.activity.kind-status:Statuses`;
      case 'assign':
        return $localize`:@@spaces.activity.kind-assign:Assignments`;
      case 'create':
        return $localize`:@@spaces.activity.kind-create:Creations`;
      case 'comment':
        return $localize`:@@spaces.activity.kind-comment:Comments`;
      case 'priority':
        return $localize`:@@spaces.activity.kind-priority:Priorities`;
      case 'due':
        return $localize`:@@spaces.activity.kind-due:Due dates`;
    }
  }

  /**
   * Method kindIcon
   *
   * @description
   * The icon of a type chip (`ACT_KINDS` of `App.dc.html`).
   *
   * @param {ListActivityKind} kind - The kind.
   * @returns {string} The icon name.
   */
  private kindIcon(kind: ListActivityKind): string {
    switch (kind) {
      case 'status':
        return 'phosphorArrowsLeftRightBold';
      case 'assign':
        return 'phosphorUserPlusBold';
      case 'create':
        return 'phosphorPlusCircleBold';
      case 'comment':
        return 'phosphorChatCircleBold';
      case 'priority':
        return 'phosphorCellSignalHighBold';
      case 'due':
        return 'phosphorCalendarBlankBold';
    }
  }
  // #endregion
}
