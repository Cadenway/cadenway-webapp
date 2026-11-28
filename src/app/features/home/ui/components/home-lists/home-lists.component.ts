import { Component, input, type InputSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';

import type { HomeListRow } from '../../../models/home-rows/home-rows.interface';
import { takesSingular } from '../../../utils/plural/plural.util';

/**
 * Constant OPEN_ONE
 *
 * @description
 * What screen readers read after a list's count, singular (the stat hint's words).
 *
 * @type {string}
 */
const OPEN_ONE: string = $localize`:@@home.stats.assigned-hint.one:open task`;

/**
 * Constant OPEN_OTHER
 *
 * @description
 * What screen readers read after a list's count, plural (the stat hint's words).
 *
 * @type {string}
 */
const OPEN_OTHER: string = $localize`:@@home.stats.assigned-hint.other:open tasks`;

/**
 * Component HomeLists
 *
 * @description
 * `Lists` of the home screen's aside (`App.dc.html` lines 1735-1742): a heading, then one link per
 * list, with the list icon, the list's name, its space's name and its open tasks, read by
 * screen readers as `name, space, count open task(s)`. Presentational: one input; the page hides the
 * section when the organization has no list.
 */
@Component({
  selector: 'cw-home-lists',
  imports: [NgIcon, RouterLink],
  host: { class: 'block' },
  template: `
    <section class="flex flex-col gap-2" aria-labelledby="home-lists">
      <h2 id="home-lists" class="text-base font-semibold" i18n="@@home.lists.title">Lists</h2>
      <ul class="flex flex-col gap-px">
        @for (row of rows(); track row.id) {
          <li>
            <a
              class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
              [routerLink]="row.link"
              data-testid="home-list"
            >
              <ng-icon
                name="phosphorListBulletsBold"
                size="1rem"
                class="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span class="truncate">{{ row.name }}</span>
              @if (row.spaceName) {
                <span class="sr-only">, </span>
                <span class="truncate text-xs text-muted-foreground">{{ row.spaceName }}</span>
              }
              <span class="sr-only">, </span>
              <span class="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums"
                >{{ row.open }}<span class="sr-only"> {{ openWord(row.open) }}</span></span
              >
            </a>
          </li>
        }
      </ul>
    </section>
  `,
})
export class HomeLists {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The lists, never empty.
   *
   * @type {InputSignal<readonly HomeListRow[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly HomeListRow[]> =
    input.required<readonly HomeListRow[]>();
  // #endregion

  // #region Methods
  /**
   * Method openWord
   *
   * @description
   * The words read after a count of open tasks, in its plural form.
   *
   * @param {number} count - The count.
   * @returns {string} The words.
   */
  protected openWord(count: number): string {
    return takesSingular(count) ? OPEN_ONE : OPEN_OTHER;
  }
  // #endregion
}
