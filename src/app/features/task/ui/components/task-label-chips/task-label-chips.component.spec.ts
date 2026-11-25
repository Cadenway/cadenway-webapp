import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { TaskLabelChips } from './task-label-chips.component';

describe('TaskLabelChips', () => {
  it('shows two labels then « +n » naming the others', async () => {
    const fixture: ComponentFixture<TaskLabelChips> = TestBed.createComponent(TaskLabelChips);
    fixture.componentRef.setInput('labels', ['Front', 'Auth', 'Sécurité', 'Bug']);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Front');
    expect(host.textContent).toContain('Auth');
    expect(host.textContent).not.toContain('Sécurité');
    expect(host.querySelector('[aria-label="Sécurité, Bug"]')?.textContent.trim()).toBe('+2');
  });

  it('shows no counter for two labels or fewer', async () => {
    const fixture: ComponentFixture<TaskLabelChips> = TestBed.createComponent(TaskLabelChips);
    fixture.componentRef.setInput('labels', ['Front']);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('+');
  });
});
