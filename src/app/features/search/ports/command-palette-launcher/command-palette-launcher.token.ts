import { InjectionToken } from '@angular/core';

import type { CommandPaletteLauncherPort } from './command-palette-launcher-port.interface';

/**
 * Constant COMMAND_PALETTE_LAUNCHER
 *
 * @description
 * Opens the command palette, provided on `/:org` by `provideCommandPaletteLauncher()`, where every
 * shell renders the palette. Inject it as optional: outside a workspace there is no palette to
 * open, and a caller leaves out what would open it.
 *
 * @type {InjectionToken<CommandPaletteLauncherPort>}
 */
export const COMMAND_PALETTE_LAUNCHER: InjectionToken<CommandPaletteLauncherPort> =
  new InjectionToken<CommandPaletteLauncherPort>('COMMAND_PALETTE_LAUNCHER');
