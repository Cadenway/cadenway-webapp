import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';

import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { SignupPage } from './signup-page.component';

/**
 * Function render
 *
 * @description
 * Renders the sign-up page with a faked sign-up outcome.
 *
 * @param {unknown} result - What the flow store's `signUp` resolves to.
 * @returns {Promise<{ host: HTMLElement; fixture: ComponentFixture<SignupPage>; navigate: Mock; signUp: Mock }>}
 * The page and its fakes.
 */
async function render(result: unknown): Promise<{
  host: HTMLElement;
  fixture: ComponentFixture<SignupPage>;
  navigate: Mock;
  signUp: Mock;
}> {
  const signUp: Mock = vi.fn(() => Promise.resolve(result));
  TestBed.configureTestingModule({
    imports: [SignupPage],
    providers: [
      provideRouter([]),
      provideCadenwayIcons(),
      { provide: AuthFlowStore, useValue: { federatedStarting: signal(false), signUp } },
      {
        provide: RuntimeConfigStore,
        useValue: {
          config: signal({ apiUrl: 'http://api.localhost', siteUrl: 'https://cadenway.example' }),
        },
      },
    ],
  });
  const navigate: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<SignupPage> = TestBed.createComponent(SignupPage);
  await fixture.whenStable();
  const host: HTMLElement = fixture.nativeElement as HTMLElement;
  for (const [selector, value] of [
    ['#su-name', 'Camille Martin'],
    ['#su-email', 'camille.martin@ateliernord.fr'],
    ['#su-password', 'atelier-nord-2026'],
  ] as const) {
    const input: HTMLInputElement | null = host.querySelector(selector);
    if (input === null) throw new Error(`Expected ${selector}.`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  await fixture.whenStable();
  return { host, fixture, navigate, signUp };
}

/**
 * Function acceptAndSubmit
 *
 * @description
 * Ticks the terms and submits the form.
 *
 * @param {HTMLElement} host - The page.
 * @param {ComponentFixture<SignupPage>} fixture - Its fixture.
 * @returns {Promise<void>} Resolves once settled.
 */
async function acceptAndSubmit(
  host: HTMLElement,
  fixture: ComponentFixture<SignupPage>,
): Promise<void> {
  host.querySelector<HTMLButtonElement>('#su-terms')?.click();
  await fixture.whenStable();
  host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  await fixture.whenStable();
}

describe('SignupPage', () => {
  it('shows the terms error on submit, then opens the verification', async () => {
    const { host, fixture, navigate, signUp }: Awaited<ReturnType<typeof render>> = await render({
      ok: true,
      value: undefined,
    });
    const submit: HTMLButtonElement | null = host.querySelector('button[type="submit"]');

    expect(submit?.disabled).toBe(false);
    expect(host.querySelector('cw-password-strength')).not.toBeNull();
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(host.querySelector('#su-terms-help')?.textContent).toContain(
      'Accept the terms to create your account.',
    );
    expect(signUp).not.toHaveBeenCalled();

    await acceptAndSubmit(host, fixture);

    expect(signUp).toHaveBeenCalledWith({
      name: 'Camille Martin',
      email: 'camille.martin@ateliernord.fr',
      password: 'atelier-nord-2026',
    });
    expect(navigate).toHaveBeenCalledWith('/signup/verify');
  });

  it('asks for a work address when the address is not valid', async () => {
    const { host, fixture, signUp }: Awaited<ReturnType<typeof render>> = await render({
      ok: true,
      value: undefined,
    });
    const input: HTMLInputElement | null = host.querySelector('#su-email');
    if (input === null) throw new Error('Expected the address.');
    input.value = 'camille';
    input.dispatchEvent(new Event('input'));
    await acceptAndSubmit(host, fixture);

    expect(host.querySelector('#su-email-help')?.textContent).toContain(
      'Enter your work email address, for example camille.martin@ateliernord.fr.',
    );
    expect(document.activeElement).toBe(input);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('sends one sign-up when the form is submitted twice before the answer', async () => {
    const { host, fixture, navigate, signUp }: Awaited<ReturnType<typeof render>> = await render({
      ok: true,
      value: undefined,
    });
    let answer: (value: unknown) => void = () => undefined;
    signUp.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    host.querySelector<HTMLButtonElement>('#su-terms')?.click();
    await fixture.whenStable();
    const form: HTMLFormElement | null = host.querySelector('form');

    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    form?.dispatchEvent(new Event('submit', { cancelable: true }));
    await expect.poll(() => signUp.mock.calls.length).toBe(1);
    answer({ ok: true, value: undefined });
    await fixture.whenStable();

    expect(signUp).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('says the address is taken, with a link to sign in', async () => {
    const { host, fixture, navigate }: Awaited<ReturnType<typeof render>> = await render({
      ok: false,
      problem: { status: 409, code: 'auth.email-taken', remainingAttempts: null },
    });

    await acceptAndSubmit(host, fixture);

    expect(host.querySelector('#su-email-help')?.textContent).toContain(
      'An account already uses this address: sign in.',
    );
    expect(host.querySelector('#su-email-help a')?.getAttribute('href')).toBe('/login');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('asks to sign up again after a replaced sign-up', async () => {
    const { host, fixture }: Awaited<ReturnType<typeof render>> = await render({
      ok: true,
      value: undefined,
    });
    fixture.componentRef.setInput('reason', 'sign-up-replaced');
    await fixture.whenStable();

    expect(host.querySelector('cw-alert')?.textContent).toContain(
      'A newer sign-up replaced this one',
    );
  });
});
