import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import type { SessionResult } from '../../../state/auth-flow/auth-flow.store';
import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { LoginPage } from './login-page.component';

/**
 * Interface Rendered
 *
 * @description
 * A rendered login page with its fakes.
 */
interface Rendered {
  // #region Properties
  /**
   * Property host
   *
   * @description
   * The page element.
   *
   * @type {HTMLElement}
   * @readonly
   */
  readonly host: HTMLElement;

  /**
   * Property fixture
   *
   * @description
   * The page fixture.
   *
   * @type {ComponentFixture<LoginPage>}
   * @readonly
   */
  readonly fixture: ComponentFixture<LoginPage>;

  /**
   * Property navigate
   *
   * @description
   * Spy of the router navigation.
   *
   * @type {Mock}
   * @readonly
   */
  readonly navigate: Mock;

  /**
   * Property flow
   *
   * @description
   * The faked flow store.
   *
   * @type {Record<string, unknown>}
   * @readonly
   */
  readonly flow: Record<string, unknown>;
  // #endregion
}

/**
 * Function render
 *
 * @description
 * Renders the login page with a faked flow store whose password sign-in gives `result`.
 *
 * @param {SessionResult} result - The sign-in outcome.
 * @param {boolean} prefilled - Whether the address comes from a remembered account.
 * @returns {Promise<Rendered>} The page and its fakes.
 */
async function render(result: SessionResult, prefilled: boolean = false): Promise<Rendered> {
  const flow: Record<string, unknown> = {
    email: signal(prefilled ? 'camille.martin@ateliernord.fr' : ''),
    prefilled: signal(prefilled),
    rememberMe: signal(true),
    federatedStarting: signal(false),
    setReturnUrl: vi.fn(),
    setEmail: vi.fn(),
    setRememberMe: vi.fn(),
    signInWithPassword: vi.fn(() => Promise.resolve(result)),
    startFederatedSignIn: vi.fn(() =>
      Promise.resolve({ ok: false, problem: { status: 503, code: null, remainingAttempts: null } }),
    ),
  };
  TestBed.configureTestingModule({
    imports: [LoginPage],
    providers: [
      provideRouter([]),
      provideCadenwayIcons(),
      { provide: AuthFlowStore, useValue: flow },
    ],
  });
  const navigate: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<LoginPage> = TestBed.createComponent(LoginPage);
  fixture.componentRef.setInput('next', '/invite/invitation-lumen');
  await fixture.whenStable();
  return { host: fixture.nativeElement as HTMLElement, fixture, navigate, flow };
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

/**
 * Function signIn
 *
 * @description
 * Fills the form and submits it.
 *
 * @param {Rendered} page - The rendered page.
 * @returns {Promise<void>} Resolves once the page settled.
 */
async function signIn(page: Rendered): Promise<void> {
  type(page.host, '#login-email', 'camille.martin@ateliernord.fr');
  type(page.host, '#login-password', 'atelier-nord');
  await page.fixture.whenStable();
  page.host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  await page.fixture.whenStable();
}

describe('LoginPage', () => {
  it('shows the errors of an incomplete form on submit, then opens the destination', async () => {
    const page: Rendered = await render({ kind: 'signed-in', destination: '/atelier-nord' });
    const submit: HTMLButtonElement | null = page.host.querySelector('button[type="submit"]');

    expect(page.flow['setReturnUrl']).toHaveBeenCalledWith('/invite/invitation-lumen');
    expect(submit?.disabled).toBe(false);
    page.host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await page.fixture.whenStable();

    expect(page.host.querySelector('#login-email-help')?.textContent).toContain(
      "Saisissez l'adresse e-mail de votre compte, par exemple camille.martin@ateliernord.fr.",
    );
    expect(page.host.querySelector('#login-password-help')?.textContent).toContain(
      'Saisissez votre mot de passe.',
    );
    expect(document.activeElement?.id).toBe('login-email');
    expect(page.flow['signInWithPassword']).not.toHaveBeenCalled();
    await signIn(page);

    expect(page.flow['signInWithPassword']).toHaveBeenCalledWith(
      'camille.martin@ateliernord.fr',
      'atelier-nord',
    );
    expect(page.navigate).toHaveBeenCalledWith('/atelier-nord', { replaceUrl: true });
  });

  it('opens the two-step screen for a challenge', async () => {
    const page: Rendered = await render({ kind: 'challenge' });

    await signIn(page);

    expect(page.navigate).toHaveBeenCalledWith('/login/two-step', { replaceUrl: true });
  });

  it('shows the attempts left and marks the password after a wrong password', async () => {
    const page: Rendered = await render({
      kind: 'failed',
      problem: { status: 422, code: 'auth.invalid-credentials', remainingAttempts: 3 },
    });

    await signIn(page);

    const alert: string = page.host.querySelector('cw-alert')?.textContent ?? '';
    expect(alert).toContain('E-mail ou mot de passe incorrect.');
    expect(alert).toContain(
      'Vérifiez votre saisie. Il vous reste 3 tentatives avant le verrouillage temporaire.',
    );
    expect(page.host.querySelector('#login-password-help')?.textContent).toContain(
      'Mot de passe incorrect : vérifiez les majuscules.',
    );
    expect(page.navigate).not.toHaveBeenCalled();
  });

  it('shows the lockout with the reset link', async () => {
    const page: Rendered = await render({
      kind: 'failed',
      problem: { status: 429, code: 'auth.account-locked', remainingAttempts: null },
    });

    await signIn(page);

    expect(page.host.textContent).toContain('Compte verrouillé pendant 15 minutes.');
    expect(page.host.querySelector('cw-alert a')?.getAttribute('href')).toBe('/forgot');
  });

  it('separates the sign-up question from its link', async () => {
    const page: Rendered = await render({ kind: 'challenge' });

    expect(page.host.textContent).toContain('Pas encore de compte ? Créer un compte');
  });

  it('says the address of a remembered account is prefilled', async () => {
    const page: Rendered = await render({ kind: 'challenge' }, true);

    expect(page.host.querySelector<HTMLInputElement>('#login-email')?.value).toBe(
      'camille.martin@ateliernord.fr',
    );
    expect(page.host.textContent).toContain(
      'Compte mémorisé sur cet appareil : saisissez son mot de passe.',
    );
  });

  it('shows a refused provider redirect', async () => {
    const page: Rendered = await render({ kind: 'challenge' });

    Array.from(page.host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('GitHub'))
      ?.click();
    await page.fixture.whenStable();

    expect(page.flow['startFederatedSignIn']).toHaveBeenCalledWith('github');
    expect(page.host.textContent).toContain('Connexion indisponible. Réessayez dans un instant.');
  });
});
