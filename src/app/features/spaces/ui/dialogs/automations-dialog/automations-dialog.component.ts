import {
  afterRenderEffect,
  Component,
  computed,
  effect,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  model,
  type ModelSignal,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { type FieldTree, form, FormField, maxLength } from '@angular/forms/signals';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
} from '@cadenway/ui/components/dialog';
import { CwInput } from '@cadenway/ui/components/input';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwSwitch } from '@cadenway/ui/components/switch';
import { CwToastService } from '@cadenway/ui/components/toast';
import { CwToggleGroup, CwToggleGroupItem } from '@cadenway/ui/components/toggle-group';
import { NgIcon } from '@ng-icons/core';

import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import { priorityLabels, statusLabels } from '../../../constants/view-labels/view-labels.constants';
import type {
  AutomationAction,
  AutomationActionType,
  AutomationDraft,
  AutomationRule,
  AutomationRun,
  AutomationTrigger,
  AutomationWriteOutcome,
} from '../../../models/automation-rule/automation-rule.interface';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import type {
  PriorityKey,
  StatusKey,
} from '../../../models/list-view-config/list-view-config.interface';
import type { SpaceDetails } from '../../../models/space/space.interface';
import { AutomationsStore } from '../../../state/automations/automations.store';
import {
  describeAction,
  describeRun,
  describeTrigger,
  type MemberName,
  runMoment,
} from './automation-text.util';

/**
 * Interface AutomationRuleRow
 *
 * @description
 * A rule as its row shows it.
 */
interface AutomationRuleRow {
  // #region Properties
  /**
   * Property rule
   *
   * @description
   * The rule, as shown.
   *
   * @type {AutomationRule}
   * @readonly
   */
  readonly rule: AutomationRule;

  /**
   * Property when
   *
   * @description
   * `When a task is created`.
   *
   * @type {string}
   * @readonly
   */
  readonly when: string;

  /**
   * Property then
   *
   * @description
   * `assign to Camille Martin`.
   *
   * @type {string}
   * @readonly
   */
  readonly then: string;

  /**
   * Property icon
   *
   * @description
   * Icon of the rule's action.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property toggleLabel
   *
   * @description
   * Accessible name of the switch: `Disable: …` or `Enable: …`.
   *
   * @type {string}
   * @readonly
   */
  readonly toggleLabel: string;

  /**
   * Property removeLabel
   *
   * @description
   * Accessible name of the delete button: `Delete: …`.
   *
   * @type {string}
   * @readonly
   */
  readonly removeLabel: string;
  // #endregion
}

/**
 * Interface AutomationRunRow
 *
 * @description
 * A run as `Last runs` shows it.
 */
interface AutomationRunRow {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the execution.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property text
   *
   * @description
   * `CAD-482 assigned to Camille Martin`.
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property at
   *
   * @description
   * `just now`.
   *
   * @type {string}
   * @readonly
   */
  readonly at: string;
  // #endregion
}

/**
 * Interface CommentModel
 *
 * @description
 * The comment field of the builder.
 */
interface CommentModel {
  // #region Properties
  /**
   * Property body
   *
   * @description
   * Typed comment.
   *
   * @type {string}
   */
  body: string;
  // #endregion
}

/**
 * Constant ACTION_ICONS
 *
 * @description
 * Icon of each action (`AUTO_ACTIONS`, `App.dc.html` lines 3627-3632).
 *
 * @type {Readonly<Record<AutomationActionType, string>>}
 */
const ACTION_ICONS: Readonly<Record<AutomationActionType, string>> = {
  assign: 'phosphorUserPlusBold',
  priority: 'phosphorFlagBold',
  notify: 'phosphorBellSimpleBold',
  comment: 'phosphorChatCircleBold',
};

/**
 * Constant COMMENT_MAX_LENGTH
 *
 * @description
 * Longest comment the contract accepts, in characters.
 *
 * @type {number}
 */
const COMMENT_MAX_LENGTH: number = 5000;

