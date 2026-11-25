import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { LoggedOutPage } from './logged-out-page.component';

/**
 * Function render
 *
 * @description
 * Renders the signed-out page for a reason, with Camille's two accounts remembered.
 *
 * @param {string | undefined} reason - The `?reason=` value.
 * @returns {Promise<{ host: HTMLElement; fixture: ComponentFixture<LoggedOutPage>; navigate: Mock; prefill: Mock }>}
 * The page and its fakes.
 */
async function render(reason: string | undefined): Promise<{
  host: HTMLElement;
  fixture: ComponentFixture<LoggedOutPage>;
  navigate: Mock;
  prefill: Mock;
}> {
  localStorage.setItem(
    'cadenway-remembered-accounts',
    JSON.stringify([
      { name: 'Camille Martin', email: 'camille.martin@ateliernord.fr' },
      { name: 'Camille Martin (Lumen)', email: 'c.martin@lumen.coop' },
    ]),
  );
  const prefill: Mock = vi.fn();
  TestBed.configureTestingModule({
    imports: [LoggedOutPage],
    providers: [
      provideRouter([]),
      provideCadenwayIcons(),
      { provide: AuthFlowStore, useValue: { prefill, setEmail: vi.fn() } },
    ],
  });
  const navigate: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<LoggedOutPage> = TestBed.createComponent(LoggedOutPage);
  fixture.componentRef.setInput('reason', reason);
  await fixture.whenStable();
  return { host: fixture.nativeElement as HTMLElement, fixture, navigate, prefill };
}

describe('LoggedOutPage', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('greets the person and signs in again with a remembered account', async () => {
    const { host, fixture, navigate, prefill }: Awaited<ReturnType<typeof render>> =
      await render(undefined);

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Vous êtes déconnecté');
    expect(host.textContent).toContain('À bientôt, Camille. Votre session');
    host
      .querySelector<HTMLButtonElement>('[aria-label="Se connecter avec c.martin@lumen.coop"]')
      ?.click();
    await fixture.whenStable();

    expect(prefill).toHaveBeenCalledWith('c.martin@lumen.coop');
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('forgets an account with an undo', async () => {
    const { host, fixture }: Awaited<ReturnType<typeof render>> = await render('expired');

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Session expirée');
    host
      .querySelector<HTMLButtonElement>(
        '[aria-label="Oublier camille.martin@ateliernord.fr sur cet appareil"]',
      )
      ?.click();
    await fixture.whenStable();
    expect(host.querySelectorAll('li')).toHaveLength(1);
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      'camille.martin@ateliernord.fr n’est plus mémorisé sur cet appareil.',
    );

    Array.from(host.querySelectorAll<HTMLButtonElement>('[role="status"] button'))[0]?.click();
    await fixture.whenStable();
    expect(host.querySelectorAll('li')).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem('cadenway-remembered-accounts') ?? '[]')).toHaveLength(
      2,
    );
  });

  it('says every session was closed', async () => {
    const { host }: Awaited<ReturnType<typeof render>> = await render('all-devices');

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Déconnecté de tous les appareils');
  });
});
