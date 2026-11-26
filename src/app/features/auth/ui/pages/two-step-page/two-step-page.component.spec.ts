import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';

import type { TwoStepChallenge } from '../../../models/session/session.interface';
import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { TwoStepPage } from './two-step-page.component';

/**
 * Constant challenge
 *
 * @description
 * Camille's challenge with every method.
 *
 * @type {TwoStepChallenge}
 */
const challenge: TwoStepChallenge = {
  email: 'camille.martin@ateliernord.fr',
  name: 'Camille Martin',
  methods: ['authenticator-app', 'security-key', 'backup-code'],
  securityKeys: ['YubiKey 5C NFC', 'Touch ID (MacBook Air)'],
  backupCodesRemaining: 7,
};

/**
 * Function render
 *
 * @description
 * Renders the page with a faked flow store.
 *
 * @param {Record<string, unknown>} flow - The faked store.
 * @returns {Promise<{ host: HTMLElement; fixture: ComponentFixture<TwoStepPage>; navigate: Mock }>}
 * The page, its fixture and the navigation spy.
 */
async function render(
  flow: Record<string, unknown>,
): Promise<{ host: HTMLElement; fixture: ComponentFixture<TwoStepPage>; navigate: Mock }> {
  TestBed.configureTestingModule({
    imports: [TwoStepPage],
    providers: [
      provideRouter([]),
      provideCadenwayIcons(),
      {
        provide: RuntimeConfigStore,
        useValue: {
          config: signal({ apiUrl: 'http://api.localhost', siteUrl: 'https://cadenway.example' }),
        },
      },
      { provide: AuthFlowStore, useValue: { cancelChallenge: vi.fn(), ...flow } },
    ],
  });
  const navigate: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<TwoStepPage> = TestBed.createComponent(TwoStepPage);
  await fixture.whenStable();
  return { host: fixture.nativeElement as HTMLElement, fixture, navigate };
}

describe('TwoStepPage', () => {
  it('returns to /login without a pending challenge', async () => {
    const { navigate }: Awaited<ReturnType<typeof render>> = await render({
      challenge: signal(null),
      loadChallenge: vi.fn(() => Promise.resolve(false)),
    });

    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('counts the digits, shows a wrong code and opens the destination of an accepted one', async () => {
    const pending: WritableSignal<TwoStepChallenge | null> = signal(challenge);
    const answerChallenge: Mock = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'failed',
        problem: { status: 422, code: 'auth.two-step-code-invalid', remainingAttempts: 4 },
      })
      .mockResolvedValueOnce({ kind: 'signed-in', destination: '/atelier-nord' });
    const { host, fixture, navigate }: Awaited<ReturnType<typeof render>> = await render({
      challenge: pending,
      loadChallenge: vi.fn(() => Promise.resolve(true)),
      answerChallenge,
    });

    expect(host.textContent).toContain('Two-step verification');
    expect(host.textContent).toContain('Enter the 6-digit code shown by your authenticator app.');
    const input: HTMLInputElement | null = host.querySelector('#mfa-app-code');
    if (input === null) throw new Error('Expected the app code.');
    const verify: () => HTMLButtonElement | null = () =>
      host.querySelector<HTMLButtonElement>('cw-tab-panel button[type="submit"]');
    input.value = '123';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(verify()?.textContent.trim()).toBe('Verify (3 / 6)');
    expect(verify()?.disabled).toBe(true);

    const send: () => Promise<void> = async (): Promise<void> => {
      input.value = '123456';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      verify()
        ?.closest('form')
        ?.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
    };
    await send();
    expect(answerChallenge).toHaveBeenCalledWith(
      { method: 'authenticator-app', code: '123456' },
      false,
    );
    expect(host.querySelector('cw-alert')?.textContent).toContain(
      'Wrong code. Check the code of your app.',
    );
    await send();
    expect(navigate).toHaveBeenCalledWith('/atelier-nord', { replaceUrl: true });
  });

  it('keeps its frame and offers to sign in again when the challenge expired', async () => {
    const pending: WritableSignal<TwoStepChallenge | null> = signal(challenge);
    const answerChallenge: Mock = vi.fn(() => {
      pending.set(null);
      return Promise.resolve({
        kind: 'failed',
        problem: { status: 422, code: 'auth.challenge-expired', remainingAttempts: null },
      });
    });
    const { host, fixture }: Awaited<ReturnType<typeof render>> = await render({
      challenge: pending,
      loadChallenge: vi.fn(() => Promise.resolve(true)),
      answerChallenge,
    });
    const input: HTMLInputElement | null = host.querySelector('#mfa-app-code');
    if (input === null) throw new Error('Expected the app code.');
    input.value = '123456';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    host
      .querySelector('cw-tab-panel form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Two-step verification');
    expect(host.querySelector('cw-alert')?.textContent).toContain(
      'The verification expired. Sign in again.',
    );
    const again: HTMLAnchorElement | null = host.querySelector('a[href="/login"]');
    expect(again?.textContent.trim()).toBe('Sign in again');
    expect(host.querySelector('#mfa-app-code')).toBeNull();
    expect(host.querySelector('[cwSkeleton]')).toBeNull();
  });

  it('lists the security keys and the unused backup codes', async () => {
    const { host, fixture }: Awaited<ReturnType<typeof render>> = await render({
      challenge: signal(challenge),
      loadChallenge: vi.fn(() => Promise.resolve(true)),
    });

    Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab: HTMLButtonElement) => tab.textContent.includes('Security key'))
      ?.click();
    await fixture.whenStable();
    expect(host.textContent).toContain(
      '2 registered keys: YubiKey 5C NFC, Touch ID (MacBook Air).',
    );
    expect(host.textContent).toContain(
      'You have 7 unused codes left. Remember to generate new ones from your profile.',
    );
    const backup: HTMLInputElement | null = host.querySelector('#mfa-backup');
    expect(backup?.getAttribute('maxlength')).toBe('9');
  });

  it('shows a recognized key and continues to the destination on request', async () => {
    const answerChallenge: Mock = vi.fn(() =>
      Promise.resolve({ kind: 'signed-in', destination: '/atelier-nord' }),
    );
    const { host, fixture, navigate }: Awaited<ReturnType<typeof render>> = await render({
      challenge: signal({ ...challenge, securityKeys: ['YubiKey 5C NFC'] }),
      loadChallenge: vi.fn(() => Promise.resolve(true)),
      answerChallenge,
    });
    Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab: HTMLButtonElement) => tab.textContent.includes('Security key'))
      ?.click();
    await fixture.whenStable();
    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('Use my security key'))
      ?.click();
    await fixture.whenStable();

    expect(answerChallenge).toHaveBeenCalledWith({ method: 'security-key' }, false);
    expect(host.textContent).toContain('Key recognized: YubiKey 5C NFC');
    expect(navigate).not.toHaveBeenCalled();
    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.trim() === 'Continue')
      ?.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/atelier-nord', { replaceUrl: true });
  });

  it('links the administrator contact to the help page beside another account', async () => {
    const { host }: Awaited<ReturnType<typeof render>> = await render({
      challenge: signal(challenge),
      loadChallenge: vi.fn(() => Promise.resolve(true)),
    });

    const contact: HTMLAnchorElement | undefined = Array.from(
      host.querySelectorAll<HTMLAnchorElement>('a'),
    ).find((link: HTMLAnchorElement) => link.textContent.includes('Contact the administrator'));
    expect(contact?.getAttribute('href')).toBe('https://cadenway.example/help');
    expect(host.textContent).toContain('Use another account');
  });
});
