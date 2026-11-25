import { computed, inject, type Signal } from '@angular/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

/**
 * Function injectOrganizationSlug
 *
 * @description
 * Follows the committed workspace organization for links.
 *
 * @returns {Signal<string>} The committed organization slug.
 */
export function injectOrganizationSlug(): Signal<string> {
  const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
  return computed((): string => workspace.organization().slug);
}
