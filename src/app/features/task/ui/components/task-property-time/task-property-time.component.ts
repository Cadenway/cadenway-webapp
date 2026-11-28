import { formatDate } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwPopover, CwPopoverTrigger } from '@cadenway/ui/components/popover';
import { CwProgress } from '@cadenway/ui/components/progress';
import { NgIcon } from '@ng-icons/core';

import type { Person } from '../../../models/person/person.interface';
import type { TaskTimeDraft, TaskTimeEntry } from '../../../models/task-time/task-time.interface';
import {
  dayOffset,
  durationSuggestions,
  formatMinutes,
  localDay,
  parseMinutes,
} from '../../../utils/task-property/task-property.util';
import { peopleOf } from '../task-property-assignees/task-property-assignees.component';

/**
 * Constant QUICK_MINUTES
 *
 * @description
 * The shortcuts of the add time panel, in minutes (`+ 15 min` to `+ 2 h`).
 *
 * @type {readonly number[]}
 */
export const QUICK_MINUTES: readonly number[] = [15, 30, 60, 120];

/**
 * Interface TimeEntryRow
 *
 * @description
 * An entry as the list writes it.
 */
interface TimeEntryRow {
  // #region Properties
  /**
   * Property entry
   *
   * @description
   * The entry.
   *
   * @type {TaskTimeEntry}
   * @readonly
   */
  readonly entry: TaskTimeEntry;

  /**
   * Property author
   *
   * @description
   * Who recorded it.
   *
   * @type {Person}
   * @readonly
   */
  readonly author: Person;

  /**
   * Property duration
   *
   * @description
   * Its duration in words.
   *
   * @type {string}
   * @readonly
   */
  readonly duration: string;

  /**
   * Property meta
   *
   * @description
   * `{note} · {when}`, or the moment alone.
   *
   * @type {string}
   * @readonly
   */
  readonly meta: string;

  /**
   * Property removable
   *
   * @description
   * Whether the caller may delete it (its author, with `edit`).
   *
   * @type {boolean}
   * @readonly
   */
  readonly removable: boolean;
  // #endregion
}

/**
 * Component TaskPropertyTime
 *
 * @description
 * The `Time spent` row of the task detail's properties (`App.dc.html` lines 2458-2503 and
 * 8622-8703). The trigger shows the time spent (`None` without any) against the estimate, with a
 * bar named `Time spent against the estimate` (grenat once over it); it opens `Add time spent`:
 * the shortcuts `+ 15 min` to `+ 2 h` (each adds at once), the `Duration` (a bare number counts
 * in minutes) and `Note` fields with suggestions as the duration is typed, the hint (`= 1 h 30`,
 * or the unreadable duration after a try), `Add` (Enter in either field), then `Entries · n`,
 * newest first, each with its author's initials, duration and `{note} · {when}`; the caller's own
 * entries have a delete button whose confirmation (`Delete this 45 min entry?`) emits `removed`.
 * Next to the trigger, the timer button starts the timer, then shows the running duration and
 * stops it (`timerToggled`). The container records (`added`), deletes and runs the timer; `now`
 * is its clock. `disabled` hides the timer and leaves the panel closed.
 */
