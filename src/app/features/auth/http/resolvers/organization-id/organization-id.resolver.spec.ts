import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RedirectCommand, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { OrganizationApi } from '../../../data-access/services/organization-api/organization-api.service';
import { resolveOrganizationId } from './organization-id.resolver';

/**
 * Function run
 *
 * @description
 * Runs the resolver with a faked current-organization read.
 *
 * @param {() => Promise<unknown>} current - The faked read.
 * @returns {Promise<string | RedirectCommand>} The resolver's answer.
 */
function run(current: () => Promise<unknown>): Promise<string | RedirectCommand> {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: OrganizationApi, useValue: { current } }],
  });
  return TestBed.runInInjectionContext(() => resolveOrganizationId());
}

describe('resolveOrganizationId', () => {
  it('pins the route to the session organization', async () => {
    await expect(run(() => Promise.resolve({ id: 'org-atelier-nord', slug: 'x' }))).resolves.toBe(
      'org-atelier-nord',
    );
  });

  it('redirects a lost session to /login', async () => {
    const result: string | RedirectCommand = await run(
      vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 401 })),
    );

    expect(result).toBeInstanceOf(RedirectCommand);
    expect(TestBed.inject(Router).serializeUrl((result as RedirectCommand).redirectTo)).toBe(
      '/login',
    );
  });
});
