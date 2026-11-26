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

import type { Person } from '../../../models/person/person.interface';
import { peopleOf } from '../task-property-assignees/task-property-assignees.component';

/**
 * Component TaskPropertyWatchers
 *
 * @description
 * The `Followers` row of the task detail's properties (`App.dc.html` lines 2538-2547): the
 * trigger shows the followers' initials (the creator and the assignees by default, with each
 * person's choice); it opens the `Followers` menu, `Notified of every change`, with the people
 * and a checkbox each, the caller marked `(me)`. Each tick emits `toggled` with the account. A
 * failed read shows the error with `Retry` (`retried`).
 */
@Component({
  selector: 'cw-task-property-watchers',
  imports: [CwMenu, CwMenuItem, CwMenuItemCheckbox, CwMenuLabel, CwMenuTriggerFor],
  template: `
    <button
      type="button"
      class="relative isolate flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
      [disabled]="disabled()"
      [cwMenuTriggerFor]="menu"
      data-testid="task-property-watchers"
    >
      @if (watchers().length > 0) {
        <span class="flex -space-x-1.5" aria-hidden="true">
          @for (person of watchers(); track person.id) {
            <span
              class="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] leading-none font-semibold text-secondary-foreground ring-2 ring-popover"
              [title]="person.name"
              >{{ person.initials }}</span
            >
          }
        </span>
        <span class="sr-only">{{ names() }}</span>
      } @else {
        <span class="text-muted-foreground" i18n="@@task.properties.empty">Empty</span>
      }
    </button>
    <cw-menu
      #menu
      side="top"
      align="end"
      ariaLabel="Followers"
      i18n-ariaLabel="@@task.properties.watchers"
    >
      <cw-menu-label i18n="@@task.properties.watchers-hint">Notified of every change</cw-menu-label>
      @if (failed()) {
        <span role="alert" class="block px-2 py-1.5 text-sm" i18n="@@task.create.read-failed"
          >Could not load this information.</span
        >
        <button cwMenuItem type="button" (triggered)="retried.emit()" i18n="@@task.retry">
          Retry
        </button>
      } @else {
        @for (person of people() ?? []; track person.id) {
          <button
            cwMenuItemCheckbox
            type="button"
            [disabled]="watcherIds() === null"
            [checked]="(watcherIds() ?? []).includes(person.id)"
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
export class TaskPropertyWatchers {
  // #region Properties
  /**
   * Property watcherIds
   *
   * @description
   * Accounts that follow the task, null while read.
   *
   * @type {InputSignal<readonly string[] | null>}
   * @readonly
   */
  public readonly watcherIds: InputSignal<readonly string[] | null> = input<
    readonly string[] | null
  >(null);

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
   * Whether reading the watchers or the people failed.
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
   * A person ticked or unticked: their account.
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
   * Property watchers
   *
   * @description
   * The people who follow the task.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  protected readonly watchers: Signal<readonly Person[]> = computed((): readonly Person[] =>
    peopleOf(this.watcherIds() ?? [], this.people()),
  );

  /**
   * Property names
   *
   * @description
   * Every follower's name, read by screen readers.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly names: Signal<string> = computed((): string =>
    this.watchers()
      .map((person: Person) => person.name)
      .join(', '),
  );
  // #endregion
}
