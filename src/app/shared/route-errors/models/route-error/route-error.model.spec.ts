import { describe, expect, it } from 'vitest';

import {
  AccessDeniedRouteError,
  DeletedTaskRouteError,
  isRouteError,
  NotFoundRouteError,
  UnavailableRouteError,
  type RouteError,
} from './route-error.model';

describe('route errors', () => {
  it('identifies each boundary error and rejects ordinary errors', () => {
    const errors: RouteError[] = [
      new NotFoundRouteError(),
      new AccessDeniedRouteError({ kind: 'space', id: '1', name: null, ownerName: null }),
      new DeletedTaskRouteError({ key: 'T-1', name: 'Task' }, '2'),
      new UnavailableRouteError(503, 'request'),
    ];
    expect(errors.map((error) => error.kind)).toEqual([
      'not-found',
      'access-denied',
      'deleted-task',
      'unavailable',
    ]);
    expect(errors.map((error) => error.name)).toEqual([
      'NotFoundRouteError',
      'AccessDeniedRouteError',
      'DeletedTaskRouteError',
      'UnavailableRouteError',
    ]);
    expect(errors.every((error) => error.message.length > 0)).toBe(true);
    expect(errors.every(isRouteError)).toBe(true);
    expect(isRouteError(new Error())).toBe(false);
  });
});
