import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { ForgotPage } from './forgot-page.component';

/**
 * Function resendButton
 *
 * @description
 * Finds `Resend the email`.
 *
 * @param {HTMLElement} host - The page.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function resendButton(host: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find((button: HTMLButtonElement) =>
    button.textContent.includes('Resend'),
  );
}

describe('ForgotPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the address error on submit, says to check the emails, waits 45 seconds to resend and lets the address change', async () => {
    const requestPasswordReset: Mock = vi.fn(() => Promise.resolve({ ok: true, value: undefined }));
    TestBed.configureTestingModule({
      imports: [ForgotPage],
      providers: [
        provideRouter([]),
        provideCadenwayIcons(),
        { provide: AuthFlowStore, useValue: { email: signal(''), requestPasswordReset } },
      ],
    });
    const fixture: ComponentFixture<ForgotPage> = TestBed.createComponent(ForgotPage);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const input: HTMLInputElement | null = host.querySelector('#fp-email');
    if (input === null) throw new Error('Expected the address.');

    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(host.querySelector('#fp-email-help')?.textContent).toContain(
      'Enter the email address of your account, for example camille.martin@ateliernord.fr.',
    );
    expect(document.activeElement).toBe(input);
    expect(requestPasswordReset).not.toHaveBeenCalled();

    input.value = 'camille.martin@ateliernord.fr';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();

    expect(requestPasswordReset).toHaveBeenCalledWith('camille.martin@ateliernord.fr');
    expect(host.querySelector('h1')?.textContent.trim()).toBe('Check your email');
    expect(resendButton(host)?.textContent.trim()).toBe('Resend the email in 0:45');
    await vi.advanceTimersByTimeAsync(44_000);
    await fixture.whenStable();
    expect(resendButton(host)?.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    await fixture.whenStable();
    resendButton(host)?.click();
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();
    expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain(
      'A new link has just been sent; the previous one no longer works.',
    );

    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('Change the address'))
      ?.click();
    await fixture.whenStable();
    await new Promise<void>((resolve: () => void) => {
      setTimeout(resolve);
    });
    expect(host.querySelector('h1')?.textContent.trim()).toBe('Forgot password');
    const edited: HTMLInputElement | null = host.querySelector('#fp-email');
    expect(document.activeElement).toBe(edited);
    expect(edited?.selectionStart).toBe(0);
    expect(edited?.selectionEnd).toBe('camille.martin@ateliernord.fr'.length);
  });
});
