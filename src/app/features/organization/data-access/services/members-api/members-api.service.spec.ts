import { TestBed } from '@angular/core/testing';
import {
  type Member,
  type MemberPage as MemberPageDto,
  MembersService,
} from '@cadenway/api-client';
import { type Observable, of, Subject } from 'rxjs';
import { describe, expect, it, type Mock, vi } from 'vitest';

import type { MemberPage } from '../../../models/member/member.interface';
import { MembersApi } from './members-api.service';

/**
 * Function member
 *
 * @description
 * A membership of Atelier Nord as the API answers it.
 *
 * @param {number} index - Position, for a distinct id.
 * @returns {Member} The membership.
 */
function member(index: number): Member {
  return {
    id: `m${String(index)}`,
    userId: `u${String(index)}`,
    name: `Member ${String(index)}`,
    email: `m${String(index)}@ateliernord.fr`,
    role: 'member',
    joinedAt: '2026-03-01T09:00:00Z',
    version: 1,
  };
}

/**
 * Function dto
 *
 * @description
 * A page of the API with `size` members starting at `from`.
 *
 * @param {number} from - First position.
 * @param {number} size - Members on the page.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @returns {MemberPageDto} The page.
 */
function dto(from: number, size: number, nextCursor: string | null): MemberPageDto {
  return {
    items: Array.from({ length: size }, (_value: unknown, index: number) => member(from + index)),
    nextCursor,
    total: 250,
    counts: { owner: 1, admin: 2, member: 247, guest: 0 },
  };
}

/**
 * Function api
 *
 * @description
 * Creates the data access over a fake `listMembers`.
 *
 * @param {Mock} listMembers - Fake of the generated operation.
 * @returns {MembersApi} The data access.
 */
function api(listMembers: Mock): MembersApi {
  TestBed.configureTestingModule({
    providers: [MembersApi, { provide: MembersService, useValue: { listMembers } }],
  });
  return TestBed.inject(MembersApi);
}

describe('MembersApi', () => {
  it('reads one page with the search, the roles and the cursor', async () => {
    const listMembers: Mock = vi.fn(() => of(dto(0, 8, 'c2')));

    const page: MemberPage = await api(listMembers).page(
      { search: '  lea ', roles: ['owner', 'admin'] },
      8,
      'c1',
    );

    expect(listMembers).toHaveBeenCalledWith({
      limit: 8,
      cursor: 'c1',
      search: 'lea',
      role: ['owner', 'admin'],
    });
    expect(page).toMatchObject({ nextCursor: 'c2', truncated: false, total: 250 });
  });

  it('follows the cursor of a complete read until the last page', async () => {
    const listMembers: Mock = vi.fn((params: { cursor?: string }) =>
      of(params.cursor === undefined ? dto(0, 100, 'c2') : dto(100, 50, null)),
    );

    const page: MemberPage = await api(listMembers).all({ search: '', roles: [] }, 2000);

    expect(listMembers).toHaveBeenCalledTimes(2);
    expect(page.items).toHaveLength(150);
    expect(page).toMatchObject({ nextCursor: null, truncated: false });
  });

  it('stops a complete read at its member limit and flags it', async () => {
    const listMembers: Mock = vi.fn((params: { cursor?: string; limit: number }) =>
      of(dto(0, params.limit, params.cursor === undefined ? 'c2' : 'c3')),
    );

    const page: MemberPage = await api(listMembers).all({ search: '', roles: [] }, 150);

    expect(
      listMembers.mock.calls.map((call: unknown[]) => (call[0] as { limit: number }).limit),
    ).toEqual([100, 50]);
    expect(page.items).toHaveLength(150);
    expect(page.truncated).toBe(true);
  });

  it('gives up a complete read once aborted, without reading the next page', async () => {
    const second: Subject<MemberPageDto> = new Subject<MemberPageDto>();
    const listMembers: Mock = vi.fn((params: { cursor?: string }): Observable<MemberPageDto> =>
      params.cursor === undefined ? of(dto(0, 100, 'c2')) : second,
    );
    const controller: AbortController = new AbortController();

    const read: Promise<MemberPage> = api(listMembers).all(
      { search: '', roles: [] },
      2000,
      controller.signal,
    );
    await vi.waitFor(() => {
      expect(listMembers).toHaveBeenCalledTimes(2);
    });
    controller.abort();

    await expect(read).rejects.toThrow();
    await expect(
      TestBed.inject(MembersApi).all({ search: '', roles: [] }, 2000, controller.signal),
    ).rejects.toThrow();
    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  it('sends the version shown as If-Match on a role change', async () => {
    const changeMemberRole: Mock = vi.fn(() => of({ ...member(1), role: 'admin', version: 4 }));
    TestBed.configureTestingModule({
      providers: [MembersApi, { provide: MembersService, useValue: { changeMemberRole } }],
    });

    await TestBed.inject(MembersApi).changeRole('m1', 'admin', 3);

    expect(changeMemberRole).toHaveBeenCalledWith(
      'm1',
      { role: 'admin' },
      { headers: { 'If-Match': '"3"' } },
    );
  });
});
