import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Navigation, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceRefresh } from './workspace-refresh.service';
import {
  WORKSPACE_RECOVERY_NAVIGATION,
  WorkspaceRevalidation,
} from './workspace-revalidation.service';

/**
 * Component SectionStub
 *
 * @description
 * A page below the workspace.
 */
@Component({ selector: 'cw-section-stub', template: '<p>Section</p>' })
class SectionStub {}

describe('WorkspaceRefresh', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: ':org/organization/general', component: SectionStub }]),
        WorkspaceRevalidation,
        WorkspaceRefresh,
      ],
    });
  });

  it('verifies the workspace again with a same-address recovery navigation', async () => {
    await RouterTestingHarness.create('/atelier-nord/organization/general');
    const router: Router = TestBed.inject(Router);
    const navigate: ReturnType<typeof vi.spyOn> = vi.spyOn(router, 'navigateByUrl');

    await TestBed.inject(WorkspaceRefresh).refresh();

    expect(navigate).toHaveBeenCalledWith('/atelier-nord/organization/general', {
      onSameUrlNavigation: 'reload',
      info: WORKSPACE_RECOVERY_NAVIGATION,
    });
  });

  it('leaves the verification to a navigation under way instead of cancelling it', async () => {
    await RouterTestingHarness.create('/atelier-nord/organization/general');
    const router: Router = TestBed.inject(Router);
    vi.spyOn(router, 'currentNavigation').mockReturnValue({ id: 7 } as unknown as Navigation);
    const navigate: ReturnType<typeof vi.spyOn> = vi.spyOn(router, 'navigateByUrl');

    await TestBed.inject(WorkspaceRefresh).refresh();

    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(WorkspaceRevalidation).consume()).toBe(true);
  });
});
