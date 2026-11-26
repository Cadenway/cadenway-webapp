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
  signal,
  type WritableSignal,
} from '@angular/core';
import { CwPopover, CwPopoverTrigger } from '@cadenway/ui/components/popover';
import { NgIcon } from '@ng-icons/core';

import {
  durationSuggestions,
  formatMinutes,
  parseMinutes,
} from '../../../utils/task-property/task-property.util';

/**
 * Component TaskPropertyEstimate
 *
 * @description
 * The `Estimate` row of the task detail's properties (`App.dc.html` lines 2429-2457 and
 * 5884-5944): the trigger shows the estimate (`1 h 30`) or `Empty` and opens the `Estimate`
 * panel, whose field takes the focus with the current value. The panel has the hours and
 * minutes steppers (one hour, a quarter of an hour), the `Duration suggestions` listbox (the
 * defaults, then suggestions from the typed beginning; `No suggestion`), the help (`A bare number
 * counts in hours.`, or the unreadable duration in the destructive tone) and `Remove`. In the
 * field, ↓ and ↑ move in the suggestions, Enter applies the highlighted one or the typed text,
 * Escape closes without change; closing otherwise (an outside click, Tab out) applies the typed
 * text. An applied duration that changed emits `estimated` (minutes, null for `Remove` or an
 * emptied field); an unreadable one emits `rejected` with the text, for the container's toast.
 */
