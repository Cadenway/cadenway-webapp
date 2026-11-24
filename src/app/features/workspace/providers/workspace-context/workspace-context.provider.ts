import { inject, type Provider } from '@angular/core';

import type { WorkspaceContextPort } from '../../ports/workspace-context/workspace-context-port.interface';
import { WORKSPACE_CONTEXT } from '../../ports/workspace-context/workspace-context.token';
import { WorkspaceContextStore } from '../../state/workspace-context/workspace-context.store';

/**
 * Function provideWorkspaceContext
 *
 * @description
 * Provides the route-scoped `WorkspaceContextStore` and publishes it as `WORKSPACE_CONTEXT`. Give
 * it to the `/:org` route only, so the guards, the resolver, the shell and the screens of one
 * workspace share one context.
 *
 * @returns {Provider[]} The store and its port.
 */
export function provideWorkspaceContext(): Provider[] {
  return [
    WorkspaceContextStore,
    {
      provide: WORKSPACE_CONTEXT,
      useFactory: (): WorkspaceContextPort => inject(WorkspaceContextStore),
    },
  ];
}
