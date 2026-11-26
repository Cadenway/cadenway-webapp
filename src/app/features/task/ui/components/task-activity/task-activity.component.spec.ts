import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskActivityEntry } from '../../../models/task-detail-sections/task-detail-sections.interface';
import { TaskActivity } from './task-activity.component';

/**
 * Function due
 *
 * @description
 * A due date change GitHub made on CAD-482.
 *
 * @param {string} id - Its id.
 * @param {string | null} from - The due date before.
 * @param {string | null} to - The due date after.
 * @returns {TaskActivityEntry} The entry.
 */
function due(id: string, from: string | null, to: string | null): TaskActivityEntry {
  return {
    id,
    at: '2026-11-06T09:00:00Z',
    actor: { type: 'git', id: 'github', provider: 'github' },
    change: { kind: 'due', from, to },
  };
}

describe('TaskActivity', () => {
  let fixture: ComponentFixture<TaskActivity>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskActivity);
    fixture.componentRef.setInput('entries', [
      due('e1', '2026-11-12', '2026-11-14'),
      due('e2', null, '2026-11-20'),
    ]);
    await fixture.whenStable();
  });

  it('writes a due date change with its dates and no colon, as the mockup does', () => {
    const text: string = (fixture.nativeElement as HTMLElement).textContent.replace(/\s+/gu, ' ');

    expect(text).toContain('moved the due date 12 Nov → 14 Nov');
    expect(text).toContain('set the due date 20 Nov');
    expect(text).not.toContain('due date:');
  });
});
