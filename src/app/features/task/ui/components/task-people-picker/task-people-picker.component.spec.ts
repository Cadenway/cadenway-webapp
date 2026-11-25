import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { Person } from '../../../models/person/person.interface';
import { TaskPeoplePicker } from './task-people-picker.component';

/**
 * Constant people
 *
 * @description
 * The mockup's people.
 *
 * @type {readonly Person[]}
 */
const people: readonly Person[] = [
  { id: 'u1', name: 'Camille Martin', initials: 'CM', avatar: null },
  { id: 'u2', name: 'Inès Robert', initials: 'IR', avatar: null },
];

describe('TaskPeoplePicker', () => {
  it('marks the current user `(me)` and adds a chosen person', async () => {
    const fixture: ComponentFixture<TaskPeoplePicker> = TestBed.createComponent(TaskPeoplePicker);
    fixture.componentRef.setInput('people', people);
    fixture.componentRef.setInput('currentUserId', 'u1');
    fixture.componentRef.setInput('value', ['u1']);
    await fixture.whenStable();
    const trigger: HTMLButtonElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      'button[role="combobox"]',
    );

    expect(trigger?.getAttribute('aria-label')).toBe('Assignees');
    trigger?.click();
    await fixture.whenStable();
    const options: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]'),
    );
    expect(
      options.map((option: HTMLElement) => option.textContent.replace(/\s+/gu, ' ').trim()),
    ).toEqual(['CMCamille Martin (me)', 'IRInès Robert']);
    options[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toEqual(['u1', 'u2']);
  });

  it('reads `Assign` when nobody is chosen', async () => {
    const fixture: ComponentFixture<TaskPeoplePicker> = TestBed.createComponent(TaskPeoplePicker);
    fixture.componentRef.setInput('people', people);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Assign');
  });
});
