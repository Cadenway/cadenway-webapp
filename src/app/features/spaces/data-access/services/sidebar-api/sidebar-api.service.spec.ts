import { TestBed } from '@angular/core/testing';
import { ArchivesService, TrashService } from '@cadenway/api-client';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SidebarApi } from './sidebar-api.service';

describe('SidebarApi', () => {
  let listTrash: Mock;
  let api: SidebarApi;

  beforeEach(() => {
    listTrash = vi.fn(() => of({ items: [], nextCursor: null, total: 2 }));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TrashService,
          useValue: { listTrash },
        },
        {
          provide: ArchivesService,
          useValue: {
            listArchivedLists: vi.fn(() => of({ items: [], nextCursor: null, total: 1 })),
            listArchivedTasks: vi.fn(() => of({ items: [], nextCursor: null, total: 4 })),
          },
        },
      ],
    });
    api = TestBed.inject(SidebarApi);
  });

  it('counts the trash entries and the archived lists and tasks from one item each', async () => {
    expect(await api.trashCount()).toBe(2);
    expect(await api.archiveCount()).toBe(5);
    expect(listTrash).toHaveBeenCalledWith({ limit: 1 });
  });
});
