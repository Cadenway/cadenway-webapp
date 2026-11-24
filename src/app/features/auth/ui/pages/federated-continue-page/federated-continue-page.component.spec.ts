import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { FederatedContinuePage } from './federated-continue-page.component';

/**
 * Function render
 *
 * @description
 * Renders the continuation page with a faked redemption.
 *
 * @param {unknown} result - What the redemption resolves to.
 * @returns {Promise<{ host: HTMLElement; navigate: Mock; finish: Mock }>} The page and its fakes.
 */
async function render(
  result: unknown,
): Promise<{ host: HTMLElement; navigate: Mock; finish: Mock }> {
  const finish: Mock = vi.fn(() => Promise.resolve(result));
  TestBed.configureTestingModule({
    imports: [FederatedContinuePage],
    providers: [
      provideRouter([]),
      provideCadenwayIcons(),
      { provide: AuthFlowStore, useValue: { finishFederatedSignIn: finish } },
    ],
  });
  const navigate: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<FederatedContinuePage> =
    TestBed.createComponent(FederatedContinuePage);
  await fixture.whenStable();
  await fixture.whenStable();
  return { host: fixture.nativeElement as HTMLElement, navigate, finish };
}

describe('FederatedContinuePage', () => {
  it('redeems the continuation once and opens the two-step screen of a challenge', async () => {
    const { navigate, finish }: Awaited<ReturnType<typeof render>> = await render({
      kind: 'challenge',
    });

    expect(finish).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login/two-step', { replaceUrl: true });
  });

  it('opens the destination of a session', async () => {
    const { navigate }: Awaited<ReturnType<typeof render>> = await render({
      kind: 'signed-in',
      destination: '/atelier-nord',
    });

    expect(navigate).toHaveBeenCalledWith('/atelier-nord', { replaceUrl: true });
  });

  it('shows a refused continuation with the other methods', async () => {
    const { host, navigate }: Awaited<ReturnType<typeof render>> = await render({
      kind: 'failed',
      problem: { status: 422, code: 'auth.federated-sign-in-refused', remainingAttempts: null },
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Cette méthode de connexion ne peut pas être utilisée.');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/login');
  });
});
