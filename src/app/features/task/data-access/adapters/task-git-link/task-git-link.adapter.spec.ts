import type { GitLink } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import type { TaskGitLinkPage } from '../../../models/task-git-link/task-git-link.interface';
import { toTaskGitLink, toTaskGitLinkPage } from './task-git-link.adapter';

/**
 * Constant PULL_REQUEST
 *
 * @description
 * `#214` of `atelier-nord/cadenway-web`, linked to CAD-482 from its branch (the contract's
 * example).
 *
 * @type {GitLink}
 */
const PULL_REQUEST: GitLink = {
  id: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e03',
  taskKey: 'CAD-482',
  provider: 'github',
  kind: 'pull-request',
  state: 'open',
  providerRepositoryId: 734912058,
  number: 214,
  branch: null,
  headSha: 'c4e1a9f2b7d04e8a9c1f3b5d7e9a0c2e4f6b8d01',
  checksCompletedAt: '2026-11-07T15:20:00Z',
  createdAt: '2026-11-08T08:40:00Z',
  updatedAt: '2026-11-08T08:40:00Z',
  version: 1,
  title: 'feat(auth): unified SSO sign-in screen',
  draft: false,
  url: 'https://github.com/atelier-nord/cadenway-web/pull/214',
  repository: {
    fullName: 'atelier-nord/cadenway-web',
    url: 'https://github.com/atelier-nord/cadenway-web',
  },
  sourceBranch: 'cad-482-sso-sign-in-screen',
  author: { login: 'cmartin', name: 'Camille Martin' },
  checks: { state: 'failed', total: 12, failed: 1 },
  reviewRequested: true,
  additions: 418,
  deletions: 132,
  linkSource: 'branch',
};

/**
 * Constant BRANCH
 *
 * @description
 * The branch `cad-479-token-rate-limit` of `atelier-nord/cadenway-api`, as recorded before any
 * webhook detail.
 *
 * @type {GitLink}
 */
const BRANCH: GitLink = {
  id: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e02',
  taskKey: 'CAD-479',
  provider: 'github',
  kind: 'branch',
  state: 'branch',
  providerRepositoryId: 734912377,
  number: null,
  branch: 'cad-479-token-rate-limit',
  headSha: null,
  checksCompletedAt: null,
  createdAt: '2026-11-03T09:30:00Z',
  updatedAt: '2026-11-03T09:30:00Z',
  version: 1,
};

describe('toTaskGitLink', () => {
  it('maps a pull request with its checks, review, diff size and link source', () => {
    expect(toTaskGitLink(PULL_REQUEST)).toEqual({
      id: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e03',
      provider: 'github',
      kind: 'pull-request',
      state: 'open',
      title: 'feat(auth): unified SSO sign-in screen',
      number: 214,
      url: 'https://github.com/atelier-nord/cadenway-web/pull/214',
      repository: {
        fullName: 'atelier-nord/cadenway-web',
        url: 'https://github.com/atelier-nord/cadenway-web',
      },
      branch: 'cad-482-sso-sign-in-screen',
      author: { login: 'cmartin', name: 'Camille Martin' },
      checks: { state: 'failed', total: 12, failed: 1 },
      checksCompletedAt: '2026-11-07T15:20:00Z',
      reviewRequested: true,
      additions: 418,
      deletions: 132,
      linkSource: 'branch',
      createdAt: '2026-11-08T08:40:00Z',
    });
  });

  it('maps a branch without the members it never has', () => {
    expect(toTaskGitLink(BRANCH)).toEqual({
      id: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e02',
      provider: 'github',
      kind: 'branch',
      state: 'branch',
      title: null,
      number: null,
      url: null,
      repository: null,
      branch: 'cad-479-token-rate-limit',
      author: null,
      checks: null,
      checksCompletedAt: null,
      reviewRequested: false,
      additions: null,
      deletions: null,
      linkSource: null,
      createdAt: '2026-11-03T09:30:00Z',
    });
  });

  it('folds the draft flag into the state of an open request only', () => {
    expect(toTaskGitLink({ ...PULL_REQUEST, draft: true })?.state).toBe('draft');
    expect(toTaskGitLink({ ...PULL_REQUEST, state: 'merged', draft: true })?.state).toBe('merged');
    expect(toTaskGitLink({ ...PULL_REQUEST, state: 'closed' })?.state).toBe('closed');
  });

  it('reads values of a later contract version safely', () => {
    expect(toTaskGitLink({ ...PULL_REQUEST, state: 'locked' })?.state).toBe('open');
    expect(toTaskGitLink({ ...PULL_REQUEST, checks: { state: 'queued' } })?.checks).toBeNull();
    expect(toTaskGitLink({ ...PULL_REQUEST, linkSource: 'manual' })?.linkSource).toBeNull();
    expect(toTaskGitLink({ ...PULL_REQUEST, checks: { state: 'passed' } })?.checks).toEqual({
      state: 'passed',
      total: null,
      failed: null,
    });
  });

  it('leaves out a link of an unknown host or kind', () => {
    expect(toTaskGitLink({ ...PULL_REQUEST, provider: 'bitbucket' })).toBeNull();
    expect(toTaskGitLink({ ...PULL_REQUEST, kind: 'tag' })).toBeNull();
  });
});

describe('toTaskGitLinkPage', () => {
  it('keeps the known links in order with the next cursor', () => {
    const page: TaskGitLinkPage = toTaskGitLinkPage({
      items: [PULL_REQUEST, { ...BRANCH, provider: 'gitea' }, BRANCH],
      nextCursor: 'c2',
    });

    expect(page.items.map((link) => link.id)).toEqual([PULL_REQUEST.id, BRANCH.id]);
    expect(page.nextCursor).toBe('c2');
  });
});
