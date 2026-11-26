import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCwStatusLabels } from '@cadenway/ui/components/status-icon';
import { beforeEach, describe, expect, it } from 'vitest';

import { STATUS_LABELS } from '../../../constants/task-copy/task-copy.constants';
import type { TaskStatusTimes } from '../../../models/task-property/task-property.interface';
import { defaultStatusOptions } from '../../../utils/task-status/task-status.util';
import { TaskPropertyStatusTimes } from './task-property-status-times.component';

/**
 * Constant HOUR
 *
 * @description
 * An hour in milliseconds.
 *
 * @type {number}
 */
const HOUR: number = 3_600_000;

/**
 * Constant TIMES
 *
 * @description
 * CAD-482: 1 d 2 h to do, 2 d 4 h in progress (current), 3 h in review.
 *
 * @type {TaskStatusTimes}
 */
const TIMES: TaskStatusTimes = {
  complete: true,
  durations: [
    { status: 'todo', milliseconds: 26 * HOUR, active: false },
    { status: 'progress', milliseconds: 52 * HOUR, active: true },
    { status: 'review', milliseconds: 3 * HOUR, active: false },
  ],
};

describe('TaskPropertyStatusTimes', () => {
  let fixture: ComponentFixture<TaskPropertyStatusTimes>;

  /**
   * Function rows
   *
   * @description
   * Texts of the status rows.
   *
   * @returns {string[]} The texts.
   */
  function rows(): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '[data-testid="task-property-status-time"]',
      ),
    ).map((row: HTMLElement) =>
      Array.from(row.children)
        .map((cell: Element) => cell.textContent.replace(/\s+/gu, ' ').trim())
        .filter(Boolean)
        .join(' | '),
    );
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideCwStatusLabels(() => ({ ...STATUS_LABELS }))],
    });
    fixture = TestBed.createComponent(TaskPropertyStatusTimes);
    fixture.componentRef.setInput('statuses', defaultStatusOptions());
    await fixture.whenStable();
  });

  it('renders nothing without times', () => {
    expect((fixture.nativeElement as HTMLElement).textContent.trim()).toBe('');
  });

  it('writes a row per status with the current one and the longest', async () => {
    fixture.componentRef.setInput('times', TIMES);
    await fixture.whenStable();
    const text: string = (fixture.nativeElement as HTMLElement).textContent;

    expect(text).toContain('Time in status');
    expect(text).toContain('Since creation: 3 d 9 h');
    expect(rows()).toEqual([
      'To do | 1 d 2 h | 32%',
      'In progress · in progress | 2 d 4 h | 64%',
      'In review | 3 h | 4%',
    ]);
    expect(text).toContain('Longest: In progress (2 d 4 h).');
  });

  it('gives no longest status under three and no total for a partial history', async () => {
    fixture.componentRef.setInput('times', {
      complete: false,
      durations: TIMES.durations.slice(0, 2),
    });
    await fixture.whenStable();
    const text: string = (fixture.nativeElement as HTMLElement).textContent;

    expect(text).not.toContain('Longest:');
    expect(text).not.toContain('Since creation');
  });
});
