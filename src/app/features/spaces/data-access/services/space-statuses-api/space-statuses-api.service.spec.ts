import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SpacesService } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { hasProblemCode } from '@core/api';

import type { SpaceDetails } from '../../../models/space/space.interface';
import { SpaceStatusesApi } from './space-statuses-api.service';

describe('SpaceStatusesApi', () => {
  let updateSpace: Mock;
  let getSpace: Mock;
  let api: SpaceStatusesApi;

  beforeEach(() => {
    updateSpace = vi.fn(() =>
      of({
        id: 'sp-product',
        name: 'Product',
        prefix: 'CAD',
        visibility: 'organization',
        version: 8,
        statuses: {
          review: { category: 'active', name: 'Code review', hidden: false },
          testing: { category: 'active', name: null, hidden: true },
        },
      }),
    );
    getSpace = vi.fn(() =>
      of({
        id: 'sp-product',
        name: 'Product',
        prefix: 'CAD',
        visibility: 'organization',
        version: 9,
        statuses: { blocked: { category: 'active', name: null, hidden: true } },
      }),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: SpacesService, useValue: { updateSpace, getSpace } }],
    });
    api = TestBed.inject(SpaceStatusesApi);
  });

  it('sends the statuses changed from the version shown and maps the space recorded', async () => {
    const recorded: SpaceDetails = await api.update('sp-product', 7, {
      review: { name: 'Code review' },
      testing: { hidden: true },
    });

    expect(updateSpace).toHaveBeenCalledWith(
      'sp-product',
      { statuses: { review: { name: 'Code review' }, testing: { hidden: true } } },
      { headers: { 'If-Match': '"7"' } },
    );
    expect(recorded.version).toBe(8);
    expect(recorded.statuses.find((status) => status.key === 'review')).toEqual({
      key: 'review',
      name: 'Code review',
      hidden: false,
    });
    expect(recorded.statuses.find((status) => status.key === 'testing')?.hidden).toBe(true);
    expect(recorded.statuses.find((status) => status.key === 'todo')).toEqual({
      key: 'todo',
      name: null,
      hidden: false,
    });
  });

  it('reads the space again to settle a write without an answer', async () => {
    const recorded: SpaceDetails = await api.read('sp-product');

    expect(getSpace).toHaveBeenCalledWith('sp-product');
    expect(recorded.version).toBe(9);
    expect(recorded.statuses.find((status) => status.key === 'blocked')?.hidden).toBe(true);
  });

  it('puts back every default with a null statuses member', async () => {
    await api.update('sp-product', 7, null);

    expect(updateSpace).toHaveBeenCalledWith(
      'sp-product',
      { statuses: null },
      { headers: { 'If-Match': '"7"' } },
    );
  });

  it('rejects with the gateway problem, so a version mismatch can be told apart', async () => {
    updateSpace.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 412,
            error: { status: 412, code: 'request.version-mismatch' },
          }),
      ),
    );

    const error: unknown = await api.update('sp-product', 7, { review: { name: 'QA' } }).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(hasProblemCode(error, 'request.version-mismatch')).toBe(true);
  });
});