@Component({
  selector: 'cw-task-property-time',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwPopover,
    CwPopoverTrigger,
    CwProgress,
    NgIcon,
  ],
  template: `
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="relative isolate flex min-h-8 min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
        [disabled]="disabled()"
        [cwPopoverTrigger]="popover"
        data-testid="task-property-time"
      >
        <span class="flex items-baseline gap-1.5 whitespace-nowrap">
          @if (totalMinutes() > 0) {
            <span class="font-medium tabular-nums" [class.text-grenat-text]="over()">{{
              format(totalMinutes())
            }}</span>
          } @else {
            <span class="text-muted-foreground" i18n="@@task.properties.time-none">None</span>
          }
          @if (estimateMinutes(); as estimate) {
            <span class="text-xs text-muted-foreground tabular-nums">/ {{ format(estimate) }}</span>
          }
        </span>
        @if (estimateMinutes()) {
          <cw-progress
            class="w-full"
            size="sm"
            [value]="percent()"
            [variant]="over() ? 'destructive' : 'success'"
            ariaLabel="Time spent against the estimate"
            i18n-ariaLabel="@@task.properties.time-meter"
          />
        }
      </button>
      @if (!disabled()) {
        <button
          type="button"
          class="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border text-xs font-medium whitespace-nowrap tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          [class]="
            running()
              ? 'border-primary/50 bg-primary/5 pr-2.5 pl-2 text-primary'
              : 'w-7 border-input text-muted-foreground hover:bg-muted hover:text-foreground'
          "
          [attr.aria-pressed]="running()"
          [attr.aria-label]="timerLabel()"
          [title]="timerLabel()"
          data-testid="task-property-timer"
          (click)="timerToggled.emit()"
        >
          <ng-icon
            [name]="running() ? 'phosphorStopFill' : 'phosphorPlayFill'"
            size="0.75rem"
            aria-hidden="true"
          />
          @if (running()) {
            <span>{{ format(runningMinutes()) }}</span>
          }
        </button>
      }
    </div>
    <cw-popover
      #popover
      side="bottom"
      align="end"
      size="lg"
      padding="none"
      ariaLabel="Add time spent"
      i18n-ariaLabel="@@task.properties.time-dialog"
      [open]="open()"
      (openChange)="openChange($event)"
    >
      <div class="flex flex-col gap-3 p-3">
        <p
          class="text-xs font-medium text-muted-foreground"
          i18n="@@task.properties.time-add-title"
        >
          Add time
        </p>
        <div class="grid grid-cols-4 gap-1.5">
          @for (minutes of quick; track minutes) {
            <button
              type="button"
              class="inline-flex h-7 items-center justify-center rounded-md border border-input text-xs font-medium whitespace-nowrap tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              (click)="addQuick(minutes)"
            >
              + {{ format(minutes) }}
            </button>
          }
        </div>
        <div class="flex flex-col gap-1.5">
          <div class="flex gap-1.5">
            <label [for]="ids.duration" class="sr-only" i18n="@@task.properties.time-duration"
              >Duration</label
            >
            <input
              #duration
              cdkFocusInitial
              type="text"
              autocomplete="off"
              placeholder="1 h 30, 45 min…"
              i18n-placeholder="@@task.properties.time-duration-placeholder"
              class="h-8 w-24 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm tabular-nums outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive/60"
              [id]="ids.duration"
              [value]="draft()"
              [attr.aria-invalid]="showInvalid() ? 'true' : null"
              [attr.aria-describedby]="ids.hint"
              (input)="typeDraft(duration.value)"
              (keydown.enter)="enter($event)"
            />
            <label [for]="ids.note" class="sr-only" i18n="@@task.properties.time-note">Note</label>
            <input
              #noteField
              type="text"
              autocomplete="off"
              placeholder="Note (optional)"
              i18n-placeholder="@@task.properties.time-note-placeholder"
              class="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
              [id]="ids.note"
              [value]="note()"
              (input)="note.set(noteField.value)"
              (keydown.enter)="enter($event)"
            />
          </div>
          @if (suggestions().length > 0) {
            <div
              role="listbox"
              aria-label="Duration suggestions"
              i18n-aria-label="@@task.properties.duration-suggestions"
              class="flex flex-wrap gap-1"
            >
              @for (minutes of suggestions(); track minutes) {
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  class="inline-flex h-6 items-center rounded-md border border-input px-2 text-xs whitespace-nowrap tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  (click)="pickSuggestion(minutes, duration)"
                >
                  {{ format(minutes) }}
                </button>
              }
            </div>
          }
          <div class="flex items-center justify-between gap-2">
            <p
              class="text-xs"
              [class.text-destructive]="showInvalid()"
              [class.text-muted-foreground]="!showInvalid()"
              [id]="ids.hint"
            >
              @if (showInvalid()) {
                <ng-container i18n="@@task.properties.time-invalid"
                  >Unrecognized duration: try 1 h 30 or 45 min.</ng-container
                >
              } @else if (draftMinutes(); as minutes) {
                = {{ format(minutes) }}
              } @else {
                <ng-container i18n="@@task.properties.time-hint"
                  >Free duration, or a shortcut.</ng-container
                >
              }
            </p>
            <button
              cwButton
              type="button"
              size="xs"
              class="shrink-0"
              [loading]="pending()"
              (click)="addDraft()"
            >
              <ng-icon name="phosphorPlusBold" size="0.875rem" aria-hidden="true" />
              <ng-container i18n="@@task.properties.time-add">Add</ng-container>
            </button>
          </div>
        </div>
        @if (failed()) {
          <div class="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
            <span role="alert" i18n="@@task.create.read-failed"
              >Could not load this information.</span
            >
            <button cwButton type="button" size="xs" variant="outline" (click)="retried.emit()">
              <ng-container i18n="@@task.retry">Retry</ng-container>
            </button>
          </div>
        } @else if (rows().length > 0) {
          <div class="flex flex-col gap-1 border-t border-border pt-2">
            <p
              class="text-xs font-medium text-muted-foreground"
              i18n="@@task.properties.time-entries"
            >
              Entries · {{ rows().length }}
            </p>
            <ul class="flex max-h-44 flex-col overflow-y-auto">
              @for (row of rows(); track row.entry.id) {
                <li
                  class="group/te flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted"
                >
                  <span
                    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] leading-none font-semibold text-secondary-foreground"
                    [title]="row.author.name"
                    >{{ row.author.initials }}</span
                  >
                  <span class="w-14 shrink-0 font-medium whitespace-nowrap tabular-nums">{{
                    row.duration
                  }}</span>
                  <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{
                    row.meta
                  }}</span>
                  @if (row.removable) {
                    <button
                      type="button"
                      class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all group-hover/te:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      [attr.aria-label]="removeLabel(row)"
                      (click)="confirming.set(row.entry)"
                    >
                      <ng-icon name="phosphorXBold" size="0.75rem" aria-hidden="true" />
                    </button>
                  }
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </cw-popover>
    <cw-alert-dialog
      variant="destructive"
      size="sm"
      [open]="confirming() !== null"
      (openChange)="$event || confirming.set(null)"
      (confirm)="confirmRemove()"
    >
      <h2 cwAlertDialogTitle>{{ confirmTitle() }}</h2>
      <p cwAlertDialogDescription i18n="@@task.properties.entry-delete-text">
        The task's time spent and the timesheet will be recalculated.
      </p>
      <button cwButton cwAlertDialogCancel variant="outline" i18n="@@task.detail.delete-cancel">
        Cancel
      </button>
      <button
        cwButton
        cwAlertDialogAction
        variant="destructive"
        i18n="@@task.properties.entry-delete-confirm"
      >
        Delete the entry
      </button>
    </cw-alert-dialog>
  `,
})
export class TaskPropertyTime {
  // #region Properties
  /**
   * Property totalMinutes
   *
   * @description
   * Minutes recorded on the task.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly totalMinutes: InputSignal<number> = input<number>(0);

  /**
   * Property estimateMinutes
   *
   * @description
   * The estimate in minutes, or null (no bar).
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly estimateMinutes: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property entries
   *
   * @description
   * The entries, newest first; null while read.
   *
   * @type {InputSignal<readonly TaskTimeEntry[] | null>}
   * @readonly
   */
  public readonly entries: InputSignal<readonly TaskTimeEntry[] | null> = input<
    readonly TaskTimeEntry[] | null
  >(null);

