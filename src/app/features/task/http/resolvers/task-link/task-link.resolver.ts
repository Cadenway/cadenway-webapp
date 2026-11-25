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
 * Constant NOT_FOUND_SEGMENT
 *
 * @description
 * A segment no screen below `/:org` declares, so the workspace's `**` renders its 404 inside the
 * shell. The redirect skips the location change: the browser keeps the task address.
 *
 * @type {string}
 */
const NOT_FOUND_SEGMENT: string = 'not-found';

/**
 * Function taskLinkResolver
 *
 * @description
 * The deep link of a task (`/:org/t/:taskKey`): reads the task by key once the workspace resolver
 * committed the organization, then redirects to its list with `?task=<KEY>`
 * (`/:org/l/<listId>/list?task=<KEY>`), where the list opens it. A task the caller cannot read (a
 * missing, deleted or private task, a malformed key, an unavailable gateway) renders the
 * workspace's 404 at the same address. It never resolves a value: it always redirects with a
 * `RedirectCommand`, so it never reaches the route's error boundary.
 *
 * @param {ActivatedRouteSnapshot} route - The task route, whose `taskKey` names the task.
 * @returns {Promise<RedirectCommand>} The redirect to the list or to the 404.
 */
export const taskLinkResolver: ResolveFn<never> = async (
  route: ActivatedRouteSnapshot,
): Promise<RedirectCommand> => {
  const router: Router = inject(Router);
  const slug: string = inject(WORKSPACE_CONTEXT).organization().slug;
  const api: TaskApi = inject(TaskApi);
  const key: string = route.paramMap.get('taskKey') ?? '';
  try {
    const task: TaskSummary = await firstValueFrom(api.read(key));
    return new RedirectCommand(
      router.createUrlTree(['/', slug, 'l', task.listId, 'list'], {
        queryParams: { task: task.key },
      }),
      { replaceUrl: true },
    );
  } catch {
    return new RedirectCommand(router.createUrlTree(['/', slug, NOT_FOUND_SEGMENT]), {
      skipLocationChange: true,
    });
  }
};
