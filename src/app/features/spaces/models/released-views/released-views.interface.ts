import type { ListDialog } from '../list-dialog/list-dialog.type';
import type { ViewLayout } from '../saved-view/saved-view.interface';

/**
 * Interface ReleasedViews
 *
 * @description
 * What the list frame offers: the layouts with a tab and a reachable route, and the header's
 * dialogs with an opener. Anything else stays built but unreachable.
 */
export interface ReleasedViews {
  // #region Properties
  /**
   * Property layouts
   *
   * @description
   * Released layouts; `list` is always one of them.
   *
   * @type {readonly ViewLayout[]}
   * @readonly
   */
  readonly layouts: readonly ViewLayout[];

  /**
   * Property dialogs
   *
   * @description
   * Released header dialogs.
   *
   * @type {readonly ListDialog[]}
   * @readonly
   */
  readonly dialogs: readonly ListDialog[];
  // #endregion
}