  /**
   * Property failed
   *
   * @description
   * Whether reading the entries failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input(false);

  /**
   * Property people
   *
   * @description
   * Members, for the authors' initials.
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
   * The caller's account: only their entries can be deleted.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly currentUserId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property timerStartedAt
   *
   * @description
   * When the timer started (epoch milliseconds), or null.
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly timerStartedAt: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property now
   *
   * @description
   * The container's clock (epoch milliseconds), for the running duration and the entries' times.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly now: InputSignal<number> = input<number>(Date.now());

  /**
   * Property pending
   *
   * @description
   * Whether an entry is being recorded.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input(false);

  /**
   * Property disabled
   *
   * @description
   * Read-only: no timer, the panel does not open.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property added
   *
   * @description
   * Time to record.
   *
   * @type {OutputEmitterRef<TaskTimeDraft>}
   * @readonly
   */
  public readonly added: OutputEmitterRef<TaskTimeDraft> = output<TaskTimeDraft>();

  /**
   * Property removed
   *
   * @description
   * An entry whose deletion was confirmed.
   *
   * @type {OutputEmitterRef<TaskTimeEntry>}
   * @readonly
   */
  public readonly removed: OutputEmitterRef<TaskTimeEntry> = output<TaskTimeEntry>();

  /**
   * Property timerToggled
   *
   * @description
   * The timer button: start, or stop and record.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly timerToggled: OutputEmitterRef<void> = output();

  /**
   * Property retried
   *
   * @description
   * `Retry` after a failed read of the entries.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property quick
   *
   * @description
   * The shortcuts, in minutes.
   *
   * @type {readonly number[]}
   * @readonly
   */
  protected readonly quick: readonly number[] = QUICK_MINUTES;