@Component({
  selector: 'cw-task-property-estimate',
  imports: [CwPopover, CwPopoverTrigger, NgIcon],
  template: `
    <button
      type="button"
      class="relative isolate flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1 text-left text-sm tabular-nums hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
      [class.text-muted-foreground]="estimateMinutes() === null"
      [disabled]="disabled()"
      [cwPopoverTrigger]="popover"
      data-testid="task-property-estimate"
    >
      {{ label() }}
    </button>
    <cw-popover
      #popover
      side="bottom"
      align="start"
      padding="none"
      ariaLabel="Estimate"
      i18n-ariaLabel="@@task.properties.estimate"
      [open]="open()"
      (openChange)="openChange($event)"
    >
      <div class="flex w-max max-w-sm min-w-64 flex-col gap-1 p-1">
        <input
          #field
          cdkFocusInitial
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          [attr.aria-controls]="listId"
          [attr.aria-activedescendant]="index() >= 0 ? listId + '-' + index() : null"
          aria-label="Estimate"
          i18n-aria-label="@@task.properties.estimate"
          autocomplete="off"
          spellcheck="false"
          placeholder="Empty"
          i18n-placeholder="@@task.properties.empty"
          class="h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          [value]="draft()"
          (input)="type(field.value)"
          (keydown)="key($event)"
        />
        <div class="flex items-center gap-2 p-1">
          <div
            role="group"
            aria-label="Hours"
            i18n-aria-label="@@task.properties.estimate-hours"
            class="flex h-8 flex-1 items-center rounded-lg border border-input"
          >
            <button
              type="button"
              class="inline-flex size-8 shrink-0 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
              aria-label="One hour less"
              i18n-aria-label="@@task.properties.estimate-hour-less"
              [disabled]="base() < 60"
              (click)="setTotal(base() - 60)"
            >
              <ng-icon name="phosphorMinusBold" class="size-3.5" aria-hidden="true" />
            </button>
            <span
              class="flex-1 text-center text-sm whitespace-nowrap tabular-nums"
              aria-live="polite"
              i18n="@@task.properties.estimate-hours-value"
              >{{ hours() }} h</span
            >
            <button
              type="button"
              class="inline-flex size-8 shrink-0 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="One hour more"
              i18n-aria-label="@@task.properties.estimate-hour-more"
              (click)="setTotal(base() + 60)"
            >
              <ng-icon name="phosphorPlusBold" class="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <div
            role="group"
            aria-label="Minutes"
            i18n-aria-label="@@task.properties.estimate-minutes"
            class="flex h-8 flex-1 items-center rounded-lg border border-input"
          >
            <button
              type="button"
              class="inline-flex size-8 shrink-0 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
              aria-label="15 minutes less"
              i18n-aria-label="@@task.properties.estimate-minutes-less"
              [disabled]="base() <= 0"
              (click)="quarterDown()"
            >
              <ng-icon name="phosphorMinusBold" class="size-3.5" aria-hidden="true" />
            </button>
            <span
              class="flex-1 text-center text-sm whitespace-nowrap tabular-nums"
              aria-live="polite"
              i18n="@@task.properties.estimate-minutes-value"
              >{{ minutes() }} min</span
            >
            <button
              type="button"
              class="inline-flex size-8 shrink-0 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="15 minutes more"
              i18n-aria-label="@@task.properties.estimate-minutes-more"
              (click)="setTotal(base() + 15 - (base() % 15))"
            >
              <ng-icon name="phosphorPlusBold" class="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div role="separator" class="-mx-1 h-px bg-border"></div>
        <div
          role="listbox"
          [id]="listId"
          aria-label="Duration suggestions"
          i18n-aria-label="@@task.properties.duration-suggestions"
          class="flex flex-col"
        >
          @for (option of suggestions(); track option; let i = $index) {
            <button
              type="button"
              role="option"
              tabindex="-1"
              [id]="listId + '-' + i"
              [attr.aria-selected]="i === index()"
              class="relative flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm whitespace-nowrap tabular-nums outline-hidden transition-colors select-none hover:bg-accent focus-visible:bg-selected"
              [class.bg-accent]="i === index()"
              (click)="commit(format(option))"
            >
              {{ format(option) }}
              @if (option === estimateMinutes()) {
                <ng-icon
                  name="phosphorCheckBold"
                  class="ml-auto size-4 shrink-0 pl-4 text-primary"
                  aria-hidden="true"
                />
              }
            </button>
          } @empty {
            <p
              class="px-2 py-1.5 text-sm text-muted-foreground"
              i18n="@@task.properties.no-suggestion"
            >
              No suggestion
            </p>
          }
        </div>
        <div
          class="flex items-center justify-between gap-2 border-t border-border px-2 pt-1.5 pb-0.5"
        >
          @if (invalid()) {
            <p class="text-xs text-destructive" i18n="@@task.properties.estimate-invalid">
              Unrecognized duration: 1 h 30, 45 min, 2h15…
            </p>
          } @else {
            <p class="text-xs text-muted-foreground" i18n="@@task.properties.estimate-help">
              A bare number counts in hours.
            </p>
          }
          @if (estimateMinutes() !== null) {
            <button
              type="button"
              class="shrink-0 rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              i18n="@@task.properties.estimate-remove"
              (click)="commit('')"
            >
              Remove
            </button>
          }
        </div>
      </div>
    </cw-popover>
  `,
})
export class TaskPropertyEstimate {
  // #region Properties
  /**
   * Property estimateMinutes
   *
   * @description
   * The estimate in minutes, or null.
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly estimateMinutes: InputSignal<number | null> = input<number | null>(null);

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
   * Property estimated
   *
   * @description
   * A changed estimate applied: minutes, or null to remove it.
   *
   * @type {OutputEmitterRef<number | null>}
   * @readonly
   */
  public readonly estimated: OutputEmitterRef<number | null> = output<number | null>();

  /**
   * Property rejected
   *
   * @description
   * An unreadable duration applied: the typed text.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly rejected: OutputEmitterRef<string> = output<string>();

  /**
   * Property listId
   *
   * @description
   * Id of the suggestions listbox, unique per row.
   *
   * @type {string}
   * @readonly
   */
  protected readonly listId: string = `task-estimate-${crypto.randomUUID()}`;

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
   * The text of the field.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly draft: WritableSignal<string> = signal<string>('');

