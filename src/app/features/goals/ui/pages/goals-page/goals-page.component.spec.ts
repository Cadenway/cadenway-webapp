import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withErrorBoundaries, withRouterConfig } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { LIST_DIRECTORY } from '@features/spaces/ports/list-directory';
import { SPACE_DIRECTORY, type SpaceDirectoryEntry } from '@features/spaces/ports/space-directory';
import { TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { GoalsApi } from '../../../data-access/services/goals-api/goals-api.service';
import type { Goal, GoalList } from '../../../models/goal/goal.interface';
import { GoalsPage } from './goals-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the route's error boundary, whose `Retry` runs the route again.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: `<p data-testid="boundary">Could not load this page</p>
    <button type="button" data-testid="boundary-retry" (click)="retry()">Retry</button>`,
})
class FakeBoundary {
  // #region Properties
  /**
   * Property router
   *
   * @description
   * Runs the route again.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);
  // #endregion

  // #region Methods
  /**
   * Method retry
   *
   * @description
   * Navigates to the same address again.
   */
  protected retry(): void {
    void this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' });
  }
  // #endregion
}

/**
 * Constant GOALS
 *
 * @description
 * The mockup's three goals (`GOALS_INIT`, `App.dc.html` lines 4245-4257), in English.
 *
 * @type {readonly Goal[]}
 */
const GOALS: readonly Goal[] = [
  {
    id: 'g1',
    name: 'Launch SSO for enterprises',
    ownerUserId: 'u-cm',
    dueDate: '2026-12-31',
    spaceId: 'product',
    version: 3,
    progressPercent: 36.7,
    health: 'at-risk',
    results: [
      {
        id: 'k1',
        kind: 'list-progress',
        label: 'Sprint 14 tasks done',
        listId: 'sprint-14',
        eligibleTaskCount: 10,
        doneTaskCount: 6,
        progressPercent: 60,
      },
      {
        id: 'k2',
        kind: 'number',
        label: 'Customer organizations on SSO',
        startValue: 0,
        currentValue: 4,
        targetValue: 10,
        progressPercent: 40,
      },
      {
        id: 'k3',
        kind: 'checkbox',
        label: 'SSO guide published',
        checked: false,
        progressPercent: 0,
      },
      {
        id: 'k9',
        kind: 'milestone',
        label: 'Milestone “SSO demo to customers” reached',
        taskKey: 'CAD-580',
        reached: false,
        progressPercent: 0,
      },
    ],
  },
  {
    id: 'g2',
    name: 'Halve the open bugs',
    ownerUserId: 'u-hd',
    dueDate: '2026-12-15',
    spaceId: 'product',
    version: 1,
    progressPercent: 75,
    health: 'on-track',
    results: [
      {
        id: 'k4',
        kind: 'number',
        label: 'Open bugs',
        startValue: 24,
        currentValue: 15,
        targetValue: 12,
        progressPercent: 75,
      },
    ],
  },
];

/**
 * Function quarterOf
 *
 * @description
 * A read of the fourth quarter of 2026.
 *
 * @param {readonly Goal[]} goals - The goals.
 * @returns {GoalList} The read.
 */
function quarterOf(goals: readonly Goal[]): GoalList {
  return {
    quarter: { key: '2026-Q4', year: 2026, number: 4, end: '2026-12-31' },
    goals,
    expectedProgressPercent: 41.3,
  };
}

