import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
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

import { SPACE_DIRECTORY, type SpaceDirectoryEntry } from '@features/spaces/ports/space-directory';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { NotFoundRouteError } from '@shared/route-errors';
import { unsavedChangesGuard } from '@shared/unsaved-changes';

import { DocumentsApi } from '../../../data-access/services/documents-api/documents-api.service';
import type { DocumentDetail } from '../../../models/document/document.interface';
import { DocumentPage } from './document-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the route's error boundary, naming the error it caught.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="boundary">Could not load this page</p>',
})
class FakeBoundary {}

/**
 * Component FakeCatalog
 *
 * @description
 * Stands in for the catalog.
 */
@Component({
  selector: 'cw-fake-catalog',
  template: '<p data-testid="catalog">Documents</p>',
})
class FakeCatalog {}

/**
 * Constant NOTES
 *
 * @description
 * The mockup's release notes (`App.dc.html` line 3835).
 *
 * @type {DocumentDetail}
 */
const NOTES: DocumentDetail = {
  id: 'd1',
  spaceId: 's1',
  title: 'Release notes 3.1',
  authorUserId: 'u2',
  updatedAt: '2025-11-04T10:00:00Z',
  version: 3,
  body: '# Highlights\n\nThe board limits work in progress.',
};

/**
 * Constant spaces
 *
 * @description
 * The spaces of the sidebar; Product is editable unless a spec makes it read only.
 *
 * @type {WritableSignal<readonly SpaceDirectoryEntry[]>}
 */
const spaces: WritableSignal<readonly SpaceDirectoryEntry[]> = signal([]);

