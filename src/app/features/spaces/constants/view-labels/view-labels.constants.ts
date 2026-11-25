import type {
  FilterField,
  ListGroupBy,
  ListSortField,
  PriorityKey,
  StatusKey,
  SubtaskMode,
} from '../../models/list-view-config/list-view-config.interface';
import type { LookIcon } from '../../models/look/look.type';
import type { ViewLayout } from '../../models/saved-view/saved-view.interface';

/**
 * Function statusLabels
 *
 * @description
 * The default word of each status (`StatutTache.dc.html`), given to `provideCwStatusLabels` and to
 * the filters when the space keeps the default label.
 *
 * @returns {Readonly<Record<StatusKey, string>>} The labels.
 */
export function statusLabels(): Readonly<Record<StatusKey, string>> {
  return {
    triage: $localize`:@@spaces.status.triage:To triage`,
    backlog: $localize`:@@spaces.status.backlog:To plan`,
    todo: $localize`:@@spaces.status.todo:To do`,
    progress: $localize`:@@spaces.status.progress:In progress`,
    review: $localize`:@@spaces.status.review:In review`,
    testing: $localize`:@@spaces.status.testing:In testing`,
    waiting: $localize`:@@spaces.status.waiting:Waiting`,
    blocked: $localize`:@@spaces.status.blocked:Blocked`,
    done: $localize`:@@spaces.status.done:Done`,
    cancelled: $localize`:@@spaces.status.cancelled:Cancelled`,
  };
}

/**
 * Function priorityLabels
 *
 * @description
 * The word of each priority (`PrioriteTache.dc.html`).
 *
 * @returns {Readonly<Record<PriorityKey, string>>} The labels.
 */
export function priorityLabels(): Readonly<Record<PriorityKey, string>> {
  return {
    urgente: $localize`:@@spaces.priority.urgente:Urgent`,
    haute: $localize`:@@spaces.priority.haute:High`,
    moyenne: $localize`:@@spaces.priority.moyenne:Medium`,
    basse: $localize`:@@spaces.priority.basse:Low`,
  };
}

/**
 * Function sortLabels
 *
 * @description
 * The criteria of « Trier par » (`SORTS`).
 *
 * @returns {Readonly<Record<ListSortField, string>>} The labels.
 */
export function sortLabels(): Readonly<Record<ListSortField, string>> {
  return {
    manual: $localize`:@@spaces.sort.manual:Manual order`,
    dueDate: $localize`:@@spaces.sort.due:Due date`,
    priority: $localize`:@@spaces.sort.priority:Priority`,
    name: $localize`:@@spaces.sort.name:Name`,
    createdAt: $localize`:@@spaces.sort.created:Creation date`,
  };
}

/**
 * Function groupLabels
 *
 * @description
 * The choices of « Grouper par » (`GROUPS`), « Aucun » keyed `none`.
 *
 * @returns {Readonly<Record<Exclude<ListGroupBy, null> | 'none', string>>} The labels.
 */
export function groupLabels(): Readonly<Record<Exclude<ListGroupBy, null> | 'none', string>> {
  return {
    status: $localize`:@@spaces.group.status:Status`,
    priority: $localize`:@@spaces.group.priority:Priority`,
    assignee: $localize`:@@spaces.group.assignee:Assignee`,
    none: $localize`:@@spaces.group.none:None`,
  };
}

/**
 * Function filterFieldLabels
 *
 * @description
 * The fields of the « Filtrer » dialog and of the chips (`FIELD_DEFS`).
 *
 * @returns {Readonly<Record<FilterField, string>>} The labels.
 */
export function filterFieldLabels(): Readonly<Record<FilterField, string>> {
  return {
    status: $localize`:@@spaces.filter.status:Status`,
    priority: $localize`:@@spaces.filter.priority:Priority`,
    assignee: $localize`:@@spaces.filter.assignee:Assignee`,
    label: $localize`:@@spaces.filter.label:Label`,
  };
}

