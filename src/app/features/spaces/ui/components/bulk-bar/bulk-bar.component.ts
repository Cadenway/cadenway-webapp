import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwMenu,
  CwMenuItem,
  CwMenuItemCheckbox,
  CwMenuLabel,
  CwMenuShortcut,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { NgIcon } from '@ng-icons/core';

import type { MoveTarget } from '../../../models/view-task-write/view-task-write.interface';

export type { MoveTarget } from '../../../models/view-task-write/view-task-write.interface';

/**
 * Interface BulkPerson
 *
 * @description
 * A person of `Assign`, ticked when every selected task has them.
 */
export interface BulkPerson {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Account id.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Display name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property initials
   *
   * @description
   * Initials of the avatar.
   *
   * @type {string}
   * @readonly
   */
  readonly initials: string;

  /**
   * Property assigned
   *
   * @description
   * Whether every selected task has the person.
   *
   * @type {boolean}
   * @readonly
   */
  readonly assigned: boolean;
  // #endregion
}

/**
 * Component BulkBar
 *
 * @description
 * The selection bar of a list view (`App.dc.html` lines 1451-1480): `n selected`,
 * `Mark done`, `Assign` (people with their initials, ticked when every selected task
 * has them; picking a ticked person removes them), `Move to…` (the other lists with their
 * icon and space), `Delete` and the cross that clears the selection, in a toolbar named
 * `Actions on the selection` that scrolls sideways without a scrollbar on a narrow screen.
 * Presentational: the page owns the selection and runs the actions; nothing renders without a
 * selection.
 */
@Component({
  selector: 'cw-bulk-bar',
  imports: [
    CwButton,
    CwMenu,
    CwMenuItem,
    CwMenuItemCheckbox,
    CwMenuLabel,
    CwMenuShortcut,
    CwMenuTriggerFor,
    NgIcon,
  ],
  template: `
    @if (count() > 0) {
      <div
        role="toolbar"
        aria-label="Actions on the selection"
        i18n-aria-label="@@spaces.bulk.label"
        class="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-popover p-1 whitespace-nowrap text-popover-foreground shadow-lg [scrollbar-width:none] animate-pop-in motion-reduce:animate-none [&::-webkit-scrollbar]:hidden"
        data-testid="bulk-bar"
      >
        <span
          class="shrink-0 px-2 text-sm font-medium whitespace-nowrap tabular-nums"
          i18n="@@spaces.bulk.count"
          >{count(), plural, =1 {1 selected} other {{{ count() }} selected}}</span
        >
        <span class="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true"></span>
        <button
          cwButton
          type="button"
          variant="ghost"
          size="sm"
          [disabled]="pending()"
          (click)="doneMarked.emit()"
        >
          <ng-icon name="phosphorCheckCircleBold" aria-hidden="true" />
          <ng-container i18n="@@spaces.bulk.done">Mark done</ng-container>
        </button>
        <button
          cwButton
          type="button"
          variant="ghost"
          size="sm"
          [disabled]="pending() || people().length === 0"
          [cwMenuTriggerFor]="assignMenu"
        >
          <ng-icon name="phosphorUserBold" aria-hidden="true" />
          <ng-container i18n="@@spaces.bulk.assign">Assign</ng-container>
        </button>
        <button
          cwButton
          type="button"
          variant="ghost"
          size="sm"
          [disabled]="pending() || targets().length === 0"
          [cwMenuTriggerFor]="moveMenu"
        >
          <ng-icon name="phosphorFolderSimpleBold" aria-hidden="true" />
          <ng-container i18n="@@spaces.bulk.move">Move to…</ng-container>
        </button>
        <button
          cwButton
          type="button"
          variant="ghost"
          size="sm"
          class="text-destructive"
          [disabled]="pending()"
          (click)="deleted.emit()"
        >
          <ng-icon name="phosphorTrashBold" aria-hidden="true" />
          <ng-container i18n="@@spaces.bulk.delete">Delete</ng-container>
        </button>
        <button
          cwButton
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cancel the selection"
          i18n-aria-label="@@spaces.bulk.clear"
          (click)="cleared.emit()"
        >
          <ng-icon name="phosphorXBold" aria-hidden="true" />
        </button>
      </div>
    }

    <cw-menu
      #assignMenu
      side="top"
      ariaLabel="Assign the selection"
      i18n-ariaLabel="@@spaces.bulk.assign-menu"
    >
      <cw-menu-label i18n="@@spaces.bulk.assign-title">Assign to</cw-menu-label>
      @for (person of people(); track person.id) {
        <button
          cwMenuItemCheckbox
          type="button"
          [checked]="person.assigned"
          (checkedChange)="assigned.emit(person.id)"
        >
          <span
            class="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] leading-none font-semibold text-secondary-foreground"
            aria-hidden="true"
            >{{ person.initials }}</span
          >
          <span class="truncate">{{ person.name }}</span>
        </button>
      }
    </cw-menu>

    <cw-menu
      #moveMenu
      side="top"
      ariaLabel="Move the selection"
      i18n-ariaLabel="@@spaces.bulk.move-menu"
    >
      <cw-menu-label i18n="@@spaces.bulk.move-title">Move to the list</cw-menu-label>
      @for (target of targets(); track target.listId) {
        <button cwMenuItem type="button" (triggered)="moved.emit(target.listId)">
          <ng-icon name="phosphorListBulletsBold" aria-hidden="true" />
          <span class="truncate">{{ target.name }}</span>
          <cw-menu-shortcut>{{ target.spaceName }}</cw-menu-shortcut>
        </button>
      }
    </cw-menu>
  `,
})
export class BulkBar {
  // #region Properties
  /**
   * Property count
   *
   * @description
   * Selected tasks.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly count: InputSignal<number> = input(0);

  /**
   * Property people
   *
   * @description
   * People the selection may be assigned to or removed from.
   *
   * @type {InputSignal<readonly BulkPerson[]>}
   * @readonly
   */
  public readonly people: InputSignal<readonly BulkPerson[]> = input<readonly BulkPerson[]>([]);

  /**
   * Property targets
   *
   * @description
   * Lists the selection may move to.
   *
   * @type {InputSignal<readonly MoveTarget[]>}
   * @readonly
   */
  public readonly targets: InputSignal<readonly MoveTarget[]> = input<readonly MoveTarget[]>([]);

  /**
   * Property pending
   *
   * @description
   * Whether a deletion is being recorded.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input(false);

  /**
   * Property doneMarked
   *
   * @description
   * Emits on `Mark done`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly doneMarked: OutputEmitterRef<void> = output();

  /**
   * Property assigned
   *
   * @description
   * Emits the account picked in `Assign`: the page assigns it, or removes it when every
   * selected task has it.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly assigned: OutputEmitterRef<string> = output<string>();

  /**
   * Property moved
   *
   * @description
   * Emits the destination list.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly moved: OutputEmitterRef<string> = output<string>();

  /**
   * Property deleted
   *
   * @description
   * Emits on `Delete`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly deleted: OutputEmitterRef<void> = output();

  /**
   * Property cleared
   *
   * @description
   * Emits on `Cancel the selection`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly cleared: OutputEmitterRef<void> = output();
  // #endregion
}