  /**
   * Property typed
   *
   * @description
   * Whether the text was typed (suggestions follow it) rather than given.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly typed: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property index
   *
   * @description
   * The highlighted suggestion, -1 for none.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  protected readonly index: WritableSignal<number> = signal<number>(-1);

  /**
   * Property label
   *
   * @description
   * The trigger's words.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly label: Signal<string> = computed((): string => {
    const minutes: number | null = this.estimateMinutes();
    return minutes === null ? $localize`:@@task.properties.empty:Empty` : formatMinutes(minutes);
  });

  /**
   * Property base
   *
   * @description
   * Minutes of the field (0 when unreadable), what the steppers change.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly base: Signal<number> = computed(
    (): number => parseMinutes(this.draft(), 'hours') ?? 0,
  );

  /**
   * Property hours
   *
   * @description
   * Whole hours of the field.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly hours: Signal<number> = computed((): number => Math.floor(this.base() / 60));

  /**
   * Property minutes
   *
   * @description
   * Minutes beyond the hours, on two digits.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly minutes: Signal<string> = computed((): string =>
    String(this.base() % 60).padStart(2, '0'),
  );

  /**
   * Property invalid
   *
   * @description
   * Whether the field holds an unreadable duration.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly invalid: Signal<boolean> = computed(
    (): boolean => this.draft().trim() !== '' && parseMinutes(this.draft(), 'hours') === null,
  );

  /**
   * Property suggestions
   *
   * @description
   * Durations proposed, in minutes.
   *
   * @type {Signal<readonly number[]>}
   * @readonly
   */
  protected readonly suggestions: Signal<readonly number[]> = computed((): readonly number[] =>
    durationSuggestions(this.typed() ? this.draft() : '', 'hours'),
  );

  /**
   * Property settled
   *
   * @description
   * Whether the opening was applied or cancelled, so its closing applies nothing more.
   *
   * @type {boolean}
   */
  private settled: boolean = false;
  // #endregion

  // #region Methods
  /**
   * Method openChange
   *
   * @description
   * Starts from the current estimate on opening; applies the field when the panel closes
   * without having been applied or cancelled.
   *
   * @param {boolean} open - Whether the panel opens.
   */
  protected openChange(open: boolean): void {
    if (open) {
      const minutes: number | null = this.estimateMinutes();
      this.draft.set(minutes === null ? '' : formatMinutes(minutes));
      this.typed.set(false);
      this.index.set(-1);
      this.settled = false;
      this.open.set(true);
      return;
    }
    if (this.open() && !this.settled) this.commit(this.draft());
    this.open.set(false);
  }

  /**
   * Method type
   *
   * @description
   * Follows the typed text.
   *
   * @param {string} value - The field's text.
   */
  protected type(value: string): void {
    this.draft.set(value);
    this.typed.set(true);
    this.index.set(-1);
  }

  /**
   * Method key
   *
   * @description
   * ↓ and ↑ move in the suggestions in a loop, Enter applies, Escape cancels.
   *
   * @param {KeyboardEvent} event - The key.
   */
  protected key(event: KeyboardEvent): void {
    const count: number = this.suggestions().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (count === 0) return;
      const index: number = this.index();
      this.index.set(
        event.key === 'ArrowDown' ? (index + 1) % count : index <= 0 ? count - 1 : index - 1,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const picked: number | undefined =
        this.index() >= 0 ? this.suggestions().at(this.index()) : undefined;
      this.commit(picked === undefined ? this.draft() : formatMinutes(picked));
    } else if (event.key === 'Escape') {
      this.settled = true;
    }
  }

  /**
   * Method setTotal
   *
   * @description
   * Writes a stepped total in the field.
   *
   * @param {number} total - Minutes, an empty field below one.
   */
  protected setTotal(total: number): void {
    this.draft.set(total > 0 ? formatMinutes(total) : '');
    this.typed.set(false);
    this.index.set(-1);
  }

  /**
   * Method quarterDown
   *
   * @description
   * Goes down to the previous quarter of an hour.
   */
  protected quarterDown(): void {
    const base: number = this.base();
    this.setTotal(base % 15 ? base - (base % 15) : base - 15);
  }

  /**
   * Method format
   *
   * @description
   * Writes a suggestion.
   *
   * @param {number} minutes - The duration.
   * @returns {string} Its words.
   */
  protected format(minutes: number): string {
    return formatMinutes(minutes);
  }

  /**
   * Method commit
   *
   * @description
   * Applies a text and closes the panel: an empty text removes the estimate, an unreadable one
   * is rejected, an unchanged one emits nothing.
   *
   * @param {string} value - The text.
   */
  protected commit(value: string): void {
    this.settled = true;
    this.open.set(false);
    const text: string = value.trim();
    const minutes: number | null = text ? parseMinutes(text, 'hours') : null;
    if (text && minutes === null) {
      this.rejected.emit(text);
      return;
    }
    if (minutes !== this.estimateMinutes()) this.estimated.emit(minutes);
  }
  // #endregion
}
