import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { type Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WorkspaceSession } from '../../../data-access/services/workspace-session/workspace-session.service';
import type { OrganizationMenuEntry } from '../../../models/organization-menu-entry/organization-menu-entry.interface';
import type { WorkspaceResult } from '../../../models/workspace-context/workspace-context.interface';
import type { WorkspaceContextPort } from '../../../ports/workspace-context/workspace-context-port.interface';
import { WORKSPACE_CONTEXT } from '../../../ports/workspace-context/workspace-context.token';
import { OrganizationSwitcher } from './organization-switcher.component';

/**
 * Constant entries
 *
 * @description
 * The mockup's three organizations of Camille.
 *
 * @type {readonly OrganizationMenuEntry[]}
 */
const entries: readonly OrganizationMenuEntry[] = [
  {
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
    memberCount: 18,
  },
  {
    id: 'o2',
    slug: 'lumen',
    name: 'Coopérative Lumen',
    initials: 'CL',
    role: 'member',
    plan: 'enterprise',
    memberCount: 40,
  },
  {
    id: 'o3',
    slug: 'studio-pivot',
    name: 'Studio Pivot',
    initials: 'SP',
    role: 'member',
    plan: 'free',
    memberCount: 4,
  },
];

/**
 * Constant workspace
 *
 * @description
 * Camille in Atelier Nord, as the workspace port shows them.
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
 * Function item
 *
 * @description
 * Finds an item of the open menu by its text.
 *
 * @param {string} text - Text the item contains.
 * @returns {HTMLButtonElement | undefined} The item.
 */
function item(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')).find(
    (candidate: HTMLButtonElement) => candidate.textContent.includes(text),
  );
}

describe('OrganizationSwitcher', () => {
  let menuOrganizations: Mock<() => Observable<WorkspaceResult<readonly OrganizationMenuEntry[]>>>;
  let navigateByUrl: Mock<(url: string) => Promise<boolean>>;
  let navigate: Mock<(commands: readonly unknown[]) => Promise<boolean>>;
  let fixture: ComponentFixture<OrganizationSwitcher>;

  beforeEach(async () => {
    menuOrganizations = vi.fn(() => of({ ok: true as const, value: entries }));
    navigateByUrl = vi.fn(() => Promise.resolve(true));
    navigate = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      imports: [OrganizationSwitcher],
      providers: [
        provideCadenwayIcons(),
        { provide: WorkspaceSession, useValue: { menuOrganizations } },
        { provide: Router, useValue: { navigateByUrl, navigate } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
    fixture = TestBed.createComponent(OrganizationSwitcher);
    await fixture.whenStable();
  });

  /**
   * Function openMenu
   *
   * @description
   * Opens the organizations menu and waits for the list.
   *
   * @returns {Promise<void>} Resolves once the list is shown.
   */
  async function openMenu(): Promise<void> {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="organization-switcher"]')
      ?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(item('Studio Pivot')).toBeDefined();
    });
  }

  it('reads the organizations only when the menu opens', async () => {
    expect(menuOrganizations).not.toHaveBeenCalled();
    await openMenu();

    expect(menuOrganizations).toHaveBeenCalledOnce();
    expect(item('Atelier Nord')?.getAttribute('aria-checked')).toBe('true');
    expect(item('Atelier Nord')?.textContent).toContain('Propriétaire · plan Équipe');
    expect(item('Coopérative Lumen')?.textContent).toContain('Membre · plan Entreprise');
    expect(item('Membres et invitations')?.textContent).toContain('18');
  });

  it('opens another organization’s workspace', async () => {
    await openMenu();

    item('Coopérative Lumen')?.click();

    expect(navigateByUrl).toHaveBeenCalledWith('/lumen');
  });

  it('opens the organization settings and the organization choice', async () => {
    await openMenu();
    item('Facturation et quotas')?.click();
    expect(navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'organization', 'billing']);

    await openMenu();
    item('Créer ou rejoindre une organisation')?.click();
    expect(navigateByUrl).toHaveBeenCalledWith('/organizations');
  });

  it('offers Réessayer when the list cannot be read', async () => {
    menuOrganizations.mockReturnValueOnce(
      of({ ok: false as const, problem: { status: 503, code: 'upstream.unavailable' } }),
    );
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="organization-switcher"]')
      ?.click();
    let retry: HTMLButtonElement | undefined;
    await vi.waitFor(() => {
      fixture.detectChanges();
      retry = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        (button: HTMLButtonElement) => button.textContent.trim() === 'Réessayer',
      );
      expect(retry).toBeDefined();
    });

    retry?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(item('Studio Pivot')).toBeDefined();
    });
    expect(menuOrganizations).toHaveBeenCalledTimes(2);
  });
});
