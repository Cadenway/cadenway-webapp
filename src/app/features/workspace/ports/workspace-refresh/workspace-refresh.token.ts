import { InjectionToken } from '@angular/core';

import type { WorkspaceRefreshPort } from './workspace-refresh-port.interface';

/**
 * Constant WORKSPACE_REFRESH
 *
 * @description
 * Asks the enclosing `/:org` route to verify its workspace again. It is provided only inside that
 * route, next to `WORKSPACE_CONTEXT`.
 *
 * @type {InjectionToken<WorkspaceRefreshPort>}
 */
export const WORKSPACE_REFRESH: InjectionToken<WorkspaceRefreshPort> =
  new InjectionToken<WorkspaceRefreshPort>('WORKSPACE_REFRESH');
