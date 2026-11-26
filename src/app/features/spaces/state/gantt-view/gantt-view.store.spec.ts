import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GanttViewStore, type GanttViewStoreInstance } from './gantt-view.store';

describe('GanttViewStore', () => {
  /**
   * Function setup
   *
   * @description
   * Provides the store on Thursday 26 November 2026.
   *
   * @returns {GanttViewStoreInstance} The store.
   */
  function setup(): GanttViewStoreInstance {
    TestBed.configureTestingModule({ providers: [GanttViewStore] });
    return TestBed.inject(GanttViewStore);
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 10, 26, 10, 30), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows three weeks of days around today until a period is set', () => {
    const store: GanttViewStoreInstance = setup();

    expect(store.scale()).toBe('day');
    expect(store.range()).toBeNull();
    expect(store.window()).toEqual({
      start: new Date(2026, 10, 23),
      end: new Date(2026, 11, 13),
    });
    expect(store.canZoomIn()).toBe(true);
    expect(store.canZoomOut()).toBe(true);
  });

  it('moves the period by a week and back to today', () => {
    const store: GanttViewStoreInstance = setup();

    store.shift(1);
    expect(store.window()).toEqual({
      start: new Date(2026, 10, 30),
      end: new Date(2026, 11, 20),
    });

    store.goToday();
    expect(store.range()).toBeNull();
  });

  it('zooms along the ladder and keeps the middle of the period when the scale changes', () => {
    const store: GanttViewStoreInstance = setup();
    store.shift(4);

    store.zoomIn();
    expect([store.scale(), store.zoom()]).toEqual(['day', 1.5]);

    store.zoomOut();
    store.zoomOut();
    expect(store.scale()).toBe('week');
    expect(store.zoom()).toBe(1.5);
    expect(store.window()).toEqual({
      start: new Date(2026, 11, 14),
      end: new Date(2027, 2, 7),
    });
  });

  it('stops at both ends of the ladder', () => {
    const store: GanttViewStoreInstance = setup();

    for (let step: number = 0; step < 10; step++) store.zoomIn();
    expect([store.scale(), store.zoom(), store.canZoomIn()]).toEqual(['day', 3, false]);

    for (let step: number = 0; step < 10; step++) store.zoomOut();
    expect([store.scale(), store.zoom(), store.canZoomOut()]).toEqual(['month', 1, false]);
  });

  it('picks a scale at its base width around today', () => {
    const store: GanttViewStoreInstance = setup();
    store.zoomIn();
    store.shift(-2);

    store.pickScale('month');

    expect([store.scale(), store.zoom(), store.range()]).toEqual(['month', 1, null]);
    expect(store.window()).toEqual({
      start: new Date(2026, 9, 1),
      end: new Date(2027, 2, 31),
    });
  });

  it('records what the timeline sets', () => {
    const store: GanttViewStoreInstance = setup();
    const range: { start: Date; end: Date } = {
      start: new Date(2026, 10, 1),
      end: new Date(2027, 0, 23),
    };

    store.followScale('week');
    store.followZoom(1);
    store.followRange(range);

    expect([store.scale(), store.zoom(), store.window()]).toEqual(['week', 1, range]);
  });

  it('folds Cancelled by status until the user changes the folded groups', () => {
    const store: GanttViewStoreInstance = setup();

    expect(store.collapsedOf('status')).toEqual(['cancelled']);
    expect(store.collapsedOf('priority')).toEqual([]);

    store.setCollapsed('status', ['done']);
    store.setCollapsed('priority', ['basse']);

    expect(store.collapsedOf('status')).toEqual(['done']);
    expect(store.collapsedOf('priority')).toEqual(['basse']);
    expect(store.collapsedOf('assignee')).toEqual([]);
  });
});
