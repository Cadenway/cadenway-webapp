import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import type { CwMenu } from '@cadenway/ui/components/menu';
import { NgIcon } from '@ng-icons/core';

import { TaskLine, type TaskSummary } from '@features/task';

import type { HomePriorityRow } from '../../../models/home-rows/home-rows.interface';

/**
 * Component HomePriorities
 *
 * @description
 * `My priorities` of the home screen (`App.dc.html` lines 1700-1715): the heading with
 * `See all my tasks` (a link to `allLink`), then one Task `cw-task-line` (`priority` variant: name
 * over `KEY · List`, due date, priority from 640 px) per row in a bordered list, or the dashed
 * empty paragraph when nothing is assigned. Each list item opens the page's task menu on right
 * click, Shift F10, the Menu key or a long press (`[cwContextMenuTriggerFor]`) and says which task
 * it opened it for (`menuOpened`); the trigger sits on the item rather than on the line, whose own
 * `opened` output would otherwise receive the menu's. A menu opened with the mouse or a long press
 * gives the focus back to its trigger, the item: the item takes it (`tabindex=-1`) and hands it to
 * the line's button, so the focus is never lost. Presentational: inputs and outputs only.
 */
@Component({
  selector: 'cw-home-priorities',
  imports: [CwButton, CwContextMenuTriggerFor, NgIcon, RouterLink, TaskLine],
  host: { class: 'block min-w-0' },
  template: `
    <section class="flex min-w-0 flex-col gap-2" aria-labelledby="home-priorities">
      <div class="flex items-center justify-between gap-3">
        <h2 id="home-priorities" class="text-base font-semibold" i18n="@@home.priorities.title">
          My priorities
        </h2>
        <a cwButton variant="ghost" size="sm" [routerLink]="allLink()">
          <ng-container i18n="@@home.priorities.all">See all my tasks</ng-container>
          <ng-icon name="phosphorArrowRightBold" class="size-3.5" aria-hidden="true" />
        </a>
      </div>
      @if (rows().length > 0) {
        <ul class="flex flex-col overflow-hidden rounded-lg border border-border">
          @for (row of rows(); track row.task.key) {
            <li
              class="border-b border-border last:border-b-0 focus:outline-none"
              tabindex="-1"
              [cwContextMenuTriggerFor]="menu()"
              (opened)="menuOpened.emit(row.task)"
              (focus)="forwardFocus($event)"
            >
              <cw-task-line
                variant="priority"
                [task]="row.task"
                [status]="row.status"
                [listName]="row.listName"
                (opened)="opened.emit($event)"
              />
            </li>
          }
        </ul>
      } @else {
        <p
          class="rounded-lg border border-dashed border-input p-6 text-center text-sm text-muted-foreground"
          data-testid="home-priorities-empty"
          i18n="@@home.priorities.empty"
        >
          Nothing is assigned to you. A good moment to move the backlog forward.
        </p>
      }
    </section>
  `,
})
export class HomePriorities {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The lines, seven at most; empty for the empty paragraph.
   *
   * @type {InputSignal<readonly HomePriorityRow[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly HomePriorityRow[]> =
    input.required<readonly HomePriorityRow[]>();

  /**
   * Property allLink
   *
   * @description
   * The address of `My tasks` (`/<slug>/my-tasks`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly allLink: InputSignal<string> = input.required<string>();

  /**
   * Property menu
   *
   * @description
   * The page's task menu (`TaskMenu.menu()`), opened from each line.
   *
   * @type {InputSignal<CwMenu>}
   * @readonly
   */
  public readonly menu: InputSignal<CwMenu> = input.required<CwMenu>();

  /**
   * Property opened
   *
   * @description
   * Emits the task of a clicked or activated line.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<TaskSummary> = output<TaskSummary>();

  /**
   * Property menuOpened
   *
   * @description
   * Emits the task whose line opened the menu, as it opens.
   *
   * @type {OutputEmitterRef<TaskSummary>}
   * @readonly
   */
  public readonly menuOpened: OutputEmitterRef<TaskSummary> = output<TaskSummary>();
  // #endregion

  // #region Methods
  /**
   * Method forwardFocus
   *
   * @description
   * Hands the focus an item received itself (the menu closing) to the line's button; the focus
   * of the button bubbling through the item is left alone.
   *
   * @param {FocusEvent} event - The item's focus event.
   */
  protected forwardFocus(event: FocusEvent): void {
    if (event.target !== event.currentTarget || !(event.currentTarget instanceof HTMLElement))
      return;
    event.currentTarget.querySelector<HTMLButtonElement>('button')?.focus();
  }
  // #endregion
}
