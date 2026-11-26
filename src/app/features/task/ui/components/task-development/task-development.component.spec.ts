import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskGitLink } from '../../../models/task-git-link/task-git-link.interface';
import { TaskDevelopment } from './task-development.component';

/**
 * Constant NOW
 *
 * @description
 * The instant the specs read the panel at: 8 November 2026, 10:40 UTC.
 *
 * @type {Date}
 */
const NOW: Date = new Date('2026-11-08T10:40:00Z');

/**
 * Constant PULL_REQUEST
 *
 * @description
 * `#214` of `atelier-nord/cadenway-web`, opened two hours ago, one check failed, reviewers
 * requested.
 *
 * @type {TaskGitLink}
 */
const PULL_REQUEST: TaskGitLink = {
  id: 'g1',
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
  checksCompletedAt: '2026-11-08T10:10:00Z',
  reviewRequested: true,
  additions: 418,
  deletions: 132,
  linkSource: 'branch',
  createdAt: '2026-11-08T08:40:00Z',
};

/**
 * Constant BRANCH
 *
 * @description
 * A GitLab branch of `nord/infra` found from a commit, without a recorded address.
 *
 * @type {TaskGitLink}
 */
const BRANCH: TaskGitLink = {
  ...PULL_REQUEST,
  id: 'g2',
  provider: 'gitlab',
  kind: 'branch',
  state: 'branch',
  title: null,
  number: null,
  url: null,
  repository: { fullName: 'nord/infra', url: 'https://gitlab.ateliernord.fr/nord/infra' },
  branch: 'cad-482-sso-redirects',
  author: { login: 'irobert', name: null },
  checks: null,
  checksCompletedAt: null,
  reviewRequested: false,
  additions: null,
  deletions: null,
  linkSource: 'commit',
};

describe('TaskDevelopment', () => {
  let fixture: ComponentFixture<TaskDevelopment>;

  /**
   * Function host
   *
   * @description
   * The rendered panel.
   *
   * @returns {HTMLElement} Its element.
   */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * Function text
   *
   * @description
   * The panel's text with its whitespace collapsed.
   *
   * @returns {string} The text.
   */
  function text(): string {
    return host().textContent.replace(/\s+/gu, ' ');
  }

  /**
   * Function render
   *
   * @description
   * Renders the panel of CAD-482 with the given inputs.
   *
   * @param {Record<string, unknown>} inputs - Inputs other than the key.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function render(inputs: Record<string, unknown>): Promise<void> {
    fixture = TestBed.createComponent(TaskDevelopment);
    fixture.componentRef.setInput('taskKey', 'CAD-482');
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('draws a pull request with its link, state, checks, review, diff and author', async () => {
    await render({ links: [PULL_REQUEST], ready: true });

    const title: HTMLAnchorElement | null = host().querySelector('a[href]');
    expect(title?.textContent.trim()).toBe('feat(auth): unified SSO sign-in screen');
    expect(title?.getAttribute('href')).toBe(
      'https://github.com/atelier-nord/cadenway-web/pull/214',
    );
    expect(title?.getAttribute('target')).toBe('_blank');
    expect(title?.getAttribute('rel')).toContain('noopener');
    expect(text()).toContain('#214');
    expect(text()).toContain('Open');
    expect(text()).toContain('1 check failed');
    expect(text()).toContain('11/12');
    expect(host().querySelector('[title^="1 check failed · "]')).not.toBeNull();
    expect(text()).toContain('Review requested');
    expect(text()).toContain('atelier-nord/cadenway-web');
    expect(text()).toContain('+418');
    expect(text()).toContain('−132');
    expect(text()).toContain('Camille · 2 h ago');
    expect(text()).toContain('detected: CAD-482 in the branch');
    expect(host().querySelector('ul')?.textContent).not.toContain('No branch or pull request');
  });

  it('draws a branch by its name, without a link it does not have', async () => {
    await render({ links: [BRANCH], ready: true });

    expect(host().querySelector('a[href]')).toBeNull();
    expect(text()).toContain('cad-482-sso-redirects');
    expect(text()).toContain('Branch');
    expect(text()).toContain('nord/infra');
    expect(text()).toContain('irobert · 2 h ago');
    expect(text()).toContain('detected: CAD-482 in a commit');
    expect(text()).not.toContain('Review requested');
    expect(text()).not.toContain('!');
  });

  it('writes the states of merged, closed and draft requests and running checks', async () => {
    await render({
      links: [
        {
          ...PULL_REQUEST,
          id: 'm',
          state: 'merged',
          checks: { state: 'passed', total: 3, failed: 0 },
        },
        { ...PULL_REQUEST, id: 'c', state: 'closed', provider: 'gitlab', number: 31 },
        {
          ...PULL_REQUEST,
          id: 'd',
          state: 'draft',
          checks: { state: 'running', total: null, failed: null },
        },
      ],
      ready: true,
    });

    expect(text()).toContain('Merged');
    expect(text()).toContain('Checks passed');
    expect(text()).toContain('3/3');
    expect(text()).toContain('Closed');
    expect(text()).toContain('!31');
    expect(text()).toContain('Draft');
    expect(text()).toContain('Checks running');
    expect(text()).toContain('Running');
    expect(host().querySelectorAll('li')).toHaveLength(3);
  });

  it('counts the links listed and offers Show more while older ones remain', async () => {
    await render({ links: [PULL_REQUEST, BRANCH], ready: true, hasMore: true });
    const more: (number | string)[] = [];
    fixture.componentInstance.moreLoaded.subscribe(() => more.push(1));

    expect(host().querySelector('h3')?.parentElement?.textContent).toContain('2+');
    const button: HTMLButtonElement | undefined = Array.from(
      host().querySelectorAll('button'),
    ).find((candidate: HTMLButtonElement) => candidate.textContent.includes('Show more'));
    button?.click();

    expect(more).toHaveLength(1);
  });

  it('keeps the empty state and the hint when no link exists', async () => {
    await render({ links: [], ready: true });
    const copied: number[] = [];
    fixture.componentInstance.keyCopied.subscribe(() => copied.push(1));

    expect(text()).toContain('No branch or pull request');
    expect(text()).toContain('Create the branch from here, or link an existing PR.');
    expect(host().querySelector('[role="alert"]')).toBeNull();
    host().querySelector<HTMLButtonElement>('button[title="Copy the identifier"]')?.click();
    expect(copied).toHaveLength(1);
    expect(text()).toContain('fixes CAD-482');
  });

  it('shows a failed read as an inline error with Retry, not as the empty state', async () => {
    await render({ links: [], ready: false, failed: true });
    const retried: number[] = [];
    fixture.componentInstance.retried.subscribe(() => retried.push(1));

    const alert: HTMLElement | null = host().querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('The Git links could not be loaded.');
    expect(text()).not.toContain('No branch or pull request');
    alert?.querySelector('button')?.click();
    expect(retried).toHaveLength(1);
  });

  it('keeps the links shown above a failed reread', async () => {
    await render({ links: [PULL_REQUEST], ready: true, failed: true });

    expect(host().querySelector('[role="alert"]')).not.toBeNull();
    expect(host().querySelectorAll('li')).toHaveLength(1);
  });

  it('shows the loading lines while the first read runs', async () => {
    await render({ links: [], ready: false, loading: true });

    expect(host().querySelector('[role="status"]')?.textContent).toContain('Loading the Git links');
    expect(text()).not.toContain('No branch or pull request');
  });
});
