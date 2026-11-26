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
  signal,
  type WritableSignal,
} from '@angular/core';
import { CwAvatar } from '@cadenway/ui/components/avatar';
import { CwButton } from '@cadenway/ui/components/button';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { NgIcon } from '@ng-icons/core';

import type { Person } from '../../../models/person/person.interface';
import type {
  TaskApprovalDecisionKey,
  TaskApprovalReview,
  TaskApprovalRound,
} from '../../../models/task-detail-sections/task-detail-sections.interface';
import type { TaskApprovalAction } from '../../../state/task-approval-card/task-approval-card.store';
import { relativeInstant } from '../../../utils/task-detail-sections/task-detail-sections.util';

/**
 * Interface ApprovalRow
 *
 * @description
 * One reviewer as the card lists them.
 */
interface ApprovalRow {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Account of the reviewer.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Their name, `(me)` added for the caller.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property person
   *
   * @description
   * Their name for the avatar, or null when unknown.
   *
   * @type {string | null}
   * @readonly
   */
  readonly person: string | null;

  /**
   * Property decision
   *
   * @description
   * Their vote.
   *
   * @type {TaskApprovalDecisionKey}
   * @readonly
   */
  readonly decision: TaskApprovalDecisionKey;
  // #endregion
}

/**
 * Component TaskApprovalCard
 *
 * @description
 * The approval card at the top of `Details` (`App.dc.html` lines 2122-2134, 5065-5106), shown
 * while the task has a round with reviewers: the title (`Approval requested`, `Changes
 * requested`, `Approved by all`) and its line, `<ok> of <n>`, the segment bar (`role="img"`
 * named with the counts), one row per reviewer with their state, then, for a reviewer who has
 * not voted, `Approve` and `Request changes`; the latter opens `What needs to change` with
 * `Send the request` (disabled while blank) and `Cancel`. After voting it says what the caller
 * did, with `Withdraw my review`. A failed read shows its inline error with `Retry`. Read-only
 * without edit rights (only editors may vote). It only emits: the tabs act.
 */
@Component({
  selector: 'cw-task-approval-card',
  imports: [CwAvatar, CwButton, CwTextarea, NgIcon],
  templateUrl: './task-approval-card.component.html',
})
export class TaskApprovalCard {
  // #region Properties
  /**
   * Property round
   *
   * @description
   * The current round, or null (no card).
   *
   * @type {InputSignal<TaskApprovalRound | null>}
   * @readonly
   */
  public readonly round: InputSignal<TaskApprovalRound | null> =
    input.required<TaskApprovalRound | null>();

  /**
   * Property failed
   *
   * @description
   * Whether the approval could not be read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input<boolean>(false);

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
   * Property meId
   *
   * @description
   * The caller's account.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly meId: InputSignal<string> = input.required<string>();

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may vote.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canEdit: InputSignal<boolean> = input<boolean>(true);

  /**
   * Property pending
   *
   * @description
   * The vote being sent, or null.
   *
   * @type {InputSignal<TaskApprovalAction | null>}
   * @readonly
   */
  public readonly pending: InputSignal<TaskApprovalAction | null> =
    input<TaskApprovalAction | null>(null);

  /**
   * Property approved
   *
   * @description
   * Emits when the caller approves.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly approved: OutputEmitterRef<void> = output();

  /**
   * Property changesRequested
   *
   * @description
   * Emits the reason when the caller sends a change request.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly changesRequested: OutputEmitterRef<string> = output<string>();

  /**
   * Property withdrawn
   *
   * @description
   * Emits when the caller withdraws their vote.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly withdrawn: OutputEmitterRef<void> = output();

  /**
   * Property retried
   *
   * @description
   * Emits when `Retry` is pressed after a failed read.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property asking
   *
   * @description
   * Whether the change request form is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly asking: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property reason
   *
   * @description
   * The typed change request.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly reason: WritableSignal<string> = signal<string>('');

  /**
   * Property rows
   *
   * @description
   * The reviewers in request order.
   *
   * @type {Signal<readonly ApprovalRow[]>}
   * @readonly
   */
  protected readonly rows: Signal<readonly ApprovalRow[]> = computed((): readonly ApprovalRow[] =>
    (this.round()?.reviews ?? []).map((review: TaskApprovalReview): ApprovalRow => {
      const person: Person | undefined = this.people().get(review.userId);
      const name: string = person?.name ?? review.userId;
      return {
        id: review.userId,
        person: person?.name ?? null,
        decision: review.decision,
        name:
          review.userId === this.meId() ? $localize`:@@task.approval.me:${name}:name: (me)` : name,
      };
    }),
  );

