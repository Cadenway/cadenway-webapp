import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { type Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WorkspaceSession } from '../../../data-access/services/workspace-session/workspace-session.service';
import type { OrganizationMenuEntry } from '../../../models/organization-menu-entry/organization-menu-entry.interface';
import type {
  WorkspaceOrganization,
  WorkspaceResult,
} from '../../../models/workspace-context/workspace-context.interface';
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
    name: 'Lumen Cooperative',
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
 * Constant ATELIER_NORD
 *
 * @description
 * The mockup's current organization.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o1',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

/**
 * Constant organization
 *
 * @description
 * The workspace's organization, which a completed switch replaces.
 *
 * @type {WritableSignal<WorkspaceOrganization>}
 */
const organization: WritableSignal<WorkspaceOrganization> = signal(ATELIER_NORD);

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
  organization,
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
  let show: Mock;
  let fixture: ComponentFixture<OrganizationSwitcher>;

  beforeEach(async () => {
    menuOrganizations = vi.fn(() => of({ ok: true as const, value: entries }));
    navigateByUrl = vi.fn(() => Promise.resolve(true));
    navigate = vi.fn(() => Promise.resolve(true));
    show = vi.fn();
    organization.set(ATELIER_NORD);
    TestBed.configureTestingModule({
      imports: [OrganizationSwitcher],
      providers: [
        provideCadenwayIcons(),
        { provide: WorkspaceSession, useValue: { menuOrganizations } },
        { provide: Router, useValue: { navigateByUrl, navigate } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: CwToastService, useValue: { show } },
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
    expect(item('Atelier Nord')?.textContent).toContain('Owner · Team plan');
    expect(item('Lumen Cooperative')?.textContent).toContain('Member · Enterprise plan');
    expect(item('Members and invitations')?.textContent).toContain('18');
  });

  it('opens the workspace of another organization', async () => {
    await openMenu();

    item('Lumen Cooperative')?.click();

    expect(navigateByUrl).toHaveBeenCalledWith('/lumen');
  });

  it('confirms a completed switch, and nothing when the navigation fails', async () => {
    navigateByUrl.mockImplementationOnce(() => {
      organization.set({ ...ATELIER_NORD, id: 'o2', slug: 'lumen', name: 'Lumen Cooperative' });
      return Promise.resolve(true);
    });
    await openMenu();
    item('Lumen Cooperative')?.click();
    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledWith('Organization: Lumen Cooperative', {
        description: 'Your spaces and settings follow the chosen organization.',
      });
    });

    organization.set(ATELIER_NORD);
    navigateByUrl.mockResolvedValueOnce(false);
    await openMenu();
    item('Studio Pivot')?.click();
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenLastCalledWith('/studio-pivot');
    expect(show).toHaveBeenCalledOnce();
  });

  it('renders the sidebar organization row, which opens the same menu', async () => {
    fixture.componentRef.setInput('placement', 'sidebar');
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="organization-switcher"]')).toBeNull();
    const row: HTMLButtonElement | null = element.querySelector('[data-testid="organization-row"]');
    expect(row?.textContent).toContain('Atelier Nord');
    expect(row?.textContent).toContain(`${location.host}/atelier-nord`);
    expect(row?.getAttribute('aria-haspopup')).toBe('menu');

    row?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(item('Studio Pivot')).toBeDefined();
    });
    expect(item('Create or join an organization')).toBeDefined();
  });

  it('opens the organization settings and the organization choice', async () => {
    await openMenu();
    item('Billing and quotas')?.click();
    expect(navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'organization', 'billing']);

    await openMenu();
    item('Create or join an organization')?.click();
    expect(navigateByUrl).toHaveBeenCalledWith('/organizations');
  });

  it('offers Retry when the list cannot be read', async () => {
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
        (button: HTMLButtonElement) => button.textContent.trim() === 'Retry',
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
