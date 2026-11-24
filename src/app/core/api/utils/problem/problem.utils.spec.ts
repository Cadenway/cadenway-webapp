import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { hasProblemCode, readProblem, readProblemAsync } from './problem.utils';

describe('readProblem', () => {
  it('reads typed fields and the request identifier', () => {
    const error: HttpErrorResponse = new HttpErrorResponse({
      status: 403,
      error: { code: 'DENIED', title: 'Denied', detail: 'No', details: { id: 1 } },
      headers: new HttpHeaders({ 'X-Request-Id': 'abc' }),
    });
    expect(readProblem(error)).toEqual({
      status: 403,
      code: 'DENIED',
      title: 'Denied',
      detail: 'No',
      details: { id: 1 },
      requestId: 'abc',
    });
    expect(hasProblemCode(error, 'DENIED')).toBe(true);
  });
  it('handles network failures and malformed bodies', () => {
    expect(readProblem(new HttpErrorResponse({ status: 0 }))).toEqual({
      status: 0,
      code: null,
      title: null,
      detail: null,
      details: null,
      requestId: null,
    });
    expect(readProblem(new Error())).toBeNull();
    expect(
      readProblem(new HttpErrorResponse({ status: 500, error: { code: 4, details: [] } }))?.code,
    ).toBeNull();
  });
  it('parses string and Blob bodies and ignores invalid JSON', async () => {
    expect(readProblem(new HttpErrorResponse({ status: 400, error: '{"code":"BAD"}' }))?.code).toBe(
      'BAD',
    );
    expect(readProblem(new HttpErrorResponse({ status: 400, error: '{' }))?.code).toBeNull();
    const blob: Blob = new Blob(['{"code":"BLOB"}']);
    expect(
      (await readProblemAsync(new HttpErrorResponse({ status: 400, error: blob })))?.code,
    ).toBe('BLOB');
    expect(
      (await readProblemAsync(new HttpErrorResponse({ status: 0, error: blob })))?.code,
    ).toBeNull();
  });
});
