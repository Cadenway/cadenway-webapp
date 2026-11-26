import { Component } from '@angular/core';
import {
  CwEmpty,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { NgIcon } from '@ng-icons/core';

import { layoutLabels } from '../../../constants/view-labels/view-labels.constants';
import { layoutIconName } from '../../../utils/look/look.util';

/**
 * Component BoardViewPage
 *
 * @description
 * The `Board` view at `/:org/l/:listId/board`, below the list frame. A stub until the
 * view's package builds it: it says the view is not available yet. The route opens only once the
 * lead adds `board` to `RELEASED_LAYOUTS`; until then it falls back to `list`.
 */
@Component({
  selector: 'cw-board-view-page',
  imports: [CwEmpty, CwEmptyDescription, CwEmptyHeader, CwEmptyMedia, CwEmptyTitle, NgIcon],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './board-view-page.component.html',
})
export class BoardViewPage {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Name of the layout.
   *
   * @type {string}
   * @readonly
   */
  protected readonly name: string = layoutLabels().board;

  /**
   * Property icon
   *
   * @description
   * Icon of the layout.
   *
   * @type {string}
   * @readonly
   */
  protected readonly icon: string = layoutIconName('board');
  // #endregion
}
