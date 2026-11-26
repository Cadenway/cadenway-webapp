import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { GitLinksService } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { TaskGitLinkPage } from '../../../models/task-git-link/task-git-link.interface';
import { GIT_LINK_PAGE, TaskGitLinksApi } from './task-git-links-api.service';

/**
 * Constant BRANCH
 *
 * @description
 * The branch `cad-482-sso-sign-in-screen` of `atelier-nord/cadenway-web`, as the gateway sends it.
 *
 * @type {Record<string, unknown>}
 */
const BRANCH: Record<string, unknown> = {
  id: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e02',
  taskKey: 'CAD-482',
  provider: 'github',
  kind: 'branch',
  state: 'branch',
  providerRepositoryId: 734912058,
  number: null,
  branch: 'cad-482-sso-sign-in-screen',
  headSha: null,
  checksCompletedAt: null,
  createdAt: '2026-11-03T09:30:00Z',
  updatedAt: '2026-11-03T09:30:00Z',
  version: 1,
  url: 'https://github.com/atelier-nord/cadenway-web/tree/cad-482-sso-sign-in-screen',
  repository: {
    fullName: 'atelier-nord/cadenway-web',
    url: 'https://github.com/atelier-nord/cadenway-web',
  },
  author: { login: 'irobert' },
  linkSource: 'branch',
};

describe('TaskGitLinksApi', () => {
  let listTaskGitLinks: Mock;
  let api: TaskGitLinksApi;

  beforeEach(() => {
    listTaskGitLinks = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: GitLinksService, useValue: { listTaskGitLinks } }],
    });
    api = TestBed.inject(TaskGitLinksApi);
  });

  it('reads the first page without the HTTP cache and maps it', async () => {
    listTaskGitLinks.mockReturnValue(of({ items: [BRANCH], nextCursor: 'c2' }));

    const page: TaskGitLinkPage = await api.page('CAD-482', null);

    expect(listTaskGitLinks).toHaveBeenCalledWith(
      'CAD-482',
      { limit: GIT_LINK_PAGE },
      { cache: 'no-store' },
    );
    expect(page.nextCursor).toBe('c2');
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      kind: 'branch',
      state: 'branch',
      branch: 'cad-482-sso-sign-in-screen',
      author: { login: 'irobert', name: null },
    });
  });

  it('reads a later page by its cursor', async () => {
    listTaskGitLinks.mockReturnValue(of({ items: [], nextCursor: null }));

    await expect(api.page('CAD-482', 'c2')).resolves.toEqual({ items: [], nextCursor: null });
    expect(listTaskGitLinks).toHaveBeenCalledWith(
      'CAD-482',
      { limit: GIT_LINK_PAGE, cursor: 'c2' },
      { cache: 'no-store' },
    );
  });

  it('lets a failed read reject', async () => {
    listTaskGitLinks.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));

    await expect(api.page('CAD-482', null)).rejects.toBeInstanceOf(HttpErrorResponse);
  });
});
