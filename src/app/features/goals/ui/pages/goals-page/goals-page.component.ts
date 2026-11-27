import { formatDate } from '@angular/common';
import {
  Component,
  computed,
  type ElementRef,
  inject,
  linkedSignal,
  LOCALE_ID,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  CwAccordion,
  CwAccordionContent,
  CwAccordionItem,
  CwAccordionTrigger,
  type CwAccordionValue,
} from '@cadenway/ui/components/accordion';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
  provideCwAlertDialogLabels,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { provideCwSelectLabels } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { provideCwStatLabels } from '@cadenway/ui/components/stat';
import { NgIcon } from '@ng-icons/core';

import { TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type {
  GoalDraft,
  GoalView,
  KeyResultDraft,
  Quarter,
} from '../../../models/goal/goal.interface';
import { GoalMilestonesStore } from '../../../state/goal-milestones/goal-milestones.store';
import { GoalsStore } from '../../../state/goals/goals.store';
import { takesSingular } from '../../../utils/plural/plural.util';
import { todayIso, toLocalDate } from '../../../utils/quarter/quarter.util';
import { GoalProgress } from '../../components/goal-progress/goal-progress.component';
import { GoalStats } from '../../components/goal-stats/goal-stats.component';
import { KeyResultRow } from '../../components/key-result-row/key-result-row.component';
import { GoalForm } from '../../forms/goal-form/goal-form.component';
import { KeyResultForm } from '../../forms/key-result-form/key-result-form.component';

/**
 * Function quarterName
 *
 * @description
 * The name of a quarter (`Q4 2026`).
 *
 * @param {Quarter} quarter - The quarter.
 * @returns {string} Its name.
 */
function quarterName(quarter: Quarter): string {
  const year: number = quarter.year;
  switch (quarter.number) {
    case 1:
      return $localize`:@@goals.quarter.q1:Q1 ${year}:year:`;
    case 2:
      return $localize`:@@goals.quarter.q2:Q2 ${year}:year:`;
    case 3:
      return $localize`:@@goals.quarter.q3:Q3 ${year}:year:`;
    case 4:
      return $localize`:@@goals.quarter.q4:Q4 ${year}:year:`;
  }
}

/**
 * Component GoalsPage
 *
 * @description
 * The goals of the current quarter (`App.dc.html` lines 1571-1637), with the page-scoped
 * `GoalsStore` and `GoalMilestonesStore`. While the first read of the organization loads, the
 * page skeleton (`Loading the goals`) replaces it; a failed first read reaches the route's error
 * boundary (`Retry` runs the route again); a successful read without goals shows `No goals this
 * quarter`. The header shows the quarter and its elapsed share and, for whoever may create a goal
 * (gap G-G3), `New goal`, which opens the goal form above the goals. The goals are a `cw-accordion`
 * of several open items, the first open at first; each row keeps its health, progress and
 * `Delete` outside its trigger, and its key results inside its content, with `Add a key result`.
 * `Delete` asks for a confirmation (`cw-alert-dialog`), since a deletion cannot be undone (gap
 * G-G4), then moves the focus to the page title. A milestone opens its task detail, a
 * list-progress result its list. The forms and the confirmation belong to the organization they
 * were opened in: a switch closes them.
 */
@Component({
  selector: 'cw-goals-page',
  imports: [
    CwAccordion,
    CwAccordionContent,
    CwAccordionItem,
    CwAccordionTrigger,
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    GoalForm,
    GoalProgress,
    GoalStats,
    KeyResultForm,
    KeyResultRow,
    NgIcon,
  ],
  providers: [
    GoalsStore,
    GoalMilestonesStore,
    provideCwAlertDialogLabels(() => ({
      confirm: $localize`:@@goals.delete.confirm-label:To confirm, type`,
      more: (count: number): string => $localize`:@@goals.delete.more:+ ${count}:count: others`,
    })),
    provideCwSelectLabels(() => ({
      placeholder: $localize`:@@goals.form.space-placeholder:Choose a space`,
      emptyText: $localize`:@@goals.form.space-empty:No space`,
    })),
    provideCwStatLabels(() => ({
      up: $localize`:@@goals.stats.trend-up:up`,
      down: $localize`:@@goals.stats.trend-down:down`,
      flat: $localize`:@@goals.stats.trend-flat:steady`,
      refreshing: $localize`:@@goals.stats.refreshing:Refreshing`,
      goalOf: $localize`:@@goals.stats.goal-of:of`,
    })),
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  templateUrl: './goals-page.component.html',
})
export class GoalsPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The page's goals.
   *
   * @type {InstanceType<typeof GoalsStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof GoalsStore> = inject(GoalsStore);

  /**
   * Property milestones
   *
   * @description
   * The milestone tasks of the goals shown.
   *
   * @type {InstanceType<typeof GoalMilestonesStore>}
   * @readonly
   */
  protected readonly milestones: InstanceType<typeof GoalMilestonesStore> =
    inject(GoalMilestonesStore);

  /**
   * Property opener
   *
   * @description
   * Opens a milestone's task detail.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly opener: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property router
   *
   * @description
   * Opens a list-progress result's list.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property workspace
   *
   * @description
   * The organization shown, for the list addresses and the forms' binding.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property locale
   *
   * @description
   * Locale of the due dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property title
   *
   * @description
   * The page title, focused after a deletion.
   *
   * @type {Signal<ElementRef<HTMLHeadingElement> | undefined>}
   * @readonly
   */
  private readonly title: Signal<ElementRef<HTMLHeadingElement> | undefined> =
    viewChild<ElementRef<HTMLHeadingElement>>('title');

  /**
   * Property today
   *
   * @description
   * The caller's day when the page opened, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  protected readonly today: string = todayIso(new Date());

  /**
   * Property organizationId
   *
   * @description
   * The organization shown.
   *
   * @type {Signal<string>}
   * @readonly
   */
  private readonly organizationId: Signal<string> = computed(
    (): string => this.workspace.organization().id,
  );

  /**
   * Property formOpen
   *
   * @description
   * Whether the goal form is open; closed by an organization switch.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly formOpen: WritableSignal<boolean> = linkedSignal({
    source: this.organizationId,
    computation: (): boolean => false,
  });

  /**
   * Property resultFormFor
   *
   * @description
   * The goal whose key result form is open, or null; closed by an organization switch.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly resultFormFor: WritableSignal<string | null> = linkedSignal({
    source: this.organizationId,
    computation: (): string | null => null,
  });

  /**
   * Property deleteTarget
   *
   * @description
   * The goal whose deletion is being confirmed, or null; dropped by an organization switch.
   *
   * @type {WritableSignal<GoalView | null>}
   * @readonly
   */
  protected readonly deleteTarget: WritableSignal<GoalView | null> = linkedSignal({
    source: this.organizationId,
    computation: (): GoalView | null => null,
  });

  /**
   * Property deleteOpen
   *
   * @description
   * Whether the deletion confirmation is open; closed by an organization switch.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly deleteOpen: WritableSignal<boolean> = linkedSignal({
    source: this.organizationId,
    computation: (): boolean => false,
  });

  /**
   * Property firstGoal
   *
   * @description
   * The first goal of the organization's read, or null before it lands.
   *
   * @type {Signal<{ readonly organizationId: string; readonly goalId: string | null }>}
   * @readonly
   */
  private readonly firstGoal: Signal<{
    readonly organizationId: string;
    readonly goalId: string | null;
  }> = computed(() => ({
    organizationId: this.organizationId(),
    goalId: this.store.goals.hasValue() ? (this.store.list()?.[0]?.goal.id ?? null) : null,
  }));

  /**
   * Property openGoals
   *
   * @description
   * The goals open in the accordion: the first one once the organization's goals are read
   * (`App.dc.html` line 5128), then whatever the person opens, and each new goal.
   *
   * @type {WritableSignal<CwAccordionValue>}
   * @readonly
   */
  protected readonly openGoals: WritableSignal<CwAccordionValue> = linkedSignal<
    { readonly organizationId: string; readonly goalId: string | null },
    CwAccordionValue
  >({
    source: this.firstGoal,
    computation: (source, previous): CwAccordionValue => {
      if (
        previous?.source.organizationId === source.organizationId &&
        previous.source.goalId !== null
      )
        return previous.value;
      return source.goalId === null ? [] : [source.goalId];
    },
  });

  /**
   * Property quarterLabel
   *
   * @description
   * Name of the quarter shown.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly quarterLabel: Signal<string> = computed((): string => {
    const quarter: Quarter | null = this.store.quarter();
    return quarter === null ? '' : quarterName(quarter);
  });

  /**
   * Property subtitle
   *
   * @description
   * The line under the title (`App.dc.html` line 5167).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly subtitle: Signal<string> = computed(
    (): string =>
      $localize`:@@goals.header.subtitle:${this.quarterLabel()}:quarter: · ${this.store.stats().expectedPercent}:percent:% of the quarter elapsed`,
  );

  /**
   * Property deleting
   *
   * @description
   * Whether a deletion is on its way.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly deleting: Signal<boolean> = computed(
    (): boolean => this.store.deletingId() !== null,
  );

  /**
   * Property skeletonRows
   *
   * @description
   * The two groups of skeleton rows (`SK_PAGES.Goals`, `App.dc.html` line 4199), with their
   * literal width classes.
   *
   * @type {readonly (readonly string[])[]}
   * @readonly
   */
  protected readonly skeletonRows: readonly (readonly string[])[] = [
    ['w-48', 'w-64', 'w-40'],
    ['w-56', 'w-36'],
  ];

  /**
   * Property creatingNow
   *
   * @description
   * Guards the creation against a second submit while its promise settles.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly creatingNow: WritableSignal<boolean> = signal(false);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the milestone tasks of the goals shown.
   *
   * @constructor
   */
  public constructor() {
    this.milestones.follow(this.store.milestoneKeys);
  }
  // #endregion

  // #region Methods
  /**
   * Method openForm
   *
   * @description
   * Opens the goal form.
   */
  protected openForm(): void {
    this.formOpen.set(true);
  }

  /**
   * Method create
   *
   * @description
   * Creates the submitted goal; once known, the form closes and the new goal opens.
   *
   * @param {GoalDraft} draft - What the form submitted.
   * @returns {Promise<void>} Settles once handled.
   */
  protected async create(draft: GoalDraft): Promise<void> {
    if (this.creatingNow()) return;
    const organization: string = this.organizationId();
    this.creatingNow.set(true);
    try {
      const id: string | null = await this.store.create(draft);
      if (id === null || organization !== this.organizationId()) return;
      this.formOpen.set(false);
      const open: CwAccordionValue = this.openGoals();
      const values: readonly string[] = Array.isArray(open)
        ? open
        : typeof open === 'string'
          ? [open]
          : [];
      this.openGoals.set([...values.filter((value: string) => value !== id), id]);
    } finally {
      this.creatingNow.set(false);
    }
  }

  /**
   * Method addResult
   *
   * @description
   * Adds the submitted key result; once known, its form closes.
   *
   * @param {string} goalId - Id of the goal.
   * @param {KeyResultDraft} draft - What the form submitted.
   * @returns {Promise<void>} Settles once handled.
   */
  protected async addResult(goalId: string, draft: KeyResultDraft): Promise<void> {
    const organization: string = this.organizationId();
    const added: boolean = await this.store.addResult(goalId, draft);
    if (added && organization === this.organizationId() && this.resultFormFor() === goalId)
      this.resultFormFor.set(null);
  }

  /**
   * Method askDelete
   *
   * @description
   * Asks to confirm a goal's deletion.
   *
   * @param {GoalView} view - The goal.
   */
  protected askDelete(view: GoalView): void {
    this.deleteTarget.set(view);
    this.deleteOpen.set(true);
  }

  /**
   * Method confirmDelete
   *
   * @description
   * Deletes the goal being confirmed; the confirmation closes once it settles, and the focus moves
   * to the page title when the goal left the list.
   *
   * @returns {Promise<void>} Settles once handled.
   */
  protected async confirmDelete(): Promise<void> {
    const target: GoalView | null = this.deleteTarget();
    if (target === null) return;
    const organization: string = this.organizationId();
    const removed: boolean = await this.store.remove(target.goal.id);
    if (organization !== this.organizationId()) return;
    this.deleteOpen.set(false);
    if (removed) setTimeout((): void => this.title()?.nativeElement.focus());
  }

  /**
   * Method openMilestone
   *
   * @description
   * Opens a milestone's task detail.
   *
   * @param {string} taskKey - Key of the task.
   */
  protected openMilestone(taskKey: string): void {
    void this.opener.open(taskKey);
  }

  /**
   * Method openList
   *
   * @description
   * Opens a list-progress result's list.
   *
   * @param {string} listId - Id of the list.
   */
  protected openList(listId: string): void {
    void this.router.navigate(['/', this.workspace.organization().slug, 'l', listId]);
  }

  /**
   * Method dueText
   *
   * @description
   * The due date part of a goal's meta line (`App.dc.html` line 5132).
   *
   * @param {GoalView} view - The goal.
   * @returns {string} The text.
   */
  protected dueText(view: GoalView): string {
    const date: string = formatDate(toLocalDate(view.goal.dueDate), 'd MMM', this.locale);
    return $localize`:@@goals.goal.due:due ${date}:date:`;
  }

  /**
   * Method countText
   *
   * @description
   * The key result count of a goal's meta line, singular or plural by the locale's rules.
   *
   * @param {GoalView} view - The goal.
   * @returns {string} The text.
   */
  protected countText(view: GoalView): string {
    const count: number = view.goal.results.length;
    return takesSingular(count)
      ? $localize`:@@goals.goal.results-one:${count}:count: key result`
      : $localize`:@@goals.goal.results-other:${count}:count: key results`;
  }

  /**
   * Method deleteLabel
   *
   * @description
   * Accessible name of a goal's `Delete` button.
   *
   * @param {GoalView} view - The goal.
   * @returns {string} The name.
   */
  protected deleteLabel(view: GoalView): string {
    return $localize`:@@goals.goal.delete:Delete the goal ${view.goal.name}:name:`;
  }

  /**
   * Method deleteTitle
   *
   * @description
   * Title of the deletion confirmation.
   *
   * @param {GoalView} view - The goal.
   * @returns {string} The title.
   */
  protected deleteTitle(view: GoalView): string {
    return $localize`:@@goals.delete.title:Delete the goal “${view.goal.name}:name:”?`;
  }

  /**
   * Method percent
   *
   * @description
   * Rounded progress of a goal.
   *
   * @param {GoalView} view - The goal.
   * @returns {number} The percentage.
   */
  protected percent(view: GoalView): number {
    return Math.round(view.goal.progressPercent);
  }
  // #endregion
}