/**
 * Function subtaskModeLabels
 *
 * @description
 * The subtask displays: the short form of the button and the menu's label and hint.
 *
 * @returns {Readonly<Record<SubtaskMode, { short: string; label: string; hint: string; icon: string }>>} The labels.
 */
export function subtaskModeLabels(): Readonly<
  Record<SubtaskMode, { short: string; label: string; hint: string; icon: string }>
> {
  return {
    nested: {
      short: $localize`:@@spaces.subtasks.nested-short:folded`,
      label: $localize`:@@spaces.subtasks.nested:Folded under their parent`,
      hint: $localize`:@@spaces.subtasks.nested-hint:A chevron shows them on demand`,
      icon: 'phosphorCaretRightBold',
    },
    expanded: {
      short: $localize`:@@spaces.subtasks.expanded-short:unfolded`,
      label: $localize`:@@spaces.subtasks.expanded:Unfolded under their parent`,
      hint: $localize`:@@spaces.subtasks.expanded-hint:Every level visible`,
      icon: 'phosphorCaretDownBold',
    },
    separate: {
      short: $localize`:@@spaces.subtasks.separate-short:apart`,
      label: $localize`:@@spaces.subtasks.separate:Apart, as tasks`,
      hint: $localize`:@@spaces.subtasks.separate-hint:Also in Board, Calendar and Gantt`,
      icon: 'phosphorRowsBold',
    },
  };
}

/**
 * Function layoutLabels
 *
 * @description
 * The names of the view layouts (`VIEW_DEFS`).
 *
 * @returns {Readonly<Record<ViewLayout, string>>} The labels.
 */
export function layoutLabels(): Readonly<Record<ViewLayout, string>> {
  return {
    list: $localize`:@@spaces.layout.list:List`,
    board: $localize`:@@spaces.layout.board:Board`,
    calendar: $localize`:@@spaces.layout.calendar:Calendar`,
    gantt: $localize`:@@spaces.layout.gantt:Gantt`,
    workload: $localize`:@@spaces.layout.workload:Workload`,
    table: $localize`:@@spaces.layout.table:Sheet`,
    form: $localize`:@@spaces.layout.form:Form`,
    activity: $localize`:@@spaces.layout.activity:Activity`,
    timesheet: $localize`:@@spaces.layout.timesheet:Timesheet`,
  };
}

/**
 * Function lookIconLabels
 *
 * @description
 * The names of the look icons (`LOOK_ICONS`), for the icon choices of the dialogs.
 *
 * @returns {Readonly<Record<Exclude<LookIcon, null>, string>>} The labels.
 */
export function lookIconLabels(): Readonly<Record<Exclude<LookIcon, null>, string>> {
  return {
    rocket: $localize`:@@spaces.icon.rocket:Rocket`,
    paint: $localize`:@@spaces.icon.paint:Brush`,
    megaphone: $localize`:@@spaces.icon.megaphone:Megaphone`,
    gear: $localize`:@@spaces.icon.gear:Gear`,
    code: $localize`:@@spaces.icon.code:Code`,
    bug: $localize`:@@spaces.icon.bug:Bug`,
    lightning: $localize`:@@spaces.icon.lightning:Lightning`,
    target: $localize`:@@spaces.icon.target:Target`,
    flag: $localize`:@@spaces.icon.flag:Flag`,
    briefcase: $localize`:@@spaces.icon.briefcase:Briefcase`,
    chart: $localize`:@@spaces.icon.chart:Chart`,
    users: $localize`:@@spaces.icon.users:Team`,
    book: $localize`:@@spaces.icon.book:Book`,
    cube: $localize`:@@spaces.icon.cube:Cube`,
    headset: $localize`:@@spaces.icon.headset:Headset`,
    globe: $localize`:@@spaces.icon.globe:Globe`,
    star: $localize`:@@spaces.icon.star:Star`,
  };
}
