import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { KeyResult, MilestoneState } from '../../../models/goal/goal.interface';
import { KeyResultRow } from './key-result-row.component';

/**
 * Constant DEMO
 *
 * @description
 * The SSO demo milestone of the mockup (`k9`, `App.dc.html` line 4250), not reached.
 *
 * @type {KeyResult}
 */
const DEMO: KeyResult = {
  id: 'k9',
  kind: 'milestone',
  label: 'SSO demo to customers',
  taskKey: 'CAD-580',
  reached: false,
  progressPercent: 0,
};

/**
 * Constant GUIDE
 *
 * @description
 * The SSO guide checkbox of the mockup (`k3`), not done.
 *
 * @type {KeyResult}
 */
const GUIDE: KeyResult = {
  id: 'k3',
  kind: 'checkbox',
  label: 'SSO guide published',
  checked: false,
  progressPercent: 0,
};

describe('KeyResultRow', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
  });

  /**
   * Function render
   *
   * @description
   * Renders a key result row.
   *
   * @param {KeyResult} result - The key result.
   * @param {boolean} canWrite - Whether the caller may change it.
   * @param {MilestoneState} milestone - What is known of its milestone task.
   * @returns {ComponentFixture<KeyResultRow>} The fixture.
   */
  function render(
    result: KeyResult,
    canWrite: boolean,
    milestone: MilestoneState = 'unknown',
  ): ComponentFixture<KeyResultRow> {
    const fixture: ComponentFixture<KeyResultRow> = TestBed.createComponent(KeyResultRow);
    fixture.componentRef.setInput('result', result);
    fixture.componentRef.setInput('canWrite', canWrite);
    fixture.componentRef.setInput('milestone', milestone);
    fixture.componentRef.setInput('today', '2026-11-08');
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Function text
   *
   * @description
   * The row's whitespace-collapsed text.
   *
   * @param {ComponentFixture<KeyResultRow>} fixture - The fixture.
   * @returns {string} The text.
   */
  function text(fixture: ComponentFixture<KeyResultRow>): string {
    return (fixture.nativeElement as HTMLElement).textContent.replace(/\s+/gu, ' ').trim();
  }

  it('shows a milestone due before today as late, with its key and date', () => {
    const row: string = text(render(DEMO, true, { key: 'CAD-580', dueDate: '2026-11-02' }));

    expect(row).toContain('CAD-580 · 2 Nov');
    expect(row).toContain('Late');
  });

  it('shows a milestone due later, or without a known task, as upcoming', () => {
    expect(text(render(DEMO, true, { key: 'CAD-580', dueDate: '2026-12-10' }))).toContain(
      'Upcoming',
    );
    expect(text(render(DEMO, true, 'unknown'))).toMatch(/CAD-580.*Upcoming/u);
  });

  it('shows a milestone whose task is gone as not found, and a reached one as reached', () => {
    expect(text(render(DEMO, true, 'missing'))).toContain('Milestone not found');
    expect(
      text(render({ ...DEMO, reached: true, progressPercent: 100 }, true, 'missing')),
    ).toContain('Reached');
  });

  it('names the checkbox after its key result', () => {
    const element: HTMLElement = render(GUIDE, true).nativeElement as HTMLElement;

    const box: HTMLElement | null = element.querySelector('[role="checkbox"]');
    expect(box?.getAttribute('aria-label')).toBe('SSO guide published');
    expect(box?.getAttribute('aria-checked')).toBe('false');
    expect(box?.hasAttribute('disabled')).toBe(false);
  });

  it('shows a read-only key result without its controls', () => {
    const number: HTMLElement = render(
      {
        id: 'k2',
        kind: 'number',
        label: 'Customers on SSO',
        startValue: 0,
        currentValue: 4,
        targetValue: 10,
        progressPercent: 40,
      },
      false,
    ).nativeElement as HTMLElement;
    const checkbox: HTMLElement = render(GUIDE, false).nativeElement as HTMLElement;

    expect(number.querySelector('[data-testid="result-increase"]')).toBeNull();
    expect(number.querySelector('[data-testid="result-decrease"]')).toBeNull();
    expect(number.querySelector('[data-testid="result-remove"]')).toBeNull();
    expect(number.textContent).toContain('4 / 10');
    expect(checkbox.querySelector('[role="checkbox"]')?.hasAttribute('disabled')).toBe(true);
    expect(checkbox.querySelector('[data-testid="result-remove"]')).toBeNull();
  });
});
