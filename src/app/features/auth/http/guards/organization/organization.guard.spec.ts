import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { OrganizationApi } from '../../../data-access/services/organization-api/organization-api.service';
import { requireOrganization } from './organization.guard';

/**
 * Function run
 *
 * @description
 * Runs the guard with a faked current-organization read.
 *
 * @param {() => Promise<unknown>} current - The faked read.
 * @returns {Promise<string | boolean>} True, or the serialized redirect.
 */
async function run(current: () => Promise<unknown>): Promise<string | boolean> {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: OrganizationApi, useValue: { current } }],
  });
  const result: boolean | UrlTree = await TestBed.runInInjectionContext(() =>
    requireOrganization(),
  );
  return typeof result === 'boolean' ? result : TestBed.inject(Router).serializeUrl(result);
}

describe('requireOrganization', () => {
  it('opens the route once the session has an organization', async () => {
    await expect(run(() => Promise.resolve({ id: 'org', slug: 'atelier-nord' }))).resolves.toBe(
      true,
    );
  });

  it('recovers through /login or /organizations', async () => {
    await expect(
      run(vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 401 }))),
    ).resolves.toBe('/login');
    TestBed.resetTestingModule();
    await expect(
      run(vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 403 }))),
    ).resolves.toBe('/organizations');
  });
});
