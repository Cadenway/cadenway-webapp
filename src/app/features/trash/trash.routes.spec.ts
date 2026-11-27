import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type MemberPage,
  MembersService,
  type TrashEntry as TrashEntryDto,
  type TrashEntryPage,
  TrashService,
} from '@cadenway/api-client';
import { provideCadenwayIcons } from '@cadenway/icons';
import { NEVER, type Observable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import { type RuntimeConfig, RuntimeConfigStore } from '@core/config';

import { RouteErrorBoundary } from '@features/errors';
import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';

import { TRASH_ROUTES } from './trash.routes';

/**
 * Function dto
 *
 * @description
 * A trash entry of Atelier Nord's `Sprint 14`, deleted by Camille Martin three weeks ago.
 *
 * @param {string} id - Entry id.
 * @param {string} key - Task key.
 * @param {string} name - Task name.
 * @returns {TrashEntryDto} The entry.
 */
function dto(id: string, key: string, name: string): TrashEntryDto {
  return {
    id,
    task: { key, name, status: 'cancelled' },
    parentKey: null,
    subtaskCount: 0,
    list: { id: 'list-sprint-14', spaceId: 'space-product', name: 'Sprint 14', state: 'active' },
    trashedAt: new Date(Date.now() - 21 * 86_400_000).toISOString(),
    trashedBy: { type: 'user', id: 'user-camille' },
    purgeAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString(),
  };
}

/**
 * Function page
 *
 * @description
 * A page of `GET /v1/trash/entries`, the last one.
 *
 * @param {readonly TrashEntryDto[]} items - Its entries.
 * @returns {TrashEntryPage} The page.
 */
function page(items: readonly TrashEntryDto[]): TrashEntryPage {
  return { items: [...items], nextCursor: null, total: items.length };
}

/**
 * Constant ENTRIES
 *
 * @description
 * Two entries of the mockup's seed (`TRASH_INIT`), in English.
 *
 * @type {readonly TrashEntryDto[]}
 */
const ENTRIES: readonly TrashEntryDto[] = [
  dto('entry-452', 'CAD-452', 'Old sign-in screen'),
  dto('entry-447', 'CAD-447', 'Dashboard PDF export (prototype)'),
];

describe('TRASH_ROUTES', () => {
  let listTrash: Mock<(params?: { cursor?: string }) => Observable<TrashEntryPage>>;
  let purgeTrashEntry: Mock<(entryId: string) => Observable<void>>;
  let emptyTrash: Mock<() => Observable<{ entryCount: number }>>;
  let restoreTrashEntry: Mock<(entryId: string) => Observable<unknown>>;

  beforeEach(() => {
    listTrash = vi.fn(() => of(page(ENTRIES)));
    purgeTrashEntry = vi.fn(() => of(undefined));
    emptyTrash = vi.fn(() => of({ entryCount: 2 }));
    restoreTrashEntry = vi.fn(() =>
      of({
        task: { key: 'CAD-452', name: 'Old sign-in screen', status: 'cancelled' },
        list: { name: 'Sprint 14' },
        subtaskCount: 0,
        detached: false,
        listRestored: false,
        spaceRestored: false,
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: ':org', providers: [provideCadenwayIcons()], children: TRASH_ROUTES }],
          withComponentInputBinding(),
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        {
          provide: TrashService,
          useValue: { listTrash, purgeTrashEntry, emptyTrash, restoreTrashEntry },
        },
        {
          provide: MembersService,
          useValue: {
            listMembers: (): Observable<MemberPage> =>
              of({
                items: [{ userId: 'user-camille', name: 'Camille Martin' }],
                nextCursor: null,
              } as unknown as MemberPage),
          },
        },
        { provide: NAVIGATION_REFRESH, useValue: { refresh: vi.fn(), refreshCounts: vi.fn() } },
        {
          provide: RuntimeConfigStore,
          useValue: { config: signal<RuntimeConfig>({ apiUrl: 'http://api.cadenway.localhost' }) },
        },
      ],
    });
    TestBed.inject(OrganizationPin).set('org-atelier-nord');
  });

  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node: Element) => {
      node.remove();
    });
  });

  /**
   * Function settle
   *
   * @description
   * Renders until no read is in flight.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {Promise<void>} Resolves once stable.
   */
  async function settle(harness: RouterTestingHarness): Promise<void> {
    await expect
      .poll(async () => {
        harness.detectChanges();
        await harness.fixture.whenStable();
        return (
          (harness.fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]') ===
          null
        );
      })
      .toBe(true);
  }

  /**
   * Function open
   *
   * @description
   * Opens the trash of Atelier Nord.
   *
   * @returns {Promise<{ harness: RouterTestingHarness; element: HTMLElement }>} The harness and its element.
   */
  async function open(): Promise<{ harness: RouterTestingHarness; element: HTMLElement }> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord/trash');
    await settle(harness);
    return { harness, element: harness.fixture.nativeElement as HTMLElement };
  }

  /**
   * Function text
   *
   * @description
   * The text of an element, whitespace collapsed.
   *
   * @param {Element | null | undefined} element - The element.
   * @returns {string} Its text.
   */
  function text(element: Element | null | undefined): string {
    return (element?.textContent ?? '').replace(/\s+/gu, ' ').trim();
  }

  /**
   * Function button
   *
   * @description
   * A button by its accessible name (its `aria-label` or its text).
   *
   * @param {ParentNode} root - Where to look.
   * @param {string} name - The name.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(root: ParentNode, name: string): HTMLButtonElement | undefined {
    return [...root.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) =>
        (candidate.getAttribute('aria-label') ?? text(candidate)) === name,
    );
  }

  it('lists the entries with their list, author, deletion and days left', async () => {
    const { element }: { element: HTMLElement } = await open();

    expect(text(element.querySelector('h1'))).toBe('Trash');
    expect(text(element.querySelector('[data-testid="trash-summary"]'))).toBe(
      '2 items · erased for good after 30 days',
    );
    const rows: Element[] = [...element.querySelectorAll('[data-testid="trash-row"]')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('role')).toBe('listitem');
    expect(text(rows[0])).toContain('Old sign-in screen');
    expect(text(rows[0]?.querySelector('[data-testid="trash-row-meta"]'))).toBe(
      'Sprint 14 · Deleted 21 days ago by Camille Martin',
    );
    const left: Element | null | undefined = rows[0]?.querySelector(
      '[data-testid="trash-row-left"]',
    );
    expect(text(left)).toBe('4 d');
    expect(left?.getAttribute('title')).toBe('Erased for good in 4 days');
    expect(button(element, 'Restore CAD-452')).toBeDefined();
    expect(button(element, 'Delete CAD-452 forever')).toBeDefined();
    expect(button(element, 'Empty the trash')).toBeDefined();
  });

  it('shows the empty state for a trash read without entries', async () => {
    listTrash.mockReturnValue(of(page([])));

    const { element }: { element: HTMLElement } = await open();

    const empty: Element | null = element.querySelector('[data-testid="trash-empty-state"]');
    expect(text(empty?.querySelector('cw-empty-title'))).toBe('The trash is empty');
    expect(text(empty?.querySelector('cw-empty-description'))).toBe(
      'Deleted tasks arrive here. You can restore them for 30 days.',
    );
    expect(text(element.querySelector('[data-testid="trash-summary"]'))).toBe(
      '0 items · erased for good after 30 days',
    );
    expect(button(element, 'Empty the trash')).toBeUndefined();
    expect(element.querySelector('[data-testid="trash-row"]')).toBeNull();
  });

  it('renders the unavailable state for a failed read, and Retry reads the trash again', async () => {
    listTrash.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 503, error: {} })),
    );

    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();

    expect(text(element.querySelector('h1'))).toBe('Could not load this page');
    expect(element.querySelector('[data-testid="trash-empty-state"]')).toBeNull();
    button(element, 'Retry')?.click();
    await settle(harness);
    await expect
      .poll(() => {
        harness.detectChanges();
        return element.querySelectorAll('[data-testid="trash-row"]').length;
      })
      .toBe(2);
    expect(listTrash).toHaveBeenCalledTimes(2);
  });

  it('deletes an entry forever once confirmed', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();
    listTrash.mockReturnValue(of(page([ENTRIES[1]])));

    button(element, 'Delete CAD-452 forever')?.click();
    harness.detectChanges();
    const dialog: Element | null = document.body.querySelector('[role="alertdialog"]');
    expect(text(dialog)).toContain('Delete CAD-452 forever?');
    expect(text(dialog)).toContain(
      '“Old sign-in screen” will be erased. This action cannot be undone.',
    );
    button(document.body, 'Delete forever')?.click();
    await settle(harness);

    expect(purgeTrashEntry).toHaveBeenCalledWith('entry-452');
    await expect
      .poll(() => {
        harness.detectChanges();
        return element.querySelectorAll('[data-testid="trash-row"]').length;
      })
      .toBe(1);
    await expect
      .poll(() => document.activeElement?.getAttribute('aria-label'))
      .toBe('Restore CAD-447');
  });

  it('moves the focus to the next row once a restored row leaves', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();
    listTrash.mockReturnValue(of(page([ENTRIES[1]])));
    const restore: HTMLButtonElement | undefined = button(element, 'Restore CAD-452');
    restore?.focus();

    restore?.click();
    await settle(harness);

    expect(restoreTrashEntry).toHaveBeenCalledWith('entry-452', {}, { reportNotReady: true });
    expect(element.querySelectorAll('[data-testid="trash-row"]')).toHaveLength(1);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Restore CAD-447');
  });

  it('keeps a pending button focusable and ignores its clicks', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();
    restoreTrashEntry.mockReturnValue(NEVER);
    const restore: HTMLButtonElement | undefined = button(element, 'Restore CAD-452');
    restore?.focus();

    restore?.click();
    harness.detectChanges();
    restore?.click();
    harness.detectChanges();

    expect(restoreTrashEntry).toHaveBeenCalledTimes(1);
    expect(restore?.hasAttribute('disabled')).toBe(false);
    expect(restore?.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(restore);
  });

  it('closes the Empty confirmation when the organization changes, and empties nothing', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();

    button(element, 'Empty the trash')?.click();
    harness.detectChanges();
    expect(document.body.querySelector('[role="alertdialog"]')).not.toBeNull();
    TestBed.inject(OrganizationPin).set('org-lumen');
    await settle(harness);

    await expect
      .poll(() => {
        harness.detectChanges();
        return document.body.querySelector('[role="alertdialog"]');
      })
      .toBeNull();
    expect(emptyTrash).not.toHaveBeenCalled();
  });

  it('keeps the h1 as the route focus target while the trash loads', async () => {
    listTrash.mockReturnValue(NEVER);
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord/trash');
    harness.detectChanges();
    const element: HTMLElement = harness.fixture.nativeElement as HTMLElement;

    const heading: Element | null = element.querySelector('h1[data-route-focus]');
    expect(text(heading)).toBe('Trash');
    expect(element.querySelector('[data-testid="trash-loading"]')?.getAttribute('aria-label')).toBe(
      'Loading the trash',
    );
    expect(element.querySelector('[data-testid="trash-summary"]')).toBeNull();
  });

  it('reaches and restores an entry past the first 1,000 with Show more', async () => {
    const all: readonly TrashEntryDto[] = Array.from(
      { length: 1_001 },
      (_: unknown, index: number) =>
        dto(`entry-${String(index + 1)}`, `CAD-${String(index + 1)}`, `Task ${String(index + 1)}`),
    );
    listTrash.mockImplementation((params?: { cursor?: string }) => {
      const start: number = Number(params?.cursor ?? '0');
      const next: number = start + 100;
      return of({
        items: all.slice(start, next),
        nextCursor: next < all.length ? String(next) : null,
        total: all.length,
      });
    });
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();
    expect(element.querySelectorAll('[data-testid="trash-row"]')).toHaveLength(1_000);
    expect(button(element, 'Restore CAD-1001')).toBeUndefined();

    element.querySelector<HTMLButtonElement>('[data-testid="trash-show-more"]')?.click();
    await settle(harness);
    await expect
      .poll(() => {
        harness.detectChanges();
        return element.querySelectorAll('[data-testid="trash-row"]').length;
      })
      .toBe(1_001);
    expect(element.querySelector('[data-testid="trash-show-more"]')).toBeNull();
    restoreTrashEntry.mockReturnValueOnce(
      of({
        task: { key: 'CAD-1001', name: 'Task 1001', status: 'cancelled' },
        list: { name: 'Sprint 14' },
        subtaskCount: 0,
        detached: false,
        listRestored: false,
        spaceRestored: false,
      }),
    );
    button(element, 'Restore CAD-1001')?.click();
    await settle(harness);

    expect(restoreTrashEntry).toHaveBeenCalledWith('entry-1001', {}, { reportNotReady: true });
  });

  it('says how many entries a capped read does not list', async () => {
    listTrash.mockReturnValue(of({ items: [...ENTRIES], nextCursor: null, total: 1_200 }));

    const { element }: { element: HTMLElement } = await open();

    expect(text(element.querySelector('[data-testid="trash-capped"]'))).toBe(
      'Showing the 2 most recently deleted items of 1200.',
    );
    expect(text(element.querySelector('[data-testid="trash-summary"]'))).toBe(
      '1200 items · erased for good after 30 days',
    );
  });

  it('empties the trash only once the word is typed', async () => {
    const { harness, element }: { harness: RouterTestingHarness; element: HTMLElement } =
      await open();
    listTrash.mockReturnValue(of(page([])));

    button(element, 'Empty the trash')?.click();
    harness.detectChanges();
    const dialog: Element | null = document.body.querySelector('[role="alertdialog"]');
    expect(text(dialog)).toContain(
      '2 items will be erased for good, subtasks and attachments included.',
    );
    expect(text(dialog)).toContain('To confirm, type trash');
    const confirm: HTMLButtonElement | undefined = [
      ...(dialog?.querySelectorAll('button') ?? []),
    ].find((candidate: HTMLButtonElement) => text(candidate) === 'Empty the trash');
    confirm?.click();
    harness.detectChanges();
    expect(emptyTrash).not.toHaveBeenCalled();

    const input: HTMLInputElement | null | undefined = dialog?.querySelector('input');
    if (input) {
      input.value = 'trash';
      input.dispatchEvent(new Event('input'));
    }
    harness.detectChanges();
    confirm?.click();
    await settle(harness);

    expect(emptyTrash).toHaveBeenCalledTimes(1);
    await expect
      .poll(() => {
        harness.detectChanges();
        return element.querySelector('[data-testid="trash-empty-state"]') !== null;
      })
      .toBe(true);
    await expect.poll(() => document.activeElement?.tagName).toBe('H1');
  });
});
