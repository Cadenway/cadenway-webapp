import { Component, input, type InputSignal, type OnInit } from '@angular/core';

/**
 * Component TaskLinkPage
 *
 * @description
 * What the deep link of a task (`/:org/t/:taskKey`) renders when `taskLinkResolver` could not
 * read the task: it throws the resolved typed route error when it starts, so the router's error
 * boundary renders the not-found, deleted-task (`Restore the task`) or unavailable (`Retry`) state
 * at the task's address. A readable task never reaches it: the resolver redirects to its list.
 */
@Component({
  selector: 'cw-task-link-page',
  template: '',
})
export class TaskLinkPage implements OnInit {
  // #region Properties
  /**
   * Property failure
   *
   * @description
   * Why the task could not be read, resolved by `taskLinkResolver` (route `data.failure`).
   *
   * @type {InputSignal<Error>}
   * @readonly
   */
  public readonly failure: InputSignal<Error> = input.required<Error>();
  // #endregion

  // #region Methods
  /**
   * Method ngOnInit
   *
   * @description
   * Hands the failure to the route's error boundary.
   *
   * @throws {Error} The resolved failure, always.
   */
  public ngOnInit(): void {
    throw this.failure();
  }
  // #endregion
}
