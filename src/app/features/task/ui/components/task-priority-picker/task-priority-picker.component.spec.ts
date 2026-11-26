import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { PriorityKey } from '@cadenway/contracts';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { describe, expect, it } from 'vitest';

import { TaskPriorityPicker } from './task-priority-picker.component';

describe('TaskPriorityPicker', () => {
  it('shows the priority word and emits the one chosen in the menu', async () => {
    const fixture: ComponentFixture<TaskPriorityPicker> =
      TestBed.createComponent(TaskPriorityPicker);
    const emitted: PriorityKey[] = [];
    fixture.componentInstance.priorityChanged.subscribe((key: PriorityKey) => emitted.push(key));
    fixture.componentRef.setInput('priority', 'moyenne');
    await fixture.whenStable();
    const trigger: HTMLButtonElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    );

    expect(trigger?.getAttribute('aria-label')).toBe('Priority: Medium');
    trigger?.click();
    await fixture.whenStable();
    const items: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    expect(items.map((item: HTMLElement) => item.textContent.trim())).toEqual([
      'Urgent',
      'High',
      'Medium',
      'Low',
    ]);
    items[1].click();

    expect(emitted).toEqual(['haute']);
  });

  it('animates the icon from the priority shown before the last change', async () => {
    const fixture: ComponentFixture<TaskPriorityPicker> =
      TestBed.createComponent(TaskPriorityPicker);
    fixture.componentRef.setInput('priority', 'moyenne');
    await fixture.whenStable();
    const icon: () => CwPriorityIcon = (): CwPriorityIcon =>
      fixture.debugElement.query(By.directive(CwPriorityIcon)).componentInstance as CwPriorityIcon;

    expect(icon().from()).toBeNull();
    fixture.componentRef.setInput('priority', 'urgente');
    await fixture.whenStable();
    expect(icon().from()).toBe('moyenne');
  });
});
