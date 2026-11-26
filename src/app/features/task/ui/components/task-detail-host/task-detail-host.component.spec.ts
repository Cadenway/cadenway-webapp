import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';
import {
  DeletedTaskRouteError,
  NotFoundRouteError,
  UnavailableRouteError,
} from '@shared/route-errors';

import { TaskApi } from '../../../data-access/services/task-api/task-api.service';
import { TaskDetailApi } from '../../../data-access/services/task-detail-api/task-detail-api.service';
import type { TaskDetail } from '../../../models/task-detail/task-detail.interface';
import { TaskDetailOpener } from '../../../services/task-detail-opener/task-detail-opener.service';
import { defaultStatusOptions } from '../../../utils/task-status/task-status.util';
import { TaskDetailHost } from './task-detail-host.component';

/**
 * Component ListViewStub
 *
 * @description
 * Stands for the page under the detail.
 */
@Component({ selector: 'cw-list-view-stub', template: '' })
class ListViewStub {}

/**
 * Constant workspace
 *
 * @description
 * Camille Martin in Atelier Nord.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u1',
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
  role: signal('owner'),
  can: () => true,
};

/**
 * Constant detail
 *
 * @description
 * CAD-482 of Sprint 14, a subtask of CAD-470.
 *
 * @type {TaskDetail}
 */
