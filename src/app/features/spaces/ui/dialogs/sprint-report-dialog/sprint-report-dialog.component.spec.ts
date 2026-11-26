import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskDetailOpener } from '@features/task';

import { SprintReportApi } from '../../../data-access/services/sprint-report-api/sprint-report-api.service';
import type { SprintReport } from '../../../models/sprint-report/sprint-report.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import { SprintReportDialog } from './sprint-report-dialog.component';

/**
 * Constant sprint14List
 *
 * @description
 * The mockup's `Sprint 14`, from November 3 to 17.
 *
 * @type {TaskList}
 */
const sprint14List: TaskList = {
  id: 'l-sprint14',
  spaceId: 'sp-product',
  name: 'Sprint 14',
  icon: 'lightning',
  color: 'violet',
  sprint: { startDate: '2026-11-03', endDate: '2026-11-17', goal: 'Ship the SSO sign-in' },
  archived: false,
  canEdit: true,
  version: 3,
};

/**
 * Constant sprint14
 *
 * @description
 * The report of `Sprint 14` on November 8: 15 of 42 points delivered, 4 left at the current pace.
 *
 * @type {SprintReport}
 */
const sprint14: SprintReport = {
  listId: 'l-sprint14',
  name: 'Sprint 14',
  startDate: '2026-11-03',
  endDate: '2026-11-17',
  committed: 42,
  delivered: {
    points: 15,
    taskCount: 7,
    tasks: [
      { key: 'CAD-471', name: 'SSO sign-in', points: 3, status: 'done' },
      { key: 'CAD-473', name: 'Quota page', points: 1, status: 'done' },
    ],
  },
  remaining: {
    points: 27,
    taskCount: 9,
    tasks: [{ key: 'CAD-482', name: 'Account lockout', points: 5, status: 'progress' }],
  },
  projected: 4,
  days: [
    { date: '2026-11-03', actual: 42, ideal: 42, projected: null },
    { date: '2026-11-08', actual: 27, ideal: 28, projected: 27 },
    { date: '2026-11-17', actual: null, ideal: 0, projected: 4 },
  ],
  velocity: [{ listId: 'l-sprint13', name: 'Sprint 13', committed: 210, delivered: 194 }],
};

/**
 * Function text
 *
 * @description
 * The text of the overlay, where the dialog renders.
 *
 * @returns {string} The text, spaces collapsed.
 */
function text(): string {
  return document.body.textContent.replace(/\s+/gu, ' ');
}

/**
 * Function byTestId
 *
 * @description
 * An element of the overlay by its test id.
 *
 * @param {string} id - Test id.
 * @returns {HTMLElement | null} The element.
 */
function byTestId(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

describe('SprintReportDialog', () => {
  let report: Mock<SprintReportApi['report']>;
  let openTask: Mock;
  let fixture: ComponentFixture<SprintReportDialog>;

  /**
   * Function show
   *
   * @description
   * Opens the dialog on `Sprint 14`, then waits for the read to settle unless asked not to.
   *
   * @param {boolean} settle - Whether to wait for the read.
   * @returns {Promise<void>} Once the dialog renders.
   */
  async function show(settle: boolean = true): Promise<void> {
    fixture = TestBed.createComponent(SprintReportDialog);
    fixture.componentRef.setInput('list', sprint14List);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    if (settle) await fixture.whenStable();
    else await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 10, 0));
    report = vi.fn<SprintReportApi['report']>(() => Promise.resolve(sprint14));
    openTask = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        { provide: SprintReportApi, useValue: { report } },
        { provide: TaskDetailOpener, useValue: { open: openTask } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows skeletons while the report is read, under the sprint name and dates', async () => {
    report.mockReturnValue(new Promise<SprintReport>(() => undefined));
    await show(false);

    expect(byTestId('sprint-report-loading')).not.toBeNull();
    expect(text()).toContain('Sprint 14 report');
    expect(text()).toContain('Nov 3 – Nov 17 · day 6 of 15');
  });

  it('shows the figures, the charts and the tasks of the report', async () => {
    await show();

    expect(report).toHaveBeenCalledWith(
      'l-sprint14',
      '2026-11-08',
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(byTestId('sprint-report-committed')?.textContent).toContain('42');
    expect(byTestId('sprint-report-committed')?.textContent).toContain('16 tasks');
    expect(byTestId('sprint-report-delivered')?.textContent).toContain('36 % of the sprint');
    expect(byTestId('sprint-report-remaining')?.textContent).toContain('9 open tasks');
    expect(byTestId('sprint-report-projected')?.textContent).toContain('≈ 4 pts');
    expect(byTestId('sprint-report-projected')?.textContent).toContain('would remain on Nov 17');
    expect(text()).toContain('Burndown');
    expect(text()).toContain(
      'Average velocity: 194 points per sprint · gray bar: points committed',
    );
    expect(byTestId('sprint-report-delivered-tasks')?.textContent).toContain('SSO sign-in');
    expect(byTestId('sprint-report-delivered-tasks')?.textContent).toContain('3 pts');
    expect(byTestId('sprint-report-delivered-tasks')?.textContent).toContain('1 pt');
    expect(byTestId('sprint-report-delivered-tasks')?.textContent).toContain('+ 5 others');
    expect(byTestId('sprint-report-remaining-tasks')?.textContent).toContain('Account lockout');
    expect(byTestId('sprint-report-remaining-tasks')?.textContent).toContain('+ 8 others');
  });

  it('shows an inline error whose Retry reads the report again', async () => {
    report.mockRejectedValueOnce(new Error('unavailable'));
    await show();

    expect(byTestId('sprint-report-failed')?.textContent).toContain(
      'The sprint report could not be loaded',
    );
    expect(byTestId('sprint-report-empty')).toBeNull();
    byTestId('sprint-report-failed')?.querySelector('button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(report).toHaveBeenCalledTimes(2);
    expect(byTestId('sprint-report-failed')).toBeNull();
    expect(byTestId('sprint-report-committed')?.textContent).toContain('42');
  });

  it('shows the empty state for a sprint without tasks', async () => {
    report.mockResolvedValue({
      ...sprint14,
      committed: 0,
      delivered: { points: 0, taskCount: 0, tasks: [] },
      remaining: { points: 0, taskCount: 0, tasks: [] },
      projected: null,
    });
    await show();

    expect(byTestId('sprint-report-empty')?.textContent).toContain('No task in this sprint');
    expect(byTestId('sprint-report-failed')).toBeNull();
  });

  it('closes the report and opens a task it lists', async () => {
    await show();

    byTestId('sprint-report-remaining-tasks')?.querySelector('button')?.click();

    expect(fixture.componentInstance.open()).toBe(false);
    expect(openTask).toHaveBeenCalledWith('CAD-482', {
      key: 'CAD-482',
      name: 'Account lockout',
      status: 'progress',
      milestone: false,
    });
  });
});
