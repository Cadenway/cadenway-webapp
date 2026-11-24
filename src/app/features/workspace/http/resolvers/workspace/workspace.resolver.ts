import { inject } from '@angular/core';
import { RedirectCommand, type ResolveFn, Router } from '@angular/router';

import type { WorkspaceContext } from '../../../models/workspace-context/workspace-context.interface';
import { organizationChoiceRedirect } from '../../../navigation/access-redirect/access-redirect.util';
import { WorkspaceContextStore } from '../../../state/workspace-context/workspace-context.store';

/**
 * Function workspaceResolver
 *
 * @description
 * Commits the person and the organization the session and organization guards verified into
 * `WorkspaceContextStore`, without reading the gateway again, before the shell and the screens are
 * created. When a guard did not verify a value for this navigation, it goes to the organization
 * choice with a `RedirectCommand`.
 *
 * @returns {WorkspaceContext | RedirectCommand} The committed context, or the redirect.
 */
export const workspaceResolver: ResolveFn<WorkspaceContext> = ():
  WorkspaceContext | RedirectCommand => {
  const context: WorkspaceContext | null = inject(WorkspaceContextStore).commit();
  return context ?? new RedirectCommand(organizationChoiceRedirect(inject(Router)));
};
