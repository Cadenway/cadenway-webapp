import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TaskAttachment } from '../../../models/task-detail-sections/task-detail-sections.interface';
import { TaskAttachmentsPreview } from './task-attachments-preview.component';

/**
 * Constant BRIEF
 *
 * @description
 * The brief Camille Martin attached to CAD-482.
 *
 * @type {TaskAttachment}
 */
const BRIEF: TaskAttachment = {
  id: 'a1',
  name: 'brief.pdf',
  contentType: 'application/pdf',
  size: 2048,
  authorId: 'u1',
  uploadedAt: '2026-11-06T09:00:00Z',
  version: 1,
};

describe('TaskAttachmentsPreview', () => {
  let fixture: ComponentFixture<TaskAttachmentsPreview>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskAttachmentsPreview);
    fixture.componentRef.setInput('items', [BRIEF]);
    fixture.componentRef.setInput('index', 0);
    await fixture.whenStable();
  });

  it('names the dialog Preview: <name> and shows the name as its title', () => {
    const dialog: HTMLElement | null = document.querySelector('[role="dialog"]');
    const title: HTMLElement | null = document.getElementById(
      dialog?.getAttribute('aria-labelledby') ?? '',
    );

    expect(title?.getAttribute('aria-label')).toBe('Preview: brief.pdf');
    expect(title?.textContent.trim()).toBe('brief.pdf');
  });
});
