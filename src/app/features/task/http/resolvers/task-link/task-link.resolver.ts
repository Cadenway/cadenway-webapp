import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  RedirectCommand,
  type ResolveFn,
  Router,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TaskApi } from '../../../data-access/services/task-api/task-api.service';
import type { TaskSummary } from '../../../models/task-summary/task-summary.interface';

/**
 * Function taskLinkResolver
 *
 * @description
 * The deep link of a task (`/:org/t/:taskKey`): reads the task by key once the workspace resolver
 * committed the organization, then redirects to its list with `?task=<KEY>`
 * (`/:org/l/<listId>/list?task=<KEY>`, replacing the address), where the list opens it. A task it
 * cannot read resolves the typed route error of `TaskApi.readLink`: not found, deleted (with its
 * trash entry) or unavailable. `TaskLinkPage` hands it to the error boundary, which renders it at
 * the task's address; the route runs its resolver again on `Retry` and after `Restore the task`.
 *
 * @param {ActivatedRouteSnapshot} route - The task route, whose `taskKey` names the task.
 * @returns {Promise<Error | RedirectCommand>} The redirect to the list, or why the task could not
 * be read.
 */
export const taskLinkResolver: ResolveFn<Error> = async (
  route: ActivatedRouteSnapshot,
): Promise<Error | RedirectCommand> => {
  const router: Router = inject(Router);
  const slug: string = inject(WORKSPACE_CONTEXT).organization().slug;
  const api: TaskApi = inject(TaskApi);
  const key: string = route.paramMap.get('taskKey') ?? '';
  try {
    const task: TaskSummary = await firstValueFrom(api.readLink(key));
    return new RedirectCommand(
      router.createUrlTree(['/', slug, 'l', task.listId, 'list'], {
        queryParams: { task: task.key },
      }),
      { replaceUrl: true },
    );
  } catch (error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
};