const detail: TaskDetail = {
  task: {
    id: 'CAD-482',
    key: 'CAD-482',
    name: 'Redesign the SSO sign-in screen',
    status: 'progress',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: ['u1'],
    due: '2026-11-12',
    start: null,
    labels: ['Front'],
    subtasks: { closed: 0, total: 0 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: 'CAD-470',
    milestone: false,
    recurrence: 'none',
    listId: 'sprint-14',
    spaceId: 'product',
    version: 4,
    description: null,
    cancelNote: null,
    estimateMinutes: null,
    checklistItems: [],
    createdAt: '2026-11-02T09:00:00Z',
    createdBy: { type: 'user', id: 'u1' },
    updatedAt: '2026-11-06T09:00:00Z',
    archivedAt: null,
  },
  space: { id: 'product', name: 'Product', statuses: defaultStatusOptions() },
  list: { id: 'sprint-14', name: 'Sprint 14', spaceId: 'product', canEdit: true, canComment: true },
  parent: { key: 'CAD-470', name: 'Sign-in', status: 'todo' },
  subtasks: [],
  comments: { items: [], total: 0, nextCursor: null },
  partial: [],
};

describe('TaskDetailHost', () => {
  let read: Mock<(key: string) => Promise<TaskDetail>>;
  let trash: Mock<(key: string, version: number) => Promise<{ id: string; subtaskCount: number }>>;
  let show: Mock;
  let fixture: ComponentFixture<TaskDetailHost>;
  let router: Router;

  /**
   * Function dialog
   *
   * @description
   * The open detail dialog, or null.
   *
   * @returns {HTMLElement | null} The dialog.
   */
  function dialog(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="dialog"]');
  }

  /**
   * Function go
   *
   * @description
   * Navigates and lets the host render.
   *
   * @param {string} url - The address.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function go(url: string): Promise<void> {
    await router.navigateByUrl(url);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    read = vi.fn(() => Promise.resolve(detail));
    trash = vi.fn(() => Promise.resolve({ id: 'entry-1', subtaskCount: 0 }));
    show = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'atelier-nord/l/:listId/list', component: ListViewStub }]),
        provideCadenwayIcons(),
        {
          provide: TaskDetailApi,
          useValue: {
            read,
            trash,
            watchers: () => Promise.resolve({ total: 2, following: false }),
            reminder: () => Promise.resolve(null),
          },
        },
        { provide: TaskApi, useValue: {} },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        {
          provide: CwToastService,
          useValue: { show, error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
        },
      ],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TaskDetailHost);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('opens nothing without `?task=`', async () => {
    await go('/atelier-nord/l/sprint-14/list');

    expect(dialog()).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('opens the detail of `?task=` over the page with its header and body', async () => {
    await go('/atelier-nord/l/sprint-14/list?task=CAD-482');

    await vi.waitFor(() => {
      expect(document.querySelector('[data-testid="task-detail-parent"]')).not.toBeNull();
    });
    expect(read).toHaveBeenCalledWith('CAD-482');
    expect(document.querySelector('[data-testid="task-detail-key"]')?.textContent).toContain(
      'CAD-482',
    );
    expect(document.querySelector<HTMLInputElement>('#task-detail-title')?.value).toBe(
      'Redesign the SSO sign-in screen',
    );
    expect(document.querySelector('[data-testid="task-detail-parent"]')?.textContent).toContain(
      'Subtask of CAD-470 · Sign-in',
    );
    expect(document.querySelector('[data-testid="task-detail-status"]')?.textContent).toContain(
      'In progress',
    );
    expect(document.querySelector('aside[aria-label="Properties of the task"]')).not.toBeNull();
  });

  it('closes on Close and removes `?task=` while keeping the other parameters', async () => {
    await go('/atelier-nord/l/sprint-14/list?view=board&task=CAD-482');
    await vi.waitFor(() => {
      expect(document.querySelector('[data-testid="task-detail-close"]')).not.toBeNull();
    });

    document.querySelector<HTMLButtonElement>('[data-testid="task-detail-close"]')?.click();

    await vi.waitFor(() => {
      expect(router.url).toBe('/atelier-nord/l/sprint-14/list?view=board');
    });
    await fixture.whenStable();
    expect(dialog()).toBeNull();
  });

  it('shows another task in the same dialog when the key changes', async () => {
    await go('/atelier-nord/l/sprint-14/list?task=CAD-482');
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledWith('CAD-482');
    });

    await TestBed.inject(TaskDetailOpener).open('CAD-470');
    await fixture.whenStable();

    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledWith('CAD-470');
    });
    expect(router.url).toBe('/atelier-nord/l/sprint-14/list?task=CAD-470');
  });

  it('renders a task that does not exist as not found inside the dialog', async () => {
    read.mockRejectedValue(new NotFoundRouteError());
    await go('/atelier-nord/l/sprint-14/list?task=CAD-999');

    await vi.waitFor(() => {
      expect(dialog()?.textContent).toContain('Page not found');
    });
    expect(document.querySelector('[data-testid="task-detail-key"]')?.textContent).toContain(
      'CAD-999',
    );
  });

  it('offers to restore a deleted task inside the dialog', async () => {
    read.mockRejectedValue(
      new DeletedTaskRouteError({ key: 'CAD-452', name: 'Old sign-in screen' }, 'entry-1'),
    );
    await go('/atelier-nord/l/sprint-14/list?task=CAD-452');

    await vi.waitFor(() => {
      expect(dialog()?.textContent).toContain('This task has been deleted');
    });
    expect(dialog()?.textContent).toContain('Restore the task');
  });

  it('keeps the header from the list and retries an unavailable read in place', async () => {
    read.mockRejectedValueOnce(new UnavailableRouteError(503, 'req-1'));
    await router.navigateByUrl('/atelier-nord/l/sprint-14/list');
    await TestBed.inject(TaskDetailOpener).open('CAD-482', {
      key: 'CAD-482',
      name: 'Redesign the SSO sign-in screen',
      status: 'progress',
      milestone: false,
    });
    await fixture.whenStable();

    await vi.waitFor(() => {
      expect(dialog()?.textContent).toContain('Could not load the task');
    });
    expect(document.querySelector<HTMLInputElement>('#task-detail-title')?.value).toBe(
      'Redesign the SSO sign-in screen',
    );
    const retry: HTMLButtonElement | undefined = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((button: HTMLButtonElement) => button.textContent.includes('Retry'));
    retry?.click();

    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledTimes(2);
      expect(document.querySelector('aside[aria-label="Properties of the task"]')).not.toBeNull();
    });
  });

  it('copies the shareable link of the task', async () => {
    const writeText: Mock<(text: string) => Promise<void>> = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await go('/atelier-nord/l/sprint-14/list?task=CAD-482');
    await vi.waitFor(() => {
      expect(document.querySelector('[data-testid="task-detail-copy-link"]')).not.toBeNull();
    });

    document.querySelector<HTMLButtonElement>('[data-testid="task-detail-copy-link"]')?.click();

    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledWith('Link copied', {
        description: `${location.origin}/atelier-nord/t/CAD-482`,
      });
    });
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/atelier-nord/t/CAD-482`);
  });

  it('deletes the task after the confirmation and closes the detail', async () => {
    await go('/atelier-nord/l/sprint-14/list?task=CAD-482');
    await vi.waitFor(() => {
      expect(document.querySelector('[data-testid="task-detail-more"]')).not.toBeNull();
    });
    document.querySelector<HTMLButtonElement>('[data-testid="task-detail-more"]')?.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((item: HTMLElement) => item.textContent.trim() === 'Delete')
      ?.click();
    await fixture.whenStable();

    const alert: HTMLElement | null = document.querySelector('[role="alertdialog"]');
    expect(alert?.textContent).toContain('Delete CAD-482?');
    expect(alert?.textContent).toContain(
      '“Redesign the SSO sign-in screen”, its 0 subtasks, its checklist and its 0 comments will go to the trash for 30 days.',
    );
    Array.from(alert?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((item: HTMLButtonElement) => item.textContent.includes('Delete the task'))
      ?.click();

    await vi.waitFor(() => {
      expect(trash).toHaveBeenCalledWith('CAD-482', 4);
      expect(router.url).toBe('/atelier-nord/l/sprint-14/list');
    });
  });
});
