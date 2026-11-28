import { TestBed } from '@angular/core/testing';
import { ShellOverlay } from '@shared/layout-slot';
import { beforeEach, describe, expect, it } from 'vitest';

import { COMMAND_PALETTE_LAUNCHER } from '../../ports/command-palette-launcher/command-palette-launcher.token';
import { CommandPalette } from '../../services/command-palette/command-palette.service';
import { provideCommandPaletteLauncher } from './search.provider';

describe('provideCommandPaletteLauncher', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideCommandPaletteLauncher()] });
  });

  it('opens the command palette', () => {
    const palette: CommandPalette = TestBed.inject(CommandPalette);

    TestBed.inject(COMMAND_PALETTE_LAUNCHER).open();

    expect(palette.isOpen()).toBe(true);
  });

  it('leaves another shell overlay open instead of opening over it', () => {
    const overlay: ShellOverlay = TestBed.inject(ShellOverlay);
    overlay.open('workspace.shortcuts-dialog');

    TestBed.inject(COMMAND_PALETTE_LAUNCHER).open();

    expect(TestBed.inject(CommandPalette).isOpen()).toBe(false);
    expect(overlay.isOpen('workspace.shortcuts-dialog')).toBe(true);
  });
});
