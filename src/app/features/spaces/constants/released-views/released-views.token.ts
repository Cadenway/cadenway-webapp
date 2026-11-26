import { InjectionToken } from '@angular/core';

import type { ReleasedViews } from '../../models/released-views/released-views.interface';
import { RELEASED_LAYOUTS, RELEASED_LIST_DIALOGS } from './released-views.constants';

/**
 * Constant RELEASED_VIEWS
 *
 * @description
 * The released layouts and header dialogs (`RELEASED_LAYOUTS`, `RELEASED_LIST_DIALOGS`), read by
 * the list page and the view routes' guard. Specs provide another value to reach a layout that
 * is not released yet; the application never overrides it.
 *
 * @type {InjectionToken<ReleasedViews>}
 */
export const RELEASED_VIEWS: InjectionToken<ReleasedViews> = new InjectionToken<ReleasedViews>(
  'RELEASED_VIEWS',
  {
    providedIn: 'root',
    factory: (): ReleasedViews => ({
      layouts: RELEASED_LAYOUTS,
      dialogs: RELEASED_LIST_DIALOGS,
    }),
  },
);