describe('DocumentPage', () => {
  let api: { open: Mock; get: Mock; update: Mock; remove: Mock; authors: Mock };
  let toasts: { success: Mock; error: Mock; warning: Mock; info: Mock };

  beforeEach(() => {
    spaces.set([{ id: 's1', name: 'Product', icon: null, tone: '', callerRole: 'edit' }]);
    api = {
      open: vi.fn(() => Promise.resolve(NOTES)),
      get: vi.fn(() => Promise.resolve(NOTES)),
      update: vi.fn((_id: string, version: number, draft: { title: string; body: string }) =>
        Promise.resolve({ ...NOTES, ...draft, version: version + 1 }),
      ),
      remove: vi.fn(() => Promise.resolve()),
      authors: vi.fn(() => Promise.resolve(new Map([['u2', 'Inès Roux']]))),
    };
    toasts = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: 'atelier-nord/d/:docId',
              component: DocumentPage,
              canDeactivate: [unsavedChangesGuard],
            },
            { path: 'atelier-nord/docs', component: FakeCatalog },
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
        { provide: SPACE_DIRECTORY, useValue: { spaces } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  /**
   * Function open
   *
   * @description
   * Opens a document's address and waits until its skeleton is gone.
   *
   * @param {string} url - The address.
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(url: string = '/atelier-nord/d/d1'): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[data-testid="docs-loading"]') ?? null;
      })
      .toBeNull();
    return harness;
  }

  /**
   * Function find
   *
   * @description
   * An element of the routed view by its `data-testid`.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} id - The test id.
   * @returns {HTMLElement | null} The element.
   */
  function find(harness: RouterTestingHarness, id: string): HTMLElement | null {
    return harness.routeNativeElement?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null;
  }

  /**
   * Function overlay
   *
   * @description
   * An element of an open overlay by its `data-testid`.
   *
   * @param {string} id - The test id.
   * @returns {HTMLElement | null} The element.
   */
  function overlay(id: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.cdk-overlay-container [data-testid="${id}"]`);
  }

  /**
   * Function typeTitle
   *
   * @description
   * Types a title into the edit mode's title field.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} text - The title.
   */
  function typeTitle(harness: RouterTestingHarness, text: string): void {
    const field: HTMLTextAreaElement | null = find(
      harness,
      'document-title-field',
    ) as HTMLTextAreaElement | null;
    if (field === null) throw new Error('Expected the title field.');
    field.value = text;
    field.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  it('reads the document with its space, last author and date, and titles the page', async () => {
    const harness: RouterTestingHarness = await open();

    expect(find(harness, 'document-title')?.textContent.trim()).toBe('Release notes 3.1');
    expect(find(harness, 'document-meta')?.textContent.trim()).toBe(
      'Product · Modified Nov 4, 2025 by Inès Roux',
    );
    expect(find(harness, 'document-body')?.querySelector('h1')?.textContent).toContain(
      'Highlights',
    );
    expect(find(harness, 'document-edit')).not.toBeNull();
    expect(find(harness, 'document-delete')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Release notes 3.1 — Cadenway');
  });

  it('reads only, without Edit or Delete, when the caller may not edit the space', async () => {
    spaces.set([{ id: 's1', name: 'Product', icon: null, tone: '', callerRole: 'view' }]);
    api.open.mockResolvedValue({ ...NOTES, body: '' });
    const harness: RouterTestingHarness = await open('/atelier-nord/d/d1?mode=edit');

    expect(find(harness, 'document-edit')).toBeNull();
    expect(find(harness, 'document-delete')).toBeNull();
    expect(find(harness, 'document-title-field')).toBeNull();
    expect(find(harness, 'document-empty')?.textContent.trim()).toBe('This document is empty.');
  });

  it('renders the not found page for a missing document', async () => {
    api.open.mockRejectedValueOnce(new NotFoundRouteError());
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/atelier-nord/d/d404');

    await expect
      .poll(() => {
        harness.detectChanges();
        return find(harness, 'boundary');
      })
      .not.toBeNull();
  });

  it('edits the title and saves it with Done, then goes back to read mode', async () => {
    const harness: RouterTestingHarness = await open();

    find(harness, 'document-edit')?.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(find(harness, 'document-title-field'));
    expect(find(harness, 'document-editor')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Product · editing in progress');
    typeTitle(harness, 'Release notes 3.2');
    find(harness, 'document-done')?.click();

    await expect
      .poll(() => {
        harness.detectChanges();
        return find(harness, 'document-title')?.textContent.trim();
      })
      .toBe('Release notes 3.2');
    expect(api.update).toHaveBeenCalledWith('d1', 3, {
      title: 'Release notes 3.2',
      body: NOTES.body,
    });
    expect(toasts.success).toHaveBeenCalledWith('Document saved', {
      description: 'Release notes 3.2',
    });
    expect(TestBed.inject(Title).getTitle()).toBe('Release notes 3.2 — Cadenway');
  });

  it('stays in edit mode with the draft when the save is refused', async () => {
    api.update.mockRejectedValueOnce(new Error('refused'));
    api.get.mockRejectedValueOnce(new Error('unreachable'));
    const harness: RouterTestingHarness = await open();

    find(harness, 'document-edit')?.click();
    harness.detectChanges();
    typeTitle(harness, 'Release notes 3.2');
    find(harness, 'document-done')?.click();

    await expect.poll(() => toasts.warning.mock.calls.length).toBe(1);
    harness.detectChanges();
    expect((find(harness, 'document-title-field') as HTMLTextAreaElement | null)?.value).toBe(
      'Release notes 3.2',
    );
  });

  it('opens a new document in edit mode from the address, its title field empty', async () => {
    api.open.mockResolvedValue({ ...NOTES, id: 'd9', title: 'Untitled', version: 1, body: '' });
    const harness: RouterTestingHarness = await open('/atelier-nord/d/d9?mode=edit');

    await expect
      .poll(() => {
        harness.detectChanges();
        return find(harness, 'document-title-field');
      })
      .not.toBeNull();
    const field: HTMLTextAreaElement = find(harness, 'document-title-field') as HTMLTextAreaElement;
    expect(field.value).toBe('');
    expect(field.placeholder).toBe('Untitled');
    expect(field.maxLength).toBe(200);

    find(harness, 'document-cancel')?.click();
    harness.detectChanges();
    expect(find(harness, 'document-title')?.textContent.trim()).toBe('Untitled');
    expect(find(harness, 'document-empty')?.textContent.trim()).toBe(
      'This document is empty. Choose Edit to write it.',
    );
  });

  it('asks before leaving unsaved changes, and stays when asked to', async () => {
    const harness: RouterTestingHarness = await open();
    const router: Router = TestBed.inject(Router);
    find(harness, 'document-edit')?.click();
    harness.detectChanges();
    typeTitle(harness, 'Release notes 3.2');

    const kept: Promise<boolean> = router.navigateByUrl('/atelier-nord/docs');
    await expect
      .poll(() => {
        harness.detectChanges();
        return overlay('document-discard-confirm');
      })
      .not.toBeNull();
    expect(document.querySelector('.cdk-overlay-container')?.textContent).toContain(
      'Leave without saving?',
    );
    overlay('document-discard-keep')?.click();
    harness.detectChanges();
    expect(await kept).toBe(false);
    expect(router.url).toBe('/atelier-nord/d/d1');
    await expect
      .poll(() => {
        harness.detectChanges();
        return overlay('document-discard-confirm');
      })
      .toBeNull();

    const left: Promise<boolean> = router.navigateByUrl('/atelier-nord/docs');
    await expect
      .poll(() => {
        harness.detectChanges();
        return overlay('document-discard-confirm');
      })
      .not.toBeNull();
    overlay('document-discard-confirm')?.click();
    harness.detectChanges();
    expect(await left).toBe(true);
    expect(router.url).toBe('/atelier-nord/docs');
  });

  it('leaves without asking when nothing changed', async () => {
    const harness: RouterTestingHarness = await open();
    find(harness, 'document-edit')?.click();
    harness.detectChanges();

    expect(await TestBed.inject(Router).navigateByUrl('/atelier-nord/docs')).toBe(true);
  });

  it('deletes the document once confirmed and goes back to the catalog', async () => {
    const harness: RouterTestingHarness = await open();

    find(harness, 'document-delete')?.click();
    harness.detectChanges();
    await expect.poll(() => overlay('document-delete-confirm')).not.toBeNull();
    overlay('document-delete-confirm')?.click();

    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/docs');
    expect(api.remove).toHaveBeenCalledWith('d1', 3);
  });

  it('reads the document again on focus while reading, never while editing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
    const harness: RouterTestingHarness = await open();
    api.get.mockResolvedValue({ ...NOTES, title: 'Release notes 3.1.1', version: 4 });
    vi.setSystemTime(new Date('2026-11-27T10:00:31Z'));

    window.dispatchEvent(new Event('focus'));
    await expect
      .poll(() => {
        harness.detectChanges();
        return find(harness, 'document-title')?.textContent.trim();
      })
      .toBe('Release notes 3.1.1');

    find(harness, 'document-edit')?.click();
    harness.detectChanges();
    vi.setSystemTime(new Date('2026-11-27T10:02:00Z'));
    window.dispatchEvent(new Event('focus'));
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('merges a version saved meanwhile, names who saved it, and confirms replacing it', async () => {
    const harness: RouterTestingHarness = await open();
    api.update.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 412,
        error: { status: 412, code: 'request.version-mismatch' },
      }),
    );
    api.get.mockResolvedValueOnce({
      ...NOTES,
      body: '# Fixes',
      version: 5,
      updatedAt: '2025-11-05T10:00:00Z',
    });

    find(harness, 'document-edit')?.click();
    harness.detectChanges();
    typeTitle(harness, 'Release notes 3.2');
    find(harness, 'document-done')?.click();

    await expect
      .poll(() => {
        harness.detectChanges();
        return find(harness, 'document-conflict')?.textContent.trim();
      })
      .toBe(
        'Inès Roux saved another version Nov 5, 2025. Your changes are kept over it; Done replaces it.',
      );
    expect((find(harness, 'document-title-field') as HTMLTextAreaElement | null)?.value).toBe(
      'Release notes 3.2',
    );

    await harness.fixture.whenStable();
    harness.detectChanges();
    find(harness, 'document-done')?.click();
    await expect
      .poll(() => {
        harness.detectChanges();
        return overlay('document-replace-confirm');
      })
      .not.toBeNull();
    expect(api.update).toHaveBeenCalledTimes(1);
    overlay('document-replace-confirm')?.click();

    await expect
      .poll(() => {
        harness.detectChanges();
        return find(harness, 'document-title')?.textContent.trim();
      })
      .toBe('Release notes 3.2');
    expect(api.update).toHaveBeenLastCalledWith('d1', 5, {
      title: 'Release notes 3.2',
      body: '# Fixes',
    });
  });

  it('shows the version saved meanwhile when the draft changed nothing', async () => {
    const harness: RouterTestingHarness = await open();
    api.update.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 412,
        error: { status: 412, code: 'request.version-mismatch' },
      }),
    );
    api.get.mockResolvedValueOnce({ ...NOTES, title: 'Release notes 3.1.1', version: 5 });

    find(harness, 'document-edit')?.click();
    harness.detectChanges();
    find(harness, 'document-done')?.click();

    await expect
      .poll(() => {
        harness.detectChanges();
        return find(harness, 'document-title')?.textContent.trim();
      })
      .toBe('Release notes 3.1.1');
    expect(find(harness, 'document-conflict')).toBeNull();
  });

  it('keeps edit mode and what was typed while a save was on its way', async () => {
    const harness: RouterTestingHarness = await open();
    let answer: (saved: DocumentDetail) => void = (): void => undefined;
    api.update.mockImplementationOnce(
      (_id: string, version: number, draft: { title: string; body: string }) =>
        new Promise<DocumentDetail>((resolve) => {
          answer = (): void => {
            resolve({ ...NOTES, ...draft, version: version + 1 });
          };
        }),
    );

    find(harness, 'document-edit')?.click();
    harness.detectChanges();
    typeTitle(harness, 'Release notes 3.2');
    find(harness, 'document-done')?.click();
    harness.detectChanges();
    typeTitle(harness, 'Release notes 3.3');
    answer(NOTES);

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    harness.detectChanges();
    expect((find(harness, 'document-title-field') as HTMLTextAreaElement | null)?.value).toBe(
      'Release notes 3.3',
    );
    find(harness, 'document-done')?.click();
    await expect.poll(() => api.update.mock.calls.length).toBe(2);
    expect(api.update).toHaveBeenLastCalledWith('d1', 4, {
      title: 'Release notes 3.3',
      body: NOTES.body,
    });
  });

  it('waits for a save under way before leaving, and leaves once it saved the draft', async () => {
    const harness: RouterTestingHarness = await open();
    let answer: () => void = (): void => undefined;
    api.update.mockImplementationOnce(
      (_id: string, version: number, draft: { title: string; body: string }) =>
        new Promise<DocumentDetail>((resolve) => {
          answer = (): void => {
            resolve({ ...NOTES, ...draft, version: version + 1 });
          };
        }),
    );
    find(harness, 'document-edit')?.click();
    harness.detectChanges();
    typeTitle(harness, 'Release notes 3.2');
    find(harness, 'document-done')?.click();
    harness.detectChanges();

    const left: Promise<boolean> = TestBed.inject(Router).navigateByUrl('/atelier-nord/docs');
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 20);
    });
    harness.detectChanges();
    expect(overlay('document-discard-confirm')).toBeNull();
    answer();

    expect(await left).toBe(true);
    expect(overlay('document-discard-confirm')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/docs');
  });

  it('asks after the save under way when the draft changed during it', async () => {
    const harness: RouterTestingHarness = await open();
    let answer: () => void = (): void => undefined;
    api.update.mockImplementationOnce(
      (_id: string, version: number, draft: { title: string; body: string }) =>
        new Promise<DocumentDetail>((resolve) => {
          answer = (): void => {
            resolve({ ...NOTES, ...draft, version: version + 1 });
          };
        }),
    );
    find(harness, 'document-edit')?.click();
    harness.detectChanges();
    typeTitle(harness, 'Release notes 3.2');
    find(harness, 'document-done')?.click();
    harness.detectChanges();
    typeTitle(harness, 'Release notes 3.3');

    const left: Promise<boolean> = TestBed.inject(Router).navigateByUrl('/atelier-nord/docs');
    answer();
    await expect
      .poll(() => {
        harness.detectChanges();
        return overlay('document-discard-confirm');
      })
      .not.toBeNull();
    overlay('document-discard-confirm')?.click();
    harness.detectChanges();

    expect(await left).toBe(true);
  });

  it('keeps the document and reads it again after a deletion refused as stale', async () => {
    const harness: RouterTestingHarness = await open();
    api.remove.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 412,
        error: { status: 412, code: 'request.version-mismatch' },
      }),
    );
    api.get.mockResolvedValueOnce({ ...NOTES, title: 'Release notes 3.1.1', version: 4 });

    find(harness, 'document-delete')?.click();
    harness.detectChanges();
    await expect.poll(() => overlay('document-delete-confirm')).not.toBeNull();
    overlay('document-delete-confirm')?.click();

    await expect
      .poll(() => {
        harness.detectChanges();
        return find(harness, 'document-title')?.textContent.trim();
      })
      .toBe('Release notes 3.1.1');
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/d/d1');
    expect(toasts.error).toHaveBeenCalledWith('The document changed meanwhile', {
      description: 'It was kept. Read it again before deleting it.',
    });
  });

  it('reads the document after a lost deletion answer, and goes back once it is gone', async () => {
    const harness: RouterTestingHarness = await open();
    api.remove.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api.get.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 404, error: { status: 404, code: 'document.not-found' } }),
    );

    find(harness, 'document-delete')?.click();
    harness.detectChanges();
    await expect.poll(() => overlay('document-delete-confirm')).not.toBeNull();
    overlay('document-delete-confirm')?.click();

    await expect.poll(() => TestBed.inject(Router).url).toBe('/atelier-nord/docs');
    expect(toasts.success).toHaveBeenCalledWith('Document deleted', {
      description: 'Release notes 3.1',
    });
  });
});
