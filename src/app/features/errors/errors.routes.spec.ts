import { Component, computed, signal, type WritableSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  RouterOutlet,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { type Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type RuntimeConfig, RuntimeConfigStore } from '@core/config';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
  type WorkspaceUser,
} from '@features/workspace/ports/workspace-context';
import {
  AccessDeniedRouteError,
  DeletedTaskRouteError,
  NotFoundRouteError,
  UnavailableRouteError,
} from '@shared/route-errors';

import { ErrorRecovery } from './data-access/services/error-recovery/error-recovery.service';
import { ERRORS_ROUTES } from './errors.routes';
import type { RestoreOutcome } from './models/error-recovery/error-recovery.type';
import type { RouteErrorData } from './models/route-error-data/route-error-data.interface';
import { RouteErrorBoundary } from './ui/components/route-error-boundary/route-error-boundary.component';

/**
 * Constant loads
 *
 * @description
 * Loads started by `LoadingPage`, and what each one does: reject with the queued failure, or
 * resolve when the queue is empty.
 *
 * @type {{ count: number; failures: unknown[] }}
 */
const loads: { count: number; failures: unknown[] } = { count: 0, failures: [] };

/**
 * Component LoadingPage
 *
 * @description
 * A page whose primary read is a resource, as the feature pages read their data: its loader
 * rejects with the next queued failure, and the template reads the value.
 */
@Component({
  selector: 'cw-loading-page',
  template: '<p data-testid="loaded">{{ data.value() }}</p>',
})
class LoadingPage {
  // #region Properties
  /**
   * Property data
   *
   * @description
   * Primary read of the page.
   *
   * @type {ReturnType<typeof rxResource<string, undefined>>}
   * @readonly
   */
  protected readonly data: ReturnType<typeof rxResource<string, undefined>> = rxResource({
    stream: (): Observable<string> => {
      loads.count++;
      const failure: unknown = loads.failures.shift();
      return failure === undefined ? of('Sprint 14') : throwError(() => failure);
    },
  });
  // #endregion
}

/**
 * Component ShellStub
 *
 * @description
 * Stands for the application shell around the routed page.
 */
@Component({
  selector: 'cw-shell-stub',
  imports: [RouterOutlet],
  template: '<nav data-testid="shell">shell</nav><router-outlet />',
})
class ShellStub {}