describe('GoalsPage', () => {
  let api: Record<
    | 'list'
    | 'get'
    | 'create'
    | 'delete'
    | 'createResult'
    | 'updateResult'
    | 'deleteResult'
    | 'owners'
    | 'milestone',
    Mock
  >;
  let toasts: { success: Mock; error: Mock };
  let open: Mock;
  let role: WritableSignal<WorkspaceRole>;
  let spaces: WritableSignal<readonly SpaceDirectoryEntry[]>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8));
    api = {
      list: vi.fn(() => Promise.resolve(quarterOf(GOALS))),
      get: vi.fn((id: string) => Promise.resolve(GOALS.find((goal: Goal) => goal.id === id))),
      create: vi.fn(() =>
        Promise.resolve({ ...GOALS[1], id: 'g9', name: 'Cut the support response time' }),
      ),
      delete: vi.fn(() => Promise.resolve()),
      createResult: vi.fn(),
      updateResult: vi.fn(() => Promise.resolve({ result: null, version: 4 })),
      deleteResult: vi.fn(() => Promise.resolve()),
      owners: vi.fn(() =>
        Promise.resolve([
          { id: 'u-cm', name: 'Camille Martin', initials: 'CM', avatar: null },
          { id: 'u-hd', name: 'Hugo Dubois', initials: 'HD', avatar: null },
        ]),
      ),
      milestone: vi.fn(() => of({ key: 'CAD-580', dueDate: '2026-11-02' })),
    };
    toasts = { success: vi.fn(), error: vi.fn() };
    open = vi.fn();
    role = signal<WorkspaceRole>('owner');
    spaces = signal<readonly SpaceDirectoryEntry[]>([
      { id: 'product', name: 'Product', icon: null, tone: '', callerRole: 'edit' },
    ]);
    const order: readonly WorkspaceRole[] = ['guest', 'member', 'admin', 'owner'];
    const workspace: WorkspaceContextPort = {
      user: signal({
        id: 'u-cm',
        name: 'Camille Martin',
        firstName: 'Camille',
        displayName: null,
        email: 'camille.martin@ateliernord.fr',
        initials: 'CM',
      }),
      organization: signal({
        id: 'o1',
        slug: 'atelier-nord',
        name: 'Atelier Nord',
        initials: 'AN',
        role: 'owner',
        plan: 'team',
      }),
      role,
      can: (least: WorkspaceRole): boolean => order.indexOf(role()) >= order.indexOf(least),
    };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [{ path: 'goals', component: GoalsPage }],
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        { provide: GoalsApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: SPACE_DIRECTORY, useValue: { spaces } },
        {
          provide: LIST_DIRECTORY,
          useValue: {
            lists: signal([
              {
                id: 'sprint-14',
                name: 'Sprint 14',
                spaceId: 'product',
                spaceName: 'Product',
                icon: 'phosphorListBold',
                tone: '',
              },
            ]),
          },
        },
        {
          provide: TaskDetailOpener,
          useValue: { open, closed: new Subject<string>(), changed: new Subject<string>() },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  /**
   * Function render
   *
   * @description
   * Opens the goals and waits until the skeleton is gone.
   *
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function render(): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/goals');
    await expect
      .poll(() => {
        harness.detectChanges();
        return document.querySelector('[data-testid="goals-loading"]');
      })
      .toBeNull();
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  /**
   * Function view
   *
   * @description
   * The routed view.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The view.
   */
  function view(harness: RouterTestingHarness): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  /**
   * Function element
   *
   * @description
   * An element of the view, of the expected type.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} selector - Its selector.
   * @param {new () => T} kind - Its expected type.
   * @returns {T} The element.
   */
  function element<T extends HTMLElement>(
    harness: RouterTestingHarness,
    selector: string,
    kind: new () => T,
  ): T {
    const found: Element | null = view(harness).querySelector(selector);
    if (!(found instanceof kind)) throw new Error('Expected ' + selector + '.');
    return found;
  }

  /**
   * Function texts
   *
   * @description
   * The trimmed, whitespace-collapsed texts of the elements of a test id.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} id - The test id.
   * @returns {string[]} The texts.
   */
  function texts(harness: RouterTestingHarness, id: string): string[] {
    return [...view(harness).querySelectorAll(`[data-testid="${id}"]`)].map((element: Element) =>
      element.textContent.replace(/\s+/gu, ' ').trim(),
    );
  }

  /**
   * Function type
   *
   * @description
   * Types a value into an input.
   *
   * @param {HTMLInputElement} input - The input.
   * @param {string} value - The value.
   */
  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('shows the quarter, its figures and the goals, the first one open', async () => {
    const harness: RouterTestingHarness = await render();

    expect(view(harness).querySelector('h1')?.textContent.trim()).toBe('Goals');
    expect(texts(harness, 'goals-subtitle')).toEqual(['Q4 2026 · 41% of the quarter elapsed']);
    expect(
      view(harness).querySelector('cw-goal-stats')?.textContent.replace(/\s+/gu, ' '),
    ).toContain('Average progress56%expected: 41%');
    expect(texts(harness, 'goal-meta')).toEqual([
      'Camille Martin · due 31 Dec · 4 key results',
      'Hugo Dubois · due 15 Dec · 1 key result',
    ]);
    expect(texts(harness, 'goal-health')).toEqual(['At risk', 'On track']);
    expect(texts(harness, 'goal-percent')).toEqual(['37%', '75%']);
    expect(
      [...view(harness).querySelectorAll('[data-testid="goal-toggle"]')].map((toggle: Element) =>
        toggle.getAttribute('aria-expanded'),
      ),
    ).toEqual(['true', 'false']);
  });

  it('shows each kind of key result with its value and hint', async () => {
    const harness: RouterTestingHarness = await render();
    const rows: string[] = [...view(harness).querySelectorAll('cw-key-result-row')].map(
      (row: Element) => row.textContent.replace(/\s+/gu, ' ').trim(),
    );

    expect(rows[0]).toContain('Calculated from “Sprint 14”');
    expect(rows[0]).toContain('6 / 10 tasks');
    expect(rows[1]).toContain('Start 0, target 10');
    expect(rows[1]).toContain('4 / 10');
    expect(rows[2]).toContain('Achieved or not');
    expect(rows[2]).toContain('To do');
    expect(rows[3]).toContain('CAD-580 · 2 Nov');
    expect(rows[3]).toContain('Late');
    expect(rows[4]).toContain('Target: down from 24 to 12');
    expect(
      view(harness).querySelector('[data-testid="result-list"]')?.getAttribute('aria-label'),
    ).toBe('Open Sprint 14');

    element(harness, '[data-testid="result-milestone"]', HTMLButtonElement).click();
    expect(open).toHaveBeenCalledWith('CAD-580');
  });

  it('sends a step of a number key result', async () => {
    const harness: RouterTestingHarness = await render();

    element(harness, '[data-testid="result-increase"]', HTMLButtonElement).click();
    harness.detectChanges();

    expect(texts(harness, 'result-value')[1]).toBe('5 / 10');
    await harness.fixture.whenStable();
    expect(api.updateResult).toHaveBeenCalledWith('g1', 'k2', 3, { currentValue: 5 });
  });

  it('shows an empty quarter with its call to create a goal', async () => {
    api.list.mockResolvedValueOnce(quarterOf([]));
    const harness: RouterTestingHarness = await render();

    expect(texts(harness, 'goals-empty')[0]).toContain('No goals this quarter');
    expect(view(harness).querySelector('[data-testid="goal-new-empty"]')).not.toBeNull();
    expect(view(harness).querySelector('[data-testid="boundary"]')).toBeNull();
  });

  it('leaves a failed read to the error boundary, whose Retry reads again', async () => {
    api.list.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const harness: RouterTestingHarness = await render();
    expect(view(harness).querySelector('[data-testid="boundary"]')).not.toBeNull();
    expect(view(harness).querySelector('[data-testid="goals-empty"]')).toBeNull();

    element(harness, '[data-testid="boundary-retry"]', HTMLButtonElement).click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return texts(harness, 'goal-meta').length;
      })
      .toBe(2);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('creates a goal from the form and opens it', async () => {
    const harness: RouterTestingHarness = await render();
    element(harness, '[data-testid="goal-new"]', HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();

    const submit: HTMLButtonElement = element(
      harness,
      '[data-testid="goal-form-submit"]',
      HTMLButtonElement,
    );
    submit.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(view(harness).querySelector('[role="alert"]')?.textContent.trim()).toBe(
      'Enter a name for the goal.',
    );
    expect(document.activeElement?.id).toBe('goal-form-name');
    expect(api.create).not.toHaveBeenCalled();

    type(element(harness, '#goal-form-name', HTMLInputElement), 'Cut the support response time');
    type(element(harness, '#goal-form-result', HTMLInputElement), 'Answer within 4 h');
    type(element(harness, '#goal-form-target', HTMLInputElement), '90');
    submit.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return view(harness).querySelector('[data-testid="goal-form"]');
      })
      .toBeNull();

    expect(api.create.mock.calls[0][0]).toEqual({
      name: 'Cut the support response time',
      ownerUserId: 'u-cm',
      spaceId: null,
      firstResult: { label: 'Answer within 4 h', target: 90 },
    });
    expect(texts(harness, 'goal-meta')).toHaveLength(3);
    expect(
      view(harness).querySelector('[data-testid="goal-toggle"]')?.getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('names the key result checkbox after its label', async () => {
    const harness: RouterTestingHarness = await render();

    const box: Element | null = view(harness).querySelector(
      '[role="checkbox"][aria-label="SSO guide published"]',
    );
    expect(box?.getAttribute('aria-checked')).toBe('false');
  });

  it('moves the focus to the next row after removing a key result', async () => {
    const harness: RouterTestingHarness = await render();

    element(harness, '[data-testid="result-remove"]', HTMLButtonElement).click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return document.activeElement?.getAttribute('aria-label');
      })
      .toBe('Decrease “Customer organizations on SSO”');
    expect(api.deleteResult).toHaveBeenCalledWith('g1', 'k1', 3);
  });

  it('returns the focus to the trigger of a closed form', async () => {
    const harness: RouterTestingHarness = await render();

    element(harness, '[data-testid="goal-new"]', HTMLButtonElement).click();
    harness.detectChanges();
    element(harness, '[data-testid="goal-form-cancel"]', HTMLButtonElement).click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return document.activeElement?.getAttribute('data-testid');
      })
      .toBe('goal-new');

    element(harness, '[data-testid="key-result-start"]', HTMLButtonElement).click();
    harness.detectChanges();
    element(harness, '[data-testid="key-result-cancel"]', HTMLButtonElement).click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return document.activeElement?.getAttribute('data-testid');
      })
      .toBe('key-result-start');
  });

  it('asks a member for a space and hides the creation without one', async () => {
    role.set('member');
    const harness: RouterTestingHarness = await render();
    element(harness, '[data-testid="goal-new"]', HTMLButtonElement).click();
    harness.detectChanges();
    expect(view(harness).querySelector('[data-testid="goal-form-space"]')).not.toBeNull();

    spaces.set([]);
    harness.detectChanges();
    expect(view(harness).querySelector('[data-testid="goal-new"]')).toBeNull();
    expect(view(harness).querySelector('[data-testid="goal-delete"]')).toBeNull();
    expect(view(harness).querySelector('[data-testid="result-increase"]')).toBeNull();
  });

  it('deletes a goal once confirmed', async () => {
    const harness: RouterTestingHarness = await render();

    const remove: HTMLButtonElement = element(
      harness,
      '[data-testid="goal-delete"]',
      HTMLButtonElement,
    );
    expect(remove.getAttribute('aria-label')).toBe('Delete the goal Launch SSO for enterprises');
    remove.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const confirm: HTMLButtonElement | null = document.querySelector(
      '[data-testid="goal-delete-confirm"]',
    );
    expect(document.body.textContent).toContain('Delete the goal “Launch SSO for enterprises”?');
    confirm?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return texts(harness, 'goal-meta').length;
      })
      .toBe(1);

    expect(api.delete).toHaveBeenCalledWith('g1', 3);
    expect(toasts.success).toHaveBeenCalledWith('Goal deleted', {
      description: 'Launch SSO for enterprises',
    });
  });
});
