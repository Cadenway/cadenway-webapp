import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { ResetPage } from './reset-page.component';

/**
 * Function render
 *
 * @description
 * Renders the reset page for a fragment with a faked flow store.
 *
 * @param {string | null} fragment - The URL fragment.
 * @param {Record<string, unknown>} flow - The faked store.
 * @returns {Promise<{ host: HTMLElement; fixture: ComponentFixture<ResetPage>; replaceState: Mock }>}
 * The page and its fakes.
 */
async function render(
  fragment: string | null,
  flow: Record<string, unknown>,
): Promise<{ host: HTMLElement; fixture: ComponentFixture<ResetPage>; replaceState: Mock }> {
  TestBed.configureTestingModule({
    imports: [ResetPage],
    providers: [
      provideRouter([]),
      provideCadenwayIcons(),
      { provide: AuthFlowStore, useValue: flow },
      { provide: ActivatedRoute, useValue: { snapshot: { fragment } } },
    ],
  });
  const replaceState: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<ResetPage> = TestBed.createComponent(ResetPage);
  await fixture.whenStable();
  await fixture.whenStable();
  return { host: fixture.nativeElement as HTMLElement, fixture, replaceState };
}

/**
 * Function type
 *
 * @description
 * Types a value into an input.
 *
 * @param {HTMLElement} host - The page.
 * @param {string} selector - The input selector.
 * @param {string} value - The value.
 */
function type(host: HTMLElement, selector: string, value: string): void {
  const input: HTMLInputElement | null = host.querySelector(selector);
  if (input === null) throw new Error(`Expected ${selector}.`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('ResetPage', () => {
  it('reads the token from the fragment, hides it, enforces the 4 rules and resets the password', async () => {
    const inspectPasswordReset: Mock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        value: { email: 'camille.martin@ateliernord.fr', sessionCount: 3 },
      }),
    );
    const confirmPasswordReset: Mock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        value: { email: 'camille.martin@ateliernord.fr', closedSessionCount: 3 },
      }),
    );
    const { host, fixture, replaceState }: Awaited<ReturnType<typeof render>> = await render(
      'token=reset-token',
      { inspectPasswordReset, confirmPasswordReset, prefill: vi.fn() },
    );

    expect(inspectPasswordReset).toHaveBeenCalledWith('reset-token');
    expect(replaceState).toHaveBeenCalledWith('/reset', { replaceUrl: true });
    expect(host.textContent).toContain('Pour le compte camille.martin@ateliernord.fr.');
    expect(host.textContent).toContain('3 appareils connectés seront déconnectés.');

    type(host, '#rp-new', 'atelier-nord-2026');
    type(host, '#rp-confirm', 'atelier-nord-2026');
    await fixture.whenStable();
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(host.textContent).toContain('Choisissez un mot de passe qui respecte les 4 règles.');
    expect(document.activeElement?.id).toBe('rp-new');
    expect(confirmPasswordReset).not.toHaveBeenCalled();

    type(host, '#rp-new', 'Atelier-Nord-2026');
    type(host, '#rp-confirm', 'Atelier-Nord-2025');
    await fixture.whenStable();
    expect(host.textContent).toContain('Les deux mots de passe diffèrent : saisissez le même.');

    type(host, '#rp-confirm', 'Atelier-Nord-2026');
    await fixture.whenStable();
    expect(host.textContent).toContain('Les mots de passe correspondent.');
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(confirmPasswordReset).toHaveBeenCalledWith('reset-token', 'Atelier-Nord-2026', true);
    expect(host.textContent).toContain('Mot de passe modifié');
    expect(host.querySelector('h1 + p')?.textContent.trim()).toBe(
      'Vos 3 autres sessions ont été fermées. Un e-mail de confirmation vient de partir vers camille.martin@ateliernord.fr.',
    );
  });

  it('says an expired link has expired', async () => {
    const { host }: Awaited<ReturnType<typeof render>> = await render('token=old', {
      inspectPasswordReset: () =>
        Promise.resolve({
          ok: false,
          problem: { status: 422, code: 'auth.reset-link-expired', remainingAttempts: null },
        }),
    });

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Ce lien a expiré');
    expect(host.querySelector('a[href="/forgot"]')?.textContent.trim()).toBe(
      'Demander un nouveau lien',
    );
  });

  it('treats a link without a token as expired', async () => {
    const inspectPasswordReset: Mock = vi.fn();
    const { host }: Awaited<ReturnType<typeof render>> = await render(null, {
      inspectPasswordReset,
    });

    expect(inspectPasswordReset).not.toHaveBeenCalled();
    expect(host.querySelector('h1')?.textContent.trim()).toBe('Ce lien a expiré');
  });
});
