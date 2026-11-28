import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { GetTaskApprovalClientResult } from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';

import { TaskApprovalRead } from './task-approval-read.service';

/**
 * Constant round
 *
 * @description
 * The approval round of CAD-482 at version 7, as the gateway answers it.
 *
 * @type {Record<string, unknown>}
 */
const round: Record<string, unknown> = {
  taskVersion: 7,
  status: 'pending',
  approvers: [],
};

describe('TaskApprovalRead', () => {
  let http: HttpTestingController;
  let reader: TaskApprovalRead;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    reader = TestBed.inject(TaskApprovalRead);
  });

  it('reads the round of a task once for the readers that ask together', async () => {
    const panel: Promise<GetTaskApprovalClientResult> = firstValueFrom(reader.approval('CAD-482'));
    const card: Promise<GetTaskApprovalClientResult> = firstValueFrom(reader.approval('CAD-482'));

    const request: TestRequest = http.expectOne('/v1/tasks/CAD-482/approvals');
    expect(request.request.cache).toBe('no-store');
    request.flush(round);

    expect(await panel).toEqual(round);
    expect(await card).toEqual(round);
    http.verify();
  });

  it('reads again for a reader after a write when the shared read answers an older version', async () => {
    const opening: Promise<GetTaskApprovalClientResult> = firstValueFrom(
      reader.approval('CAD-482'),
    );
    const delayed: TestRequest = http.expectOne('/v1/tasks/CAD-482/approvals');

    const afterWrite: Promise<GetTaskApprovalClientResult> = firstValueFrom(
      reader.approval('CAD-482', 8),
    );
    const panel: Promise<GetTaskApprovalClientResult> = firstValueFrom(
      reader.approval('CAD-482', 8),
    );
    http.expectNone('/v1/tasks/CAD-482/approvals');
    delayed.flush(round);
    expect(await opening).toEqual(round);

    http.expectOne('/v1/tasks/CAD-482/approvals').flush({ ...round, taskVersion: 8 });

    expect(await afterWrite).toEqual({ ...round, taskVersion: 8 });
    expect(await panel).toEqual({ ...round, taskVersion: 8 });
    http.verify();
  });

  it('checks every answer against the version of each reader, retries included', async () => {
    const opening: Promise<GetTaskApprovalClientResult> = firstValueFrom(
      reader.approval('CAD-482'),
    );
    const old: TestRequest = http.expectOne('/v1/tasks/CAD-482/approvals');
    const atEight: Promise<GetTaskApprovalClientResult> = firstValueFrom(
      reader.approval('CAD-482', 8),
    );
    const atNine: Promise<GetTaskApprovalClientResult> = firstValueFrom(
      reader.approval('CAD-482', 9),
    );

    old.flush(round);
    expect(await opening).toEqual(round);
    http.expectOne('/v1/tasks/CAD-482/approvals').flush({ ...round, taskVersion: 8 });
    expect(await atEight).toEqual({ ...round, taskVersion: 8 });
    http.expectOne('/v1/tasks/CAD-482/approvals').flush({ ...round, taskVersion: 9 });

    expect(await atNine).toEqual({ ...round, taskVersion: 9 });
    http.verify();
  });

  it('keeps the latest answer after two further reads that stay too old', async () => {
    const waiting: Promise<GetTaskApprovalClientResult> = firstValueFrom(
      reader.approval('CAD-482', 9),
    );
    http.expectOne('/v1/tasks/CAD-482/approvals').flush(round);
    http.expectOne('/v1/tasks/CAD-482/approvals').flush(round);
    http.expectOne('/v1/tasks/CAD-482/approvals').flush({ ...round, taskVersion: 8 });

    expect(await waiting).toEqual({ ...round, taskVersion: 8 });
    http.verify();
  });

  it('gives a reader of another organization its own read and rejects the old one', async () => {
    const pin: OrganizationPin = TestBed.inject(OrganizationPin);
    pin.set('org-atelier');
    const before: Promise<GetTaskApprovalClientResult> = firstValueFrom(reader.approval('CAD-1'));
    const old: TestRequest = http.expectOne('/v1/tasks/CAD-1/approvals');

    pin.set('org-studio');
    const after: Promise<GetTaskApprovalClientResult> = firstValueFrom(reader.approval('CAD-1'));
    const fresh: TestRequest = http.expectOne('/v1/tasks/CAD-1/approvals');
    old.flush(round);
    fresh.flush({ ...round, taskVersion: 3 });

    await expect(before).rejects.toBeInstanceOf(OrganizationSwitchPendingError);
    expect(await after).toEqual({ ...round, taskVersion: 3 });
    http.verify();
  });

  it('keeps a shared answer that already reaches the version asked', async () => {
    const opening: Promise<GetTaskApprovalClientResult> = firstValueFrom(
      reader.approval('CAD-482'),
    );
    const current: Promise<GetTaskApprovalClientResult> = firstValueFrom(
      reader.approval('CAD-482', 7),
    );
    http.expectOne('/v1/tasks/CAD-482/approvals').flush(round);

    expect(await opening).toEqual(round);
    expect(await current).toEqual(round);
    http.verify();
  });

  it('reads again once the previous read ended, and each task on its own', async () => {
    const first: Promise<GetTaskApprovalClientResult> = firstValueFrom(reader.approval('CAD-482'));
    const other: Promise<GetTaskApprovalClientResult> = firstValueFrom(reader.approval('CAD-490'));
    http.expectOne('/v1/tasks/CAD-482/approvals').flush(round);
    http.expectOne('/v1/tasks/CAD-490/approvals').flush(round);
    await Promise.all([first, other]);

    const again: Promise<GetTaskApprovalClientResult> = firstValueFrom(reader.approval('CAD-482'));
    http.expectOne('/v1/tasks/CAD-482/approvals').flush({ ...round, taskVersion: 8 });

    expect(await again).toEqual({ ...round, taskVersion: 8 });
    http.verify();
  });
});