/**
 * Component AutomationsDialog
 *
 * @description
 * `Automations` (`App.dc.html` lines 3246-3301, logic lines 8532-8585): the organization's "when…
 * then…" rules, which apply to every task of the workspace. Hosted by the list page (`[(open)]`,
 * set to false when the dialog closes, and `space`), which offers it to organization admins and
 * owners. It provides its own `AutomationsStore`, read again each time it opens.
 *
 * - The rules: `<when>` over `then <then>`, a switch (`Enable: …` / `Disable: …`, applied at once,
 *   restored with a toast when refused) and a delete button, confirmed by `cw-alert-dialog`
 *   (`Delete this automation?`) before the rule leaves at once. Loading shows skeleton rows; a
 *   failed read an inline error with Retry; no rule, `No automation yet.`
 * - `New automation` opens the builder: `When` (`Task created` / `Status becomes…` with the ten
 *   statuses), `Then` (`Assign to`, `Change the priority`, `Notify`, `Add a comment`) with the
 *   person, the priority or the comment's text, the preview `<when>, then <then>.`, `Cancel` and
 *   `Create the rule` (disabled while the comment is empty or over 5,000 characters, with its
 *   message, or while no person can be chosen). A created
 *   rule shows the `Automation created` toast and closes the builder; a refused one keeps it open
 *   with its values.
 * - `Last runs`: the eight most recent executions, shown only when there are some.
 *
 * Statuses use their default words: a rule is not tied to a space, so `space` (kept for the
 * host's contract) does not rename them.
 *
 * The mockup's `Git automations` section (lines 3274-3296, gap B6) is not rendered: no
 * operation exists for it and its scope (per space or per organization) is not decided. Its place
 * is between the builder and `Last runs`; it will read and write through new `AutomationsApi`
 * methods and its own store state once the contract exists.
 */
