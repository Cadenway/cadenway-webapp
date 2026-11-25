import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';

import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { CodeSignInPage } from './code-sign-in-page.component';

/**
 * Function resendButton
 *
 * @description
 * Finds `Resend the code`.
 *
 * @param {HTMLElement} host - The page.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function resendButton(host: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find((button: HTMLButtonElement) =>
    button.textContent.includes('Resend'),
  );
}

describe('CodeSignInPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a code to the shared address, waits 30 seconds to resend and signs in', async () => {
    const requestSignInCode: Mock = vi.fn(() => Promise.resolve({ ok: true, value: undefined }));
    const signInWithCode: Mock = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'failed',
        problem: { status: 422, code: 'auth.code-invalid', remainingAttempts: null },
      })
      .mockResolvedValueOnce({ kind: 'challenge' });
    TestBed.configureTestingModule({
      imports: [CodeSignInPage],
      providers: [
        provideRouter([]),
        provideCadenwayIcons(),
        {
          provide: RuntimeConfigStore,
          useValue: {
            config: signal({ apiUrl: 'http://api.localhost', siteUrl: 'https://cadenway.example' }),
          },
        },
        {
          provide: AuthFlowStore,
          useValue: {
            email: signal('camille.martin@ateliernord.fr'),
            requestSignInCode,
            signInWithCode,
          },
        },
      ],
    });
    const navigate: Mock = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true) as Mock;
    const fixture: ComponentFixture<CodeSignInPage> = TestBed.createComponent(CodeSignInPage);
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(requestSignInCode).toHaveBeenCalledWith('camille.martin@ateliernord.fr');
    expect(host.textContent).toContain('camille.martin@ateliernord.fr');
    expect(resendButton(host)?.textContent.trim()).toBe('Resend the code in 0:30');
    expect(resendButton(host)?.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    await fixture.whenStable();
    expect(resendButton(host)?.disabled).toBe(false);
    resendButton(host)?.click();
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();
    expect(requestSignInCode).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('New code sent; the previous one no longer works.');
    expect(host.querySelector('cw-code-help a')?.getAttribute('href')).toBe(
      'https://cadenway.example/help',
    );

    const input: HTMLInputElement | null = host.querySelector('#code-input');
    if (input === null) throw new Error('Expected the code input.');
    const submitCode: () => Promise<void> = async (): Promise<void> => {
      input.value = '123456';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.advanceTimersByTimeAsync(0);
      await fixture.whenStable();
    };
    await submitCode();
    expect(host.textContent).toContain('Wrong or expired code: check the last email you received.');
    await submitCode();
    expect(navigate).toHaveBeenCalledWith('/login/two-step', { replaceUrl: true });
  });

  it('asks for the address first when none is known and shows its error on submit', async () => {
    const requestSignInCode: Mock = vi.fn(() => Promise.resolve({ ok: true, value: undefined }));
    TestBed.configureTestingModule({
      imports: [CodeSignInPage],
      providers: [
        provideRouter([]),
        provideCadenwayIcons(),
        {
          provide: RuntimeConfigStore,
          useValue: {
            config: signal({ apiUrl: 'http://api.localhost', siteUrl: 'https://cadenway.example' }),
          },
        },
        { provide: AuthFlowStore, useValue: { email: signal(''), requestSignInCode } },
      ],
    });
    const fixture: ComponentFixture<CodeSignInPage> = TestBed.createComponent(CodeSignInPage);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(requestSignInCode).not.toHaveBeenCalled();
    expect(host.querySelector('#code-email')).not.toBeNull();
    expect(host.querySelector('cw-code-help')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(host.querySelector('#code-email-help')?.textContent).toContain(
      'Enter the email address of your account, for example camille.martin@ateliernord.fr.',
    );
    expect(document.activeElement?.id).toBe('code-email');
    expect(requestSignInCode).not.toHaveBeenCalled();
  });
});
