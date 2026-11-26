import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SprintReportApi } from '../../data-access/services/sprint-report-api/sprint-report-api.service';
import type { SprintReport } from '../../models/sprint-report/sprint-report.interface';
import { SprintReportStore, type SprintReportStoreInstance } from './sprint-report.store';

/**
 * Constant sprint14
 *
 * @description
 * The mockup's `Sprint 14` report.
 *
 * @type {SprintReport}
 */
const sprint14: SprintReport = {
  listId: 'l-sprint14',
  name: 'Sprint 14',
  startDate: '2026-11-03',
  endDate: '2026-11-17',
  committed: 42,
  delivered: { points: 15, taskCount: 6, tasks: [] },
  remaining: { points: 27, taskCount: 9, tasks: [] },
  projected: 4,
  days: [],
  velocity: [],
};

describe('SprintReportStore', () => {
  let report: Mock<SprintReportApi['report']>;
  let store: SprintReportStoreInstance;
  let listId: WritableSignal<string | null>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 10, 0));
    report = vi.fn<SprintReportApi['report']>(() => Promise.resolve(sprint14));
    TestBed.configureTestingModule({
      providers: [SprintReportStore, { provide: SprintReportApi, useValue: { report } }],
    });
    store = TestBed.inject(SprintReportStore);
    listId = signal<string | null>(null);
    TestBed.runInInjectionContext(() => {
      store.follow(listId);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads nothing before the dialog opens, then the report of the caller day and time zone', async () => {
    TestBed.tick();
    expect(report).not.toHaveBeenCalled();
    expect(store.report.status()).toBe('idle');

    listId.set('l-sprint14');
    TestBed.tick();
    await expect.poll(() => store.report.hasValue()).toBe(true);

    expect(report).toHaveBeenCalledWith(
      'l-sprint14',
      '2026-11-08',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      expect.any(AbortSignal),
    );
    expect(store.report.value()).toEqual(sprint14);
  });

  it('keeps the report while closing and reads it again at the next opening', async () => {
    listId.set('l-sprint14');
    TestBed.tick();
    await expect.poll(() => store.report.hasValue()).toBe(true);

    listId.set(null);
    TestBed.tick();
    expect(store.report.value()).toEqual(sprint14);
    expect(report).toHaveBeenCalledTimes(1);

    listId.set('l-sprint14');
    TestBed.tick();
    await expect.poll(() => report.mock.calls.length).toBe(2);
  });

  it('keeps a failed read apart from an empty report and reads again on retry', async () => {
    report.mockRejectedValueOnce(new Error('unavailable'));
    listId.set('l-sprint14');
    TestBed.tick();
    await expect.poll(() => store.report.status()).toBe('error');

    store.retry();
    await expect.poll(() => store.report.hasValue()).toBe(true);
    expect(report).toHaveBeenCalledTimes(2);
  });
});
