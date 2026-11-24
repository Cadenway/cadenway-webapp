import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CwToastService } from '@cadenway/ui/components/toast';
import { type Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ThemeService } from '@core/theme';
import { SignOut } from '@features/auth';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import { ShellOverlay } from '@shared/layout-slot';

import { SearchApi } from '../../../data-access/services/search-api/search-api.service';
import type { SearchResult } from '../../../models/search-result/search-result.interface';
import { CommandPalette } from '../../../services/command-palette/command-palette.service';
import { CommandPaletteDialog } from './command-palette.component';

/**
 * Constant workspace
 *
 * @description
 * Atelier Nord, the mockup's organization, as the workspace port shows it.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u1',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: () => true,
};

/**
 * Function optionNamed
 *
 * @description
 * Finds an option of the open palette by its text.
 *
 * @param {string} text - Text the option contains.
 * @returns {HTMLElement | undefined} The option.
 */
function optionNamed(text: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (option: HTMLElement) => option.textContent.includes(text),
  );
}

describe('CommandPaletteDialog', () => {
  let search: Mock<(query: string) => Observable<readonly SearchResult[]>>;
  let navigate: Mock<(commands: readonly unknown[]) => Promise<boolean>>;
  let run: Mock<() => Promise<boolean>>;
  let toggle: Mock<() => void>;
  let fixture: ComponentFixture<CommandPaletteDialog>;

  beforeEach(async () => {
    search = vi.fn(() =>
      of([{ kind: 'task', key: 'CAD-482', name: 'Relecture du parcours SSO', status: 'review' }]),
    );
    navigate = vi.fn(() => Promise.resolve(true));
    run = vi.fn(() => Promise.resolve(true));
    toggle = vi.fn();
    TestBed.configureTestingModule({
      imports: [CommandPaletteDialog],
      providers: [
        { provide: SearchApi, useValue: { search } },
        { provide: Router, useValue: { navigate, navigateByUrl: navigate } },
        { provide: SignOut, useValue: { run } },
        { provide: ThemeService, useValue: { resolved: () => 'light', toggle } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: CwToastService, useValue: { error: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(CommandPaletteDialog);
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.inject(CommandPalette).setOpen(false);
    localStorage.clear();
  });

  it('opens with Ctrl K and goes home from « Aller à »', async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await fixture.whenStable();

    expect(TestBed.inject(CommandPalette).isOpen()).toBe(true);
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Palette de commandes',
    );
    optionNamed('Accueil')?.click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/', 'atelier-nord']);
    expect(TestBed.inject(CommandPalette).isOpen()).toBe(false);
  });

  it('shows the server matches, opens a task and remembers it', async () => {
    TestBed.inject(CommandPalette).setOpen(true);
    await fixture.whenStable();
    const input: HTMLInputElement | null = document.querySelector('input[role="combobox"]');
    if (!input) throw new Error('No palette field');
    input.value = 'sso';
    input.dispatchEvent(new Event('input'));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(optionNamed('Relecture du parcours SSO')).toBeDefined();
    });
    expect(search).toHaveBeenCalledWith('sso');
    optionNamed('Relecture du parcours SSO')?.click();

    expect(navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 't', 'CAD-482']);
    expect(localStorage.getItem('cadenway-recent-tasks:u1:o1')).toContain('CAD-482');
  });

  it('says nothing matched the text', async () => {
    search.mockReturnValue(of([]));
    TestBed.inject(CommandPalette).setOpen(true);
    await fixture.whenStable();
    const input: HTMLInputElement | null = document.querySelector('input[role="combobox"]');
    if (!input) throw new Error('No palette field');
    input.value = 'zzzz';
    input.dispatchEvent(new Event('input'));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.body.textContent).toContain('Aucun résultat pour « zzzz ».');
    });
  });

  it('offers « Facturation et quotas » and one theme action that toggles', async () => {
    TestBed.inject(CommandPalette).setOpen(true);
    await fixture.whenStable();

    optionNamed('Facturation et quotas')?.click();
    expect(navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'organization', 'billing']);

    TestBed.inject(CommandPalette).setOpen(true);
    await fixture.whenStable();
    expect(optionNamed('Passer au thème clair')).toBeUndefined();
    optionNamed('Passer au thème sombre')?.click();
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('never opens over another shell overlay', async () => {
    TestBed.inject(ShellOverlay).open('workspace.shortcuts-dialog');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await fixture.whenStable();

    expect(TestBed.inject(CommandPalette).isOpen()).toBe(false);
    TestBed.inject(ShellOverlay).close('workspace.shortcuts-dialog');
  });

  it('signs out from « Actions »', async () => {
    TestBed.inject(CommandPalette).setOpen(true);
    await fixture.whenStable();

    optionNamed('Se déconnecter')?.click();

    expect(run).toHaveBeenCalledOnce();
  });
});
