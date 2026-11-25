import { HttpContext, HttpErrorResponse, HttpResponse, HttpRequest } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  provideRouter,
  Router,
  withAutoCleanupInjectors,
  withComponentInputBinding,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BillingService, InboxService, RealtimeService } from '@cadenway/api-client';
import { filter, firstValueFrom, type Observable, of, Subject, throwError } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  OrganizationPin,
  organizationPinInterceptor,
  OrganizationSwitchPendingError,
  PASSIVE_REQUEST,
} from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import { REALTIME_TERMINAL_FAILURE, RealtimeConnection } from '@core/realtime';

import { WorkspaceSession } from './data-access/services/workspace-session/workspace-session.service';
import type {
  WorkspaceOrganization,
  WorkspaceProblem,
  WorkspaceResult,
  WorkspaceUser,
} from './models/workspace-context/workspace-context.interface';
import { WORKSPACE_ROUTES } from './workspace.routes';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

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
          withAutoCleanupInjectors(),
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        { provide: WorkspaceSession, useValue: session },
        { provide: RuntimeConfigStore, useValue: { config: () => ({}) } },
        { provide: InboxService, useValue: { getInboxUnreadCount: () => of({ unreadCount: 2 }) } },
        {
          provide: BillingService,
          useValue: {
            getBillingSubscription: () =>
              of({
                plan: 'team',
                seats: { used: 18, limit: 25 },
                guestCount: 0,
                storage: { attachmentBytesUsed: 92_400_000_000, limitBytes: 100_000_000_000 },
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

  it('revalidates after a context mismatch but not for query-only navigation', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    expect(pin.current()).toBe(atelierNord.id);
    expect(session.currentOrganization).toHaveBeenCalledTimes(1);
    await harness.navigateByUrl('/atelier-nord?task=CAD-1');
    expect(session.currentOrganization).toHaveBeenCalledTimes(1);
    session.currentOrganization.mockReturnValue(ok(lumen));
    const navigation: Promise<NavigationEnd> = firstValueFrom(
      TestBed.inject(Router).events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      ),
    );
    pin.notifyContextChanged();
    await navigation;
    expect(session.currentOrganization).toHaveBeenCalledTimes(2);
    expect(session.switchOrganization).toHaveBeenCalledWith(atelierNord.id);
    expect(pin.current()).toBe(atelierNord.id);
  });

  it('does not interrupt an in-progress organization navigation on a context change', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');
    const pending: Subject<WorkspaceResult<void>> = new Subject<WorkspaceResult<void>>();
    session.switchOrganization.mockReturnValue(pending);
    const router: Router = TestBed.inject(Router);
    const navigation: Promise<boolean> = router.navigateByUrl('/lumen');
    await vi.waitFor(() => {
      expect(session.switchOrganization).toHaveBeenCalledOnce();
    });
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    expect(pin.isSwitching()).toBe(true);
    pin.notifyContextChanged();
    pin.notifyContextChanged();
    pending.next({ ok: true, value: undefined });
    pending.complete();
    expect(await navigation).toBe(true);
    await harness.fixture.whenStable();
    expect(router.url).toBe('/lumen');
    expect(pin.current()).toBe(lumen.id);
    expect(pin.isSwitching()).toBe(false);
  });

  it('recovers an active mismatch after an unrelated navigation finishes', async () => {
    TestBed.overrideProvider(RuntimeConfigStore, {
      useValue: { config: () => ({ apiUrl: 'https://api.example.test' }) },
    });
    const router: Router = TestBed.inject(Router);
    const pending: Subject<boolean> = new Subject<boolean>();
    const guard: Mock<() => Observable<boolean>> = vi
      .fn(() => of(true))
      .mockReturnValueOnce(pending);
    router.resetConfig(
      router.config.map((route) =>
        route.path === ':org'
          ? {
              ...route,
              children: [
                { path: 'slow', canActivate: [guard], component: AuthStub },
                ...(route.children ?? []),
              ],
            }
          : route,
      ),
    );
    const harness: RouterTestingHarness = await open('/atelier-nord');
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    const navigation: Promise<boolean> = router.navigateByUrl('/atelier-nord/slow');
    await vi.waitFor(() => {
      expect(guard).toHaveBeenCalledOnce();
      expect(router.currentNavigation()).not.toBeNull();
    });
    const active: Promise<unknown> = TestBed.runInInjectionContext(() =>
      firstValueFrom(
        organizationPinInterceptor(new HttpRequest('GET', '/v1/tasks/CAD-1'), () =>
          throwError(
            () =>
              new HttpErrorResponse({
                status: 412,
                error: { code: 'organization.context-changed' },
              }),
          ),
        ),
      ),
    );
    await expect(active).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(pin.stale()).toBe(true);
    const next: Mock = vi.fn(() => of(new HttpResponse({ status: 200 })));
    const passive: Promise<unknown> = TestBed.runInInjectionContext(() =>
      firstValueFrom(
        organizationPinInterceptor(
          new HttpRequest('GET', '/v1/tasks/CAD-1', {
            context: new HttpContext().set(PASSIVE_REQUEST, true),
          }),
          next,
        ),
      ),
    );
    await expect(passive).rejects.toBeInstanceOf(OrganizationSwitchPendingError);
    expect(next).not.toHaveBeenCalled();
    session.currentOrganization.mockReturnValue(ok(lumen));
    const verified: Promise<void> = firstValueFrom(pin.organizationVerified);
    pending.next(true);
    pending.complete();
    expect(await navigation).toBe(true);
    await verified;
    await harness.fixture.whenStable();
    expect(session.switchOrganization).toHaveBeenCalledWith(atelierNord.id);
    expect(pin.stale()).toBe(false);
    const resumed: Promise<unknown> = TestBed.runInInjectionContext(() =>
      firstValueFrom(
        organizationPinInterceptor(
          new HttpRequest('GET', '/v1/tasks/CAD-1', {
            context: new HttpContext().set(PASSIVE_REQUEST, true),
          }),
          next,
        ),
      ),
    );
    await expect(resumed).resolves.toBeInstanceOf(HttpResponse);
  });

  it('revalidates a passive mismatch that arrives while already focused', async () => {
    TestBed.overrideProvider(RuntimeConfigStore, {
      useValue: { config: () => ({ apiUrl: 'https://api.example.test' }) },
    });
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const harness: RouterTestingHarness = await open('/atelier-nord');
    const router: Router = TestBed.inject(Router);
    session.currentOrganization.mockReturnValue(ok(lumen));
    const navigation: Promise<NavigationEnd> = firstValueFrom(
      router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    );
    const response: Promise<unknown> = TestBed.runInInjectionContext(() =>
      firstValueFrom(
        organizationPinInterceptor(
          new HttpRequest('GET', '/v1/tasks/CAD-1', {
            context: new HttpContext().set(PASSIVE_REQUEST, true),
          }),
          () =>
            throwError(
              () =>
                new HttpErrorResponse({
                  status: 412,
                  error: { code: 'organization.context-changed' },
                }),
            ),
        ),
      ),
    );
    await expect(response).rejects.toBeDefined();
    await navigation;
    await harness.fixture.whenStable();
    expect(session.currentOrganization).toHaveBeenCalledTimes(2);
    expect(session.switchOrganization).toHaveBeenCalledWith(atelierNord.id);
    expect(TestBed.inject(OrganizationPin).stale()).toBe(false);
  });

  it('revalidates a stale context once when the document returns to the foreground', async () => {
    TestBed.overrideProvider(RuntimeConfigStore, {
      useValue: { config: () => ({ apiUrl: 'https://api.example.test' }) },
    });
    const harness: RouterTestingHarness = await open('/atelier-nord');
    const router: Router = TestBed.inject(Router);
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const response: Promise<unknown> = TestBed.runInInjectionContext(() =>
      firstValueFrom(
        organizationPinInterceptor(
          new HttpRequest('GET', '/v1/tasks/CAD-1', {
            context: new HttpContext().set(PASSIVE_REQUEST, true),
          }),
          () =>
            throwError(
              () =>
                new HttpErrorResponse({
                  status: 412,
                  error: { code: 'organization.context-changed' },
                }),
            ),
        ),
      ),
    );
    await expect(response).rejects.toBeDefined();
    expect(pin.stale()).toBe(true);
    window.dispatchEvent(new Event('focus'));
    expect(session.currentOrganization).toHaveBeenCalledTimes(1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const navigation: Promise<NavigationEnd> = firstValueFrom(
      router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    );
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await navigation;
    await harness.fixture.whenStable();
    expect(session.currentOrganization).toHaveBeenCalledTimes(2);
    expect(pin.stale()).toBe(false);
  });

  it.each([
    ['cancelled', false],
    ['superseded', false],
    ['failed', false],
    ['cancelled', true],
    ['failed', true],
  ] as const)(
    'retries a %s recovery (active: %s) and resumes passive requests',
    async (outcome: 'cancelled' | 'superseded' | 'failed', active: boolean) => {
      TestBed.overrideProvider(RuntimeConfigStore, {
        useValue: { config: () => ({ apiUrl: 'https://api.example.test' }) },
      });
      const guard: Mock<() => boolean> = vi.fn(() => true);
      const router: Router = TestBed.inject(Router);
      router.resetConfig(
        router.config.map((route) =>
          route.path === ':org'
            ? { ...route, canActivate: [...(route.canActivate ?? []), guard] }
            : route,
        ),
      );
      const harness: RouterTestingHarness = await open('/atelier-nord');
      const pin: OrganizationPin = TestBed.inject(OrganizationPin);
      const focus: Mock<() => boolean> = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      const clock: Mock<() => number> = vi.spyOn(Date, 'now');
      const navigationSpy: Mock = vi.spyOn(router, 'navigateByUrl');
      const pending: Subject<WorkspaceResult<WorkspaceUser>> = new Subject<
        WorkspaceResult<WorkspaceUser>
      >();
      if (outcome === 'cancelled') guard.mockReturnValueOnce(false);
      if (outcome === 'failed')
        session.currentUser.mockReturnValueOnce(throwError(() => new Error('Navigation failed')));
      if (outcome === 'superseded') session.currentUser.mockReturnValueOnce(pending);
      const failedNavigation: Promise<NavigationCancel | NavigationError> = firstValueFrom(
        router.events.pipe(
          filter(
            (event): event is NavigationCancel | NavigationError =>
              event instanceof NavigationCancel || event instanceof NavigationError,
          ),
        ),
      );
      if (active) {
        const mismatch: Promise<unknown> = TestBed.runInInjectionContext(() =>
          firstValueFrom(
            organizationPinInterceptor(new HttpRequest('GET', '/v1/tasks/CAD-1'), () =>
              throwError(
                () =>
                  new HttpErrorResponse({
                    status: 412,
                    error: { code: 'organization.context-changed' },
                  }),
              ),
            ),
          ),
        );
        await expect(mismatch).rejects.toBeInstanceOf(HttpErrorResponse);
      } else pin.markStale();
      focus.mockReturnValue(false);
      if (outcome === 'superseded') {
        await vi.waitFor(() => {
          expect(session.currentUser).toHaveBeenCalledTimes(2);
        });
        await router.navigateByUrl('/atelier-nord?tab=next');
      }
      const event: NavigationCancel | NavigationError = await failedNavigation;
      expect(event).toBeInstanceOf(outcome === 'failed' ? NavigationError : NavigationCancel);
      await vi.waitFor(() => {
        expect(navigationSpy).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(router.currentNavigation()).toBeNull();
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(pin.stale()).toBe(true);
      const fencedNext: Mock = vi.fn(() => of(new HttpResponse({ status: 200 })));
      const fenced: Promise<unknown> = TestBed.runInInjectionContext(() =>
        firstValueFrom(
          organizationPinInterceptor(
            new HttpRequest('GET', '/v1/tasks/CAD-1', {
              context: new HttpContext().set(PASSIVE_REQUEST, true),
            }),
            fencedNext,
          ),
        ),
      );
      await expect(fenced).rejects.toBeInstanceOf(OrganizationSwitchPendingError);
      expect(fencedNext).not.toHaveBeenCalled();
      clock.mockReturnValue(Date.now() + 2000);
      const verification: Promise<NavigationEnd> = firstValueFrom(
        router.events.pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        ),
      );
      if (!active) focus.mockReturnValue(true);
      window.dispatchEvent(new Event('focus'));
      await verification;
      await harness.fixture.whenStable();
      expect(pin.stale()).toBe(false);
      const next: Mock = vi.fn(() => of(new HttpResponse({ status: 200 })));
      const response: Promise<unknown> = TestBed.runInInjectionContext(() =>
        firstValueFrom(
          organizationPinInterceptor(
            new HttpRequest('GET', '/v1/tasks/CAD-1', {
              context: new HttpContext().set(PASSIVE_REQUEST, true),
            }),
            next,
          ),
        ),
      );
      await expect(response).resolves.toBeInstanceOf(HttpResponse);
      expect(next).toHaveBeenCalledOnce();
      clock.mockRestore();
    },
  );

  it('backs off repeated failed recoveries while the tab remains focused', async () => {
    await open('/atelier-nord');
    const router: Router = TestBed.inject(Router);
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.useFakeTimers();
    const navigation: Mock = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(false);
    pin.markStale();
    await vi.advanceTimersByTimeAsync(0);
    expect(navigation).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(999);
    expect(navigation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(navigation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(navigation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(navigation).toHaveBeenCalledTimes(3);
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('coalesces multiple context changes into one revalidation', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');
    const router: Router = TestBed.inject(Router);
    const navigation: Promise<NavigationEnd> = firstValueFrom(
      router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    );
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.notifyContextChanged();
    pin.notifyContextChanged();
    pin.notifyContextChanged();
    await navigation;
    await harness.fixture.whenStable();
    expect(session.currentOrganization).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, '/login?next=%2Fatelier-nord%3Ftask%3DCAD-1'],
    [403, '/organizations'],
  ] as const)(
    'redirects terminal realtime status %s',
    async (status: 401 | 403, target: string) => {
      const harness: RouterTestingHarness = await open('/atelier-nord?task=CAD-1');
      const callback: ((status: 401 | 403) => void) | undefined =
        harness.routeDebugElement?.injector.get(REALTIME_TERMINAL_FAILURE);
      if (!callback) throw new Error('Workspace runtime was not provided.');
      const router: Router = TestBed.inject(Router);
      const navigation: Promise<NavigationEnd> = firstValueFrom(
        router.events.pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        ),
      );
      callback(status);
      await navigation;
      expect(router.url).toBe(target);
    },
  );

  it('clears the organization pin when the workspace injector is destroyed', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    expect(pin.current()).toBe(atelierNord.id);
    await harness.navigateByUrl('/organizations');
    await harness.fixture.whenStable();
    expect(pin.current()).toBeNull();
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

  it('reconnects an active realtime watch when the workspace slug changes', async () => {
    const handlers: Map<string, (data: unknown) => void>[] = [];
    const disconnects: (() => void)[] = [];
    const joins: unknown[] = [];
    const tickets: ReturnType<typeof vi.fn> = vi.fn(() =>
      of({ token: 'ticket', expiresAt: '2026-11-08T11:00:00Z' }),
    );
    TestBed.overrideProvider(RuntimeConfigStore, {
      useValue: { config: () => ({ realtimeUrl: 'https://realtime.example.test' }) },
    });
    TestBed.overrideProvider(RealtimeService, { useValue: { issueRealtimeTicket: tickets } });
    vi.mocked(io).mockImplementation(() => {
      const events: Map<string, (data: unknown) => void> = new Map<
        string,
        (data: unknown) => void
      >();
      handlers.push(events);
      const disconnect: Mock<() => void> = vi.fn();
      disconnects.push(disconnect);
      return {
        once: (name: string, callback: (data: unknown) => void) => events.set(name, callback),
        on: (name: string, callback: (data: unknown) => void) => events.set(name, callback),
        connect: () => undefined,
        disconnect,
        removeAllListeners: () => {
          events.clear();
        },
        volatile: { emit: () => undefined },
        timeout: () => ({
          emit: (
            event: string,
            body: unknown,
            callback: (error: null, response: unknown) => void,
          ) => {
            if (event === 'room:join') joins.push(body);
            callback(null, { ok: true });
          },
        }),
        emit: () => undefined,
      } as unknown as Socket;
    });
    const harness: RouterTestingHarness = await open('/atelier-nord');
    const realtime: RealtimeConnection | undefined =
      harness.routeDebugElement?.injector.get(RealtimeConnection);
    if (!realtime) throw new Error('Realtime connection is not provided.');
    const watch: import('rxjs').Subscription = realtime
      .watch({ kind: 'task', taskKey: 'CAD-1' })
      .subscribe();
    await vi.waitFor(() => {
      expect(handlers).toHaveLength(1);
    });
    handlers[0].get('hello')?.({
      id: '019a7005-6f7a-7b8c-9d0e-1f2a3b4c5d4f',
      type: 'connection.ready.v1',
      at: '2026-11-08T10:40:00Z',
      version: 1,
      data: {
        organizationId: atelierNord.id,
        sessionExpiresAt: '2026-11-08T11:00:00Z',
        heartbeatIntervalSeconds: 10,
      },
    });
    await harness.fixture.whenStable();
    await harness.navigateByUrl('/lumen');
    await harness.fixture.whenStable();
    expect(disconnects[0]).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(tickets).toHaveBeenCalledTimes(2);
    });
    expect(handlers).toHaveLength(2);
    handlers[1].get('hello')?.({
      id: '019a7005-6f7a-7b8c-9d0e-1f2a3b4c5d4f',
      type: 'connection.ready.v1',
      at: '2026-11-08T10:40:00Z',
      version: 1,
      data: {
        organizationId: lumen.id,
        sessionExpiresAt: '2026-11-08T11:00:00Z',
        heartbeatIntervalSeconds: 10,
      },
    });
    await vi.waitFor(() => {
      expect(joins).toHaveLength(2);
    });
    expect(joins[1]).toEqual({ kind: 'task', taskKey: 'CAD-1' });
    watch.unsubscribe();
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
