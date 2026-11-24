import { formatDate } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { CwAlert, CwAlertDescription } from '@cadenway/ui/components/alert';

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
 * screen step. `?notice=logo-upload-failed`, set by Auth after an organization creation whose logo
 * could not be uploaded, shows a dismissible notice pointing to the organization settings.
 */
@Component({
  selector: 'cw-home-page',
  imports: [CwAlert, CwAlertDescription],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  templateUrl: './home-page.component.html',
})
export class HomePage {
  // #region Properties
  /**
   * Property notice
   *
   * @description
   * The `?notice=` query parameter; only `logo-upload-failed` is known.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly notice: InputSignal<string | undefined> = input<string | undefined>();

  /**
   * Property noticeDismissed
   *
   * @description
   * Whether the person closed the notice.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly noticeDismissed: WritableSignal<boolean> = signal(false);

  /**
   * Property logoFailed
   *
   * @description
   * Whether to tell the person the new organization's logo could not be uploaded.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly logoFailed: Signal<boolean> = computed(
    (): boolean => this.notice() === 'logo-upload-failed' && !this.noticeDismissed(),
  );

  /**
   * Property closeLabel
   *
   * @description
   * Accessible name of the notice's close button.
   *
   * @type {string}
   * @readonly
   */
  protected readonly closeLabel: string = $localize`:@@home.notice.close:Close`;

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