  /**
   * Property ids
   *
   * @description
   * Element ids of the panel, unique per row.
   *
   * @type {{ readonly duration: string; readonly note: string; readonly hint: string }}
   * @readonly
   */
  protected readonly ids: {
    readonly duration: string;
    readonly note: string;
    readonly hint: string;
  } = ((id: string) => ({ duration: `${id}-duration`, note: `${id}-note`, hint: `${id}-hint` }))(
    `task-time-${crypto.randomUUID()}`,
  );

  /**
   * Property open
   *
   * @description
   * Whether the panel is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly open: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property draft
   *
   * @description
   * The typed duration.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly draft: WritableSignal<string> = signal<string>('');

  /**
   * Property note
   *
   * @description
   * The typed note.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly note: WritableSignal<string> = signal<string>('');

  /**
   * Property tried
   *
   * @description
   * Whether `Add` was tried with an unreadable duration (the error shows until it changes).
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly tried: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property confirming
   *
   * @description
   * The entry whose deletion is being confirmed.
   *
   * @type {WritableSignal<TaskTimeEntry | null>}
   * @readonly
   */
  protected readonly confirming: WritableSignal<TaskTimeEntry | null> =
    signal<TaskTimeEntry | null>(null);

  /**
   * Property locale
   *
   * @description
   * Locale of the times.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property running
   *
   * @description
   * Whether the timer runs.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly running: Signal<boolean> = computed(
    (): boolean => this.timerStartedAt() !== null,
  );

  /**
   * Property runningMinutes
   *
   * @description
   * Whole minutes the timer has run.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly runningMinutes: Signal<number> = computed((): number => {
    const startedAt: number | null = this.timerStartedAt();
    return startedAt === null ? 0 : Math.max(0, Math.floor((this.now() - startedAt) / 60_000));
  });

  /**
   * Property timerLabel
   *
   * @description
   * Name of the timer button.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly timerLabel: Signal<string> = computed((): string =>
    this.running()
      ? $localize`:@@task.properties.timer-stop:Stop the timer (${formatMinutes(this.runningMinutes())}:duration:)`
      : $localize`:@@task.properties.timer-start:Start the timer`,
  );

  /**
   * Property over
   *
   * @description
   * Whether the time spent is over the estimate.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly over: Signal<boolean> = computed((): boolean => {
    const estimate: number | null = this.estimateMinutes();
    return estimate !== null && estimate > 0 && this.totalMinutes() > estimate;
  });

  /**
   * Property percent
   *
   * @description
   * Time spent against the estimate, 0 to 100.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly percent: Signal<number> = computed((): number => {
    const estimate: number | null = this.estimateMinutes();
    return estimate ? Math.min(100, Math.round((this.totalMinutes() / estimate) * 100)) : 0;
  });

  /**
   * Property draftMinutes
   *
   * @description
   * Minutes of the typed duration, null when empty or unreadable.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  protected readonly draftMinutes: Signal<number | null> = computed((): number | null =>
    parseMinutes(this.draft(), 'minutes'),
  );

  /**
   * Property showInvalid
   *
   * @description
   * Whether to show the unreadable duration error.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly showInvalid: Signal<boolean> = computed(
    (): boolean => this.tried() && this.draftMinutes() === null,
  );

  /**
   * Property suggestions
   *
   * @description
   * Durations proposed from the typed beginning, hidden when the only one is what is typed.
   *
   * @type {Signal<readonly number[]>}
   * @readonly
   */
  protected readonly suggestions: Signal<readonly number[]> = computed((): readonly number[] => {
    const text: string = this.draft().trim();
    if (!text) return [];
    const found: readonly number[] = durationSuggestions(text, 'minutes');
    return found.length === 1 && formatMinutes(found[0]) === text ? [] : found;
  });

  /**
   * Property rows
   *
   * @description
   * The entries as the list writes them.
   *
   * @type {Signal<readonly TimeEntryRow[]>}
   * @readonly
   */
  protected readonly rows: Signal<readonly TimeEntryRow[]> = computed(
    (): readonly TimeEntryRow[] => {
      const entries: readonly TaskTimeEntry[] = this.entries() ?? [];
      const authors: readonly Person[] = peopleOf(
        entries.map((entry: TaskTimeEntry) => entry.authorId),
        this.people(),
      );
      return entries.map((entry: TaskTimeEntry, index: number): TimeEntryRow => {
        const when: string = this.when(entry.createdAt);
        return {
          entry,
          author: authors[index],
          duration: formatMinutes(entry.minutes),
          meta: entry.note ? `${entry.note} · ${when}` : when,
          removable: !this.disabled() && entry.authorId === this.currentUserId(),
        };
      });
    },
  );

