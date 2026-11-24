import { InjectionToken } from '@angular/core';

import type { WorkspaceContextPort } from './workspace-context-port.interface';

/**
 * Constant WORKSPACE_CONTEXT
 *
 * @description
 * The workspace context of the enclosing `/:org` route. It is provided only inside that route:
 * inject it as optional from code that may also run outside a workspace.
 *
 * @type {InjectionToken<WorkspaceContextPort>}
 */
export const WORKSPACE_CONTEXT: InjectionToken<WorkspaceContextPort> =
  new InjectionToken<WorkspaceContextPort>('WORKSPACE_CONTEXT');
