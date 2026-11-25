import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwMenu,
  CwMenuItem,
  CwMenuLabel,
  CwMenuShortcut,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { NgIcon } from '@ng-icons/core';

import type { ViewOption } from '../../../models/view-option/view-option.interface';

/**
 * Interface MoveTarget
 *
 * @description
 * A list the selection may move to, with its space.
 */
export interface MoveTarget {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * Destination list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property name
   *
   * @description
   * List name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property spaceName
   *
   * @description
   * Its space's name.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceName: string;
  // #endregion
}

/**
 * Component BulkBar
 *
 * @description
 * The selection bar of a list view (`App.dc.html` lines 1451-1480): « n sélectionnée(s) »,
 * « Marquer terminé », « Assigner » (a menu of people), « Déplacer vers… » (a menu of the other
 * lists with their space), « Supprimer » and the cross that clears the selection, in a toolbar
 * named « Actions sur la sélection ». Presentational: the rows pass owns the selection and the page
 * runs the actions; nothing renders without a selection.
 */
@Component({
  selector: 'cw-bulk-bar',
  imports: [CwButton, CwMenu, CwMenuItem, CwMenuLabel, CwMenuShortcut, CwMenuTriggerFor, NgIcon],
  template: `
    @if (count() > 0) {
      <div
        role="toolbar"
        aria-label="Actions on the selection"
        i18n-aria-label="@@spaces.bulk.label"
        class="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-popover p-1.5 shadow-lg animate-pop-in motion-reduce:animate-none"
        data-testid="bulk-bar"
      >
        <span
          class="shrink-0 px-2 text-sm font-medium whitespace-nowrap tabular-nums"
          i18n="@@spaces.bulk.count"
          >{count(), plural, =1 {1 selected} other {{{ count() }} selected}}</span
        >
        <span class="mx-1 h-5 w-px bg-border" aria-hidden="true"></span>
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
      @for (person of people(); track person.value) {
        <button cwMenuItem (triggered)="assigned.emit(person.value)">{{ person.label }}</button>
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
        <button cwMenuItem (triggered)="moved.emit(target.listId)">
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
   * People the selection may be assigned to, by account id.
   *
   * @type {InputSignal<readonly ViewOption[]>}
   * @readonly
   */
  public readonly people: InputSignal<readonly ViewOption[]> = input<readonly ViewOption[]>([]);

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
   * Whether an action is being recorded.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input(false);

  /**
   * Property doneMarked
   *
   * @description
   * Emits on « Marquer terminé ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly doneMarked: OutputEmitterRef<void> = output();

  /**
   * Property assigned
   *
   * @description
   * Emits the account the selection is assigned to.
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
   * Emits on « Supprimer ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly deleted: OutputEmitterRef<void> = output();

  /**
   * Property cleared
   *
   * @description
   * Emits on « Annuler la sélection ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly cleared: OutputEmitterRef<void> = output();
  // #endregion
}