  /**
   * Property confirmTitle
   *
   * @description
   * Title of the deletion confirmation.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly confirmTitle: Signal<string> = computed((): string => {
    const entry: TaskTimeEntry | null = this.confirming();
    return entry
      ? $localize`:@@task.properties.entry-delete-title:Delete this ${formatMinutes(entry.minutes)}:duration: entry?`
      : '';
  });
  // #endregion

  // #region Methods
  /**
   * Method format
   *
   * @description
   * Writes minutes.
   *
   * @param {number} minutes - The duration.
   * @returns {string} Its words.
   */
  protected format(minutes: number): string {
    return formatMinutes(minutes);
  }

  /**
   * Method openChange
   *
   * @description
   * Follows the panel; it starts empty each time it opens.
   *
   * @param {boolean} open - Whether it opens.
   */
  protected openChange(open: boolean): void {
    if (open) {
      this.draft.set('');
      this.note.set('');
      this.tried.set(false);
    }
    this.open.set(open);
  }

  /**
   * Method typeDraft
   *
   * @description
   * Follows the typed duration and clears the error.
   *
   * @param {string} value - The text.
   */
  protected typeDraft(value: string): void {
    this.draft.set(value);
    this.tried.set(false);
  }

  /**
   * Method pickSuggestion
   *
   * @description
   * Writes a suggestion in the duration field and gives it the focus back.
   *
   * @param {number} minutes - The suggestion.
   * @param {HTMLInputElement} field - The duration field.
   */
  protected pickSuggestion(minutes: number, field: HTMLInputElement): void {
    this.typeDraft(formatMinutes(minutes));
    field.focus();
  }

  /**
   * Method addQuick
   *
   * @description
   * Records a shortcut at once and closes the panel.
   *
   * @param {number} minutes - The shortcut.
   */
  protected addQuick(minutes: number): void {
    this.added.emit({ minutes, note: '' });
    this.open.set(false);
  }

  /**
   * Method addDraft
   *
   * @description
   * Records the typed duration and note and closes the panel, or shows the error.
   */
  protected addDraft(): void {
    const minutes: number | null = this.draftMinutes();
    if (minutes === null) {
      this.tried.set(true);
      return;
    }
    this.added.emit({ minutes, note: this.note().trim() });
    this.open.set(false);
  }

  /**
   * Method enter
   *
   * @description
   * Enter in a field adds.
   *
   * @param {Event} event - The key.
   */
  protected enter(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      event.preventDefault();
      this.addDraft();
    }
  }

  /**
   * Method removeLabel
   *
   * @description
   * Name of an entry's delete button.
   *
   * @param {TimeEntryRow} row - The entry.
   * @returns {string} The name.
   */
  protected removeLabel(row: TimeEntryRow): string {
    return $localize`:@@task.properties.entry-delete:Delete the ${row.duration}:duration: entry`;
  }

  /**
   * Method confirmRemove
   *
   * @description
   * Emits the confirmed deletion.
   */
  protected confirmRemove(): void {
    const entry: TaskTimeEntry | null = this.confirming();
    this.confirming.set(null);
    if (entry) this.removed.emit(entry);
  }

  /**
   * Method when
   *
   * @description
   * When an entry was recorded (`just now`, `today, 9:05`, `yesterday, 14:10`, `6 Nov, 11:00`).
   *
   * @param {string} createdAt - ISO instant.
   * @returns {string} The moment.
   */
  private when(createdAt: string): string {
    const at: Date = new Date(createdAt);
    const now: number = this.now();
    if (now - at.getTime() < 60_000) return $localize`:@@task.properties.time-just-now:just now`;
    const time: string = formatDate(at, 'shortTime', this.locale);
    const offset: number = dayOffset(localDay(at), localDay(new Date(now)));
    if (offset === 0) return $localize`:@@task.properties.time-today-at:today, ${time}:time:`;
    if (offset === -1)
      return $localize`:@@task.properties.time-yesterday-at:yesterday, ${time}:time:`;
    return `${formatDate(at, 'd MMM', this.locale)}, ${time}`;
  }
  // #endregion
}
