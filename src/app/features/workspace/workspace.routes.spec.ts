import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingApi } from '@features/organization/data-access/services/billing-api/billing-api.service';
import { InboxApi } from '@features/inbox/data-access/services/inbox-api/inbox-api.service';

import { WorkspaceSession } from './data-access/services/workspace-session/workspace-session.service';
import type {
  WorkspaceOrganization,
  WorkspaceProblem,
  WorkspaceResult,
  WorkspaceUser,
} from './models/workspace-context/workspace-context.interface';
import { WORKSPACE_ROUTES } from './workspace.routes';

/**
 * Component AuthStub
 *
 * @description
 * Stands for Auth's sign-in and organization choice, which this spec only reaches by redirect.
 */
@Component({ selector: 'cw-auth-stub', template: '<p>auth</p>' })
class AuthStub {}

/**
 * Constant camille
 *
 * @description
 * Signed-in person of the mockup.
 *
 * @type {WorkspaceUser}
 */
const camille: WorkspaceUser = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: 'Camille Martin',
  firstName: 'Camille',
  displayName: null,
  email: 'camille.martin@ateliernord.fr',
  initials: 'CM',
};

/**
 * Constant atelierNord
 *
 * @description
 * Current organization of the mockup.
 *
 * @type {WorkspaceOrganization}
 */
const atelierNord: WorkspaceOrganization = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

/**
 * Constant lumen
 *
 * @description
 * Another organization of the person in the mockup.
 *
 * @type {WorkspaceOrganization}
 */
const lumen: WorkspaceOrganization = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1c40',
  slug: 'lumen',
  name: 'Coopérative Lumen',
  initials: 'CL',
  role: 'member',
  plan: 'enterprise',
};

/**
 * Function ok
 *
 * @description
 * A successful workspace result.
 *
 * @template T
 * @param {T} value - Display model.
 * @returns {Observable<WorkspaceResult<T>>} The result.
 */
function ok<T>(value: T): Observable<WorkspaceResult<T>> {
  return of({ ok: true, value });
}

/**
 * Function failed
 *
 * @description
 * A failed workspace result.
 *
 * @template T
 * @param {WorkspaceProblem} problem - What the gateway answered.
 * @returns {Observable<WorkspaceResult<T>>} The result.
 */
function failed<T>(problem: WorkspaceProblem): Observable<WorkspaceResult<T>> {
  return of({ ok: false, problem });
}

/**
 * Interface SessionFake
 *
 * @description
 * Fake of the workspace data-access service.
 */
interface SessionFake {
  // #region Properties
  /**
   * Property currentUser
   *
   * @description
   * Fake of `currentUser`.
   *
   * @type {ReturnType<typeof vi.fn<() => Observable<WorkspaceResult<WorkspaceUser>>>>}
   * @readonly
   */
  readonly currentUser: ReturnType<typeof vi.fn<() => Observable<WorkspaceResult<WorkspaceUser>>>>;

  /**
   * Property currentOrganization
   *
   * @description
   * Fake of `currentOrganization`.
   *
   * @type {ReturnType<typeof vi.fn<() => Observable<WorkspaceResult<WorkspaceOrganization>>>>}
   * @readonly
   */
  readonly currentOrganization: ReturnType<
    typeof vi.fn<() => Observable<WorkspaceResult<WorkspaceOrganization>>>
  >;

  /**
   * Property myOrganizations
   *
   * @description
   * Fake of `myOrganizations`.
   *
   * @type {ReturnType<typeof vi.fn<() => Observable<WorkspaceResult<readonly WorkspaceOrganization[]>>>>}
   * @readonly
   */
  readonly myOrganizations: ReturnType<
    typeof vi.fn<() => Observable<WorkspaceResult<readonly WorkspaceOrganization[]>>>
  >;

  /**
   * Property switchOrganization
   *
   * @description
   * Fake of `switchOrganization`.
   *
   * @type {ReturnType<typeof vi.fn<(id: string) => Observable<WorkspaceResult<void>>>>}
   * @readonly
   */
  readonly switchOrganization: ReturnType<
    typeof vi.fn<(id: string) => Observable<WorkspaceResult<void>>>
  >;

  /**
   * Property exclusive
   *
   * @description
   * Runs the sequence the guard gives it, as the real lock does once granted.
   *
   * @type {ReturnType<typeof vi.fn<(operation: () => Observable<unknown>) => Observable<unknown>>>}
   * @readonly
   */
  readonly exclusive: ReturnType<
    typeof vi.fn<(operation: () => Observable<unknown>) => Observable<unknown>>
  >;
  // #endregion
}

