import { HttpContext, HttpErrorResponse, HttpResponse, HttpRequest } from '@angular/common/http';
import {
  DOCUMENT,
  Component,
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  provideRouter,
  Router,
  withAutoCleanupInjectors,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import {
  AccessService,
  ArchivesService,
  BillingService,
  InboxService,
  InvitationsService,
  ListsService,
  MembersService,
  MyTasksService,
  RealtimeService,
  SpacesService,
  TaskQueriesService,
  TasksService,
  TeamReportsService,
  DocumentsService,
  GoalsService,
  TrashService,
} from '@cadenway/api-client';
import { filter, firstValueFrom, NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  OrganizationPin,
  organizationPinInterceptor,
  OrganizationSwitchPendingError,
  PASSIVE_REQUEST,
} from '@core/api';
import { RuntimeConfigStore } from '@core/config';
import {
  REALTIME_SOCKET_FACTORY,
  REALTIME_TERMINAL_FAILURE,
  RealtimeConnection,
} from '@core/realtime';
import { RouteErrorBoundary } from '@features/errors';
import { TaskCreate, TaskDetailOpener } from '@features/task';

import { WorkspaceSession } from './data-access/services/workspace-session/workspace-session.service';
import type {
  WorkspaceOrganization,
  WorkspaceProblem,
  WorkspaceResult,
  WorkspaceUser,
} from './models/workspace-context/workspace-context.interface';
import { WORKSPACE_ROUTES } from './workspace.routes';
import { provideWorkspaceRuntime } from './providers/workspace-runtime/workspace-runtime.provider';

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
  name: 'Lumen Cooperative',
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

/**
 * Constant RECONNECT_WAIT
 *
 * @description
 * Wait options of the realtime reconnect scenario: a CI runner with coverage needs more than the
 * 1 s default to load the routes and walk the two admissions; the scenario itself gets 20 s.
 *
 * @type {{ timeout: number }}
 */
const RECONNECT_WAIT: { timeout: number } = { timeout: 10_000 };

describe('WORKSPACE_ROUTES', () => {
  let session: SessionFake;

  beforeEach(() => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
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
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        { provide: WorkspaceSession, useValue: session },
        { provide: RuntimeConfigStore, useValue: { config: () => ({}) } },
        { provide: InboxService, useValue: { getInboxUnreadCount: () => of({ unreadCount: 2 }) } },
        {
          provide: GoalsService,
          useValue: {
            listGoals: () =>
              of({
                items: [],
                nextCursor: null,
                summary: {
                  goalCount: 0,
                  expectedProgressPercent: 0,
                  averageProgressPercent: 0,
                  onTrackOrAchievedCount: 0,
                  achievedCount: 0,
                  atRiskOrBehindCount: 0,
                },
              }),
          },
        },
        {
          provide: TeamReportsService,
          useValue: {
            getTeamDashboard: () =>
              of({
                today: '2026-11-08',
                timeZone: 'Europe/Paris',
                weeks: 8,
                observedAt: '2026-11-08T09:00:00Z',
                openCount: 0,
                lateCount: 0,
                blockedCount: 0,
                completedCount: 0,
                byStatus: [],
                overdueTasks: [],
                assigneeThreshold: 6,
                assignees: [],
                completions: [],
              }),
          },
        },
        {
          provide: DocumentsService,
          useValue: {
            listDocuments: () => of({ items: [], nextCursor: null, total: 0 }),
            getDocument: () =>
              of({
                id: '019a7005-4b2c-7d4e-8f5a-6b7c8d9e0f17',
                spaceId: 's1',
                title: 'Onboarding',
                authorUserId: 'u1',
                createdAt: '2026-11-02T09:00:00Z',
                updatedAt: '2026-11-02T09:00:00Z',
                version: 1,
                body: '',
              }),
          },
        },
        {
          provide: MyTasksService,
          useValue: {
            listMyTasks: () => of({ items: [], nextCursor: null, counts: { open: 0, closed: 0 } }),
          },
        },
        {
          provide: TrashService,
          useValue: { listTrash: () => of({ items: [], nextCursor: null, total: 0 }) },
        },
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
        {
          provide: MembersService,
          useValue: {
            listMembers: () =>
              of({
                items: [],
                nextCursor: null,
                total: 0,
                counts: { owner: 1, admin: 0, member: 0, guest: 0 },
              }),
          },
        },
        {
          provide: InvitationsService,
          useValue: { listInvitations: () => of({ items: [], nextCursor: null, total: 0 }) },
        },
      ],
    });
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
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
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Hello Camille');
    const switcher: HTMLButtonElement | null = element.querySelector(
      '[data-testid="organization-switcher"]',
    );
    expect(switcher?.getAttribute('aria-haspopup')).toBe('menu');
    expect(switcher?.textContent).toContain('AN');
    expect(switcher?.textContent).toContain('Switch organization: Atelier Nord');
    expect(session.switchOrganization).not.toHaveBeenCalled();
  });

  it('renders the list grid inside the workspace route', async () => {
    const list: Record<string, unknown> = {
      id: 'sprint-14',
      spaceId: 'product',
      name: 'Sprint 14',
      icon: null,
      color: null,
      sprint: null,
      version: 1,
    };
    const counts: Record<string, number> = { total: 0, open: 0, done: 0, cancelled: 0, late: 0 };
    const empty: { items: readonly never[]; nextCursor: null; total: number } = {
      items: [],
      nextCursor: null,
      total: 0,
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ListsService,
          useValue: {
            getList: () => of(list),
            getListCounts: () => of({ list, counts }),
            listSavedViews: () => of(empty),
          },
        },
        {
          provide: SpacesService,
          useValue: {
            getSpace: () => of({ id: 'product', name: 'Product', statuses: {} }),
            listSpaces: () => of(empty),
            listFavorites: () => of(empty),
          },
        },
        {
          provide: TaskQueriesService,
          useValue: {
            countTaskGroups: () => of({ ...empty, groupBy: 'status' }),
            queryListTasks: () => of(empty),
          },
        },
        { provide: TasksService, useValue: { listLabels: () => of(empty) } },
        { provide: MembersService, useValue: { listMembers: () => of(empty) } },
        { provide: AccessService, useValue: { listListGrants: () => of(empty) } },
        { provide: ArchivesService, useValue: {} },
      ],
    });
    const harness: RouterTestingHarness = await open('/atelier-nord/l/sprint-14/list');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(
        (harness.fixture.nativeElement as HTMLElement).querySelector('[role="grid"]'),
      ).not.toBeNull();
    });
  });

  it('binds every shell contribution on the workspace route', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');
    await harness.fixture.whenStable();
    harness.detectChanges();

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    for (const id of [
      'home-rail-item',
      'inbox-rail-item',
      'my-tasks-rail-item',
      'spaces-rail-item',
      'dashboards-rail-item',
      'goals-rail-item',
      'docs-rail-item',
      'search-rail-item',
      'theme-rail-item',
      'user-menu-trigger',
      'organization-row',
      'search-button',
      'plan-summary',
      'sidebar-trash',
      'sidebar-archives',
      'shortcuts-button',
      'storage-banner',
    ]) {
      expect(element.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    expect(
      element.querySelector('[data-testid="home-rail-item"]')?.getAttribute('aria-current'),
    ).toBe('page');
  });

  it('orders the rail applications as the mockup does', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(
      [...element.querySelectorAll('[data-testid$="-rail-item"]')]
        .map((item: Element) => item.getAttribute('data-testid'))
        .filter((id: string | null) => id !== 'search-rail-item' && id !== 'theme-rail-item'),
    ).toEqual([
      'home-rail-item',
      'inbox-rail-item',
      'my-tasks-rail-item',
      'spaces-rail-item',
      'dashboards-rail-item',
      'goals-rail-item',
      'docs-rail-item',
    ]);
  });

  it('opens each cross-cutting page inside the shell, its rail item current', async () => {
    TestBed.overrideProvider(ArchivesService, {
      useValue: {
        listArchivedLists: () => of({ items: [], nextCursor: null, total: 0 }),
        listArchivedTasks: () => of({ items: [], nextCursor: null, total: 0 }),
      },
    });
    const harness: RouterTestingHarness = await open('/atelier-nord');
    for (const [url, heading, title, item] of [
      ['/atelier-nord/my-tasks?tab=closed', 'My tasks', 'My tasks', 'my-tasks-rail-item'],
      ['/atelier-nord/dashboards', 'Team dashboard', 'Dashboards', 'dashboards-rail-item'],
      ['/atelier-nord/goals', 'Goals', 'Goals', 'goals-rail-item'],
      ['/atelier-nord/docs', 'Documents', 'Documents', 'docs-rail-item'],
      [
        '/atelier-nord/d/019a7005-4b2c-7d4e-8f5a-6b7c8d9e0f17',
        'Onboarding',
        'Onboarding — Cadenway',
        'docs-rail-item',
      ],
      ['/atelier-nord/trash', 'Trash', 'Trash', null],
      ['/atelier-nord/archives', 'Archives', 'Archives', null],
    ] as const) {
      await harness.navigateByUrl(url);
      await harness.fixture.whenStable();
      harness.detectChanges();

      const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
      expect(element.querySelector('h1')?.textContent.trim(), url).toBe(heading);
      expect(TestBed.inject(Title).getTitle(), url).toBe(title);
      expect(element.querySelector('[data-testid="organization-switcher"]'), url).not.toBeNull();
      expect(
        element
          .querySelector('[aria-current="page"][data-testid$="-rail-item"]')
          ?.getAttribute('data-testid') ?? null,
        url,
      ).toBe(item);
    }
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

  it.each(['focus', 'visibility'] as const)(
    'defers a recovery switch when the tab loses %s during the organization read',
    async (lost: 'focus' | 'visibility') => {
      const harness: RouterTestingHarness = await open('/atelier-nord');
      const router: Router = TestBed.inject(Router);
      const pin: OrganizationPin = TestBed.inject(OrganizationPin);
      const focus: Mock<() => boolean> = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const visibility: Mock<() => DocumentVisibilityState> = vi
        .spyOn(document, 'visibilityState', 'get')
        .mockReturnValue('visible');
      const clock: Mock<() => number> = vi.spyOn(Date, 'now');
      const read: Subject<WorkspaceResult<WorkspaceOrganization>> = new Subject<
        WorkspaceResult<WorkspaceOrganization>
      >();
      session.currentOrganization.mockReturnValueOnce(read).mockReturnValue(ok(lumen));
      const cancelled: Promise<NavigationCancel> = firstValueFrom(
        router.events.pipe(
          filter((event): event is NavigationCancel => event instanceof NavigationCancel),
        ),
      );
      pin.notifyContextChanged();
      await vi.waitFor(() => {
        expect(session.currentOrganization).toHaveBeenCalledTimes(2);
      });
      if (lost === 'focus') focus.mockReturnValue(false);
      else visibility.mockReturnValue('hidden');
      read.next({ ok: true, value: lumen });
      read.complete();
      await cancelled;
      await vi.waitFor(() => {
        expect(router.currentNavigation()).toBeNull();
      });
      await Promise.resolve();
      expect(session.switchOrganization).not.toHaveBeenCalled();
      expect(pin.stale()).toBe(true);
      expect(pin.isSwitching()).toBe(false);
      expect(router.url).toBe('/atelier-nord');
      clock.mockReturnValue(Date.now() + 2000);
      const verified: Promise<void> = firstValueFrom(pin.organizationVerified);
      focus.mockReturnValue(true);
      visibility.mockReturnValue('visible');
      window.dispatchEvent(new Event('focus'));
      await verified;
      await harness.fixture.whenStable();
      expect(session.switchOrganization).toHaveBeenCalledExactlyOnceWith(atelierNord.id);
      expect(pin.stale()).toBe(false);
      clock.mockRestore();
    },
  );

  it.each(['current organization', 'organization lookup'] as const)(
    'does not switch after a recovery is superseded during the locked %s read',
    async (stage: 'current organization' | 'organization lookup') => {
      const harness: RouterTestingHarness = await open('/atelier-nord');
      const router: Router = TestBed.inject(Router);
      const pin: OrganizationPin = TestBed.inject(OrganizationPin);
      const focus: Mock<() => boolean> = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const clock: Mock<() => number> = vi.spyOn(Date, 'now');
      const current: Subject<WorkspaceResult<WorkspaceOrganization>> = new Subject<
        WorkspaceResult<WorkspaceOrganization>
      >();
      const lookup: Subject<WorkspaceResult<readonly WorkspaceOrganization[]>> = new Subject<
        WorkspaceResult<readonly WorkspaceOrganization[]>
      >();
      const settled: Subject<void> = new Subject<void>();
      session.exclusive.mockImplementation(
        (operation: () => Observable<unknown>) =>
          new Observable((subscriber) => {
            operation().subscribe({
              next: (value: unknown) => {
                subscriber.next(value);
              },
              error: (error: unknown) => {
                subscriber.error(error);
              },
              complete: () => {
                subscriber.complete();
                settled.next();
              },
            });
          }),
      );
      if (stage === 'current organization')
        session.currentOrganization.mockReturnValueOnce(current);
      else {
        session.currentOrganization.mockReturnValueOnce(ok(lumen));
        session.myOrganizations.mockReturnValueOnce(lookup);
      }
      session.currentOrganization.mockReturnValue(ok(lumen));
      const cancelled: Promise<NavigationCancel> = firstValueFrom(
        router.events.pipe(
          filter((event): event is NavigationCancel => event instanceof NavigationCancel),
        ),
      );
      pin.notifyContextChanged();
      await vi.waitFor(() => {
        if (stage === 'current organization')
          expect(session.currentOrganization).toHaveBeenCalledTimes(2);
        else expect(session.myOrganizations).toHaveBeenCalledOnce();
      });
      const superseding: Promise<boolean> = router.navigateByUrl('/atelier-nord?task=CAD-1');
      await cancelled;
      expect(await superseding).toBe(true);
      const finished: Promise<void> = firstValueFrom(settled);
      if (stage === 'current organization') {
        current.next({ ok: true, value: lumen });
        current.complete();
      } else {
        lookup.next({ ok: true, value: [atelierNord, lumen] });
        lookup.complete();
      }
      await finished;
      expect(session.switchOrganization).not.toHaveBeenCalled();
      expect(pin.stale()).toBe(true);
      expect(pin.isSwitching()).toBe(false);
      focus.mockReturnValue(false);
      clock.mockReturnValue(Date.now() + 2000);
      const verified: Promise<void> = firstValueFrom(pin.organizationVerified);
      focus.mockReturnValue(true);
      window.dispatchEvent(new Event('focus'));
      await verified;
      await harness.fixture.whenStable();
      expect(session.switchOrganization).toHaveBeenCalledExactlyOnceWith(atelierNord.id);
      expect(pin.stale()).toBe(false);
      clock.mockRestore();
      settled.complete();
    },
  );

  it('finishes a dispatched recovery switch even when navigation is superseded', async () => {
    await open('/atelier-nord');
    const router: Router = TestBed.inject(Router);
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    const focus: Mock<() => boolean> = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const write: Subject<WorkspaceResult<void>> = new Subject<WorkspaceResult<void>>();
    const settled: Subject<void> = new Subject<void>();
    session.exclusive.mockImplementation(
      (operation: () => Observable<unknown>) =>
        new Observable((subscriber) => {
          operation().subscribe({
            next: (value: unknown) => {
              subscriber.next(value);
            },
            error: (error: unknown) => {
              subscriber.error(error);
            },
            complete: () => {
              subscriber.complete();
              settled.next();
            },
          });
        }),
    );
    session.currentOrganization.mockReturnValue(ok(lumen));
    session.switchOrganization.mockReturnValueOnce(write);
    pin.notifyContextChanged();
    await vi.waitFor(() => {
      expect(session.switchOrganization).toHaveBeenCalledOnce();
    });
    const finished: Promise<void> = firstValueFrom(settled);
    const superseding: Promise<boolean> = router.navigateByUrl('/atelier-nord?task=CAD-1');
    expect(await superseding).toBe(true);
    focus.mockReturnValue(false);
    write.next({ ok: true, value: undefined });
    write.complete();
    await finished;
    expect(session.switchOrganization).toHaveBeenCalledExactlyOnceWith(atelierNord.id);
    expect(pin.stale()).toBe(true);
    settled.complete();
  });

  it('lets an explicit organization switch finish after navigation is superseded during its read', async () => {
    await open('/atelier-nord');
    const router: Router = TestBed.inject(Router);
    const read: Subject<WorkspaceResult<WorkspaceOrganization>> = new Subject<
      WorkspaceResult<WorkspaceOrganization>
    >();
    const settled: Subject<void> = new Subject<void>();
    session.exclusive.mockImplementation(
      (operation: () => Observable<unknown>) =>
        new Observable((subscriber) => {
          operation().subscribe({
            next: (value: unknown) => {
              subscriber.next(value);
            },
            error: (error: unknown) => {
              subscriber.error(error);
            },
            complete: () => {
              subscriber.complete();
              settled.next();
            },
          });
        }),
    );
    session.currentOrganization.mockReturnValueOnce(read);
    const cancelledNavigation: Promise<boolean> = router.navigateByUrl('/lumen');
    await vi.waitFor(() => {
      expect(session.currentOrganization).toHaveBeenCalledTimes(2);
    });
    const superseding: Promise<boolean> = router.navigateByUrl('/atelier-nord?task=CAD-1');
    expect(await cancelledNavigation).toBe(false);
    expect(await superseding).toBe(true);
    const finished: Promise<void> = firstValueFrom(settled);
    read.next({ ok: true, value: atelierNord });
    read.complete();
    await finished;
    expect(session.switchOrganization).toHaveBeenCalledExactlyOnceWith(lumen.id);
    settled.complete();
  });

  it('allows an explicit organization navigation while the document is unfocused', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord');
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    await harness.navigateByUrl('/lumen');
    expect(session.switchOrganization).toHaveBeenCalledExactlyOnceWith(lumen.id);
    expect(TestBed.inject(OrganizationPin).current()).toBe(lumen.id);
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

  it.each([
    ['hidden', true],
    ['visible', false],
  ] as const)(
    'waits for foreground after an active mismatch when %s and focus is %s',
    async (visibility: 'hidden' | 'visible', focused: boolean) => {
      TestBed.overrideProvider(RuntimeConfigStore, {
        useValue: { config: () => ({ apiUrl: 'https://api.example.test' }) },
      });
      const harness: RouterTestingHarness = await open('/atelier-nord');
      const router: Router = TestBed.inject(Router);
      const pin: OrganizationPin = TestBed.inject(OrganizationPin);
      const focus: Mock<() => boolean> = vi.spyOn(document, 'hasFocus').mockReturnValue(focused);
      const state: Mock<() => DocumentVisibilityState> = vi
        .spyOn(document, 'visibilityState', 'get')
        .mockReturnValue(visibility);
      const navigation: Mock = vi.spyOn(router, 'navigateByUrl');
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
      await Promise.resolve();
      expect(pin.stale()).toBe(true);
      expect(navigation).not.toHaveBeenCalled();
      expect(session.switchOrganization).not.toHaveBeenCalled();
      const verified: Promise<void> = firstValueFrom(pin.organizationVerified);
      state.mockReturnValue('visible');
      focus.mockReturnValue(true);
      window.dispatchEvent(new Event('focus'));
      await verified;
      await harness.fixture.whenStable();
      expect(pin.stale()).toBe(false);
      expect(navigation).toHaveBeenCalledOnce();
    },
  );

  it('keeps a hidden tab from switching the shared session back after the focused tab recovers', async () => {
    TestBed.overrideProvider(RuntimeConfigStore, {
      useValue: { config: () => ({ apiUrl: 'https://api.example.test' }) },
    });
    const harness: RouterTestingHarness = await open('/atelier-nord');
    const router: Router = TestBed.inject(Router);
    const pinA: OrganizationPin = TestBed.inject(OrganizationPin);
    let sharedOrganization: WorkspaceOrganization = lumen;
    session.currentOrganization.mockImplementation(() => ok(sharedOrganization));
    session.switchOrganization.mockImplementation((id: string) => {
      sharedOrganization = id === atelierNord.id ? atelierNord : lumen;
      return ok(undefined);
    });
    const tabDocument: Document = document.implementation.createHTMLDocument('Background tab');
    vi.spyOn(tabDocument, 'visibilityState', 'get').mockReturnValue('hidden');
    vi.spyOn(tabDocument, 'hasFocus').mockReturnValue(false);
    const events: Subject<NavigationEnd> = new Subject<NavigationEnd>();
    const navigateB: Mock = vi.fn(() => {
      sharedOrganization = lumen;
      return Promise.resolve(true);
    });
    const tabB: EnvironmentInjector = createEnvironmentInjector(
      [
        OrganizationPin,
        { provide: DOCUMENT, useValue: tabDocument },
        {
          provide: Router,
          useValue: {
            url: '/lumen',
            currentNavigation: () => null,
            navigateByUrl: navigateB,
            events,
          },
        },
        ...provideWorkspaceRuntime(),
      ],
      TestBed.inject(EnvironmentInjector),
    );
    const pinB: OrganizationPin = tabB.get(OrganizationPin);
    pinB.set(lumen.id);
    const verified: Promise<void> = firstValueFrom(pinA.organizationVerified);
    const mismatchA: Promise<unknown> = TestBed.runInInjectionContext(() =>
      firstValueFrom(
        organizationPinInterceptor(new HttpRequest('GET', '/v1/spaces/space-a'), () =>
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
    await expect(mismatchA).rejects.toBeInstanceOf(HttpErrorResponse);
    await verified;
    await harness.fixture.whenStable();
    expect(sharedOrganization.id).toBe(atelierNord.id);
    expect(session.switchOrganization).toHaveBeenCalledTimes(1);
    for (let i: number = 0; i < 3; i++) {
      const mismatchB: Promise<unknown> = runInInjectionContext(tabB, () =>
        firstValueFrom(
          organizationPinInterceptor(new HttpRequest('GET', '/v1/spaces/space-b'), () =>
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
      await expect(mismatchB).rejects.toBeInstanceOf(HttpErrorResponse);
      tabDocument.dispatchEvent(new Event('visibilitychange'));
    }
    await Promise.resolve();
    expect(pinB.stale()).toBe(true);
    expect(navigateB).not.toHaveBeenCalled();
    expect(sharedOrganization.id).toBe(atelierNord.id);
    expect(router.url).toBe('/atelier-nord');
    tabB.destroy();
    events.complete();
  });

  it.each([
    ['session', 503, null],
    ['session', 408, null],
    ['organization', 0, null],
    ['organization', 429, 'gateway.unavailable'],
    ['lookup', 503, null],
    ['switch', 503, null],
  ] as const)(
    'keeps the workspace and retries a transient %s failure (status %s)',
    async (
      stage: 'session' | 'organization' | 'lookup' | 'switch',
      status: number,
      code: string | null,
    ) => {
      TestBed.overrideProvider(RuntimeConfigStore, {
        useValue: { config: () => ({ apiUrl: 'https://api.example.test' }) },
      });
      const harness: RouterTestingHarness = await open('/atelier-nord');
      const router: Router = TestBed.inject(Router);
      const pin: OrganizationPin = TestBed.inject(OrganizationPin);
      const clock: Mock<() => number> = vi.spyOn(Date, 'now');
      if (stage === 'session') session.currentUser.mockReturnValueOnce(failed({ status, code }));
      if (stage === 'organization')
        session.currentOrganization.mockReturnValueOnce(failed({ status, code }));
      if (stage === 'lookup' || stage === 'switch')
        session.currentOrganization.mockReturnValue(ok(lumen));
      if (stage === 'lookup') session.myOrganizations.mockReturnValueOnce(failed({ status, code }));
      if (stage === 'switch')
        session.switchOrganization.mockReturnValueOnce(failed({ status, code }));
      const cancelled: Promise<NavigationCancel> = firstValueFrom(
        router.events.pipe(
          filter((event): event is NavigationCancel => event instanceof NavigationCancel),
        ),
      );
      const mismatch: Promise<unknown> = TestBed.runInInjectionContext(() =>
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
      await expect(mismatch).rejects.toBeInstanceOf(HttpErrorResponse);
      await cancelled;
      await vi.waitFor(() => {
        expect(router.currentNavigation()).toBeNull();
      });
      await Promise.resolve();
      expect(router.url).toBe('/atelier-nord');
      expect(pin.current()).toBe(atelierNord.id);
      expect(pin.stale()).toBe(true);
      const verified: Promise<void> = firstValueFrom(pin.organizationVerified);
      clock.mockReturnValue(Date.now() + 2000);
      window.dispatchEvent(new Event('focus'));
      await verified;
      await harness.fixture.whenStable();
      expect(router.url).toBe('/atelier-nord');
      expect(pin.stale()).toBe(false);
      clock.mockRestore();
    },
  );

  it.each([
    ['session', 401, 'auth.session-expired', '/login?next=%2Fatelier-nord'],
    ['organization', 403, 'organization.access-denied', '/organizations'],
    ['switch', 403, 'organization.mfa-required', '/organizations'],
    ['unknown', 404, 'organization.not-found', '/organizations'],
  ] as const)(
    'keeps the definitive %s failure redirect during recovery',
    async (
      stage: 'session' | 'organization' | 'switch' | 'unknown',
      status: number,
      code: string,
      target: string,
    ) => {
      await open('/atelier-nord');
      const router: Router = TestBed.inject(Router);
      const pin: OrganizationPin = TestBed.inject(OrganizationPin);
      if (stage === 'session') session.currentUser.mockReturnValueOnce(failed({ status, code }));
      if (stage === 'organization')
        session.currentOrganization.mockReturnValueOnce(failed({ status, code }));
      if (stage === 'unknown') {
        session.currentOrganization.mockReturnValueOnce(failed({ status, code }));
        session.myOrganizations.mockReturnValueOnce(ok([]));
      }
      if (stage === 'switch') {
        session.currentOrganization.mockReturnValue(ok(lumen));
        session.switchOrganization.mockReturnValueOnce(failed({ status, code }));
      }
      const navigation: Promise<NavigationEnd> = firstValueFrom(
        router.events.pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        ),
      );
      pin.markStale();
      await navigation;
      expect(router.url).toBe(target);
    },
  );

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
      focus.mockReturnValue(true);
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
      'Lumen Cooperative',
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
    TestBed.overrideProvider(REALTIME_SOCKET_FACTORY, {
      useValue: (): Socket => {
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
      },
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
      expect(handlers[0].has('hello')).toBe(true);
    }, RECONNECT_WAIT);
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
    await vi.waitFor(() => {
      expect(joins).toHaveLength(1);
    }, RECONNECT_WAIT);
    await harness.navigateByUrl('/lumen');
    await harness.fixture.whenStable();
    expect(disconnects[0]).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(tickets).toHaveBeenCalledTimes(2);
    }, RECONNECT_WAIT);
    await vi.waitFor(() => {
      expect(handlers).toHaveLength(2);
      expect(handlers[1].has('hello')).toBe(true);
    }, RECONNECT_WAIT);
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
    }, RECONNECT_WAIT);
    expect(joins[1]).toEqual({ kind: 'task', taskKey: 'CAD-1' });
    watch.unsubscribe();
  }, 20_000);

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
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Page not found');
    expect(element.querySelector('[data-testid="organization-switcher"]')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/missing/page');
  });

  it('mounts the account settings in the settings shell, outside the application shell', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/account');

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/account/profile');
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Profile');
    expect(element.querySelector('nav[aria-label="Settings"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="organization-switcher"]')).toBeNull();
    for (const id of [
      'settings-organization-home',
      'home-rail-item',
      'inbox-rail-item',
      'my-tasks-rail-item',
      'spaces-rail-item',
      'dashboards-rail-item',
      'docs-rail-item',
      'search-rail-item',
      'theme-rail-item',
      'user-menu-trigger',
      'settings-back-to-app',
    ]) {
      expect(element.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    expect(element.querySelector('[data-testid="goals-rail-item"]')).toBeNull();
    expect(
      element.querySelector('[data-testid="settings-back-to-app"]')?.getAttribute('href'),
    ).toBe('/atelier-nord');
    expect(
      element
        .querySelector('[data-testid="account-navigation-profile"]')
        ?.getAttribute('aria-current'),
    ).toBe('page');
    expect(
      [...element.querySelectorAll('[data-testid^="organization-link-"]')].map((link: Element) =>
        link.getAttribute('href'),
      ),
    ).toEqual([
      '/atelier-nord/organization/general',
      '/atelier-nord/organization/members',
      '/atelier-nord/organization/billing',
      '/atelier-nord/organization/quotas',
    ]);
  });

  it('mounts the organization settings with the navigation of an owner', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/organization/billing');

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Billing');
    expect(element.querySelector('nav[aria-label="Organization settings"]')).not.toBeNull();
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(element.querySelector('[data-testid="organization-identity"]')?.textContent).toContain(
        'Team plan · 18 members',
      );
    });
    expect(element.querySelectorAll('[data-testid^="organization-navigation-"]')).toHaveLength(7);
    expect(
      element
        .querySelector('[data-testid="organization-navigation-quotas"] [aria-hidden="false"]')
        ?.getAttribute('aria-label'),
    ).toBe('Critical quota');
    expect(
      element.querySelector('[data-testid="account-settings-link"]')?.getAttribute('href'),
    ).toBe('/atelier-nord/account/security');
  });

  it('sends a member who opens an owner section to the first section their role allows', async () => {
    const harness: RouterTestingHarness = await open('/lumen/organization/billing');

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(TestBed.inject(Router).url).toBe('/lumen/organization/members');
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Members');
    expect(
      [...element.querySelectorAll('[data-testid^="organization-navigation-"]')].map(
        (link: Element) => link.textContent.trim(),
      ),
    ).toEqual(['Members']);
  });

  it('sends a member who opens General, which only administrators may edit, to Members', async () => {
    await open('/lumen/organization/general');

    expect(TestBed.inject(Router).url).toBe('/lumen/organization/members');
  });

  it('redirects an owner demoted during a workspace recovery off a restricted section', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/organization/billing');
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/billing');
    session.currentOrganization.mockReturnValue(ok({ ...atelierNord, role: 'member' }));
    const router: Router = TestBed.inject(Router);

    TestBed.inject(OrganizationPin).notifyContextChanged();

    await vi.waitFor(() => {
      expect(router.url).toBe('/atelier-nord/organization/members');
    });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(
      (harness.fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent.trim(),
    ).toBe('Members');
  });

  it('never shows the organization settings frame to a guest, not even its 404', async () => {
    session.currentOrganization.mockReturnValue(ok({ ...lumen, role: 'guest' }));
    session.myOrganizations.mockReturnValue(ok([atelierNord, { ...lumen, role: 'guest' }]));

    await open('/lumen/organization/missing');

    expect(TestBed.inject(Router).url).toBe('/lumen');
  });

  it('opens the task creation and the task detail over the settings', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TasksService, useValue: { getTaskDetail: () => NEVER, getTask: () => NEVER } },
      ],
    });
    const harness: RouterTestingHarness = await open('/atelier-nord/account/profile');

    expect(TestBed.inject(TaskCreate).open()).toBe(true);
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Create a task');
    });
    TestBed.inject(TaskCreate).close();
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    await harness.navigateByUrl('/atelier-nord/account/profile?task=CAD-482');
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(document.querySelector('cw-task-detail-dialog')).not.toBeNull();
    });
    expect(TestBed.inject(TaskDetailOpener).taskKey()).toBe('CAD-482');
  });

  it('sends a guest who opens the organization settings back to the workspace', async () => {
    session.currentOrganization.mockReturnValue(ok({ ...lumen, role: 'guest' }));
    session.myOrganizations.mockReturnValue(ok([atelierNord, { ...lumen, role: 'guest' }]));

    await open('/lumen/organization');

    expect(TestBed.inject(Router).url).toBe('/lumen');
  });

  it('renders the 404 inside the settings shell for an unknown settings section', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/account/missing');

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Page not found');
    expect(element.querySelector('nav[aria-label="Settings"]')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/account/missing');
  });

  it('mounts the task deep link inside the shell and renders not found for a missing task', async () => {
    const getTask: Mock<() => Observable<never>> = vi.fn(() =>
      throwError(() => new HttpErrorResponse({ status: 404, url: '/tasks/CAD-482' })),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: TasksService, useValue: { getTask } }],
    });

    const harness: RouterTestingHarness = await open('/atelier-nord/t/CAD-482');

    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;
    expect(getTask).toHaveBeenCalledWith('CAD-482', { cache: 'no-store' });
    expect(element.querySelector('h1')?.textContent.trim()).toBe('Page not found');
    expect(element.querySelector('[data-testid="organization-switcher"]')).not.toBeNull();
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
