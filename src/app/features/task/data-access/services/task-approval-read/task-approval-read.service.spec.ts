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
