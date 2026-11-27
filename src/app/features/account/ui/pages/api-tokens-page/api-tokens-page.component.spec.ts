import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withErrorBoundaries, withRouterConfig } from '@angular/router';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { unsavedChangesGuard } from '@shared/unsaved-changes';

import { ApiTokensApi } from '../../../data-access/services/api-tokens-api/api-tokens-api.service';
import type { ApiToken } from '../../../models/api-token/api-token.interface';
import { ReauthenticationService } from '../../../reauthentication/reauthentication.service';
import { ApiTokensPage } from './api-tokens-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the route's error boundary.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="boundary">Could not load this section</p>',
})
class FakeBoundary {}

/**
 * Component Elsewhere
 *
 * @description
 * Another settings section to navigate to.
 */
@Component({
  selector: 'cw-elsewhere',
  template: '<p data-testid="elsewhere">Profile</p>',
})
class Elsewhere {}

/**
 * Constant rows
 *
 * @description
 * The mockup's three tokens (`Compte.dc.html` lines 1486-1488).
 *
 * @type {readonly ApiToken[]}
 */
const rows: readonly ApiToken[] = [
  {
    id: 't1',
    name: 'GitLab continuous integration',
    prefix: 'cw_pat_4c1e…',
    scopes: ['tasks:read', 'tasks:write'],
    lastUse: { kind: 'minutes', count: 5 },
    expiry: { kind: 'date', date: '2027-01-12', soon: false },
  },
  {
    id: 't2',
    name: 'Trello import script',
    prefix: 'cw_pat_9ab2…',
    scopes: ['tasks:write'],
    lastUse: { kind: 'days', count: 21 },
    expiry: { kind: 'days', count: 6, soon: true },
  },
  {
    id: 't3',
    name: 'Grafana dashboard',
    prefix: 'cw_pat_d07f…',
    scopes: ['tasks:read', 'members:read'],
    lastUse: { kind: 'hours', count: 1 },
    expiry: { kind: 'never', soon: false },
  },
];

/**
 * Constant SECRET
 *
 * @description
 * A fake secret in the contract's shape.
 *
 * @type {string}
 */
const SECRET: string = `cw_pat_${'E'.repeat(36)}`;

