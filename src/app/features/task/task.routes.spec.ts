import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, input, type InputSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
  withErrorBoundaries,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TasksService } from '@cadenway/api-client';
import { type Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { isRouteError } from '@shared/route-errors';

import { TASK_ROUTES } from './task.routes';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the error boundary: shows the kind of the typed route error it receives.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="error">{{ kindOf(error()) }}</p>',
})
class FakeBoundary {
  // #region Properties
  /**
   * Property error
   *
   * @description
   * The error the router caught.
   *
   * @type {InputSignal<unknown>}
   * @readonly
   */
  public readonly error: InputSignal<unknown> = input<unknown>();
  // #endregion

  // #region Methods
  /**
   * Method kindOf
   *
   * @description
   * The kind of a typed route error, following the `cause` chain; `other` for any other error.
   *
   * @param {unknown} error - The caught error.
   * @returns {string} The kind.
   */
  protected kindOf(error: unknown): string {
    let current: unknown = error;
    while (current instanceof Error) {
      if (isRouteError(current)) return current.kind;
      current = current.cause;
    }
    return 'other';
  }
  // #endregion
}

/**
 * Component ListStub
 *
 * @description
 * The list the deep link redirects to.
 */
@Component({ selector: 'cw-list-stub', template: '<p data-testid="list">list</p>' })
class ListStub {}

/**
 * Constant cad482
 *
 * @description
 * CAD-482 of Sprint 14 as `getTask` answers it.
 *
 * @type {Record<string, unknown>}
 */
const cad482: Record<string, unknown> = {
  key: 'CAD-482',
  name: 'Redesign the SSO sign-in screen',
  description: null,
  status: 'review',
  cancelReason: null,
  cancelNote: null,
  priority: 'haute',
  assignees: [],
  dueDate: null,
  startDate: null,
  estimateMinutes: null,
  labels: [],
  parentKey: null,
  listId: 'list-sprint-14',
  spaceId: 'product',
  subtaskCounts: { total: 0, closed: 0 },
  checklist: [],
  checklistCounts: { total: 0, done: 0 },
  completedAt: null,
  createdAt: '2026-11-03T09:00:00Z',
  createdBy: { userId: 'u1' },
  updatedAt: '2026-11-08T09:00:00Z',
  version: 4,
};

/**
 * Function problem
 *
 * @description
 * A problem answer of the gateway.
 *
 * @param {number} status - HTTP status.
 * @param {Record<string, unknown>} [body] - Problem body.
 * @returns {HttpErrorResponse} The answer.
 */
function problem(status: number, body: Record<string, unknown> = {}): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: body,
    headers: new HttpHeaders({ 'X-Request-Id': 'req-7' }),
  });
}

describe('TASK_ROUTES', () => {
  let read: Mock<(key: string) => Observable<unknown>>;

  beforeEach(() => {
    read = vi.fn<(key: string) => Observable<unknown>>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: ':org',
              children: [
                { path: 'home', component: ListStub },
                { path: 'l/:listId/list', component: ListStub },
                ...TASK_ROUTES,
              ],
            },
          ],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
        ),
        { provide: TasksService, useValue: { getTask: read } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: signal({ id: 'org-1', slug: 'atelier-nord' }) },
        },
      ],
    });
  });

  /**
   * Function open
   *
   * @description
   * Navigates to the deep link of CAD-482 and returns the rendered state.
   *
   * @returns {Promise<{ harness: RouterTestingHarness; text: () => string }>} The harness and its text.
   */
  async function open(): Promise<{ harness: RouterTestingHarness; text: () => string }> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/atelier-nord/home');
    await harness.navigateByUrl('/atelier-nord/t/CAD-482');
    harness.detectChanges();
    return {
      harness,
      text: (): string => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent.trim() ?? '';
      },
    };
  }

  it('redirects to the task list with the task in the address', async () => {
    read.mockReturnValue(of(cad482));

    const { text }: { text: () => string } = await open();

    expect(TestBed.inject(Router).url).toBe('/atelier-nord/l/list-sprint-14/list?task=CAD-482');
    expect(text()).toBe('list');
  });

  it('renders not found at the task address for a missing task', async () => {
    read.mockReturnValue(throwError(() => problem(404, { code: 'task.not-found' })));

    const { text }: { text: () => string } = await open();

    expect(text()).toBe('not-found');
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/t/CAD-482');
  });

  it('renders the deleted task with its trash entry for a task in the trash', async () => {
    read.mockReturnValue(
      throwError(() =>
        problem(404, {
          code: 'task.trashed',
          details: { key: 'CAD-482', name: 'Redesign the SSO sign-in screen', entryId: 'entry-1' },
        }),
      ),
    );

    const { text }: { text: () => string } = await open();

    expect(text()).toBe('deleted-task');
  });

  it('renders unavailable for a refused or unanswered read, and Retry reads again', async () => {
    read
      .mockReturnValueOnce(throwError(() => problem(503)))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValue(of(cad482));

    const { harness, text }: { harness: RouterTestingHarness; text: () => string } = await open();
    expect(text()).toBe('unavailable');

    await TestBed.inject(Router).navigateByUrl('/atelier-nord/t/CAD-482', {
      onSameUrlNavigation: 'reload',
    });
    harness.detectChanges();
    expect(text()).toBe('unavailable');

    await TestBed.inject(Router).navigateByUrl('/atelier-nord/t/CAD-482', {
      onSameUrlNavigation: 'reload',
    });
    expect(read).toHaveBeenCalledTimes(3);
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/l/list-sprint-14/list?task=CAD-482');
  });
});
