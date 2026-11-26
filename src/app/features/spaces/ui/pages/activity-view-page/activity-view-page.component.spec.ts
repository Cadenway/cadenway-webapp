import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withErrorBoundaries } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';
import { TaskCreate, TaskDetailOpener } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { UnavailableRouteError } from '@shared/route-errors';

import { ListActivityApi } from '../../../data-access/services/list-activity-api/list-activity-api.service';
import type {
  ListActivityEntry,
  ListActivityPage,
} from '../../../models/list-activity/list-activity.interface';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import { ActivityViewStore } from '../../../state/activity-view/activity-view.store';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { ActivityViewPage } from './activity-view-page.component';

/**
 * Constant URL
 *
 * @description
 * Address of the view in the test router.
 *
 * @type {string}
 */
const URL: string = '/atelier-nord/l/sprint-14/activity';

/**
 * Constant members
 *
 * @description
 * The mockup's people of `Atelier Nord`.
 *
 * @type {readonly ListMember[]}
 */
const members: readonly ListMember[] = [
  { userId: 'u-camille', name: 'Camille Martin' },
  { userId: 'u-ines', name: 'Inès Robert' },
];

/**
 * Constant entries
 *
 * @description
 * Today's activity of `Sprint 14`: a status change, an assignment, a priority change and a
 * comment by an automation.
 *
 * @type {readonly ListActivityEntry[]}
 */
const entries: readonly ListActivityEntry[] = [
  {
    id: 'e1',
    at: new Date().toISOString(),
    actor: { type: 'user', id: 'u-camille', provider: null },
    task: { key: 'CAD-479', name: 'Fix the redirect after sign-in', status: 'progress' },
    change: { kind: 'status', from: 'todo', to: 'progress' },
  },
  {
    id: 'e2',
    at: new Date().toISOString(),
    actor: { type: 'user', id: 'u-camille', provider: null },
    task: { key: 'CAD-490', name: 'Log SSO sign-ins', status: 'todo' },
    change: { kind: 'assign', userId: 'u-ines', added: true },
  },
  {
    id: 'e3',
    at: new Date().toISOString(),
    actor: { type: 'user', id: 'u-ines', provider: null },
    task: { key: 'CAD-490', name: 'Log SSO sign-ins', status: 'todo' },
    change: { kind: 'priority', from: 'moyenne', to: 'urgente' },
  },
  {
    id: 'e4',
    at: new Date().toISOString(),
    actor: { type: 'automation', id: 'rule-1', provider: null },
    task: { key: 'CAD-482', name: 'SSO screen', status: 'review' },
    change: { kind: 'comment', excerpt: 'Ready for review' },
  },
];

/**
 * Function pageOf
 *
 * @description
 * A page of entries.
 *
 * @param {readonly ListActivityEntry[]} items - Its entries.
 * @returns {ListActivityPage} The last page.
 */
function pageOf(items: readonly ListActivityEntry[]): ListActivityPage {
  return { items, nextCursor: null, total: items.length };
}

