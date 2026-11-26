import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  AccessService,
  ListsService,
  MembersService,
  type Space,
  SpacesService,
  type TaskList,
} from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { ListAccess } from '../../../models/list-share/list-share.interface';
import { versionOfEtag } from '../../adapters/list-access/list-access.adapter';
import { ListAccessApi } from './list-access-api.service';

/**
 * Constant sprint14
 *
 * @description
 * The mockup's `Sprint 14` as the gateway answers it.
 *
 * @type {TaskList}
 */
const sprint14: TaskList = {
  id: 'l-sprint14',
  spaceId: 'sp-product',
  name: 'Sprint 14',
  icon: 'lightning',
  color: 'violet',
  sprint: null,
  createdAt: '2026-11-01T00:00:00Z',
  version: 4,
  organizationAccess: true,
  callerRole: 'edit',
};

/**
 * Constant product
 *
 * @description
 * The space `Product`, owned by Camille Martin.
 *
 * @type {Space}
 */
const product: Space = {
  id: 'sp-product',
  name: 'Product',
  prefix: 'CAD',
  visibility: 'organization',
  owner: { userId: 'u-camille' },
} as Space;

/**
 * Constant directory
 *
 * @description
 * Two pages of the member directory of Atelier Nord.
 *
 * @type {readonly Record<string, unknown>[]}
 */
const directory: readonly Record<string, unknown>[] = [
  {
    items: [
      {
        userId: 'u-camille',
        name: 'Camille Martin',
        email: 'camille@ateliernord.fr',
        role: 'owner',
      },
      { userId: 'u-lea', name: 'Léa Petit', email: 'lea@ateliernord.fr', role: 'member' },
    ],
    nextCursor: 'next',
    total: 3,
  },
  {
    items: [
      { userId: 'u-nadia', name: 'Nadia Benali', email: 'nadia@studio-pixel.fr', role: 'guest' },
    ],
    nextCursor: null,
    total: 3,
  },
];

describe('ListAccessApi', () => {
  let access: Record<string, Mock>;
  let lists: Record<string, Mock>;
  let members: Record<string, Mock>;
  let api: ListAccessApi;

  beforeEach(() => {
    access = {
      listListGrants: vi.fn(() =>
        of({
          items: [
            { userId: 'u-camille', role: 'edit' },
            { userId: 'u-lea', role: 'comment' },
            { userId: 'u-nadia', role: 'owner-of-something-new' },
          ],
          nextCursor: null,
          total: 3,
        }),
      ),
      setListGrant: vi.fn(() =>
        of(new HttpResponse({ body: {}, headers: new HttpHeaders({ ETag: '"5"' }) })),
      ),
      removeListGrant: vi.fn(() =>
        of(new HttpResponse({ body: null, headers: new HttpHeaders({ ETag: 'W/"6"' }) })),
      ),
    };
    lists = {
      getList: vi.fn(() => of(sprint14)),
      updateList: vi.fn(() => of({ ...sprint14, organizationAccess: false, version: 7 })),
    };
    members = {
      listMembers: vi
        .fn()
        .mockReturnValueOnce(of(directory[0]))
        .mockReturnValueOnce(of(directory[1])),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessService, useValue: access },
        { provide: ListsService, useValue: lists },
        { provide: MembersService, useValue: members },
        { provide: SpacesService, useValue: { getSpace: vi.fn(() => of(product)) } },
      ],
    });
    api = TestBed.inject(ListAccessApi);
  });

  it('reads the list, its owner, its grants and every page of the directory', async () => {
    const read: ListAccess = await api.read('l-sprint14', 'sp-product');

    expect(read).toEqual({
      listId: 'l-sprint14',
      canEdit: true,
      organizationAccess: true,
      privateSpace: false,
      ownerId: 'u-camille',
      grants: [
        { userId: 'u-lea', role: 'comment' },
        { userId: 'u-nadia', role: 'view' },
      ],
      directory: [
        {
          userId: 'u-camille',
          name: 'Camille Martin',
          email: 'camille@ateliernord.fr',
          guest: false,
        },
        { userId: 'u-lea', name: 'Léa Petit', email: 'lea@ateliernord.fr', guest: false },
        { userId: 'u-nadia', name: 'Nadia Benali', email: 'nadia@studio-pixel.fr', guest: true },
      ],
    });
    expect(members['listMembers']).toHaveBeenLastCalledWith({ limit: 100, cursor: 'next' });
  });

  it('keeps the read when the directory is refused, without names', async () => {
    members['listMembers'] = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 403 })));
    lists['getList'].mockReturnValueOnce(
      of({ ...sprint14, callerRole: 'view', organizationAccess: undefined }),
    );

    const read: ListAccess = await api.read('l-sprint14', 'sp-product');

    expect(read.directory).toBeNull();
    expect(read.canEdit).toBe(false);
    expect(read.organizationAccess).toBe(true);
  });

  it('gives, removes and switches access, returning the version of the list', async () => {
    await expect(api.setRole('l-sprint14', 'u-lea', 'view')).resolves.toEqual({ version: 5 });
    expect(access['setListGrant']).toHaveBeenCalledWith(
      'l-sprint14',
      'u-lea',
      { role: 'view' },
      { observe: 'response' },
    );
    await expect(api.removeRole('l-sprint14', 'u-lea')).resolves.toEqual({ version: 6 });
    await expect(api.setOrganizationAccess('l-sprint14', false)).resolves.toEqual({ version: 7 });
    expect(lists['updateList']).toHaveBeenCalledWith('l-sprint14', { organizationAccess: false });
  });

  it('reads no version from an absent or malformed ETag', () => {
    expect(versionOfEtag(null)).toBeNull();
    expect(versionOfEtag('abc')).toBeNull();
    expect(versionOfEtag(' "12" ')).toBe(12);
  });
});
