import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Person } from '../../../models/person/person.interface';
import { TaskMembersApi } from './task-members-api.service';

/**
 * Function member
 *
 * @description
 * A member of Atelier Nord as the directory lists it.
 *
 * @param {string} userId - Account id.
 * @param {string} name - Full name.
 * @param {string} role - Role in the organization.
 * @returns {Record<string, unknown>} The member.
 */
function member(userId: string, name: string, role: string): Record<string, unknown> {
  return {
    id: `m-${userId}`,
    userId,
    name,
    email: `${userId}@ateliernord.fr`,
    role,
    joinedAt: '2026-11-01T10:00:00Z',
    version: 1,
  };
}

/**
 * Function page
 *
 * @description
 * A page of the directory.
 *
 * @param {readonly Record<string, unknown>[]} items - The members.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @returns {Record<string, unknown>} The page.
 */
function page(
  items: readonly Record<string, unknown>[],
  nextCursor: string | null,
): Record<string, unknown> {
  return {
    items,
    nextCursor,
    total: 3,
    counts: { owner: 1, admin: 0, member: 1, guest: 1 },
  };
}

describe('TaskMembersApi', () => {
  let http: HttpTestingController;
  let api: TaskMembersApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TaskMembersApi);
  });

  it('reads every page once for the readers that ask together', async () => {
    const everyone: Promise<readonly Person[]> = firstValueFrom(api.people());
    const assignable: Promise<readonly Person[]> = firstValueFrom(api.assignable());

    const first: TestRequest = http.expectOne(
      (request) => request.url === '/v1/members' && !request.params.has('cursor'),
    );
    expect(first.request.params.get('limit')).toBe('100');
    first.flush(
      page([member('u1', 'Camille Martin', 'owner'), member('u2', 'Ines Robert', 'member')], 'c2'),
    );
    http
      .expectOne(
        (request) => request.url === '/v1/members' && request.params.get('cursor') === 'c2',
      )
      .flush(page([member('u9', 'Nora Guest', 'guest')], null));

    expect((await everyone).map((person: Person) => person.id)).toEqual(['u1', 'u2', 'u9']);
    expect((await assignable).map((person: Person) => person.id)).toEqual(['u1', 'u2']);
    http.verify();
  });

  it('reads the directory again once the previous read ended', async () => {
    const before: Promise<readonly Person[]> = firstValueFrom(api.people());
    http
      .expectOne('/v1/members?limit=100')
      .flush(page([member('u1', 'Camille Martin', 'owner')], null));
    await before;

    const after: Promise<readonly Person[]> = firstValueFrom(api.people());
    http
      .expectOne('/v1/members?limit=100')
      .flush(
        page(
          [member('u1', 'Camille Martin', 'owner'), member('u2', 'Ines Robert', 'member')],
          null,
        ),
      );

    expect(await after).toHaveLength(2);
    http.verify();
  });
});
