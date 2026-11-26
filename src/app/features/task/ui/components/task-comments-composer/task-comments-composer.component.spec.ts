import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import { TASK_SECTIONS_BRICK_LABELS } from '../../../constants/task-detail-sections/task-detail-sections.constants';
import { TaskCommentsComposer } from './task-comments-composer.component';

describe('TaskCommentsComposer', () => {
  let fixture: ComponentFixture<TaskCommentsComposer>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideCadenwayIcons(), ...TASK_SECTIONS_BRICK_LABELS],
    });
    fixture = TestBed.createComponent(TaskCommentsComposer);
    await fixture.whenStable();
  });

  it('names the send button Send the comment, as the mockup does', () => {
    const names: string[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).map(
      (button: HTMLButtonElement): string =>
        button.getAttribute('aria-label') ?? button.textContent.trim(),
    );

    expect(names).toContain('Send the comment');
    expect(names).not.toContain('Send');
  });
});
