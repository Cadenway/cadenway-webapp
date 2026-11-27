import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SPACE_DIRECTORY } from '@features/spaces/ports/space-directory';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { DocumentsApi } from '../../../data-access/services/documents-api/documents-api.service';
import type { DocumentSummary } from '../../../models/document/document.interface';
import { DocsPage } from './docs-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the route's error boundary.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="boundary">Could not load this page</p>',
})
class FakeBoundary {}

/**
 * Component FakeDocument
 *
 * @description
 * Stands in for the document page.
 */
@Component({
  selector: 'cw-fake-document',
  template: '<p data-testid="document">Document</p>',
})
class FakeDocument {}

/**
 * Constant CATALOG
 *
 * @description
 * Two documents of the mockup's catalog (`App.dc.html` lines 3834-3839), in its Product and
 * Operations spaces.
 *
 * @type {readonly DocumentSummary[]}
 */
const CATALOG: readonly DocumentSummary[] = [
  {
    id: 'd1',
    spaceId: 's1',
    title: 'Release notes 3.1',
    authorUserId: 'u2',
    updatedAt: '2025-11-04T10:00:00Z',
    version: 2,
  },
  {
    id: 'd2',
    spaceId: 's2',
    title: 'API integration guide',
    authorUserId: 'u9',
    updatedAt: '2025-10-31T10:00:00Z',
    version: 5,
  },
];

