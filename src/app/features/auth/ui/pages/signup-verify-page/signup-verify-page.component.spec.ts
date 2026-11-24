import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { SignupVerifyPage } from './signup-verify-page.component';

/**
 * Function render
 *
 * @description
 * Renders the verification page with a faked flow store.
 *
 * @param {Record<string, unknown>} flow - The faked store.
 * @returns {Promise<{ host: HTMLElement; fixture: ComponentFixture<SignupVerifyPage>; navigate: Mock }>}
 * The page and its fakes.
 */
async function render(flow: Record<string, unknown>): Promise<{
  host: HTMLElement;
  fixture: ComponentFixture<SignupVerifyPage>;
  navigate: Mock;
}> {
  TestBed.configureTestingModule({
    imports: [SignupVerifyPage],
    providers: [
      provideRouter([]),
      provideCadenwayIcons(),
      { provide: AuthFlowStore, useValue: { abandonSignUp: vi.fn(), ...flow } },
    ],
  });
  const navigate: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<SignupVerifyPage> = TestBed.createComponent(SignupVerifyPage);
  await vi.advanceTimersByTimeAsync(0);
  await fixture.whenStable();
  return { host: fixture.nativeElement as HTMLElement, fixture, navigate };
}

describe('SignupVerifyPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns to /signup without a pending sign-up', async () => {
    const { navigate }: Awaited<ReturnType<typeof render>> = await render({
      signUpEmail: signal(null),
    });

    expect(navigate).toHaveBeenCalledWith('/signup', { replaceUrl: true });
  });

  it('verifies the address and opens the first session', async () => {
    const verifySignUp: Mock = vi.fn(() =>
      Promise.resolve({ kind: 'signed-in', destination: '/organizations' }),
    );
    const resendSignUpCode: Mock = vi.fn(() => Promise.resolve({ ok: true, value: undefined }));
    const { host, fixture, navigate }: Awaited<ReturnType<typeof render>> = await render({
      signUpEmail: signal('camille.martin@ateliernord.fr'),
      verifySignUp,
      resendSignUpCode,
    });

    expect(host.textContent).toContain('Confirmez votre adresse e-mail');
    expect(host.textContent).toContain('Renvoyer le code dans 0:30');
    await vi.advanceTimersByTimeAsync(30_000);
    await fixture.whenStable();
    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('Renvoyer le code'))
      ?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(resendSignUpCode).toHaveBeenCalledOnce();

    const input: HTMLInputElement | null = host.querySelector('#code-input');
    if (input === null) throw new Error('Expected the code input.');
    input.value = '654321';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.advanceTimersByTimeAsync(0);

    expect(verifySignUp).toHaveBeenCalledWith('654321');
    expect(navigate).toHaveBeenCalledWith('/organizations', { replaceUrl: true });
  });

  it('sends a replaced sign-up back to sign-up with its notice', async () => {
    const { host, fixture, navigate }: Awaited<ReturnType<typeof render>> = await render({
      signUpEmail: signal('camille.martin@ateliernord.fr'),
      verifySignUp: vi.fn(() =>
        Promise.resolve({
          kind: 'failed',
          problem: { status: 422, code: 'auth.sign-up-replaced', remainingAttempts: null },
        }),
      ),
    });
    const input: HTMLInputElement | null = host.querySelector('#code-input');
    if (input === null) throw new Error('Expected the code input.');
    input.value = '654321';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.advanceTimersByTimeAsync(0);

    expect(navigate).toHaveBeenCalledWith('/signup?reason=sign-up-replaced', { replaceUrl: true });
    expect(host.textContent).not.toContain('Code incorrect ou expiré');
  });
});
