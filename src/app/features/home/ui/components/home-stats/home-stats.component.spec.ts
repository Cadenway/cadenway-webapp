import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { HomeStats as HomeStatsModel } from '../../../models/home-read/home-read.interface';
import { HomeStats } from './home-stats.component';

/**
 * Function render
 *
 * @description
 * Renders the counters strip.
 *
 * @param {HomeStatsModel} stats - The counters.
 * @returns {Promise<HTMLElement>} The strip's host.
 */
async function render(stats: HomeStatsModel): Promise<HTMLElement> {
  const fixture: ComponentFixture<HomeStats> = TestBed.createComponent(HomeStats);
  fixture.componentRef.setInput('stats', stats);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/**
 * Function cells
 *
 * @description
 * The label, value and hint of each counter.
 *
 * @param {HTMLElement} host - The strip.
 * @returns {readonly string[]} One entry per counter.
 */
function cells(host: HTMLElement): readonly string[] {
  return Array.from(host.querySelectorAll('cw-stat')).map((cell: Element) =>
    Array.from(cell.querySelectorAll('span'))
      .map((part: Element) => part.textContent.trim())
      .join(' '),
  );
}

describe('HomeStats', () => {
  it('shows the four counters with hints in the plural form of their count', async () => {
    const host: HTMLElement = await render({ assigned: 9, late: 2, dueToday: 1, done: 31 });

    expect(cells(host)).toEqual([
      'Assigned to me 9 open tasks',
      'Late 2 to reschedule',
      'Today 1 due today',
      'Done 31 tasks completed in total',
    ]);
    expect(
      host.querySelector('[data-testid="home-stats-late"]')?.classList.contains('text-grenat-text'),
    ).toBe(true);
  });

  it('uses the singular for one task and leaves no late task in the default tone', async () => {
    const host: HTMLElement = await render({ assigned: 1, late: 0, dueToday: 0, done: 1 });

    expect(cells(host)[0]).toBe('Assigned to me 1 open task');
    expect(cells(host)[2]).toBe('Today 0 due today');
    expect(cells(host)[3]).toBe('Done 1 task completed in total');
    expect(
      host.querySelector('[data-testid="home-stats-late"]')?.classList.contains('text-grenat-text'),
    ).toBe(false);
  });
});