describe('DocsPage', () => {
  let api: { list: Mock; authors: Mock; create: Mock; remove: Mock; get: Mock };
  let toasts: { success: Mock; error: Mock; warning: Mock };
  let writeText: Mock;

  beforeEach(() => {
    api = {
      list: vi.fn(() => Promise.resolve({ items: CATALOG, truncated: false })),
      authors: vi.fn(() => Promise.resolve(new Map([['u2', 'Inès Roux']]))),
      create: vi.fn(() =>
        Promise.resolve({ ...CATALOG[0], id: 'd9', title: 'Untitled', version: 1, body: '' }),
      ),
      remove: vi.fn(() => Promise.resolve()),
      get: vi.fn(),
    };
    toasts = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            { path: 'atelier-nord/docs', component: DocsPage },
            { path: 'atelier-nord/d/:docId', component: FakeDocument },
          ],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        { provide: DocumentsApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: signal({ id: 'o1', slug: 'atelier-nord' }) },
        },
        {
          provide: SPACE_DIRECTORY,
          useValue: {
            spaces: signal([
              { id: 's1', name: 'Product', icon: null, tone: '', callerRole: 'edit' },
              { id: 's2', name: 'Operations', icon: null, tone: '', callerRole: 'view' },
            ]),
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
    TestBed.resetTestingModule();
  });

  /**
   * Function open
   *
   * @description
   * Opens the catalog and waits until its skeleton is gone.
   *
   * @param {string} url - The address.
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(url: string = '/atelier-nord/docs'): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle(harness);
    return harness;
  }

  /**
   * Function settle
   *
   * @description
   * Waits until the view no longer shows its skeleton.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(harness: RouterTestingHarness): Promise<void> {
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[data-testid="docs-loading"]') ?? null;
      })
      .toBeNull();
  }

  /**
   * Function view
   *
   * @description
   * The routed view.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The view.
   */
  function view(harness: RouterTestingHarness): HTMLElement {
    const host: HTMLElement | null = harness.routeNativeElement;
    if (!host) throw new Error('Expected the routed view.');
    return host;
  }

  /**
   * Function rowTexts
   *
   * @description
   * The text of each row, its cells joined by ` | `, without the avatars hidden from screen
   * readers.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {string[]} The texts.
   */
  function rowTexts(harness: RouterTestingHarness): string[] {
    return [...view(harness).querySelectorAll('[data-testid="document-row"]')].map(
      (row: Element): string =>
        [...row.querySelectorAll('[role="cell"]')]
          .map((cell: Element): string => {
            const copy: Element = cell.cloneNode(true) as Element;
            copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden: Element) => {
              hidden.remove();
            });
            return copy.textContent.replace(/\s+/g, ' ').trim();
          })
          .join(' | '),
    );
  }

  /**
   * Function rows
   *
   * @description
   * The row buttons.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLButtonElement[]} The buttons.
   */
  function rows(harness: RouterTestingHarness): HTMLButtonElement[] {
    return [
      ...view(harness).querySelectorAll<HTMLButtonElement>('[data-testid="document-row"] button'),
    ];
  }

  /**
   * Function menuItem
   *
   * @description
   * An item of the open context menu by its text.
   *
   * @param {string} label - Its text.
   * @returns {HTMLElement | undefined} The item.
   */
  function menuItem(label: string): HTMLElement | undefined {
    return [
      ...document.querySelectorAll<HTMLElement>('.cdk-overlay-container [role="menuitem"]'),
    ].find((item: HTMLElement): boolean => item.textContent.trim() === label);
  }

  /**
   * Function rightClick
   *
   * @description
   * Opens the context menu of a row.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {Element | undefined} element - The row's button.
   */
  function rightClick(harness: RouterTestingHarness, element: Element | undefined): void {
    element?.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    harness.detectChanges();
  }

  it('lists the documents with their space, author and date', async () => {
    const harness: RouterTestingHarness = await open();

    expect(view(harness).querySelector('h1')?.textContent.trim()).toBe('Documents');
    expect(view(harness).querySelector('[role="table"]')?.getAttribute('aria-label')).toBe(
      'Documents',
    );
    expect(
      [...view(harness).querySelectorAll('[role="columnheader"]')].map((cell: Element) =>
        cell.textContent.trim(),
      ),
    ).toEqual(['Title', 'Space', 'Author', 'Modified']);
    expect(rowTexts(harness)).toEqual([
      'Release notes 3.1 | Product | Inès Roux | Nov 4, 2025',
      'API integration guide | Operations | — | Oct 31, 2025',
    ]);
    expect(view(harness).querySelector('[data-testid="docs-create"]')?.textContent).toContain(
      'New document',
    );
  });

  it('shows the empty line for a completed read without document', async () => {
    api.list.mockResolvedValue({ items: [], truncated: false });
    const harness: RouterTestingHarness = await open();

    expect(view(harness).querySelector('[data-testid="documents-empty"]')?.textContent).toContain(
      'No document matches.',
    );
    expect(view(harness).querySelector('[data-testid="boundary"]')).toBeNull();
  });

  it('lets a failed read reach the error boundary, whose retry reads again', async () => {
    api.list.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord/docs');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[data-testid="boundary"]') ?? null;
      })
      .not.toBeNull();

    await harness.navigateByUrl('/atelier-nord/docs');
    await settle(harness);

    expect(api.list).toHaveBeenCalledTimes(2);
    expect(rowTexts(harness)).toHaveLength(2);
  });

  it('writes the search to the address after a pause, and reads the catalog for it', async () => {
    const harness: RouterTestingHarness = await open();
    const field: HTMLInputElement | null = view(harness).querySelector<HTMLInputElement>(
      '[data-testid="docs-search"]',
    );
    if (field === null) throw new Error('Expected the search field.');
    expect(field.getAttribute('aria-label')).toBe('Search for a document');
    api.list.mockResolvedValue({ items: [CATALOG[0]], truncated: false });

    field.value = 'notes ';
    field.dispatchEvent(new Event('input'));

    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/docs?q=notes');
    await expect
      .poll(() => {
        harness.detectChanges();
        return rowTexts(harness).length;
      })
      .toBe(1);
    expect(api.list).toHaveBeenLastCalledWith('notes', expect.anything());
    expect(field.value).toBe('notes ');
  });

  it('keeps what is typed while the address takes the previous search', async () => {
    const harness: RouterTestingHarness = await open();
    const field: HTMLInputElement | null = view(harness).querySelector<HTMLInputElement>(
      '[data-testid="docs-search"]',
    );
    if (field === null) throw new Error('Expected the search field.');

    field.value = 'notes';
    field.dispatchEvent(new Event('input'));
    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/docs?q=notes');
    field.value = 'notes 3';
    field.dispatchEvent(new Event('input'));
    harness.detectChanges();

    expect(field.value).toBe('notes 3');
    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/docs?q=notes%203');
    harness.detectChanges();
    expect(field.value).toBe('notes 3');

    await TestBed.inject(Router).navigateByUrl('/atelier-nord/docs?q=guide');
    harness.detectChanges();
    expect(field.value).toBe('guide');
  });

  it('asks to refine the search past the 500 documents the catalog reads', async () => {
    api.list.mockResolvedValue({ items: CATALOG, truncated: true });
    const harness: RouterTestingHarness = await open();

    expect(
      view(harness).querySelector('[data-testid="documents-truncated"]')?.textContent.trim(),
    ).toBe(
      'Showing the 500 most recently modified documents. Refine the search to find the others.',
    );
  });

  it('keeps each cell a cell, the row’s only button in its title cell', async () => {
    const harness: RouterTestingHarness = await open();
    const row: Element | undefined = [
      ...view(harness).querySelectorAll('[data-testid="document-row"]'),
    ].at(0);

    expect(row?.querySelectorAll(':scope > [role="cell"]')).toHaveLength(4);
    expect(row?.querySelectorAll('button')).toHaveLength(1);
    expect(row?.querySelector('[role="cell"] button')?.textContent.trim()).toBe(
      'Release notes 3.1',
    );
    expect(row?.querySelector('button [role="cell"]')).toBeNull();
  });

  it('reads the search of the address', async () => {
    const harness: RouterTestingHarness = await open('/atelier-nord/docs?q=guide');

    expect(api.list).toHaveBeenCalledWith('guide', expect.anything());
    expect(
      view(harness).querySelector<HTMLInputElement>('[data-testid="docs-search"]')?.value,
    ).toBe('guide');
  });

  it('creates a document and opens it in edit mode', async () => {
    const harness: RouterTestingHarness = await open();

    view(harness).querySelector<HTMLButtonElement>('[data-testid="docs-create"]')?.click();

    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/d/d9?mode=edit');
    expect(api.create).toHaveBeenCalledWith('s1', 'Untitled', expect.any(String));
  });

  it('opens a row, and offers editing and deletion only where the caller may edit', async () => {
    const harness: RouterTestingHarness = await open();

    rightClick(harness, rows(harness)[1]);
    expect(menuItem('Open')).toBeDefined();
    expect(menuItem('Copy the link')).toBeDefined();
    expect(menuItem('Edit')).toBeUndefined();
    expect(menuItem('Delete')).toBeUndefined();
    menuItem('Copy the link')?.click();
    await expect.poll(() => writeText.mock.calls.length).toBe(1);
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/atelier-nord/d/d2`);
    expect(toasts.success).toHaveBeenCalledWith('Document link copied');

    rows(harness)[0]?.click();
    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/d/d1');
  });

  it('confirms a deletion from the context menu, then hides the row', async () => {
    const harness: RouterTestingHarness = await open();

    rightClick(harness, rows(harness)[0]);
    menuItem('Delete')?.click();
    await harness.fixture.whenStable();
    const dialog: HTMLElement | null = document.querySelector<HTMLElement>(
      '.cdk-overlay-container [data-testid="document-delete-confirm"]',
    );
    expect(document.querySelector('.cdk-overlay-container')?.textContent).toContain(
      'Delete “Release notes 3.1”?',
    );
    expect(api.remove).not.toHaveBeenCalled();
    dialog?.click();

    await expect
      .poll(() => {
        harness.detectChanges();
        return rowTexts(harness).length;
      })
      .toBe(1);
    expect(api.remove).toHaveBeenCalledWith('d1', 2);
    expect(toasts.success).toHaveBeenCalledWith('Document deleted', {
      description: 'Release notes 3.1',
    });
  });

  it('reads the catalog again when the window regains focus, at most once per 30 s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    const harness: RouterTestingHarness = await open();

    window.dispatchEvent(new Event('focus'));
    harness.detectChanges();
    expect(api.list).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-11-27T10:00:31Z'));
    window.dispatchEvent(new Event('focus'));
    harness.detectChanges();

    await expect.poll(() => api.list.mock.calls.length).toBe(2);
    expect(api.list).toHaveBeenLastCalledWith('', { passive: true });
  });
});
