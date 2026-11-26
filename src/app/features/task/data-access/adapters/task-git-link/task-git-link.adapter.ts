import type { GitLink, GitLinkPage } from '@cadenway/api-client';

import type {
  TaskGitChecks,
  TaskGitChecksState,
  TaskGitLink,
  TaskGitLinkKind,
  TaskGitLinkPage,
  TaskGitLinkSource,
  TaskGitLinkState,
  TaskGitProvider,
} from '../../../models/task-git-link/task-git-link.interface';

/**
 * Constant PROVIDERS
 *
 * @description
 * The Git hosts the panel knows.
 *
 * @type {readonly string[]}
 */
const PROVIDERS: readonly string[] = ['github', 'gitlab'];

/**
 * Constant KINDS
 *
 * @description
 * The link kinds the panel knows.
 *
 * @type {readonly string[]}
 */
const KINDS: readonly string[] = ['branch', 'pull-request'];

/**
 * Constant REQUEST_STATES
 *
 * @description
 * The lifecycle states of a pull or merge request the panel knows.
 *
 * @type {readonly string[]}
 */
const REQUEST_STATES: readonly string[] = ['open', 'merged', 'closed'];

/**
 * Constant CHECK_STATES
 *
 * @description
 * The checks outcomes the panel knows.
 *
 * @type {readonly string[]}
 */
const CHECK_STATES: readonly string[] = ['passed', 'failed', 'running'];

/**
 * Constant SOURCES
 *
 * @description
 * The places a detected key can come from.
 *
 * @type {readonly string[]}
 */
const SOURCES: readonly string[] = ['branch', 'title', 'description', 'commit'];

/**
 * Function toState
 *
 * @description
 * The state a row shows: a branch is `branch` whatever it says; an open draft request is `draft`;
 * a request state of a later contract version reads as `open`, as the mockup's fallback does.
 *
 * @param {GitLink} link - The gateway link.
 * @param {TaskGitLinkKind} kind - Its known kind.
 * @returns {TaskGitLinkState} The state shown.
 */
function toState(link: GitLink, kind: TaskGitLinkKind): TaskGitLinkState {
  if (kind === 'branch') return 'branch';
  const state: TaskGitLinkState = REQUEST_STATES.includes(link.state)
    ? (link.state as TaskGitLinkState)
    : 'open';
  return state === 'open' && link.draft === true ? 'draft' : state;
}

/**
 * Function toChecks
 *
 * @description
 * The checks of a request's head; none for a branch, and none for an outcome of a later contract
 * version.
 *
 * @param {GitLink} link - The gateway link.
 * @returns {TaskGitChecks | null} The checks, or null.
 */
function toChecks(link: GitLink): TaskGitChecks | null {
  const checks: GitLink['checks'] = link.checks;
  if (!checks || link.kind !== 'pull-request' || !CHECK_STATES.includes(checks.state)) return null;
  return {
    state: checks.state as TaskGitChecksState,
    total: checks.total ?? null,
    failed: checks.failed ?? null,
  };
}

/**
 * Function toTaskGitLink
 *
 * @description
 * Maps one Git link to the panel's model, or null for a link of an unknown host or kind, which
 * the contract asks clients to ignore. The branch shown is the linked branch, or a request's
 * source branch.
 *
 * @param {GitLink} link - The gateway link.
 * @returns {TaskGitLink | null} The link model, or null when it is left out.
 */
export function toTaskGitLink(link: GitLink): TaskGitLink | null {
  if (!PROVIDERS.includes(link.provider) || !KINDS.includes(link.kind)) return null;
  const kind: TaskGitLinkKind = link.kind as TaskGitLinkKind;
  const request: boolean = kind === 'pull-request';
  return {
    id: link.id,
    provider: link.provider as TaskGitProvider,
    kind,
    state: toState(link, kind),
    title: request ? (link.title ?? null) : null,
    number: request ? link.number : null,
    url: link.url ?? null,
    repository: link.repository
      ? { fullName: link.repository.fullName, url: link.repository.url }
      : null,
    branch: (request ? link.sourceBranch : link.branch) ?? null,
    author: link.author ? { login: link.author.login, name: link.author.name ?? null } : null,
    checks: toChecks(link),
    checksCompletedAt: link.checksCompletedAt,
    reviewRequested: request && link.reviewRequested === true,
    additions: request ? (link.additions ?? null) : null,
    deletions: request ? (link.deletions ?? null) : null,
    linkSource:
      link.linkSource !== undefined && SOURCES.includes(link.linkSource)
        ? (link.linkSource as TaskGitLinkSource)
        : null,
    createdAt: link.createdAt,
  };
}

/**
 * Function toTaskGitLinkPage
 *
 * @description
 * Maps a page of Git links, leaving out those of an unknown host or kind.
 *
 * @param {GitLinkPage} page - The gateway page.
 * @returns {TaskGitLinkPage} The page model.
 */
export function toTaskGitLinkPage(page: GitLinkPage): TaskGitLinkPage {
  return {
    items: page.items
      .map(toTaskGitLink)
      .filter((link: TaskGitLink | null): link is TaskGitLink => link !== null),
    nextCursor: page.nextCursor,
  };
}
