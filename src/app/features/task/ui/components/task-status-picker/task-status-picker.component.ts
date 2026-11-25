import {
  booleanAttribute,
  Component,
  computed,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { STATUS_CATEGORIES, type StatusCategory, type StatusKey } from '@cadenway/contracts';
import { CwMenu, CwMenuGroup, CwMenuItem, CwMenuLabel } from '@cadenway/ui/components/menu';
import { CwSplitButton } from '@cadenway/ui/components/split-button';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';

import {
  MILESTONE_STATUS_HINTS,
  STATUS_CATEGORY_LABELS,
  STATUS_HINTS,
} from '../../../constants/task-copy/task-copy.constants';
import type { StatusOption } from '../../../models/status-option/status-option.interface';
import {
  isMilestoneStatus,
  nextStatus,
  pickableStatuses,
  statusLabel,
} from '../../../utils/task-status/task-status.util';

/**
 * Interface StatusMenuEntry
 *
 * @description
 * One option of the status menu, with its hint.
 */
interface StatusMenuEntry {
  // #region Properties
  /**
   * Property option
   *
   * @description
   * The status.
   *
   * @type {StatusOption}
   * @readonly
   */
  readonly option: StatusOption;

  /**
   * Property hint
   *
   * @description
   * One-line meaning of the status.
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;
  // #endregion
}

/**
 * Interface StatusMenuGroup
 *
 * @description
 * The options of one category, under its heading; a milestone's menu has one group without a
 * heading.
 */
interface StatusMenuGroup {
  // #region Properties
  /**
   * Property category
   *
   * @description
   * Category of the options, or null for a milestone's single group.
   *
   * @type {StatusCategory | null}
   * @readonly
   */
  readonly category: StatusCategory | null;

  /**
   * Property heading
   *
   * @description
   * Heading of the group, empty for a milestone.
   *
   * @type {string}
   * @readonly
   */
  readonly heading: string;

  /**
   * Property entries
   *
   * @description
   * Options of the group, in workflow order.
   *
   * @type {readonly StatusMenuEntry[]}
   * @readonly
   */
  readonly entries: readonly StatusMenuEntry[];
  // #endregion
}

/**
 * Component TaskStatusPicker
 *
 * @description
 * The status split button of the task detail and the create dialog (`App.dc.html` near line
 * 2905): the left part shows the status icon and word and moves the task to its next status
 * (`NEXT_STATUS`, « Atteint » for a milestone); without a next status it opens the menu. The
 * caret opens the menu of the space's visible statuses, grouped under « Non commencé », « Actif »
 * and « Fermé », each with its hint; the current status is marked even when the space hides it. A
 * milestone offers its four statuses only. It emits `statusChanged` with the chosen key and never
 * changes the shown status itself: the owner passes the displayed status back.
 */
@Component({
  selector: 'cw-task-status-picker',
  imports: [CwMenu, CwMenuGroup, CwMenuItem, CwMenuLabel, CwSplitButton, CwStatusIcon],
  templateUrl: './task-status-picker.component.html',
})
export class TaskStatusPicker {
  // #region Properties
  /**
   * Property failed
   *
   * @description
   * Whether the status options could not be loaded.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input(false);

  /**
   * Property retry
   *
   * @description
   * Requests another status options read.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retry: OutputEmitterRef<void> = output();

  /**
   * Property status
   *
   * @description
   * Status shown now (the displayed status, pending clicks included).
   *
   * @type {InputSignal<StatusKey>}
   * @readonly
   */
  public readonly status: InputSignal<StatusKey> = input.required<StatusKey>();

  /**
   * Property options
   *
   * @description
   * Statuses of the task's space; the default ten when empty.
   *
   * @type {InputSignal<readonly StatusOption[]>}
   * @readonly
   */
  public readonly options: InputSignal<readonly StatusOption[]> = input<readonly StatusOption[]>(
    [],
  );

  /**
   * Property milestone
   *
   * @description
   * Whether the task is a milestone: a diamond icon and four statuses.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly milestone: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property from
   *
   * @description
   * Previous status, which the icon animates from.
   *
   * @type {InputSignal<StatusKey | null>}
   * @readonly
   */
  public readonly from: InputSignal<StatusKey | null> = input<StatusKey | null>(null);

  /**
   * Property disabled
   *
   * @description
   * Whether the status cannot be changed.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property statusChanged
   *
   * @description
   * Emits the status the person chose, from either part of the button.
   *
   * @type {OutputEmitterRef<StatusKey>}
   * @readonly
   */
  public readonly statusChanged: OutputEmitterRef<StatusKey> = output<StatusKey>();

  /**
   * Property label
   *
   * @description
   * Word of the shown status.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly label: Signal<string> = computed((): string =>
    statusLabel(this.status(), this.options(), this.milestone()),
  );

  /**
   * Property next
   *
   * @description
   * Status the main part moves to, or null when it opens the menu.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly next: Signal<StatusKey | null> = computed((): StatusKey | null =>
    nextStatus(this.status(), this.milestone()),
  );

  /**
   * Property ariaLabel
   *
   * @description
   * Accessible name of the main part (« Statut : À faire. Passer à « En cours » »).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly ariaLabel: Signal<string> = computed((): string => {
    const next: StatusKey | null = this.next();
    if (this.milestone()) {
      return next
        ? $localize`:@@task.status-picker.milestone-reach:Mark the milestone as reached`
        : $localize`:@@task.status-picker.milestone-change:Change the milestone status`;
    }
    return next
      ? $localize`:@@task.status-picker.advance-label:Status: ${this.label()}:status:. Move to “${statusLabel(next, this.options(), this.milestone())}:next:”`
      : $localize`:@@task.status-picker.status-label:Status: ${this.label()}:status:`;
  });

  /**
   * Property tooltip
   *
   * @description
   * Tooltip of the main part (« Passer à « En cours » » or « Choisir un statut »).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly tooltip: Signal<string> = computed((): string => {
    const next: StatusKey | null = this.next();
    return next
      ? $localize`:@@task.status-picker.advance-title:Move to “${statusLabel(next, this.options(), this.milestone())}:next:”`
      : $localize`:@@task.status-picker.choose:Choose a status`;
  });

  /**
   * Property groups
   *
   * @description
   * The menu, grouped by category; one group for a milestone.
   *
   * @type {Signal<readonly StatusMenuGroup[]>}
   * @readonly
   */
  protected readonly groups: Signal<readonly StatusMenuGroup[]> = computed(
    (): readonly StatusMenuGroup[] => {
      const milestone: boolean = this.milestone();
      const entries: readonly StatusMenuEntry[] = pickableStatuses(
        this.options(),
        this.status(),
        milestone,
      ).map((option: StatusOption): StatusMenuEntry => ({
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
        entries: entries.filter((entry: StatusMenuEntry) => entry.option.category === category),
      })).filter((group: StatusMenuGroup) => group.entries.length > 0);
    },
  );
  // #endregion

  // #region Methods
  /**
   * Method advance
   *
   * @description
   * The main part: emits the next status when there is one; the split button opens the menu
   * otherwise.
   */
  protected advance(): void {
    if (this.failed()) return;
    const next: StatusKey | null = this.next();
    if (next) this.statusChanged.emit(next);
  }

  /**
   * Method choose
   *
   * @description
   * A menu option: emits it unless it is the shown status.
   *
   * @param {StatusKey} status - Chosen status.
   */
  protected choose(status: StatusKey): void {
    if (status !== this.status()) this.statusChanged.emit(status);
  }
  // #endregion
}
