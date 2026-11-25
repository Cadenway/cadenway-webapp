import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { PriorityKey } from '@cadenway/contracts';
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

    expect(trigger?.getAttribute('aria-label')).toBe('Priorité : Moyenne');
    trigger?.click();
    await fixture.whenStable();
    const items: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    expect(items.map((item: HTMLElement) => item.textContent.trim())).toEqual([
      'Urgente',
      'Haute',
      'Moyenne',
      'Basse',
    ]);
    items[1].click();

    expect(emitted).toEqual(['haute']);
  });
});
