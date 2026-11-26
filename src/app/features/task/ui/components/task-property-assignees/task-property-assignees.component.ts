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
import { initialsOf } from '../../../utils/person/person.util';

/**
 * Constant SHOWN_ASSIGNEES
 *
 * @description
 * Initials drawn on the trigger before `+N`.
 *
 * @type {number}
 */
export const SHOWN_ASSIGNEES: number = 5;

/**
 * Function peopleOf
 *
 * @description
 * The people of some accounts, in their order; an account missing from the members (a former
 * member) reads as `Unknown member`.
 *
 * @param {readonly string[]} ids - The accounts.
 * @param {readonly Person[] | null} people - The members read.
 * @returns {readonly Person[]} The people.
 */
export function peopleOf(
  ids: readonly string[],
  people: readonly Person[] | null,
): readonly Person[] {
  const byId: Map<string, Person> = new Map<string, Person>(
    (people ?? []).map((person: Person) => [person.id, person]),
  );
  return ids.map((id: string): Person => {
    const known: Person | undefined = byId.get(id);
    if (known) return known;
    const name: string = $localize`:@@task.properties.unknown-member:Unknown member`;
    return { id, name, initials: initialsOf(name), avatar: null };
  });
}

/**
 * Component TaskPropertyAssignees
 *
 * @description
 * The `Assignees` row of the task detail's properties (`App.dc.html` lines 2392-2405): a trigger
 * with up to `SHOWN_ASSIGNEES` initials and `+N` (titled with the other names), every name for
 * screen readers, or `Empty`; it opens the `Assignees` menu of people with a checkbox each, the
 * caller marked `(me)`, which stays open while people are ticked. Each tick emits `toggled` with
 * the account; the container writes it. A failed read of the people shows the error with
 * `Retry` (`retried`); `disabled` (no `edit` role) keeps the trigger but opens nothing.
 */
@Component({
  selector: 'cw-task-property-assignees',
  imports: [CwMenu, CwMenuItem, CwMenuItemCheckbox, CwMenuLabel, CwMenuTriggerFor],
  template: `
    <button
      type="button"
      class="relative isolate flex min-h-8 w-full flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden rounded-md border border-transparent px-2 py-1 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none aria-expanded:bg-selected"
      [disabled]="disabled()"
      [cwMenuTriggerFor]="menu"
      data-testid="task-property-assignees"
    >
      @if (assignees().length > 0) {
        <span class="flex -space-x-1.5" aria-hidden="true">
          @for (person of shown(); track person.id) {
            <span
              class="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] leading-none font-semibold text-secondary-foreground ring-2 ring-popover"
              [title]="person.name"
              >{{ person.initials }}</span
            >
          }
          @if (more() > 0) {
            <span
              class="flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] leading-none font-semibold text-muted-foreground tabular-nums ring-2 ring-popover"
              [title]="moreNames()"
              >+{{ more() }}</span
            >
          }
        </span>
        <span class="sr-only">{{ names() }}</span>
      } @else {
        <span class="text-muted-foreground" i18n="@@task.properties.empty">Empty</span>
      }
    </button>
    <cw-menu #menu align="end" ariaLabel="Assignees" i18n-ariaLabel="@@task.properties.assignees">
      @if (failed()) {
        <span role="alert" class="block px-2 py-1.5 text-sm" i18n="@@task.create.read-failed"
          >Could not load this information.</span
        >
        <button cwMenuItem type="button" (triggered)="retried.emit()">
          <ng-container i18n="@@task.retry">Retry</ng-container>
        </button>
      } @else if (people() === null) {
        <cw-menu-label i18n="@@task.properties.people-loading">Loading the people</cw-menu-label>
      } @else {
        @for (person of people(); track person.id) {
          <button
            cwMenuItemCheckbox
            type="button"
            [checked]="assigneeIds().includes(person.id)"
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
export class TaskPropertyAssignees {
  // #region Properties
  /**
   * Property assigneeIds
   *
   * @description
   * Accounts assigned, in order.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly assigneeIds: InputSignal<readonly string[]> = input<readonly string[]>([]);

  /**
   * Property people
   *
   * @description
   * Members who can be assigned, null while they are read.
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
   * Whether reading the people failed.
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
   * `Retry` after a failed read of the people.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property assignees
   *
   * @description
   * The people assigned.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  protected readonly assignees: Signal<readonly Person[]> = computed((): readonly Person[] =>
    peopleOf(this.assigneeIds(), this.people()),
  );

  /**
   * Property shown
   *
   * @description
   * The people drawn as initials.
   *
   * @type {Signal<readonly Person[]>}
   * @readonly
   */
  protected readonly shown: Signal<readonly Person[]> = computed((): readonly Person[] =>
    this.assignees().slice(0, SHOWN_ASSIGNEES),
  );

  /**
   * Property more
   *
   * @description
   * People beyond those drawn.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly more: Signal<number> = computed((): number =>
    Math.max(0, this.assignees().length - SHOWN_ASSIGNEES),
  );

  /**
   * Property moreNames
   *
   * @description
   * Names of the people beyond those drawn, the title of `+N`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly moreNames: Signal<string> = computed((): string =>
    this.assignees()
      .slice(SHOWN_ASSIGNEES)
      .map((person: Person) => person.name)
      .join(', '),
  );

  /**
   * Property names
   *
   * @description
   * Every name, read by screen readers.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly names: Signal<string> = computed((): string =>
    this.assignees()
      .map((person: Person) => person.name)
      .join(', '),
  );
  // #endregion
}
