import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, type InputSignal, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withErrorBoundaries, withRouterConfig } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type AppLocale, LocaleService } from '@core/locale';
import { type ResolvedTheme, type ThemePreference, ThemeService } from '@core/theme';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { AccountChangedError } from '../../../data-access/services/notification-preferences-api/account-changed.error';
import type {
  AccountLanguage,
  AccountLanguageSettings,
} from '../../../data-access/services/language-api/account-language.interface';
import { LanguageApi } from '../../../data-access/services/language-api/language-api.service';
import { PreferencesPage } from './preferences-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the router's error component: it shows that the page failed.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="error">failed</p>',
})
class FakeBoundary {
  // #region Properties
  /**
   * Property error
   *
   * @description
   * Failure the router passes.
   *
   * @type {InputSignal<unknown>}
   * @readonly
   */
  public readonly error: InputSignal<unknown> = input<unknown>();
  // #endregion
}

/**
 * Constant workspace
 *
 * @description
 * Camille Martin in Atelier Nord.
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
 * Constant versionMismatch
 *
 * @description
 * The gateway's `412 request.version-mismatch`.
 *
 * @type {HttpErrorResponse}
 */
const versionMismatch: HttpErrorResponse = new HttpErrorResponse({
  status: 412,
  error: { type: 'about:blank', status: 412, code: 'request.version-mismatch' },
});

