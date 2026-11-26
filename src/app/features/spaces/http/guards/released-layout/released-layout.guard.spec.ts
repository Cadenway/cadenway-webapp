import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';

import { RELEASED_VIEWS } from '../../../constants/released-views/released-views.token';
import type { ViewLayout } from '../../../models/saved-view/saved-view.interface';
import { releasedLayoutGuard } from './released-layout.guard';

/**
 * Component ViewStub
 *
 * @description
 * A routed view of the guard's routes.
 */
@Component({ selector: 'cw-view-stub', template: '' })
class ViewStub {}

/**
 * Function configure
 *
 * @description
 * Routes a list with a `list` and a guarded `board` view, with the given released layouts.
 *
 * @param {readonly ViewLayout[]} layouts - Released layouts.
 */
function configure(layouts: readonly ViewLayout[]): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: ':org/l/:listId',
          children: [
            { path: 'list', component: ViewStub },
            { path: 'board', canActivate: [releasedLayoutGuard('board')], component: ViewStub },
          ],
        },
      ]),
      { provide: RELEASED_VIEWS, useValue: { layouts, dialogs: [] } },
    ],
  });
}

describe('releasedLayoutGuard', () => {
  it('replaces an unreleased layout with the list view, keeping the query and the fragment', async () => {
    configure(['list']);
    await RouterTestingHarness.create('/atelier-nord/l/l-bugs/board?savedView=sv-bugs#row-12');

    expect(TestBed.inject(Router).url).toBe('/atelier-nord/l/l-bugs/list?savedView=sv-bugs#row-12');
  });

  it('opens a released layout', async () => {
    configure(['list', 'board']);
    await RouterTestingHarness.create('/atelier-nord/l/l-bugs/board#row-12');

    expect(TestBed.inject(Router).url).toBe('/atelier-nord/l/l-bugs/board#row-12');
  });
});