describe('ApiTokensPage', () => {
  let api: { list: Mock; create: Mock; revoke: Mock };
  let toasts: { success: Mock; error: Mock; warning: Mock };
  let writeText: Mock;

  beforeEach(() => {
    api = {
      list: vi.fn(() => Promise.resolve(rows)),
      create: vi.fn(() =>
        Promise.resolve({
          token: { ...rows[0], id: 't4', name: 'GitLab sync', lastUse: { kind: 'never' } },
          secret: SECRET,
        }),
      ),
      revoke: vi.fn(() => Promise.resolve()),
    };
    toasts = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            { path: 'api-tokens', component: ApiTokensPage, canDeactivate: [unsavedChangesGuard] },
            { path: 'profile', component: Elsewhere },
          ],
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        { provide: ApiTokensApi, useValue: api },
        {
          provide: ReauthenticationService,
          useValue: { run: (operation: () => Promise<unknown>) => operation() },
        },
        { provide: CwToastService, useValue: toasts },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: signal({ id: 'o1', name: 'Atelier Nord' }) },
        },
      ],
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    TestBed.resetTestingModule();
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
    await harness.navigateByUrl('/api-tokens');
    await settle(harness);
    return harness;
  }

  /**
   * Function settle
   *
   * @description
   * Waits until the view no longer shows its skeleton.
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
   * Function view
   *
   * @description
   * The routed view.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The view.
   */
  function view(harness: RouterTestingHarness): HTMLElement {
    const host: HTMLElement | null = harness.routeNativeElement;
    if (!host) throw new Error('Expected the routed view.');
    return host;
  }

  /**
   * Function rowTexts
   *
   * @description
   * The text of each token row, its cells joined by ` | ` and the parts of a cell by spaces.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {string[]} The texts.
   */
  function rowTexts(harness: RouterTestingHarness): string[] {
    return [...view(harness).querySelectorAll('[data-testid="token-row"]')].map(
      (row: Element): string => [...row.querySelectorAll('td')].map(textOf).join(' | '),
    );
  }

  /**
   * Function textOf
   *
   * @description
   * The text of an element, its child elements' texts joined by spaces.
   *
   * @param {Element} element - The element.
   * @returns {string} The text.
   */
  function textOf(element: Element): string {
    const parts: string[] = [...element.children].map(textOf).filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : element.textContent.trim();
  }

  /**
   * Function overlay
   *
   * @description
   * An element of an open overlay by its `data-testid`.
   *
   * @param {string} id - The test id.
   * @returns {HTMLElement | null} The element.
   */
  function overlay(id: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.cdk-overlay-container [data-testid="${id}"]`);
  }

  it('lists the tokens with their scopes, last use and expiry', async () => {
    const harness: RouterTestingHarness = await open();

    expect(view(harness).querySelector('h1')?.textContent.trim()).toBe('API tokens');
    expect(view(harness).querySelector('table')?.getAttribute('aria-label')).toBe(
      'Personal access tokens',
    );
    expect(rowTexts(harness)).toEqual([
      'GitLab continuous integration cw_pat_4c1e… | tasks:read tasks:write | 5 min ago | Jan 12, 2027 | Revoke',
      'Trello import script cw_pat_9ab2… | tasks:write | 21 days ago | In 6 days | Revoke',
      'Grafana dashboard cw_pat_d07f… | tasks:read members:read | 1 h ago | No expiration | Revoke',
    ]);
    const expiries: Element[] = [...view(harness).querySelectorAll('[data-testid="token-expiry"]')];
    expect(expiries[1]?.classList).toContain('text-grenat-text');
    expect(expiries[0]?.classList).not.toContain('text-grenat-text');
    expect(view(harness).querySelector('[data-testid="tokens-empty"]')).toBeNull();
    expect(view(harness).querySelector('table')?.getAttribute('role')).toBe('table');
    expect(view(harness).querySelectorAll('[role="columnheader"]')).toHaveLength(5);
    expect(view(harness).querySelectorAll('tbody [role="row"]')).toHaveLength(3);
    expect(view(harness).querySelectorAll('tbody [role="cell"]')).toHaveLength(15);
  });

  it('words an expiry up to 90 days in days and a whole year ahead in years', async () => {
    api.list.mockResolvedValue([
      { ...rows[0], id: 't5', expiry: { kind: 'days', count: 90, soon: false } },
      { ...rows[0], id: 't6', expiry: { kind: 'years', count: 1, soon: false } },
    ]);
    const harness: RouterTestingHarness = await open();

    const expiries: string[] = [
      ...view(harness).querySelectorAll('[data-testid="token-expiry"]'),
    ].map((cell: Element): string => cell.textContent.trim());
    expect(expiries).toEqual(['In 90 days', 'In 1 year']);
  });

  it('shows the empty state for a completed read without token', async () => {
    api.list.mockResolvedValue([]);
    const harness: RouterTestingHarness = await open();

    expect(rowTexts(harness)).toEqual([]);
    expect(view(harness).querySelector('[data-testid="tokens-empty"]')?.textContent).toContain(
      'No active token',
    );
    expect(view(harness).querySelector('[data-testid="boundary"]')).toBeNull();
  });

  it('lets a failed read reach the error boundary, whose retry reads again', async () => {
    api.list.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/api-tokens');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[data-testid="boundary"]') ?? null;
      })
      .not.toBeNull();

    await harness.navigateByUrl('/api-tokens');
    await settle(harness);

    expect(api.list).toHaveBeenCalledTimes(2);
    expect(rowTexts(harness)).toHaveLength(3);
  });

  it('creates a token, shows and copies its secret once, then forgets it', async () => {
    const harness: RouterTestingHarness = await open();

    view(harness).querySelector<HTMLButtonElement>('[data-testid="token-create"]')?.click();
    await harness.fixture.whenStable();
    const name: HTMLInputElement | null = document.querySelector<HTMLInputElement>('#token-name');
    if (name === null) throw new Error('Expected the name field.');
    name.value = 'GitLab sync';
    name.dispatchEvent(new Event('input'));
    overlay('token-submit')?.click();

    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(document.querySelector<HTMLInputElement>('[data-testid="token-secret"]')?.value).toBe(
        SECRET,
      );
    });
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('[data-testid="token-secret"]'));
    });
    expect(api.create).toHaveBeenCalledWith({
      name: 'GitLab sync',
      scopes: ['tasks:read'],
      expiration: '30-days',
    });
    expect(rowTexts(harness)[0]).toContain('GitLab sync');

    overlay('token-copy')?.click();
    await vi.waitFor(() => {
      expect(toasts.success).toHaveBeenCalledWith('Token copied', {
        description: 'It will not be shown again.',
      });
    });
    expect(writeText).toHaveBeenCalledWith(SECRET);

    overlay('token-done')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(overlay('token-secret')).toBeNull();
    });
    expect(document.body.innerHTML).not.toContain(SECRET);

    view(harness).querySelector<HTMLButtonElement>('[data-testid="token-create"]')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(overlay('token-submit')).not.toBeNull();
    });
    expect(overlay('token-secret')).toBeNull();
  });

  /**
   * Function submitName
   *
   * @description
   * Opens the create dialog, types a name and submits it.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} value - The name.
   * @returns {Promise<void>} Resolves once submitted.
   */
  async function submitName(harness: RouterTestingHarness, value: string): Promise<void> {
    view(harness).querySelector<HTMLButtonElement>('[data-testid="token-create"]')?.click();
    await harness.fixture.whenStable();
    const name: HTMLInputElement | null = document.querySelector<HTMLInputElement>('#token-name');
    if (name === null) throw new Error('Expected the name field.');
    name.value = value;
    name.dispatchEvent(new Event('input'));
    overlay('token-submit')?.click();
  }

  it('keeps the column headers for screen readers in the card layout', async () => {
    const harness: RouterTestingHarness = await open();

    const head: HTMLElement | null = view(harness).querySelector('thead');
    expect(head?.classList).toContain('max-md:sr-only');
    expect(head?.classList).not.toContain('max-md:hidden');
    expect(head?.querySelectorAll('[role="columnheader"]')).toHaveLength(5);
  });

  it('closes the dialog onto the highlighted token when the answer of its creation was lost', async () => {
    api.create.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    const harness: RouterTestingHarness = await open();
    api.list.mockResolvedValueOnce([{ ...rows[0], id: 't4', name: 'GitLab sync' }, ...rows]);

    await submitName(harness, 'GitLab sync');

    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    const highlighted: Element | null = view(harness).querySelector('[data-highlighted="true"]');
    expect(highlighted?.textContent).toContain('GitLab sync');
    expect(toasts.warning).toHaveBeenCalledWith('The token was created without its secret', {
      description: 'Its secret could not be shown. Revoke it, then create another one.',
    });
  });

  it('waits for a creation in progress before leaving, and stays to show its secret', async () => {
    let answer: (value: unknown) => void = (): void => undefined;
    api.create.mockReturnValueOnce(
      new Promise((resolve: (value: unknown) => void): void => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await open();
    await submitName(harness, 'GitLab sync');
    await vi.waitFor(() => {
      expect(api.create).toHaveBeenCalledOnce();
    });

    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl('/profile');
    answer({
      token: { ...rows[0], id: 't4', name: 'GitLab sync', lastUse: { kind: 'never' } },
      secret: SECRET,
    });

    expect(await leaving).toBe(false);
    await harness.fixture.whenStable();
    expect(document.querySelector<HTMLInputElement>('[data-testid="token-secret"]')?.value).toBe(
      SECRET,
    );
    expect(document.querySelector('[data-testid="elsewhere"]')).toBeNull();
  });

  it('leaves once a creation in progress was refused', async () => {
    let refuse: (error: unknown) => void = (): void => undefined;
    api.create.mockReturnValueOnce(
      new Promise((_resolve: (value: unknown) => void, reject: (error: unknown) => void): void => {
        refuse = reject;
      }),
    );
    const harness: RouterTestingHarness = await open();
    await submitName(harness, 'GitLab sync');
    await vi.waitFor(() => {
      expect(api.create).toHaveBeenCalledOnce();
    });

    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl('/profile');
    refuse(new HttpErrorResponse({ status: 429 }));

    expect(await leaving).toBe(true);
  });

  it('says the copy failed when the clipboard refuses', async () => {
    writeText.mockRejectedValueOnce(new Error('Denied'));
    const harness: RouterTestingHarness = await open();
    view(harness).querySelector<HTMLButtonElement>('[data-testid="token-create"]')?.click();
    await harness.fixture.whenStable();
    const name: HTMLInputElement | null = document.querySelector<HTMLInputElement>('#token-name');
    if (name === null) throw new Error('Expected the name field.');
    name.value = 'GitLab sync';
    name.dispatchEvent(new Event('input'));
    overlay('token-submit')?.click();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(overlay('token-copy')).not.toBeNull();
    });

    overlay('token-copy')?.click();

    await vi.waitFor(() => {
      expect(toasts.error).toHaveBeenCalledWith('Copy failed', {
        description: 'Select the text, then copy it with Ctrl C.',
      });
    });
  });

  it('revokes a token once its name is typed', async () => {
    const harness: RouterTestingHarness = await open();

    view(harness)
      .querySelector<HTMLButtonElement>('[aria-label="Revoke the token “Trello import script”"]')
      ?.click();
    await harness.fixture.whenStable();
    const dialog: HTMLElement | null = document.querySelector<HTMLElement>('[role="alertdialog"]');
    expect(dialog?.textContent).toContain('Revoke the token “Trello import script”?');
    const confirm: HTMLElement | null = overlay('token-revoke-confirm');
    expect(confirm?.getAttribute('aria-disabled')).toBe('true');

    const typed: HTMLInputElement | null = dialog?.querySelector<HTMLInputElement>('input') ?? null;
    if (typed === null) throw new Error('Expected the confirmation field.');
    typed.value = 'Trello import script';
    typed.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    confirm?.click();

    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(rowTexts(harness)).toHaveLength(2);
    });
    expect(api.revoke).toHaveBeenCalledWith('t2');
    expect(toasts.success).toHaveBeenCalledWith('Token revoked', {
      description: 'Trello import script can no longer call the API.',
    });
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Revoke the token “Grafana dashboard”',
      );
    });
  });

  it('gives focus to Create a token once the last token is revoked', async () => {
    api.list.mockResolvedValue([rows[1]]);
    const harness: RouterTestingHarness = await open();

    view(harness)
      .querySelector<HTMLButtonElement>('[aria-label="Revoke the token “Trello import script”"]')
      ?.click();
    await harness.fixture.whenStable();
    const typed: HTMLInputElement | null = document.querySelector<HTMLInputElement>(
      '[role="alertdialog"] input',
    );
    if (typed === null) throw new Error('Expected the confirmation field.');
    typed.value = 'Trello import script';
    typed.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    overlay('token-revoke-confirm')?.click();

    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      expect(document.activeElement).toBe(
        view(harness).querySelector('[data-testid="token-create"]'),
      );
    });
    expect(view(harness).querySelector('[data-testid="tokens-empty"]')).not.toBeNull();
  });
});