  /**
   * Property approvedCount
   *
   * @description
   * Reviewers who approved.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly approvedCount: Signal<number> = computed(
    (): number => this.rows().filter((row: ApprovalRow) => row.decision === 'approved').length,
  );

  /**
   * Property changesCount
   *
   * @description
   * Reviewers who asked for changes.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly changesCount: Signal<number> = computed(
    (): number =>
      this.rows().filter((row: ApprovalRow) => row.decision === 'changes-requested').length,
  );

  /**
   * Property mine
   *
   * @description
   * The caller's vote, undefined when they are not a reviewer.
   *
   * @type {Signal<TaskApprovalDecisionKey | undefined>}
   * @readonly
   */
  protected readonly mine: Signal<TaskApprovalDecisionKey | undefined> = computed(
    (): TaskApprovalDecisionKey | undefined =>
      this.round()?.reviews.find((review: TaskApprovalReview) => review.userId === this.meId())
        ?.decision,
  );

  /**
   * Property title
   *
   * @description
   * The card's title for the round's outcome.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string => {
    switch (this.round()?.status) {
      case 'approved':
        return $localize`:@@task.approval.title-approved:Approved by all`;
      case 'changes-requested':
        return $localize`:@@task.approval.title-changes:Changes requested`;
      default:
        return $localize`:@@task.approval.title-pending:Approval requested`;
    }
  });

  /**
   * Property subtitle
   *
   * @description
   * The line under the title: who asked and when with the count, who waits for a new version,
   * or that the task can ship.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly subtitle: Signal<string> = computed((): string => {
    const round: TaskApprovalRound | null = this.round();
    if (!round) return '';
    if (round.status === 'approved') {
      return $localize`:@@task.approval.sub-approved:The task can be delivered.`;
    }
    if (round.status === 'changes-requested') {
      const asker: ApprovalRow | undefined = this.rows().find(
        (row: ApprovalRow) => row.decision === 'changes-requested',
      );
      const name: string = asker?.person ?? asker?.id ?? '';
      return $localize`:@@task.approval.sub-changes:${name}:name: is waiting for a new version.`;
    }
    const requester: string = this.people().get(round.requesterId)?.name ?? round.requesterId;
    const when: string = relativeInstant(round.requestedAt, new Date(), this.locale);
    const ok: number = this.approvedCount();
    const total: number = this.rows().length;
    return ok > 1
      ? $localize`:@@task.approval.sub-pending-many:By ${requester}:name:, ${when}:when: · ${ok}:ok: approvals of ${total}:total:`
      : $localize`:@@task.approval.sub-pending-one:By ${requester}:name:, ${when}:when: · ${ok}:ok: approval of ${total}:total:`;
  });

  /**
   * Property barLabel
   *
   * @description
   * Accessible name of the segment bar.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly barLabel: Signal<string> = computed((): string => {
    const ok: number = this.approvedCount();
    const total: number = this.rows().length;
    const changes: number = this.changesCount();
    const approvals: string =
      ok > 1
        ? $localize`:@@task.approval.bar-many:${ok}:ok: approvals of ${total}:total:`
        : $localize`:@@task.approval.bar-one:${ok}:ok: approval of ${total}:total:`;
    if (changes === 0) return approvals;
    const requests: string =
      changes > 1
        ? $localize`:@@task.approval.bar-requests-many:${changes}:changes: change requests`
        : $localize`:@@task.approval.bar-requests-one:${changes}:changes: change request`;
    return $localize`:@@task.approval.bar-changes:${approvals}:approvals:, ${requests}:requests:`;
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
   * Method stateLabel
   *
   * @description
   * The word of a reviewer's state.
   *
   * @param {TaskApprovalDecisionKey} decision - Their vote.
   * @returns {string} The word.
   */
  protected stateLabel(decision: TaskApprovalDecisionKey): string {
    if (decision === 'approved') return $localize`:@@task.approval.state-approved:Approved`;
    if (decision === 'changes-requested') {
      return $localize`:@@task.approval.state-changes:Changes requested`;
    }
    return $localize`:@@task.approval.state-waiting:Waiting`;
  }

  /**
   * Method ask
   *
   * @description
   * Opens the change request form.
   */
  protected ask(): void {
    this.reason.set('');
    this.asking.set(true);
  }

  /**
   * Method send
   *
   * @description
   * Emits the change request when it is not blank and closes the form.
   */
  protected send(): void {
    const reason: string = this.reason().trim();
    if (reason === '') return;
    this.changesRequested.emit(reason);
    this.asking.set(false);
  }

  /**
   * Method typed
   *
   * @description
   * Keeps the typed reason.
   *
   * @param {Event} event - The input event of the field.
   */
  protected typed(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }
  // #endregion
}
