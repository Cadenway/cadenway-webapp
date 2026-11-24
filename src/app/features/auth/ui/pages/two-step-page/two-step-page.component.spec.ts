import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

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

    expect(host.textContent).toContain('Vérification en deux étapes');
    expect(host.textContent).toContain(
      "Saisissez le code à 6 chiffres affiché par votre application d'authentification.",
    );
    const input: HTMLInputElement | null = host.querySelector('#mfa-app-code');
    if (input === null) throw new Error('Expected the app code.');
    const verify: () => HTMLButtonElement | null = () =>
      host.querySelector<HTMLButtonElement>('cw-tab-panel button[type="submit"]');
    input.value = '123';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(verify()?.textContent.trim()).toBe('Vérifier (3 / 6)');
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
      'Code incorrect. Vérifiez le code de votre application.',
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

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Vérification en deux étapes');
    expect(host.querySelector('cw-alert')?.textContent).toContain(
      'La vérification a expiré. Connectez-vous à nouveau.',
    );
    const again: HTMLAnchorElement | null = host.querySelector('a[href="/login"]');
    expect(again?.textContent.trim()).toBe('Se reconnecter');
    expect(host.querySelector('#mfa-app-code')).toBeNull();
    expect(host.querySelector('[cwSkeleton]')).toBeNull();
  });

  it('lists the security keys and the unused backup codes', async () => {
    const { host, fixture }: Awaited<ReturnType<typeof render>> = await render({
      challenge: signal(challenge),
      loadChallenge: vi.fn(() => Promise.resolve(true)),
    });

    Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab: HTMLButtonElement) => tab.textContent.includes('Clé de sécurité'))
      ?.click();
    await fixture.whenStable();
    expect(host.textContent).toContain(
      '2 clés enregistrées : YubiKey 5C NFC, Touch ID (MacBook Air).',
    );
    expect(host.textContent).toContain(
      'Il vous reste 7 codes inutilisés. Pensez à en générer de nouveaux depuis votre profil.',
    );
  });
});