@Component({
  selector: 'cw-automations-dialog',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwButton,
    CwDialog,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    CwPriorityIcon,
    CwSkeleton,
    CwStatusIcon,
    CwSwitch,
    CwToggleGroup,
    CwToggleGroupItem,
    FormField,
    NgIcon,
  ],
  providers: [AutomationsStore],
  templateUrl: './automations-dialog.component.html',
})
export class AutomationsDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog shows; `[(open)]`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model(false);

  /**
   * Property space
   *
   * @description
   * The space of the list the dialog was opened from, or null while it is read. The rules belong
   * to the organization; the dialog does not use it yet.
   *
   * @type {InputSignal<SpaceDetails | null>}
   * @readonly
   */
  public readonly space: InputSignal<SpaceDetails | null> = input<SpaceDetails | null>(null);

  /**
   * Property store
   *
   * @description
   * The dialog's rules, runs and members.
   *
   * @type {InstanceType<typeof AutomationsStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof AutomationsStore> = inject(AutomationsStore);

  /**
   * Property toasts
   *
   * @description
   * The shell's toasts.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property locale
   *
   * @description
   * Locale of the runs' days.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property nameOf
   *
   * @description
   * The members' names by user id.
   *
   * @type {Signal<MemberName>}
   * @readonly
   */
  private readonly nameOf: Signal<MemberName> = computed((): MemberName => {
    const names: ReadonlyMap<string, string | null> = new Map(
      this.members().map((member: ListMember): [string, string | null] => [
        member.userId,
        member.name,
      ]),
    );
    return (userId: string): string | null => names.get(userId) ?? null;
  });

  /**
   * Property members
   *
   * @description
   * The members a rule can assign or notify, once read.
   *
   * @type {Signal<readonly ListMember[]>}
   * @readonly
   */
  protected readonly members: Signal<readonly ListMember[]> = computed((): readonly ListMember[] =>
    this.store.members.hasValue() ? this.store.members.value() : [],
  );

  /**
   * Property ruleRows
   *
   * @description
   * The shown rules with their texts.
   *
   * @type {Signal<readonly AutomationRuleRow[]>}
   * @readonly
   */
  protected readonly ruleRows: Signal<readonly AutomationRuleRow[]> = computed(
    (): readonly AutomationRuleRow[] => {
      const nameOf: MemberName = this.nameOf();
      return this.store.shownRules().map((rule: AutomationRule): AutomationRuleRow => {
        const when: string = describeTrigger(rule.trigger);
        const then: string = describeAction(rule.action, nameOf);
        return {
          rule,
          when,
          then,
          icon: ACTION_ICONS[rule.action.type],
          toggleLabel: rule.enabled
            ? $localize`:@@spaces.automations.disable:Disable: ${when}:when:, ${then}:then:`
            : $localize`:@@spaces.automations.enable:Enable: ${when}:when:, ${then}:then:`,
          removeLabel: $localize`:@@spaces.automations.delete-label:Delete: ${when}:when:, ${then}:then:`,
        };
      });
    },
  );

  /**
   * Property runRows
   *
   * @description
   * `Last runs`, newest first.
   *
   * @type {Signal<readonly AutomationRunRow[]>}
   * @readonly
   */
  protected readonly runRows: Signal<readonly AutomationRunRow[]> = computed(
    (): readonly AutomationRunRow[] => {
      if (!this.store.runs.hasValue()) return [];
      const nameOf: MemberName = this.nameOf();
      const now: Date = new Date();
      return this.store.runs.value().map((run: AutomationRun): AutomationRunRow => ({
        id: run.id,
        text: describeRun(run, nameOf),
        at: runMoment(run.executedAt, now, this.locale),
      }));
    },
  );

  /**
   * Property description
   *
   * @description
   * The dialog's text with the count of active rules.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly description: Signal<string> = computed((): string => {
    const count: number = this.store.activeCount();
    return count === 1
      ? $localize`:@@spaces.automations.text-one:“When… then…” rules applied to every task of the workspace · 1 active.`
      : $localize`:@@spaces.automations.text:“When… then…” rules applied to every task of the workspace · ${count}:count: active.`;
  });

  /**
   * Property statusWords
   *
   * @description
   * The default word of each status, the chips of `Status becomes…` in workflow order.
   *
   * @type {Readonly<Record<StatusKey, string>>}
   * @readonly
   */
  protected readonly statusWords: Readonly<Record<StatusKey, string>> = statusLabels();

  /**
   * Property priorityWords
   *
   * @description
   * The word of each priority, the chips of `Change the priority`.
   *
   * @type {Readonly<Record<PriorityKey, string>>}
   * @readonly
   */
  protected readonly priorityWords: Readonly<Record<PriorityKey, string>> = priorityLabels();

  /**
   * Property actionWords
   *
   * @description
   * The `Then` chips (`AUTO_ACTIONS`, `App.dc.html` lines 3627-3632).
   *
   * @type {Readonly<Record<AutomationActionType, string>>}
   * @readonly
   */
  protected readonly actionWords: Readonly<Record<AutomationActionType, string>> = {
    assign: $localize`:@@spaces.automations.action-assign:Assign to`,
    priority: $localize`:@@spaces.automations.action-priority:Change the priority`,
    notify: $localize`:@@spaces.automations.action-notify:Notify`,
    comment: $localize`:@@spaces.automations.action-comment:Add a comment`,
  };

  /**
   * Property actionIcons
   *
   * @description
   * The icon of each `Then` chip.
   *
   * @type {Readonly<Record<AutomationActionType, string>>}
   * @readonly
   */
  protected readonly actionIcons: Readonly<Record<AutomationActionType, string>> = ACTION_ICONS;

  /**
   * Property adding
   *
   * @description
   * Whether the builder shows instead of `New automation`.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly adding: WritableSignal<boolean> = signal(false);

  /**
   * Property trigger
   *
   * @description
   * The builder's trigger, `Status becomes…` by default as in the mockup.
   *
   * @type {WritableSignal<AutomationTrigger['type']>}
   * @readonly
   */
  protected readonly trigger: WritableSignal<AutomationTrigger['type']> = signal('status');

  /**
   * Property status
   *
   * @description
   * The status of `Status becomes…`, `In review` by default.
   *
   * @type {WritableSignal<StatusKey>}
   * @readonly
   */
  protected readonly status: WritableSignal<StatusKey> = signal('review');

  /**
   * Property action
   *
   * @description
   * The builder's action, `Notify` by default.
   *
   * @type {WritableSignal<AutomationActionType>}
   * @readonly
   */
  protected readonly action: WritableSignal<AutomationActionType> = signal('notify');

  /**
   * Property chosenPerson
   *
   * @description
   * The person picked for `Assign to` and `Notify`, or null before a pick.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly chosenPerson: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property person
   *
   * @description
   * The person the rule names: the pick while that member is listed, else the first member.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly person: Signal<string | null> = computed((): string | null => {
    const members: readonly ListMember[] = this.members();
    const chosen: string | null = this.chosenPerson();
    if (chosen && members.some((member: ListMember): boolean => member.userId === chosen)) {
      return chosen;
    }
    return members[0]?.userId ?? null;
  });

  /**
   * Property personGroupShown
   *
   * @description
   * Whether the person chips are rendered.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  private readonly personGroupShown: Signal<boolean> = computed(
    (): boolean => this.adding() && this.needsPerson() && this.members().length > 0,
  );

  /**
   * Property personRendered
   *
   * @description
   * Whether the person chips have rendered once since they appeared.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly personRendered: WritableSignal<boolean> = signal(false);

  /**
   * Property personValue
   *
   * @description
   * The person chips' value. While the chips are first rendered it is the first member: in
   * `@cadenway/ui` 0.8.0, `cw-toggle-group` reads the value of every item up to the selected one
   * while the items of a `@for` have not all received their `value` yet, which throws when the
   * selected chip is not the first. Once rendered, it is the chosen person.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly personValue: Signal<string | null> = computed((): string | null =>
    this.personRendered() ? this.person() : (this.members()[0]?.userId ?? null),
  );

  /**
   * Property priority
   *
   * @description
   * The priority of `Change the priority`, `High` by default.
   *
   * @type {WritableSignal<PriorityKey>}
   * @readonly
   */
  protected readonly priority: WritableSignal<PriorityKey> = signal('haute');

  /**
   * Property commentModel
   *
   * @description
   * The comment's text.
   *
   * @type {WritableSignal<CommentModel>}
   * @readonly
   */
  protected readonly commentModel: WritableSignal<CommentModel> = signal({ body: '' });

  /**
   * Property commentForm
   *
   * @description
   * The comment field, 5,000 characters at most as the contract accepts: a longer one blocks
   * `Create the rule` and shows its message. `[formField]` gives the input the rule's native
   * `maxlength`, which stops typing and pasting beyond the limit; Angular refuses a static
   * `maxlength` beside it.
   *
   * @type {FieldTree<CommentModel>}
   * @readonly
   */
  protected readonly commentForm: FieldTree<CommentModel> = form(this.commentModel, (path) => {
    maxLength(path.body, COMMENT_MAX_LENGTH, {
      message: $localize`:@@spaces.automations.comment-too-long:Keep the comment to 5,000 characters or fewer.`,
    });
  });

  /**
   * Property retryLabel
   *
   * @description
   * Label for retrying a failed read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = SPACES_RETRY;

  /**
   * Property needsPerson
   *
   * @description
   * Whether the action names a person.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly needsPerson: Signal<boolean> = computed(
    (): boolean => this.action() === 'assign' || this.action() === 'notify',
  );

  /**
   * Property previewAction
   *
   * @description
   * The builder's action as it would be recorded; a person action without a person names nobody.
   *
   * @type {Signal<AutomationAction>}
   * @readonly
   */
  private readonly previewAction: Signal<AutomationAction> = computed((): AutomationAction => {
    const type: AutomationActionType = this.action();
    if (type === 'assign' || type === 'notify') return { type, userId: this.person() ?? '' };
    if (type === 'priority') return { type, priority: this.priority() };
    return { type, body: this.commentModel().body };
  });

  /**
   * Property previewTrigger
   *
   * @description
   * The builder's trigger.
   *
   * @type {Signal<AutomationTrigger>}
   * @readonly
   */
  private readonly previewTrigger: Signal<AutomationTrigger> = computed((): AutomationTrigger =>
    this.trigger() === 'created' ? { type: 'created' } : { type: 'status', status: this.status() },
  );

  /**
   * Property draft
   *
   * @description
   * The rule to create, or null while it is incomplete or invalid: an empty comment, one over
   * 5,000 characters, or no person.
   *
   * @type {Signal<AutomationDraft | null>}
   * @readonly
   */
  protected readonly draft: Signal<AutomationDraft | null> = computed(
    (): AutomationDraft | null => {
      const action: AutomationAction = this.previewAction();
      if (action.type === 'comment') {
        if (!action.body.trim() || this.commentForm.body().invalid()) return null;
      }
      if ((action.type === 'assign' || action.type === 'notify') && !action.userId) return null;
      return { trigger: this.previewTrigger(), action };
    },
  );

  /**
   * Property preview
   *
   * @description
   * `<when>, then <then>.`
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly preview: Signal<string> = computed((): string =>
    this.sentence(this.previewTrigger(), this.previewAction()),
  );

  /**
   * Property removal
   *
   * @description
   * The rule whose deletion is being confirmed, with its texts.
   *
   * @type {WritableSignal<AutomationRuleRow | null>}
   * @readonly
   */
  protected readonly removal: WritableSignal<AutomationRuleRow | null> =
    signal<AutomationRuleRow | null>(null);

  /**
   * Property removeOpen
   *
   * @description
   * Whether the deletion's confirmation shows.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly removeOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property removalText
   *
   * @description
   * `<when>, <then>. It will no longer run.`
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly removalText: Signal<string> = computed((): string => {
    const row: AutomationRuleRow | null = this.removal();
    if (!row) return '';
    const when: string = row.when;
    const then: string = row.then;
    return $localize`:@@spaces.automations.delete-text:${when}:when:, ${then}:then:. It will no longer run.`;
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Each opening reads the rules and the runs again and shows `New automation` instead of the
   * builder, whose values stay as they were (`App.dc.html` line 8566). After each render, it
   * notes whether the person chips are shown (`personValue`).
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      if (!this.open()) return;
      untracked((): void => {
        this.adding.set(false);
        this.store.load();
      });
    });
    afterRenderEffect((): void => {
      this.personRendered.set(this.personGroupShown());
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method pickTrigger
   *
   * @description
   * Keeps the chosen trigger.
   *
   * @param {string | null | readonly string[]} value - Toggle value.
   */
  protected pickTrigger(value: string | null | readonly string[]): void {
    if (value === 'created' || value === 'status') this.trigger.set(value);
  }

  /**
   * Method pickStatus
   *
   * @description
   * Keeps the chosen status.
   *
   * @param {string | null | readonly string[]} value - Toggle value.
   */
  protected pickStatus(value: string | null | readonly string[]): void {
    if (typeof value === 'string' && value in this.statusWords) this.status.set(value as StatusKey);
  }

  /**
   * Method pickAction
   *
   * @description
   * Keeps the chosen action.
   *
   * @param {string | null | readonly string[]} value - Toggle value.
   */
  protected pickAction(value: string | null | readonly string[]): void {
    if (typeof value === 'string' && value in this.actionWords) {
      this.action.set(value as AutomationActionType);
    }
  }

  /**
   * Method pickPerson
   *
   * @description
   * Keeps the chosen person.
   *
   * @param {string | null | readonly string[]} value - Toggle value.
   */
  protected pickPerson(value: string | null | readonly string[]): void {
    if (typeof value === 'string') this.chosenPerson.set(value);
  }

  /**
   * Method pickPriority
   *
   * @description
   * Keeps the chosen priority.
   *
   * @param {string | null | readonly string[]} value - Toggle value.
   */
  protected pickPriority(value: string | null | readonly string[]): void {
    if (typeof value === 'string' && value in this.priorityWords) {
      this.priority.set(value as PriorityKey);
    }
  }

  /**
   * Method memberLabel
   *
   * @description
   * The chip's words for a member.
   *
   * @param {ListMember} member - The member.
   * @returns {string} The name, or `Former member` without one.
   */
  protected memberLabel(member: ListMember): string {
    return member.name ?? $localize`:@@spaces.automations.former-member:Former member`;
  }

  /**
   * Method startAdding
   *
   * @description
   * Shows the builder.
   */
  protected startAdding(): void {
    this.adding.set(true);
  }

  /**
   * Method cancelAdding
   *
   * @description
   * Hides the builder and forgets the key of its last submission.
   */
  protected cancelAdding(): void {
    this.adding.set(false);
    this.store.discardDraft();
  }

  /**
   * Method save
   *
   * @description
   * Creates the rule; once recorded, closes the builder, empties the comment and shows
   * `Automation created`. A refusal keeps the builder and its values for a retry.
   */
  protected async save(): Promise<void> {
    const draft: AutomationDraft | null = this.draft();
    if (!draft || this.store.creating()) return;
    const created: AutomationRule | null = await this.store.create(draft);
    if (!created) {
      this.toasts.error(
        $localize`:@@spaces.automations.create-failed:The automation could not be created`,
      );
      return;
    }
    this.adding.set(false);
    this.commentModel.set({ body: '' });
    this.toasts.show($localize`:@@spaces.automations.created:Automation created`, {
      description: this.sentence(created.trigger, created.action),
    });
  }

  /**
   * Method toggle
   *
   * @description
   * Turns a rule on or off. A refusal shows its recorded state again with an error toast; a
   * lost answer shows the state the gateway confirms, with a warning when the change did not
   * apply or could not be confirmed.
   *
   * @param {AutomationRule} rule - The rule.
   */
  protected async toggle(rule: AutomationRule): Promise<void> {
    const outcome: AutomationWriteOutcome = await this.store.toggle(rule);
    if (outcome === 'refused') {
      this.toasts.error(
        $localize`:@@spaces.automations.toggle-failed:The automation could not be changed`,
      );
    } else if (outcome === 'not-applied') {
      this.toasts.warning(
        $localize`:@@spaces.automations.toggle-not-applied:The automation was not changed`,
      );
    } else if (outcome === 'unknown') {
      this.toasts.warning(
        $localize`:@@spaces.automations.toggle-unknown:The change to the automation could not be confirmed`,
      );
    }
  }

  /**
   * Method askRemove
   *
   * @description
   * Opens the deletion's confirmation.
   *
   * @param {AutomationRuleRow} row - The rule's row.
   */
  protected askRemove(row: AutomationRuleRow): void {
    this.removal.set(row);
    this.removeOpen.set(true);
  }

  /**
   * Method confirmRemove
   *
   * @description
   * Closes the confirmation and deletes the rule, which leaves at once. A refusal brings it back
   * with an error toast; a lost answer shows what the gateway confirms, with a warning when the
   * rule is still there or its deletion could not be confirmed.
   */
  protected async confirmRemove(): Promise<void> {
    const row: AutomationRuleRow | null = this.removal();
    this.removeOpen.set(false);
    if (!row) return;
    const outcome: AutomationWriteOutcome = await this.store.remove(row.rule);
    if (outcome === 'refused') {
      this.toasts.error(
        $localize`:@@spaces.automations.delete-failed:The automation could not be deleted`,
      );
    } else if (outcome === 'not-applied') {
      this.toasts.warning(
        $localize`:@@spaces.automations.delete-not-applied:The automation was not deleted`,
      );
    } else if (outcome === 'unknown') {
      this.toasts.warning(
        $localize`:@@spaces.automations.delete-unknown:The deletion of the automation could not be confirmed`,
      );
    }
  }

  /**
   * Method sentence
   *
   * @description
   * `<when>, then <then>.`, the preview and the created toast's text.
   *
   * @param {AutomationTrigger} trigger - The trigger.
   * @param {AutomationAction} action - The action.
   * @returns {string} The sentence.
   */
  private sentence(trigger: AutomationTrigger, action: AutomationAction): string {
    const when: string = describeTrigger(trigger);
    const then: string = describeAction(action, this.nameOf());
    return $localize`:@@spaces.automations.preview:${when}:when:, then ${then}:then:.`;
  }
  // #endregion
}
