import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  RedirectCommand,
  Router,
  type RouterStateSnapshot,
} from '@angular/router';
import { type Observable, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TaskApi } from '../../../data-access/services/task-api/task-api.service';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';
import { taskLinkResolver } from './task-link.resolver';

/**
 * Function run
 *
 * @description
 * Resolves `/atelier-nord/t/CAD-482` with a faked task read and returns the redirect.
 *
 * @param {() => Observable<TaskSummary>} read - The faked `TaskApi.read`.
 * @returns {Promise<{ url: string; skipLocationChange: boolean }>} The redirect and its option.
 */
async function run(
  read: () => Observable<TaskSummary>,
): Promise<{ url: string; skipLocationChange: boolean }> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TaskApi, useValue: { read } },
      {
        provide: WORKSPACE_CONTEXT,
        useValue: { organization: signal({ id: 'org-1', slug: 'atelier-nord' }) },
      },
    ],
  });
  const result: unknown = await TestBed.runInInjectionContext(() =>
    taskLinkResolver(
      { paramMap: convertToParamMap({ taskKey: 'CAD-482' }) } as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ),
  );
  if (!(result instanceof RedirectCommand)) throw new Error('Expected a redirect');
  return {
    url: TestBed.inject(Router).serializeUrl(result.redirectTo),
    skipLocationChange: result.navigationBehaviorOptions?.skipLocationChange === true,
  };
}

describe('taskLinkResolver', () => {
  it('redirects to the task list with the task in the address', async () => {
    const redirect: { url: string; skipLocationChange: boolean } = await run(() =>
      of({ key: 'CAD-482', listId: 'list-sprint-14' } as TaskSummary),
    );
    expect(redirect).toEqual({
      url: '/atelier-nord/l/list-sprint-14/list?task=CAD-482',
      skipLocationChange: false,
    });
  });

  it('renders the 404 at the same address when the task is missing', async () => {
    const redirect: { url: string; skipLocationChange: boolean } = await run(() =>
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    expect(redirect).toEqual({ url: '/atelier-nord/not-found', skipLocationChange: true });
  });
});