describe('ActivityViewPage', () => {
  let page: Mock<ListActivityApi['page']>;
  let open: Mock;

  beforeEach(() => {
    page = vi.fn<ListActivityApi['page']>(() => Promise.resolve(pageOf(entries)));
    open = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: 'atelier-nord/l/sprint-14/activity',
              providers: [ActivityViewStore, { provide: ListActivityApi, useValue: { page } }],
              component: ActivityViewPage,
            },
          ],
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        {
          provide: ListPageStore,
          useValue: {
            listId: signal('sprint-14'),
            organizationMembers: { hasValue: () => true, value: () => members },
            space: { hasValue: () => false, value: () => undefined },
          },
        },
        {
          provide: TaskDetailOpener,
          useValue: { open, closed: new Subject<string>(), changed: new Subject<string>() },
        },
        { provide: TaskCreate, useValue: { created: new Subject() } },
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: () => ({ id: 'org-atelier-nord', slug: 'atelier-nord' }),
            user: () => ({ id: 'u-camille' }),
          },
        },
      ],
    });
  });

  /**
   * Function view
   *
   * @description
   * Text of the rendered route once changes are detected.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {string} The text.
   */
  function view(harness: RouterTestingHarness): string {
    harness.detectChanges();
    return harness.routeNativeElement?.textContent ?? '';
  }

  /**
   * Function button
   *
   * @description
   * The first button of the page whose text contains the given words.
   *
   * @param {string} text - Words of the button.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(text: string): HTMLButtonElement | undefined {
    return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (item: HTMLButtonElement): boolean => item.textContent.includes(text),
    );
  }

  it('shows the day group, the actors, the verbs, the details and the count', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(URL);
    await expect.poll(() => view(harness)).toContain('Fix the redirect after sign-in');

    const text: string = view(harness);
    expect(text).toContain('Today');
    expect(text).toContain('Camille Martin');
    expect(text).toContain('changed the status');
    expect(text).toContain('assigned Inès Robert');
    expect(text).toContain('changed the priority to');
    expect(text).toContain('Urgent');
    expect(text).toContain('An automation');
    expect(text).toContain('Ready for review');
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="activity-count"]')?.textContent,
    ).toContain('4 events');
  });

  it("opens a task's detail from its chip", async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(URL);
    await expect.poll(() => view(harness)).toContain('Fix the redirect after sign-in');

    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('[data-testid="activity-task"]')
      ?.click();

    expect(open).toHaveBeenCalledWith('CAD-479');
  });

  it('reads one kind from its chip and every kind again from All', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(URL);
    await expect.poll(() => view(harness)).toContain('Today');

    button('Statuses')?.click();
    await expect.poll(() => page.mock.lastCall?.[1]).toEqual({ kinds: ['status'], actorId: null });
    expect(button('Statuses')?.getAttribute('aria-pressed')).toBe('true');
    expect(button('All')?.getAttribute('aria-pressed')).toBe('false');

    button('All')?.click();
    await expect.poll(() => page.mock.lastCall?.[1]).toEqual({ kinds: [], actorId: null });
    harness.detectChanges();
    expect(button('All')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the empty state, with Clear filters only when filtered', async () => {
    page.mockResolvedValue(pageOf([]));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(URL);
    await expect.poll(() => view(harness)).toContain('No activity matches');
    expect(button('Clear filters')).toBeUndefined();
    expect(view(harness)).toContain('0 events');

    button('Comments')?.click();
    await expect.poll(() => button('Clear filters')).toBeDefined();
    button('Clear filters')?.click();

    await expect.poll(() => page.mock.lastCall?.[1]).toEqual({ kinds: [], actorId: null });
    await expect.poll(() => (view(harness), button('Clear filters'))).toBeUndefined();
  });

  it('retries a failed first read through the route boundary', async () => {
    page.mockRejectedValueOnce(new UnavailableRouteError(503, 'req-1'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(URL);
    await expect.poll(() => view(harness)).toContain('Retry');
    expect(view(harness)).not.toContain('No activity matches');

    button('Retry')?.click();

    await expect.poll(() => page.mock.calls.length).toBe(2);
    await expect.poll(() => view(harness)).toContain('Fix the redirect after sign-in');
  });

  it('offers Retry in place when a later read fails', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create(URL);
    await expect.poll(() => view(harness)).toContain('Today');

    page.mockRejectedValueOnce(new UnavailableRouteError(503, 'req-2'));
    button('Creations')?.click();
    await expect.poll(() => view(harness)).toContain('The activity could not be loaded.');

    button('Retry')?.click();
    await expect.poll(() => page.mock.calls.length).toBe(3);
    await expect
      .poll(() => (view(harness), document.querySelector('[data-testid="activity-failed"]')))
      .toBeNull();
  });
});
