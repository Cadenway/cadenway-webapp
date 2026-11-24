import { formatDate } from '@angular/common';
import { Component, computed, inject, LOCALE_ID, type Signal } from '@angular/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

/**
 * Component HomePage
 *
 * @description
 * The home screen of a workspace (mockup `App.dc.html` lines 1683-1690): today's date in the
 * application locale and the greeting with the signed-in person's first name. The greeting is the
 * route focus target. The statistics, the task groups and « Créer une tâche » come with the home
 * screen step.
 */
@Component({
  selector: 'cw-home-page',
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  templateUrl: './home-page.component.html',
})
export class HomePage {
  // #region Properties
  /**
   * Property workspace
   *
   * @description
   * Workspace context of the enclosing `/:org` route.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property firstName
   *
   * @description
   * First name of the signed-in person, greeted by the heading.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly firstName: Signal<string> = computed(
    (): string => this.workspace.user().firstName,
  );

  /**
   * Property today
   *
   * @description
   * Weekday, day and month of the day the page opened, in the application locale, capitalized as
   * the mockup's « Dimanche 8 novembre ».
   *
   * @type {string}
   * @readonly
   */
  protected readonly today: string = capitalize(
    formatDate(Date.now(), 'EEEE d MMMM', inject(LOCALE_ID)),
  );
  // #endregion
}

/**
 * Function capitalize
 *
 * @description
 * Uppercases the first character of a formatted date, since French weekday names are lowercase.
 *
 * @param {string} text - Formatted date.
 * @returns {string} The text with an uppercase first character.
 */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
