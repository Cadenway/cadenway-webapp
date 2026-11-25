import { TestBed } from '@angular/core/testing';
import { ArchivesService, BillingService, TrashService } from '@cadenway/api-client';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SidebarApi } from './sidebar-api.service';

describe('SidebarApi', () => {
  let subscription: Mock;
  let listTrash: Mock;
  let api: SidebarApi;

  beforeEach(() => {
    subscription = vi.fn(() => of({ plan: 'team', seats: { used: 18, limit: 25 } }));
    listTrash = vi.fn(() => of({ items: [], nextCursor: null, total: 2 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: BillingService, useValue: { getBillingSubscription: subscription } },
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

  it('reads the free seats of the plan, never below zero', async () => {
    expect(await api.seats()).toEqual({ plan: 'team', free: 7 });
    subscription.mockReturnValueOnce(of({ plan: 'free', seats: { used: 6, limit: 5 } }));
    expect(await api.seats()).toEqual({ plan: 'free', free: 0 });
  });

  it('counts the trash entries and the archived lists and tasks from one item each', async () => {
    expect(await api.trashCount()).toBe(2);
    expect(await api.archiveCount()).toBe(5);
    expect(listTrash).toHaveBeenCalledWith({ limit: 1 });
  });
});
