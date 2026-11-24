import { InjectionToken } from '@angular/core';

import type { ShellSidebar } from '../models/shell-sidebar.interface';

/**
 * Constant SHELL_SIDEBAR
 *
 * @description
 * Port to the collapsible sidebar of the hosting shell, provided by the shell component for its
 * routed screens. Inject it as optional: a screen outside such a shell gets `null`.
 *
 * @type {InjectionToken<ShellSidebar>}
 */
export const SHELL_SIDEBAR: InjectionToken<ShellSidebar> = new InjectionToken<ShellSidebar>(
  'SHELL_SIDEBAR',
);
