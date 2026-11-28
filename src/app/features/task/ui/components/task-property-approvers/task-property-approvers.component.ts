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
import {
  CwMenu,
  CwMenuItem,
  CwMenuItemCheckbox,
  CwMenuLabel,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { NgIcon } from '@ng-icons/core';

import type { Person } from '../../../models/person/person.interface';
import type {
  TaskApproval,
  TaskApprovalDecision,
  TaskApprover,
} from '../../../models/task-property/task-property.interface';
import { peopleOf } from '../task-property-assignees/task-property-assignees.component';

/**
 * Interface ApproverChip
 *
 * @description
 * A reviewer as the trigger draws them.
 */
interface ApproverChip {
  // #region Properties
  /**
   * Property person
   *
   * @description
   * The reviewer.
   *
   * @type {Person}
   * @readonly
   */
  readonly person: Person;

  /**
   * Property title
   *
   * @description
   * `{name} · {state}`.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property icon
   *
   * @description
   * Icon of the state.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property decision
   *
   * @description
   * The vote, null while waiting.
   *
   * @type {TaskApprovalDecision}
   * @readonly
   */
  readonly decision: TaskApprovalDecision;
  // #endregion
}

/**
 * Constant DECISION_ICONS
 *
 * @description
 * Icons of the votes (`App.dc.html` line 5049).
 *
 * @type {Readonly<Record<'approved' | 'changes-requested' | 'waiting', string>>}
 */
const DECISION_ICONS: Readonly<Record<'approved' | 'changes-requested' | 'waiting', string>> = {
  approved: 'phosphorCheckBold',
  'changes-requested': 'phosphorArrowCounterClockwiseBold',
  waiting: 'phosphorClockBold',
};

/**
 * Component TaskPropertyApprovers
 *
 * @description
 * The `Approval` row of the task detail's properties (`App.dc.html` lines 2553-2565): the
 * trigger shows each reviewer's initials with the state of their vote (titled
 * `{name} · Approved`, `Changes requested` or `Waiting`) and `{ok} of {n}`, or
 * `Add approvers`; it opens the `Approvers` menu, `Must approve before delivery`, with the people
 * and a checkbox each. Each tick emits `toggled`. The gateway replaces the round on each change,
 * so every vote is cleared; a round keeps one reviewer at least, so the last one cannot be
 * unticked. A failed read shows the error with `Retry` (`retried`).
 */
@Component({
  selector: 'cw-task-property-approvers',
  imports: [CwMenu, CwMenuItem, CwMenuItemCheckbox, CwMenuLabel, CwMenuTriggerFor, NgIcon],
  template: `
    <button
      type="button"
      class="relative isolate flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
      [disabled]="disabled() || (approval() === null && !failed())"
      [cwMenuTriggerFor]="menu"
      data-testid="task-property-approvers"
    >
      @if (chips().length > 0) {
        <span class="flex min-w-0 flex-wrap items-center gap-1">
          @for (chip of chips(); track chip.person.id) {
            <span
              class="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-background pr-1.5 pl-0.5"
              [title]="chip.title"
            >
              <span
                class="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] leading-none font-semibold text-secondary-foreground"
                aria-hidden="true"
                >{{ chip.person.initials }}</span
              >
              <ng-icon
                [name]="chip.icon"
                size="0.875rem"
                [class.text-jade]="chip.decision === 'approved'"
                [class.text-balise]="chip.decision === 'changes-requested'"
                [class.text-muted-foreground]="chip.decision === null"
                aria-hidden="true"
              />
              <span class="sr-only">{{ chip.title }}</span>
            </span>
          }
          <span class="ml-0.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{{
            summary()
          }}</span>
        </span>
      } @else if (failed()) {
        <span class="text-muted-foreground" i18n="@@task.create.read-failed"
          >Could not load this information.</span
        >
      } @else {
        <span class="text-muted-foreground" i18n="@@task.properties.approvers-add"
          >Add approvers</span
        >
      }
    </button>
    <cw-menu
      #menu
      side="top"
      align="end"
      minWidth="60"
      ariaLabel="Approvers"
      i18n-ariaLabel="@@task.properties.approvers"
    >
      <cw-menu-label i18n="@@task.properties.approvers-hint"
        >Must approve before delivery</cw-menu-label
      >
      @if (failed()) {
        <button cwMenuItem type="button" (triggered)="retried.emit()">
          <ng-container i18n="@@task.retry">Retry</ng-container>
        </button>
      } @else {
        @for (person of people() ?? []; track person.id) {
          <button
            cwMenuItemCheckbox
            type="button"
            [checked]="reviewerIds().includes(person.id)"
            [disabled]="reviewerIds().length === 1 && reviewerIds()[0] === person.id"
            (checkedChange)="toggled.emit(person.id)"
          >
            <span
              class="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] leading-none font-semibold text-secondary-foreground"
              aria-hidden="true"
              >{{ person.initials }}</span
            >
            @if (person.id === currentUserId()) {
              <span i18n="@@task.people-picker.me">{{ person.name }} (me)</span>
            } @else {
              <span>{{ person.name }}</span>
            }
          </button>
        }
      }
    </cw-menu>
  `,
})
export class TaskPropertyApprovers {
  // #region Properties
  /**
   * Property approval
   *
   * @description
   * The current round, null while read.
   *
   * @type {InputSignal<TaskApproval | null>}
   * @readonly
   */
  public readonly approval: InputSignal<TaskApproval | null> = input<TaskApproval | null>(null);

  /**
   * Property people
   *
   * @description
   * Members the menu offers.
   *
   * @type {InputSignal<readonly Person[] | null>}
   * @readonly
   */
  public readonly people: InputSignal<readonly Person[] | null> = input<readonly Person[] | null>(
    null,
  );

  /**
   * Property currentUserId
   *
   * @description
   * The caller's account, marked `(me)`.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly currentUserId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property failed
   *
   * @description
   * Whether reading the approval failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input(false);

  /**
   * Property disabled
   *
   * @description
   * Read-only: the trigger opens nothing.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property toggled
   *
   * @description
   * A reviewer ticked or unticked: their account.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly toggled: OutputEmitterRef<string> = output<string>();

  /**
   * Property retried
   *
   * @description
   * `Retry` after a failed read.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property reviewerIds
   *
   * @description
   * Accounts of the reviewers.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  protected readonly reviewerIds: Signal<readonly string[]> = computed((): readonly string[] =>
    (this.approval()?.reviewers ?? []).map((reviewer: TaskApprover) => reviewer.userId),
  );

  /**
   * Property chips
   *
   * @description
   * The reviewers as the trigger draws them.
   *
   * @type {Signal<readonly ApproverChip[]>}
   * @readonly
   */
  protected readonly chips: Signal<readonly ApproverChip[]> = computed(
    (): readonly ApproverChip[] => {
      const reviewers: readonly TaskApprover[] = this.approval()?.reviewers ?? [];
      const people: readonly Person[] = peopleOf(this.reviewerIds(), this.people());
      return reviewers.map((reviewer: TaskApprover, index: number): ApproverChip => {
        const state: string =
          reviewer.decision === 'approved'
            ? $localize`:@@task.properties.approval-approved:Approved`
            : reviewer.decision === 'changes-requested'
              ? $localize`:@@task.properties.approval-changes:Changes requested`
              : $localize`:@@task.properties.approval-waiting:Waiting`;
        return {
          person: people[index],
          title: `${people[index].name} · ${state}`,
          icon: DECISION_ICONS[reviewer.decision ?? 'waiting'],
          decision: reviewer.decision,
        };
      });
    },
  );

  /**
   * Property summary
   *
   * @description
   * `{ok} of {n}`: approvals against reviewers.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly summary: Signal<string> = computed((): string => {
    const reviewers: readonly TaskApprover[] = this.approval()?.reviewers ?? [];
    const approved: number = reviewers.filter(
      (reviewer: TaskApprover): boolean => reviewer.decision === 'approved',
    ).length;
    return $localize`:@@task.properties.approval-summary:${approved}:approved: of ${reviewers.length}:total:`;
  });
  // #endregion
}