/**
 * Constant workspace
 *
 * @description
 * Workspace context of the mockup's Atelier Nord.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal<WorkspaceUser>({
    id: 'u1',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization: signal<WorkspaceOrganization>({
    id: 'o1',
    slug: 'atelier-nord',
    name: 'Atelier Nord',
    initials: 'AN',
    role: 'owner',
    plan: 'team',
  }),
  role: computed(() => 'owner' as const),
  can: (): boolean => true,
};

describe('ERRORS_ROUTES and the route error boundary', () => {
  let recovery: {
    requestAccess: ReturnType<typeof vi.fn<(...args: unknown[]) => Observable<void>>>;
    restoreTask: ReturnType<typeof vi.fn<(entryId: string) => Observable<RestoreOutcome>>>;
  };

  let config: WritableSignal<RuntimeConfig>;

  beforeEach(() => {
    config = signal<RuntimeConfig>({ apiUrl: 'http://api.cadenway.localhost' });
    loads.count = 0;
    loads.failures = [];
    recovery = {
      requestAccess: vi.fn(() => of(undefined)),
      restoreTask: vi.fn(() => of<RestoreOutcome>('restored')),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: ':org',
              component: ShellStub,
              providers: [
                provideCadenwayIcons(),
                { provide: WORKSPACE_CONTEXT, useValue: workspace },
              ],
              children: [
                { path: 'page', component: LoadingPage },
                {
                  path: 'tasks',
                  component: LoadingPage,
                  data: {
                    unavailableTitle: 'Could not load the tasks',
                  } satisfies RouteErrorData,
                },
                ...ERRORS_ROUTES,
              ],
            },
            ...ERRORS_ROUTES,
          ],
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        { provide: ErrorRecovery, useValue: recovery },
        { provide: RuntimeConfigStore, useValue: { config } },
      ],
    });
  });

  /**
   * Function open
   *
   * @description
   * Opens a URL and waits until the page or its error state rendered.
   *
   * @param {string} url - Address to open.
   * @returns {Promise<{ harness: RouterTestingHarness; element: HTMLElement }>} The harness and its root element.
   */
  async function open(
    url: string,
  ): Promise<{ harness: RouterTestingHarness; element: HTMLElement }> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle(harness);
    return { harness, element: harness.fixture.nativeElement as HTMLElement };
  }

  /**
   * Function settle
   *
   * @description
   * Waits for pending loads and navigations, then renders.
   *
   * @param {RouterTestingHarness} harness - Harness to settle.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function settle(harness: RouterTestingHarness): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /**
   * Function button
   *
   * @description
   * Finds a button or link by its visible name.
   *
   * @param {HTMLElement} element - Rendered root.
   * @param {string} name - Visible name.
   * @returns {HTMLElement | undefined} The control.
   */
  function button(element: HTMLElement, name: string): HTMLElement | undefined {
    return Array.from(element.querySelectorAll<HTMLElement>('button, a')).find(
      (control: HTMLElement) => control.textContent.trim() === name,
    );
  }

  /**
   * Function heading
   *
   * @description
   * Text of the page's first-level heading.
   *
   * @param {HTMLElement} element - Rendered root.
   * @returns {string | undefined} The heading text.
   */
  function heading(element: HTMLElement): string | undefined {
    return element.querySelector('h1')?.textContent.trim();
  }

  it('renders the 404 of an unknown address at the root, without a shell', async () => {
    const { element }: { element: HTMLElement } = await open('/');

    expect(heading(element)).toBe('Page not found');
    expect(element.querySelector('[data-testid="shell"]')).toBeNull();
  });

  it('renders the 404 of an unknown address inside the workspace shell', async () => {
    const { element }: { element: HTMLElement } = await open('/atelier-nord/missing/page');

    expect(heading(element)).toBe('Page not found');
    expect(element.querySelector('[data-testid="shell"]')).not.toBeNull();
    expect(button(element, 'Back to home')?.getAttribute('href')).toBe('/home');
    expect(loads.count).toBe(0);
  });

  it('renders the not-found state when the page read rejects with a not-found error', async () => {
    loads.failures.push(new NotFoundRouteError());

    const { element }: { element: HTMLElement } = await open('/atelier-nord/page');

    expect(heading(element)).toBe('Page not found');
    expect(element.textContent).toContain('Error 404');
    expect(element.querySelector('[data-testid="shell"]')).not.toBeNull();
  });

  it('renders the access-denied state and sends an access request with the message', async () => {
    loads.failures.push(
      new AccessDeniedRouteError({
        kind: 'space',
        id: 'space-direction',
        name: 'Direction',
        ownerName: 'Léa Petit',
      }),
    );

    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/page');

    expect(heading(element)).toBe('You do not have access to this space');
    expect(element.textContent.replace(/\s+/gu, ' ')).toContain(
      '“Direction” is a private space. Léa Petit, its owner, can add you.',
    );
    expect(element.querySelector('label')?.textContent.replace(/\s+/gu, ' ').trim()).toBe(
      'Message for Léa (optional)',
    );
    const message: HTMLTextAreaElement | null = element.querySelector('textarea');
    if (!message) throw new Error('The message field is missing.');
    message.value = 'I need to cost the tooling share of the 2027 budget.';
    message.dispatchEvent(new Event('input'));
    button(element, 'Request access')?.click();
    await vi.waitFor(() => {
      expect(recovery.requestAccess).toHaveBeenCalled();
    });
    await settle(harness);

    expect(recovery.requestAccess).toHaveBeenCalledWith(
      { kind: 'space', id: 'space-direction' },
      'I need to cost the tooling share of the 2027 budget.',
    );
    const sent: HTMLElement | undefined = button(element, 'Request sent');
    expect(sent?.hasAttribute('disabled')).toBe(true);
    expect(element.querySelector('textarea')).toBeNull();
  });

  it('restores a deleted task, then runs the route again', async () => {
    loads.failures.push(
      new DeletedTaskRouteError({ key: 'CAD-452', name: 'Old sign-in screen' }, 'entry-1'),
    );

    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/page');

    expect(heading(element)).toBe('This task has been deleted');
    expect(element.textContent).toContain('CAD-452 “Old sign-in screen” has been deleted.');
    expect(button(element, 'Open the trash')?.getAttribute('href')).toBe('/atelier-nord/trash');
    button(element, 'Restore the task')?.click();
    await settle(harness);

    expect(recovery.restoreTask).toHaveBeenCalledWith('entry-1');
    expect(loads.count).toBe(2);
    expect(element.querySelector('[data-testid="loaded"]')?.textContent).toBe('Sprint 14');
  });

  it('marks a task that is no longer in the trash as already restored', async () => {
    recovery.restoreTask.mockReturnValue(of<RestoreOutcome>('already-restored'));
    loads.failures.push(
      new DeletedTaskRouteError({ key: 'CAD-452', name: 'Old sign-in screen' }, 'entry-1'),
    );

    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/page');
    button(element, 'Restore the task')?.click();
    await settle(harness);

    expect(button(element, 'Already restored')?.hasAttribute('disabled')).toBe(true);
    expect(loads.count).toBe(1);
  });

  it('renders the unavailable state with its reference, and Retry re-creates the page', async () => {
    loads.failures.push(new UnavailableRouteError(503, 'REQ-7F3A'));

    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/page');

    expect(heading(element)).toBe('Could not load this page');
    expect(
      element
        .querySelector('[data-testid="route-error-reference"]')
        ?.textContent.replace(/\s+/gu, ' ')
        .trim(),
    ).toBe('Error 503 · ref. REQ-7F3A');
    expect(element.querySelector('[data-testid="route-error-status"]')).toBeNull();
    button(element, 'Retry')?.click();
    await settle(harness);

    expect(loads.count).toBe(2);
    expect(element.querySelector('[data-testid="loaded"]')?.textContent).toBe('Sprint 14');
    expect(element.querySelector('[data-testid="shell"]')).not.toBeNull();
  });

  it('titles the unavailable state after its route and links to a configured status page', async () => {
    config.set({
      apiUrl: 'http://api.cadenway.localhost',
      statusUrl: 'https://status.cadenway.test',
    });
    loads.failures.push(new UnavailableRouteError(503, null));

    const { element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/tasks');

    expect(heading(element)).toBe('Could not load the tasks');
    expect(element.textContent).toContain(
      'The server did not answer in time. Your data is not lost: try again in a moment.',
    );
    expect(button(element, 'Retry')).toBeDefined();
    const status: HTMLAnchorElement | null = element.querySelector(
      '[data-testid="route-error-status"]',
    );
    expect(status?.textContent.trim()).toBe('Service status');
    expect(status?.getAttribute('href')).toBe('https://status.cadenway.test');
    expect(status?.getAttribute('target')).toBe('_blank');
  });

  it('renders any other failure as unavailable, and Retry keeps failing until the read succeeds', async () => {
    loads.failures.push(new Error('boom'), new Error('boom again'));

    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open('/atelier-nord/page');

    expect(heading(element)).toBe('Could not load this page');
    expect(element.querySelector('[data-testid="route-error-reference"]')).toBeNull();
    button(element, 'Retry')?.click();
    await settle(harness);
    expect(loads.count).toBe(2);
    expect(heading(element)).toBe('Could not load this page');

    button(element, 'Retry')?.click();
    await settle(harness);
    expect(loads.count).toBe(3);
    expect(element.querySelector('[data-testid="loaded"]')?.textContent).toBe('Sprint 14');
  });
});
