import type { Route, Routes } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { RESERVED_SLUGS } from '@core/routing';
import { AUTH_ROUTES } from '@features/auth/auth.routes';
import { WORKSPACE_ROUTES } from '@features/workspace/workspace.routes';

import { APP_ROUTES } from './app.routes';

/**
 * Function firstSegments
 *
 * @description
 * Lists the fixed first segments of a route table, looking through componentless and layout
 * routes whose path is empty.
 *
 * @param {Routes} routes - The route table.
 * @returns {string[]} The first segments that are neither empty, a parameter nor a wildcard.
 */
function firstSegments(routes: Routes): string[] {
  return routes.flatMap((route: Route): string[] => {
    const path: string = route.path ?? '';
    if (path === '') return firstSegments(route.children ?? []);
    const segment: string = path.split('/')[0] ?? '';
    return segment.startsWith(':') || segment === '**' ? [] : [segment];
  });
}

describe('APP_ROUTES', () => {
  it('reserves every fixed first segment of the application, so no slug shadows it', () => {
    const segments: Set<string> = new Set<string>([
      ...firstSegments(APP_ROUTES),
      ...firstSegments(AUTH_ROUTES),
      ...firstSegments(WORKSPACE_ROUTES),
    ]);

    expect([...segments].filter((segment: string) => !RESERVED_SLUGS.has(segment))).toEqual([]);
    expect(segments.size).toBeGreaterThan(10);
  });
});
