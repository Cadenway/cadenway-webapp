import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import type { HomeSprint } from '../../../models/home-read/home-read.interface';
import { HomeSprintCard } from './home-sprint-card.component';

/**
 * Function render
 *
 * @description
 * Renders the card of a sprint of Atelier Nord.
 *
 * @param {Partial<HomeSprint>} overrides - The values that differ from `Sprint 14`.
 * @returns {Promise<HTMLElement>} The card's host.
 */
async function render(overrides: Partial<HomeSprint> = {}): Promise<HTMLElement> {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture: ComponentFixture<HomeSprintCard> = TestBed.createComponent(HomeSprintCard);
  fixture.componentRef.setInput('sprint', {
    listId: 'l-sprint-14',
    name: 'Sprint 14',
    startDate: '2026-11-03',
    endDate: '2026-11-17',
    done: 12,
    live: 32,
    ...overrides,
  });
  fixture.componentRef.setInput('link', '/atelier-nord/l/l-sprint-14');
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('HomeSprintCard', () => {
  it('shows the sprint, its range, its progress over the live tasks and a link to it', async () => {
    const host: HTMLElement = await render();

    expect(host.querySelector('h2')?.textContent.trim()).toBe('Sprint 14');
    expect(host.textContent).toContain('Nov 3 – 17');
    expect(host.querySelector('[data-testid="home-sprint-done"]')?.textContent.trim()).toBe(
      '12 / 32 · 38%',
    );
    const bar: HTMLElement | null = host.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Progress');
    expect(bar?.getAttribute('aria-valuenow')).toBe('38');
    const link: HTMLAnchorElement | null = host.querySelector('a');
    expect(link?.textContent.trim()).toBe('Open the sprint');
    expect(link?.getAttribute('href')).toBe('/atelier-nord/l/l-sprint-14');
  });

  it('shows no progress for a sprint whose tasks are all cancelled', async () => {
    const host: HTMLElement = await render({ done: 0, live: 0 });

    expect(host.querySelector('[data-testid="home-sprint-done"]')?.textContent.trim()).toBe(
      '0 / 0 · 0%',
    );
  });
});