describe('WORKSPACE_ROUTES', () => {
  let session: SessionFake;

  beforeEach(() => {
    session = {
      currentUser: vi.fn(() => ok(camille)),
      currentOrganization: vi.fn(() => ok(atelierNord)),
      myOrganizations: vi.fn(() => ok([atelierNord, lumen])),
      switchOrganization: vi.fn(() => ok(undefined)),
      exclusive: vi.fn((operation: () => Observable<unknown>) => operation()),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'login', component: AuthStub },
            { path: 'organizations', component: AuthStub },
            ...WORKSPACE_ROUTES,
          ],
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        { provide: WorkspaceSession, useValue: session },
        { provide: InboxApi, useValue: { unreadCount: () => of(2) } },
        {
          provide: BillingApi,
          useValue: {
            subscription: () =>
              Promise.resolve({
                plan: 'team',
                seatsUsed: 18,
                seatsLimit: 25,
                storageUsedBytes: 92_400_000_000,
                storageLimitBytes: 100_000_000_000,
              }),
          },
        },
      ],
    });
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Function open
   *
   * @description
   * Navigates the harness and waits for the lazy routes and the page.
   *
   * @param {string} url - Address to open.
   * @returns {Promise<RouterTestingHarness>} The harness after the navigation.
   */
  async function open(url: string): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it('opens the current organization in the shell with the greeting and the switcher', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Bonjour Camille');
    const switcher: HTMLButtonElement | null = element.querySelector(
      '[data-testid="organization-switcher"]',
    );
    expect(switcher?.getAttribute('aria-haspopup')).toBe('menu');
    expect(switcher?.textContent).toContain('AN');
    expect(switcher?.textContent).toContain('Changer d’organisation : Atelier Nord');
    expect(session.switchOrganization).not.toHaveBeenCalled();
  });

  it('binds every shell contribution on the workspace route', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');
    await harness.fixture.whenStable();
    harness.detectChanges();

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    for (const id of [
      'home-rail-item',
      'inbox-rail-item',
      'search-rail-item',
      'theme-rail-item',
      'user-menu-trigger',
      'search-button',
      'plan-summary',
      'shortcuts-button',
      'storage-banner',
    ]) {
      expect(element.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    expect(
      element.querySelector('[data-testid="home-rail-item"]')?.getAttribute('aria-current'),
    ).toBe('page');
  });

  it('switches the session to another organization of the person named by the slug', async () => {
    const harness: RouterTestingHarness = await open('/lumen');

    expect(session.switchOrganization).toHaveBeenCalledWith(lumen.id);
    expect(TestBed.inject(Router).url).toBe('/lumen');
    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="organization-switcher"]')?.textContent).toContain(
      'CL',
    );
  });

  it('follows an organization switch in place when the slug changes', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');
    await harness.navigateByUrl('/lumen');
    await harness.fixture.whenStable();
    harness.detectChanges();

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="organization-switcher"]')?.textContent).toContain(
      'Coopérative Lumen',
    );
  });

  it('switches when the session has no current organization and the slug matches one', async () => {
    session.currentOrganization.mockReturnValue(
      failed({ status: 403, code: 'organization.not-selected' }),
    );

    await open('/atelier-nord');

    expect(session.switchOrganization).toHaveBeenCalledWith(atelierNord.id);
    expect(TestBed.inject(Router).url).toBe('/atelier-nord');
  });

  it('reads and switches the organization under one exclusive session lock', async () => {
    await open('/lumen');

    expect(session.exclusive).toHaveBeenCalledOnce();
    expect(session.switchOrganization).toHaveBeenCalledWith(lumen.id);
  });

  it('never opens a reserved slug as a workspace', async () => {
    await open('/f');

    expect(TestBed.inject(Router).url).toBe('/organizations');
    expect(session.currentOrganization).not.toHaveBeenCalled();
    expect(session.switchOrganization).not.toHaveBeenCalled();
  });

  it('sends an e-mail link to the organization choice when the current slug is reserved', async () => {
    session.currentOrganization.mockReturnValue(ok({ ...atelierNord, slug: 'home' }));
    const router: Router = TestBed.inject(Router);

    await router.navigateByUrl('/home');

    expect(router.url).toBe('/organizations');
  });

  it('sends an unknown slug to the organization choice', async () => {
    await open('/inconnue');

    expect(TestBed.inject(Router).url).toBe('/organizations');
    expect(session.switchOrganization).not.toHaveBeenCalled();
  });

  it('sends a refused switch to the organization choice', async () => {
    session.currentOrganization.mockReturnValue(
      failed({ status: 403, code: 'organization.mfa-required' }),
    );
    session.switchOrganization.mockReturnValue(
      failed({ status: 403, code: 'organization.mfa-required' }),
    );

    await open('/lumen');

    expect(TestBed.inject(Router).url).toBe('/organizations');
  });

  it('sends a caller without a session to sign-in with the return address', async () => {
    session.currentUser.mockReturnValue(failed({ status: 401, code: 'auth.session-expired' }));
    session.currentOrganization.mockReturnValue(
      failed({ status: 401, code: 'auth.session-expired' }),
    );

    await open('/atelier-nord/missing');

    expect(TestBed.inject(Router).url).toBe('/login?next=%2Fatelier-nord%2Fmissing');
  });

  it('sends an unavailable gateway to the organization choice', async () => {
    session.currentOrganization.mockReturnValue(failed({ status: 503, code: null }));

    await open('/atelier-nord');

    expect(TestBed.inject(Router).url).toBe('/organizations');
  });

  it('renders the 404 inside the shell for an unknown address below the slug', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/missing/page');

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Page introuvable');
    expect(element.querySelector('[data-testid="organization-switcher"]')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/missing/page');
  });

  it.each([
    ['/home', '/atelier-nord'],
    ['/account', '/atelier-nord/account/profile'],
    ['/account/notifications?tab=email', '/atelier-nord/account/notifications?tab=email'],
    ['/org/quotas', '/atelier-nord/organization/quotas'],
  ])('redirects the e-mail link %s to %s', async (link: string, target: string) => {
    const router: Router = TestBed.inject(Router);

    await router.navigateByUrl(link);

    expect(router.url).toBe(target);
  });

  it('sends an e-mail link without a session to sign-in', async () => {
    session.currentOrganization.mockReturnValue(
      failed({ status: 401, code: 'auth.session-expired' }),
    );

    await TestBed.inject(Router).navigateByUrl('/org/quotas');

    expect(TestBed.inject(Router).url).toBe('/login?next=%2Forg%2Fquotas');
  });
});
