import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import type { SavedView, ViewLayout } from '../../../models/saved-view/saved-view.interface';
import { DEFAULT_VIEW_CONFIG } from '../../../utils/list-view-query/list-view-query.util';
import { ViewTabs } from './view-tabs.component';

/**
 * Constant criticalBugs
 *
 * @description
 * The mockup's `Critical bugs` saved view of `Bugs`.
 *
 * @type {SavedView}
 */
const criticalBugs: SavedView = {
  id: 'sv-bugs',
  listId: 'l-bugs',
  name: 'Critical bugs',
  icon: 'bug',
  layout: 'board',
  config: DEFAULT_VIEW_CONFIG,
  version: 1,
};

/**
 * Function tabs
 *
 * @description
 * The rendered tabs of the view tab list.
 *
 * @param {ComponentFixture<ViewTabs>} fixture - The fixture.
 * @returns {HTMLElement[]} The tabs.
 */
function tabs(fixture: ComponentFixture<ViewTabs>): HTMLElement[] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]')];
}

describe('ViewTabs', () => {
  it('shows a tab per given layout and emits the layout picked', async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<ViewTabs> = TestBed.createComponent(ViewTabs);
    const picked: Mock<(layout: ViewLayout) => void> = vi.fn();
    fixture.componentInstance.layoutPicked.subscribe((layout: ViewLayout) => {
      picked(layout);
    });
    fixture.componentRef.setInput('layouts', ['list', 'board', 'table']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(tabs(fixture).map((tab: HTMLElement): string => tab.textContent.trim())).toEqual([
      'List',
      'Board',
      'Sheet',
    ]);
    expect(tabs(fixture)[0]?.getAttribute('aria-selected')).toBe('true');

    tabs(fixture)[2]?.click();
    fixture.detectChanges();
    expect(picked).toHaveBeenCalledExactlyOnceWith('table');
  });

  it('shows only the list tab by default and emits a saved view picked', async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<ViewTabs> = TestBed.createComponent(ViewTabs);
    const picked: Mock<(view: SavedView) => void> = vi.fn();
    fixture.componentInstance.savedPicked.subscribe((view: SavedView) => {
      picked(view);
    });
    fixture.componentRef.setInput('savedViews', [criticalBugs]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(tabs(fixture).map((tab: HTMLElement): string => tab.textContent.trim())).toEqual([
      'List',
      'Critical bugs',
    ]);
    tabs(fixture)[1]?.click();
    fixture.detectChanges();
    expect(picked).toHaveBeenCalledExactlyOnceWith(criticalBugs);
  });
});
