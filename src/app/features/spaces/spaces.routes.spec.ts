import type { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { LAYOUT_SEGMENTS } from './constants/view-layouts/view-layouts.constants';
import { SPACES_ROUTES } from './spaces.routes';

/**
 * Function viewRoutes
 *
 * @description
 * The children of `l/:listId` that load a view (the empty-path redirect left out).
 *
 * @returns {readonly Route[]} The view routes.
 */
function viewRoutes(): readonly Route[] {
  const list: Route | undefined = SPACES_ROUTES[0]?.children?.find(
    (route: Route): boolean => route.path === 'l/:listId',
  );
  return (list?.children ?? []).filter((route: Route): boolean => route.path !== '');
}

describe('SPACES_ROUTES', () => {
  it('declares one view route per layout segment', () => {
    expect(viewRoutes().map((route: Route): string | undefined => route.path)).toEqual(
      Object.values(LAYOUT_SEGMENTS),
    );
  });

  it("titles every view's failed read with the mockup's single title", () => {
    for (const route of viewRoutes()) {
      expect(route.data?.['unavailableTitle'], route.path).toBe('Could not load the tasks');
    }
  });
});