describe('PreferencesPage', () => {
  let recorded: AccountLanguageSettings;
  let read: Mock<LanguageApi['read']>;
  let write: Mock<LanguageApi['write']>;
  let toasts: { success: Mock; error: Mock };
  let locale: { current: AppLocale; use: Mock };
  let theme: {
    preference: WritableSignal<ThemePreference>;
    resolved: WritableSignal<ResolvedTheme>;
    set: Mock;
  };

  beforeEach(() => {
    recorded = { language: 'fr', version: 3 };
    read = vi.fn<LanguageApi['read']>(() => Promise.resolve(recorded));
    write = vi.fn<LanguageApi['write']>((language: AccountLanguage, version: number) => {
      recorded = { language, version: version + 1 };
      return Promise.resolve(recorded);
    });
    toasts = { success: vi.fn(() => 'toast-1'), error: vi.fn(() => 'toast-2') };
    locale = { current: 'fr', use: vi.fn() };
    theme = {
      preference: signal<ThemePreference>('system'),
      resolved: signal<ResolvedTheme>('light'),
      set: vi.fn((preference: ThemePreference) => {
        theme.preference.set(preference);
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [{ path: 'preferences', component: PreferencesPage }],
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        { provide: LanguageApi, useValue: { read, write } },
        { provide: CwToastService, useValue: toasts },
        { provide: LocaleService, useValue: locale },
        { provide: ThemeService, useValue: theme },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
      ],
    });
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((node: Element) => {
      node.remove();
    });
  });

  /**
   * Function open
   *
   * @description
   * Opens the section and waits until its skeleton is gone.
   *
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/preferences');
    await settle(harness);
    return harness;
  }

  /**
   * Function settle
   *
   * @description
   * Waits until the section no longer shows its skeleton.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(harness: RouterTestingHarness): Promise<void> {
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[aria-busy="true"]') ?? null;
      })
      .toBeNull();
  }

  /**
   * Function hostOf
   *
   * @description
   * The element of the routed page.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The page.
   */
  function hostOf(harness: RouterTestingHarness): HTMLElement {
    const host: HTMLElement | null = harness.routeNativeElement;
    if (!host) throw new Error('Expected the routed page.');
    return host;
  }

  /**
   * Function themeRadio
   *
   * @description
   * The radio of a theme card, found by its label's text.
   *
   * @param {HTMLElement} host - The page.
   * @param {string} name - The card's name.
   * @returns {HTMLElement} The radio.
   */
  function themeRadio(host: HTMLElement, name: string): HTMLElement {
    const found: HTMLElement | undefined = Array.from(
      host.querySelectorAll<HTMLElement>('[role="radio"]'),
    ).find(
      (radio: HTMLElement) =>
        host.querySelector(`label[for="${radio.id}"]`)?.textContent.trim() === name,
    );
    if (!found) throw new Error(`No theme "${name}"`);
    return found;
  }

  /**
   * Function shownLanguage
   *
   * @description
   * The text of the language select's trigger.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {string} The language shown.
   */
  function shownLanguage(harness: RouterTestingHarness): string {
    harness.detectChanges();
    return (
      hostOf(harness)
        .querySelector('[data-testid="account-language"] [role="combobox"]')
        ?.textContent.trim() ?? ''
    );
  }

  /**
   * Function pickLanguage
   *
   * @description
   * Opens the language select and picks an option by its text.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} label - The option's text.
   * @returns {Promise<void>} Resolves once picked.
   */
  async function pickLanguage(harness: RouterTestingHarness, label: string): Promise<void> {
    hostOf(harness)
      .querySelector<HTMLButtonElement>('[data-testid="account-language"] [role="combobox"]')
      ?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return document.querySelectorAll('[role="option"]').length;
      })
      .toBe(4);
    [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((option: HTMLElement) => option.textContent.trim() === label)
      ?.click();
    harness.detectChanges();
  }

  it('shows the section skeleton while the account loads', async () => {
    read.mockReturnValueOnce(new Promise<AccountLanguageSettings>(() => undefined));
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/preferences');
    harness.detectChanges();

    const status: Element | null = hostOf(harness).querySelector('[role="status"]');
    expect(status?.getAttribute('aria-label')).toBe('Loading the section');
    expect(hostOf(harness).querySelector('h1')).toBeNull();
  });

  it('shows the device theme and the account language, and hides what is not stored yet', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Preferences');
    expect(themeRadio(host, 'System').getAttribute('aria-checked')).toBe('true');
    expect(themeRadio(host, 'Light').getAttribute('aria-checked')).toBe('false');
    expect(shownLanguage(harness)).toBe('Français');
    expect(read).toHaveBeenCalledWith('u1', expect.any(AbortSignal));
    expect(host.textContent).not.toContain('Date format');
    expect(host.textContent).not.toContain('Week starts on');
    expect(host.querySelector('[role="switch"]')).toBeNull();
  });

  it('applies a theme at once, spreading from its card', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    themeRadio(host, 'Dark').click();
    harness.detectChanges();

    expect(theme.set).toHaveBeenCalledWith('dark', { x: 0, y: 0 });
    expect(themeRadio(host, 'Dark').getAttribute('aria-checked')).toBe('true');
    expect(write).not.toHaveBeenCalled();
  });

  it('saves a language on the account, then reloads the application in it', async () => {
    const harness: RouterTestingHarness = await open();

    await pickLanguage(harness, 'English');

    expect(shownLanguage(harness)).toBe('English');
    await expect.poll(() => locale.use.mock.calls.length).toBe(1);
    expect(write).toHaveBeenCalledWith('en', 3, 'u1');
    expect(locale.use).toHaveBeenCalledWith('en');
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('confirms with a toast when the locale shown does not change', async () => {
    locale.current = 'en';
    const harness: RouterTestingHarness = await open();

    await pickLanguage(harness, 'Deutsch');

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(toasts.success).toHaveBeenCalledWith('Preference saved', {
      description: 'Language: Deutsch.',
    });
    expect(locale.use).not.toHaveBeenCalled();
  });

  it('keeps the previous language with an error toast when the save is refused', async () => {
    write.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
    const harness: RouterTestingHarness = await open();

    await pickLanguage(harness, 'English');

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('Could not save', {
      description: 'The previous language is back. Try again in a moment.',
    });
    expect(shownLanguage(harness)).toBe('Français');
    expect(locale.use).not.toHaveBeenCalled();
  });

  it('reads the account again on a version mismatch and resends once against it', async () => {
    write.mockRejectedValueOnce(versionMismatch);
    read
      .mockImplementationOnce(() => Promise.resolve(recorded))
      .mockImplementationOnce(() => Promise.resolve({ language: 'fr', version: 5 }));
    const harness: RouterTestingHarness = await open();

    await pickLanguage(harness, 'English');

    await expect.poll(() => locale.use.mock.calls.length).toBe(1);
    expect(
      write.mock.calls.map(([, version]: [AccountLanguage, number, string]) => version),
    ).toEqual([3, 5]);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('counts a write without an answer as saved when the account holds it', async () => {
    write.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    read
      .mockImplementationOnce(() => Promise.resolve(recorded))
      .mockImplementationOnce(() => Promise.resolve({ language: 'en', version: 4 }));
    const harness: RouterTestingHarness = await open();

    await pickLanguage(harness, 'English');

    await expect.poll(() => locale.use.mock.calls.length).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('stops silently when another account holds the session', async () => {
    write.mockRejectedValueOnce(new AccountChangedError());
    const harness: RouterTestingHarness = await open();

    await pickLanguage(harness, 'English');

    await expect.poll(() => shownLanguage(harness)).toBe('Français');
    expect(toasts.error).not.toHaveBeenCalled();
    expect(locale.use).not.toHaveBeenCalled();
  });

  it('renders the route boundary on a failed read, and reads again on Retry', async () => {
    read.mockRejectedValueOnce(new Error('503'));

    const harness: RouterTestingHarness = await open();
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent.trim();
      })
      .toBe('failed');

    await harness.navigateByUrl('/preferences');
    await settle(harness);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('h1')?.textContent.trim();
      })
      .toBe('Preferences');
    expect(read).toHaveBeenCalledTimes(2);
  });
});
