import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import type { AuthProblem } from '../../../models/auth-problem/auth-problem.interface';
import type {
  OrganizationChoice,
  ReceivedInvitation,
} from '../../../models/organization/organization.interface';
import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { OrganizationChoiceStore } from '../../../state/organization-choice/organization-choice.store';
import { OrganizationsPage } from './organizations-page.component';

/**
 * Constant atelierNord
 *
 * @description
 * Atelier Nord on the chooser.
 *
 * @type {OrganizationChoice}
 */
const atelierNord: OrganizationChoice = {
  id: 'org-atelier-nord',
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  role: 'owner',
  memberCount: 18,
  plan: 'team',
};

/**
 * Constant invitation
 *
 * @description
 * Inès Robert's invitation to Coopérative Lumen.
 *
 * @type {ReceivedInvitation}
 */
const invitation: ReceivedInvitation = {
  id: 'invitation-lumen',
  organizationName: 'Coopérative Lumen',
  role: 'member',
  inviterName: 'Inès Robert',
  expiresAt: '2026-11-15T10:00:00Z',
};

/**
 * Interface FakeChooser
 *
 * @description
 * The faked chooser store and its writable signals.
 */
interface FakeChooser {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The value provided in place of the store.
   *
   * @type {Record<string, unknown>}
   * @readonly
   */
  readonly store: Record<string, unknown>;

  /**
   * Property loading
   *
   * @description
   * Whether the list loads.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly loading: WritableSignal<boolean>;

  /**
   * Property loadProblem
   *
   * @description
   * Problem of the list.
   *
   * @type {WritableSignal<AuthProblem | null>}
   * @readonly
   */
  readonly loadProblem: WritableSignal<AuthProblem | null>;
  // #endregion
}

/**
 * Function chooser
 *
 * @description
 * Builds a faked chooser store listing Atelier Nord and Lumen's invitation.
 *
 * @returns {FakeChooser} The fake.
 */
function chooser(): FakeChooser {
  const loading: WritableSignal<boolean> = signal(false);
  const loadProblem: WritableSignal<AuthProblem | null> = signal(null);
  return {
    loading,
    loadProblem,
    store: {
      organizations: { isLoading: loading },
      loadProblem,
      invitationsProblem: signal(null),
      reloadInvitations: vi.fn(),
      choices: signal([atelierNord]),
      pendingInvitations: signal([invitation]),
      joined: signal([]),
      refused: signal(null),
      failure: signal(null),
      pendingId: signal(null),
      reload: vi.fn(),
      choose: vi.fn(() => Promise.resolve('/atelier-nord')),
      accept: vi.fn(),
      refuse: vi.fn(),
      undoRefuse: vi.fn(),
    },
  };
}

/**
 * Function render
 *
 * @description
 * Renders the chooser page with fakes.
 *
 * @param {FakeChooser} fake - The faked chooser store.
 * @param {Mock} signOut - The faked sign-out.
 * @returns {Promise<{ host: HTMLElement; fixture: ComponentFixture<OrganizationsPage>; navigate: Mock }>}
 * The page and its fakes.
 */
async function render(
  fake: FakeChooser,
  signOut: Mock = vi.fn(() => Promise.resolve({ ok: true, value: undefined })),
): Promise<{ host: HTMLElement; fixture: ComponentFixture<OrganizationsPage>; navigate: Mock }> {
  TestBed.configureTestingModule({
    imports: [OrganizationsPage],
    providers: [
      provideRouter([]),
      provideCadenwayIcons(),
      {
        provide: AuthFlowStore,
        useValue: {
          account: signal({ name: 'Camille Martin', email: 'camille.martin@ateliernord.fr' }),
          signOut,
        },
      },
    ],
  });
  TestBed.overrideComponent(OrganizationsPage, {
    set: { providers: [{ provide: OrganizationChoiceStore, useValue: fake.store }] },
  });
  const navigate: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<OrganizationsPage> = TestBed.createComponent(OrganizationsPage);
  fixture.componentRef.setInput('invitation', 'invitation-lumen');
  await fixture.whenStable();
  return { host: fixture.nativeElement as HTMLElement, fixture, navigate };
}

describe('OrganizationsPage', () => {
  it('lists the account, the invitation and the organizations, and opens the chosen one', async () => {
    const fake: FakeChooser = chooser();
    const { host, fixture, navigate }: Awaited<ReturnType<typeof render>> = await render(fake);

    expect(host.textContent).toContain('Connecté en tant que camille.martin@ateliernord.fr.');
    expect(
      host.querySelector('[data-testid="invitation-invitation-lumen"]')?.textContent,
    ).toContain('Inès Robert vous invite comme Membre');
    expect(host.textContent).toContain('Propriétaire · 18 membres · plan Équipe');

    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('Atelier Nord'))
      ?.click();
    await fixture.whenStable();
    expect(fake.store['choose']).toHaveBeenCalledWith(atelierNord);
    expect(navigate).toHaveBeenCalledWith('/atelier-nord', { replaceUrl: true });
  });

  it('tells a failed list from an empty one and retries it', async () => {
    const fake: FakeChooser = chooser();
    fake.loadProblem.set({ status: 503, code: 'upstream.unavailable', remainingAttempts: null });
    const { host, fixture }: Awaited<ReturnType<typeof render>> = await render(fake);

    expect(host.textContent).toContain('Impossible de charger cette page');
    expect(host.textContent).not.toContain('Atelier Nord');
    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.trim() === 'Réessayer')
      ?.click();
    await fixture.whenStable();
    expect(fake.store['reload']).toHaveBeenCalledOnce();
  });

  it('shows a failed invitation list inline with Réessayer instead of an empty list', async () => {
    const fake: FakeChooser = chooser();
    (fake.store['invitationsProblem'] as WritableSignal<AuthProblem | null>).set({
      status: 503,
      code: 'upstream.unavailable',
      remainingAttempts: null,
    });
    const { host, fixture }: Awaited<ReturnType<typeof render>> = await render(fake);

    const error: Element | null = host.querySelector('[data-testid="invitations-error"]');
    expect(error?.textContent).toContain('Impossible de charger cette section');
    expect(host.querySelector('[data-testid="invitation-invitation-lumen"]')).toBeNull();
    expect(host.textContent).toContain('Atelier Nord');
    error?.querySelector('button')?.click();
    await fixture.whenStable();
    expect(fake.store['reloadInvitations']).toHaveBeenCalledOnce();
  });

  it('returns to /login when the session is gone', async () => {
    const fake: FakeChooser = chooser();
    fake.loadProblem.set({ status: 401, code: 'auth.session-expired', remainingAttempts: null });
    const { navigate }: Awaited<ReturnType<typeof render>> = await render(fake);

    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('signs out to the signed-out screen', async () => {
    const { host, fixture, navigate }: Awaited<ReturnType<typeof render>> = await render(chooser());

    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('Se déconnecter'))
      ?.click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/logged-out?reason=signed-out', { replaceUrl: true });
  });
});
