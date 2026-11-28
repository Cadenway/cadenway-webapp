import { getDebugNode, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwAvatar } from '@cadenway/ui/components/avatar';
import { CwMenu } from '@cadenway/ui/components/menu';
import { CwToastService } from '@cadenway/ui/components/toast';
import { CwTooltip } from '@cadenway/ui/components/tooltip';
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
  if (!found) throw new Error(`No menu item "${text}"`);
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

    expect(trigger.textContent).toContain('Account of Camille Martin');
    expect(trigger.textContent).not.toContain('status');
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
    const tooltip: CwTooltip = fixture.debugElement
      .query(By.css('[data-testid="user-menu-trigger"]'))
      .query(By.directive(CwTooltip))
      .injector.get(CwTooltip);
    expect(tooltip.cwTooltip()).toBe('');
    expect(trigger.querySelector('cw-presence-dot')).toBeNull();
    expect(document.body.textContent).toContain('camille.martin@ateliernord.fr');
    item('Status').click();
    await fixture.whenStable();
    expect(document.querySelector('[role="menuitemradio"][aria-checked="true"]')).toBeNull();
  });

  it('names the chosen presence and draws its dot', async () => {
    status.set('away');
    const trigger: HTMLButtonElement = await openMenu();

    expect(trigger.textContent).toContain('Account of Camille Martin, status: Away');
    expect(trigger.querySelector('cw-avatar')?.getAttribute('title')).toBe('Camille Martin (away)');
  });

  it.each([
    ['online', 'online'],
    ['away', 'away'],
    ['do-not-disturb', 'do not disturb'],
    ['invisible', 'invisible'],
  ] as const)(
    'shows %s on both avatars without repeating it in the button name',
    async (presence, label) => {
      status.set(presence);
      const trigger: HTMLButtonElement = await openMenu();
      const avatars: NodeListOf<HTMLElement> = document.querySelectorAll('cw-avatar');
      expect(avatars).toHaveLength(2);
      for (const avatar of avatars) {
        expect(avatar.getAttribute('title')).toBe(`Camille Martin (${label})`);
        expect(avatar.getAttribute('aria-hidden')).toBe('true');
        expect(avatar.querySelector('span[aria-hidden="true"]')).not.toBeNull();
      }
      expect(trigger.querySelector('cw-presence-dot')).toBeNull();
    },
  );

  it('rings the rail avatar with the canvas and the menu avatar with the popover', async () => {
    status.set('online');
    await openMenu();

    const rings: string[] = [...document.querySelectorAll('cw-avatar')].map((avatar: Element) =>
      (getDebugNode(avatar)?.componentInstance as CwAvatar).ring(),
    );
    expect(rings).toEqual(['canvas', 'popover']);
  });

  it('opens the account menu 4 px beside the rail, at least 240 px wide', async () => {
    await openMenu();

    const menu: CwMenu = fixture.debugElement.query(By.directive(CwMenu))
      .componentInstance as CwMenu;
    expect(menu.sideOffset()).toBe(14);
    expect(menu.minWidth()).toBe('60');
    expect(document.querySelector('[role="menu"][aria-label="Account"]')?.className).toContain(
      'min-w-[min(15rem,calc(100vw-1rem))]',
    );
  });

  it('shows the current status and theme as values of their submenu items', async () => {
    status.set('away');
    await openMenu();

    for (const [name, value] of [
      ['Status', 'Away'],
      ['Theme', 'Light'],
    ] as const) {
      const values: NodeListOf<Element> = item(name).querySelectorAll('cw-menu-item-value');
      expect(values).toHaveLength(1);
      expect(values[0].textContent.trim()).toBe(value);
    }
  });

  it('disables `Status` without realtime, and never confirms anything', async () => {
    connection.set('disabled');
    await fixture.whenStable();
    await openMenu();

    const status: HTMLButtonElement = item('Status');
    expect(status.getAttribute('aria-disabled')).toBe('true');
    expect(status.textContent).toContain('Unavailable');
    status.click();
    await fixture.whenStable();

    expect(document.querySelector('[role="menuitemradio"]')).toBeNull();
    expect(setPresence).not.toHaveBeenCalled();
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('reports a presence the server refused', async () => {
    await openMenu();
    item('Status').click();
    await fixture.whenStable();
    item('Away').click();
    await fixture.whenStable();

    status.set(null);
    await fixture.whenStable();

    expect(toasts.error).toHaveBeenCalledWith('The status could not be changed', expect.anything());
  });

  it('sets the presence from `Status` and confirms it', async () => {
    await openMenu();
    item('Status').click();
    await fixture.whenStable();

    item('Do not disturb').click();
    await fixture.whenStable();

    expect(setPresence).toHaveBeenCalledExactlyOnceWith('do-not-disturb');
    expect(toasts.show).toHaveBeenCalledWith('Status: Do not disturb', {
      description: 'Notifications paused.',
    });
  });

  it('opens the account sections of the current organization', async () => {
    await openMenu();

    item('Security and sign-ins').click();

    expect(navigate).toHaveBeenCalledWith(['/', 'atelier-nord', 'account', 'security']);
  });

  it('switches the theme from `Theme`', async () => {
    await openMenu();
    item('Theme').click();
    await fixture.whenStable();

    item('Dark').click();

    expect(theme.set).toHaveBeenCalledOnce();
    expect(theme.set.mock.calls[0]?.[0]).toBe('dark');
  });

  it('signs out, and reports a refusal', async () => {
    await openMenu();
    item('Sign out').click();
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledOnce();
    });
    expect(toasts.error).not.toHaveBeenCalled();

    run.mockResolvedValueOnce(false);
    await openMenu();
    item('Sign out').click();
    await vi.waitFor(() => {
      expect(toasts.error).toHaveBeenCalledWith('Sign-out failed', expect.anything());
    });
  });
});
