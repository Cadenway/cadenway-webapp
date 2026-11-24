import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { PresenceStatus } from '@core/realtime';
import { ThemeService } from '@core/theme';
import { SignOut } from '@features/auth';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { PRESENCE } from '../../../ports/presence/presence.token';
import { UserMenu } from './user-menu.component';

/**
 * Constant workspace
 *
 * @description
 * Camille Martin in Atelier Nord, as the workspace port shows them.
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
 * Finds a menu item of an open menu by its text.
 *
 * @param {string} text - Text the item contains.
 * @returns {HTMLButtonElement} The item.
 */
function item(text: string): HTMLButtonElement {
  const found: HTMLButtonElement | undefined = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]'),
  ).find((candidate: HTMLButtonElement) => candidate.textContent.includes(text));
  if (!found) throw new Error(`No menu item « ${text} »`);
  return found;
}

describe('UserMenu', () => {
  let run: Mock<() => Promise<boolean>>;
  let navigate: Mock<(commands: readonly unknown[]) => Promise<boolean>>;
  let toasts: { show: Mock; error: Mock };
  let theme: { set: Mock; resolved: () => 'light' | 'dark' };
  let status: WritableSignal<PresenceStatus | null>;
  let setPresence: Mock<(next: PresenceStatus) => void>;
  let connection: WritableSignal<'disabled' | 'connecting' | 'connected' | 'reconnecting'>;
  let fixture: ComponentFixture<UserMenu>;

  beforeEach(async () => {
    status = signal<PresenceStatus | null>(null);
    connection = signal<'disabled' | 'connecting' | 'connected' | 'reconnecting'>('connected');
    setPresence = vi.fn((next: PresenceStatus) => {
      status.set(next);
    });
    run = vi.fn(() => Promise.resolve(true));
    navigate = vi.fn(() => Promise.resolve(true));
    toasts = { show: vi.fn(), error: vi.fn() };
    theme = { set: vi.fn(), resolved: () => 'light' };
    TestBed.configureTestingModule({
      imports: [UserMenu],
      providers: [
        provideCadenwayIcons(),
        { provide: PRESENCE, useValue: { ownStatus: status, status: connection, setPresence } },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: SignOut, useValue: { run } },
        { provide: Router, useValue: { navigate } },
        { provide: CwToastService, useValue: toasts },
        { provide: ThemeService, useValue: theme },
      ],
    });
    fixture = TestBed.createComponent(UserMenu);
    await fixture.whenStable();
  });

  /**
   * Function openMenu
   *
   * @description
   * Opens the account menu from the rail button.
   *
   * @returns {Promise<HTMLButtonElement>} The rail button.
   */
  async function openMenu(): Promise<HTMLButtonElement> {
    const trigger: HTMLButtonElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="user-menu-trigger"]',
    );
    if (!trigger) throw new Error('No account button');
    trigger.click();
    await fixture.whenStable();
    return trigger;
  }

  it('names the person without a presence until one is chosen in this tab', async () => {
    const trigger: HTMLButtonElement = await openMenu();

    expect(trigger.textContent).toContain('Compte de Camille Martin');
    expect(trigger.textContent).not.toContain('statut');
    expect(trigger.querySelector('cw-presence-dot')).toBeNull();
    expect(document.body.textContent).toContain('camille.martin@ateliernord.fr');
    item('Statut').click();
    await fixture.whenStable();
    expect(document.querySelector('[role="menuitemradio"][aria-checked="true"]')).toBeNull();
  });

  it('names the chosen presence and draws its dot', async () => {
    status.set('away');
    const trigger: HTMLButtonElement = await openMenu();

    expect(trigger.textContent).toContain('Compte de Camille Martin, statut : Absent');
    expect(trigger.querySelector('cw-presence-dot')?.getAttribute('data-status')).toBe('away');
  });

  it('disables « Statut » without realtime, and never confirms anything', async () => {
    connection.set('disabled');
    await fixture.whenStable();
    await openMenu();

    const status: HTMLButtonElement = item('Statut');
    expect(status.getAttribute('aria-disabled')).toBe('true');
    expect(status.textContent).toContain('Indisponible');
    status.click();
    await fixture.whenStable();

    expect(document.querySelector('[role="menuitemradio"]')).toBeNull();
    expect(setPresence).not.toHaveBeenCalled();
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('reports a presence the server refused', async () => {
    await openMenu();
    item('Statut').click();
    await fixture.whenStable();
    item('Absent').click();
    await fixture.whenStable();

    status.set(null);
    await fixture.whenStable();

    expect(toasts.error).toHaveBeenCalledWith('Impossible de changer de statut', expect.anything());
  });

  it('sets the presence from « Statut » and confirms it', async () => {
    await openMenu();
    item('Statut').click();
    await fixture.whenStable();

    item('Ne pas déranger').click();
    await fixture.whenStable();

    expect(setPresence).toHaveBeenCalledExactlyOnceWith('do-not-disturb');
    expect(toasts.show).toHaveBeenCalledWith('Statut : Ne pas déranger', {
      description: 'Notifications en pause.',
    });
  });

  it('opens the account sections of the current organization', async () => {
    await openMenu();

    item('Sécurité et connexions').click();

    expect(navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'account', 'security']);
  });

  it('switches the theme from « Thème »', async () => {
    await openMenu();
    item('Thème').click();
    await fixture.whenStable();

    item('Sombre').click();

    expect(theme.set).toHaveBeenCalledOnce();
    expect(theme.set.mock.calls[0]?.[0]).toBe('dark');
  });

  it('signs out, and reports a refusal', async () => {
    await openMenu();
    item('Se déconnecter').click();
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledOnce();
    });
    expect(toasts.error).not.toHaveBeenCalled();

    run.mockResolvedValueOnce(false);
    await openMenu();
    item('Se déconnecter').click();
    await vi.waitFor(() => {
      expect(toasts.error).toHaveBeenCalledWith(
        'Impossible de vous déconnecter',
        expect.anything(),
      );
    });
  });
});
