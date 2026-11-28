import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withErrorBoundaries } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { WORKSPACE_REFRESH } from '@features/workspace/ports/workspace-refresh';
import { unsavedChangesGuard } from '@shared/unsaved-changes';

import { OrganizationApi } from '../../../data-access/services/organization-api/organization-api.service';
import type { OrganizationProfile } from '../../../models/organization/organization-profile.interface';
import { GeneralPage } from './general-page.component';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * Atelier Nord without a logo, version 3.
 *
 * @type {OrganizationProfile}
 */
const ATELIER_NORD: OrganizationProfile = {
  id: 'org-nord',
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  description: 'Furniture design studio.',
  website: 'https://ateliernord.fr',
  defaultLanguage: 'fr',
  logoId: null,
  initials: 'AN',
  version: 3,
};

/**
 * Component OtherSection
 *
 * @description
 * Another settings section to leave the page for.
 */
@Component({ selector: 'cw-other-section', template: '<p>Members</p>' })
class OtherSection {}

/**
 * Function problem
 *
 * @description
 * A refused call of the gateway.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @returns {HttpErrorResponse} The error.
 */
function problem(status: number, code: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { type: 'about:blank', title: '', status, code } });
}

/**
 * Function byTestId
 *
 * @description
 * An element of the page by its test id.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {string} id - Test id.
 * @returns {HTMLElement | null} The element, when rendered.
 */
function byTestId(harness: RouterTestingHarness, id: string): HTMLElement | null {
  harness.detectChanges();
  return harness.routeNativeElement?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null;
}

/**
 * Function button
 *
 * @description
 * A button of the document by its text.
 *
 * @param {string} text - Visible text.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function button(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate: HTMLButtonElement) => candidate.textContent.trim() === text,
  );
}

/**
 * Function type
 *
 * @description
 * Types a value into a field, as the person does.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {string} id - Test id of the field.
 * @param {string} value - The new value.
 */
function type(harness: RouterTestingHarness, id: string, value: string): void {
  const field: HTMLInputElement | HTMLTextAreaElement | null = byTestId(harness, id) as
    HTMLInputElement | HTMLTextAreaElement | null;
  if (field === null) throw new Error(`No field ${id}`);
  field.value = value;
  field.dispatchEvent(new Event('input'));
  field.dispatchEvent(new Event('blur'));
  harness.detectChanges();
}

/**
 * Function pick
 *
 * @description
 * Picks a file in the logo input.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {File} file - The file.
 */
function pick(harness: RouterTestingHarness, file: File): void {
  const input: HTMLInputElement | null = byTestId(
    harness,
    'organization-logo-input',
  ) as HTMLInputElement | null;
  if (input === null) throw new Error('No logo input');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

/**
 * Function open
 *
 * @description
 * Opens the general section of Atelier Nord and waits for the organization.
 *
 * @param {string} [url] - The address to open.
 * @returns {Promise<RouterTestingHarness>} The harness.
 */
async function open(
  url: string = '/atelier-nord/organization/general',
): Promise<RouterTestingHarness> {
  const harness: RouterTestingHarness = await RouterTestingHarness.create(url);
  await expect
    .poll(() => (byTestId(harness, 'organization-name') as HTMLInputElement | null)?.value)
    .toBe('Atelier Nord');
  return harness;
}

/**
 * Constant createObjectURL
 *
 * @description
 * The environment's own `URL.createObjectURL`, restored after each test.
 *
 * @type {typeof URL.createObjectURL}
 */
const createObjectURL: typeof URL.createObjectURL = URL.createObjectURL.bind(URL);

/**
 * Constant revokeObjectURL
 *
 * @description
 * The environment's own `URL.revokeObjectURL`, restored after each test.
 *
 * @type {typeof URL.revokeObjectURL}
 */
const revokeObjectURL: typeof URL.revokeObjectURL = URL.revokeObjectURL.bind(URL);

describe('GeneralPage', () => {
  let api: Record<string, Mock>;
  let toasts: { success: Mock; error: Mock };
  let refresh: Mock;

  beforeEach(() => {
    refresh = vi.fn(() => Promise.resolve());
    URL.createObjectURL = vi.fn(() => 'blob:logo');
    URL.revokeObjectURL = vi.fn();
    api = {
      current: vi.fn(() => Promise.resolve(ATELIER_NORD)),
      update: vi.fn((change: Partial<OrganizationProfile>) =>
        Promise.resolve({ ...ATELIER_NORD, ...change, version: 4 }),
      ),
      logo: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
      reserveLogo: vi.fn(() =>
        Promise.resolve({ uploadId: 'upload-1', url: 'https://files.test', fields: {} }),
      ),
      sendLogo: vi.fn(() => Promise.resolve()),
      publishLogo: vi.fn(() => Promise.resolve()),
      removeLogo: vi.fn(() => Promise.resolve()),
      refusedFields: vi.fn(() => []),
    };
    toasts = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: ':org/organization/general',
              component: GeneralPage,
              canDeactivate: [unsavedChangesGuard],
            },
            { path: ':org/organization/members', component: OtherSection },
            { path: ':org/organization/billing', component: OtherSection },
          ],
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        { provide: OrganizationApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: () => ({ id: 'org-nord', slug: 'atelier-nord' }) },
        },
        { provide: WORKSPACE_REFRESH, useValue: { refresh } },
      ],
    });
  });

  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    document.body.innerHTML = '';
  });

  it('shows the loading state until the organization arrives', async () => {
    let answer: (profile: OrganizationProfile) => void = (): void => undefined;
    api['current'].mockReturnValue(
      new Promise<OrganizationProfile>((resolve: (profile: OrganizationProfile) => void) => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/organization/general',
    );

    const loading: Element | null =
      harness.routeNativeElement?.querySelector('[role="status"]') ?? null;
    expect(loading?.getAttribute('aria-label')).toBe('Loading the section');
    expect(loading?.getAttribute('aria-busy')).toBe('true');

    answer(ATELIER_NORD);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent ?? '';
      })
      .toContain('Identity');
    expect(harness.routeNativeElement?.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the saved organization and only the card the contract serves', async () => {
    const harness: RouterTestingHarness = await open();
    const text: string = harness.routeNativeElement?.textContent ?? '';

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Organization profile',
    );
    expect((byTestId(harness, 'organization-slug') as HTMLInputElement).value).toBe('atelier-nord');
    expect(text).toContain(`${location.host}/`);
    expect(byTestId(harness, 'organization-description-count')?.textContent.trim()).toBe(
      '24 / 280',
    );
    expect(byTestId(harness, 'organization-language')?.textContent).toContain('Français');
    expect(byTestId(harness, 'organization-logo-tile')?.textContent.trim()).toBe('AN');
    expect(byTestId(harness, 'organization-logo-remove')).toHaveProperty('disabled', true);
    expect(text).toContain('Import a logo');
    expect(byTestId(harness, 'organization-unsaved')).toBeNull();
    expect(button('Save')?.disabled).toBe(true);
    expect(text).not.toContain('Verified domains');
    expect(text).not.toContain('Transfer');
    expect(text).not.toContain('Delete');
  });

  it('shows the logo of an organization that has one', async () => {
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'logo-1' });
    const harness: RouterTestingHarness = await open();

    await expect
      .poll(() => byTestId(harness, 'organization-logo-tile')?.querySelector('img')?.src)
      .toBe('blob:logo');
    expect(harness.routeNativeElement?.textContent).toContain('Change logo');
    expect(byTestId(harness, 'organization-logo-remove')).toHaveProperty('disabled', false);
  });

  it('retries a failed read through the route boundary', async () => {
    api['current'].mockRejectedValueOnce(problem(503, 'upstream.unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/organization/general',
    );

    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent ?? '';
      })
      .toContain('Retry');
    button('Retry')?.click();

    await expect
      .poll(() => (byTestId(harness, 'organization-name') as HTMLInputElement | null)?.value)
      .toBe('Atelier Nord');
    expect(api['current']).toHaveBeenCalledTimes(2);
  });

  it('shows the unsaved changes, which Cancel drops', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'organization-name', 'Atelier du Nord');
    expect(byTestId(harness, 'organization-unsaved')?.textContent).toContain('Unsaved changes');
    expect(button('Save')?.disabled).toBe(false);

    button('Cancel')?.click();
    harness.detectChanges();

    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Atelier Nord');
    expect(byTestId(harness, 'organization-unsaved')).toBeNull();
  });

  it('typing a value back leaves nothing to save', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'organization-website', 'https://nord.example');
    type(harness, 'organization-website', 'https://ateliernord.fr');

    expect(byTestId(harness, 'organization-unsaved')).toBeNull();
  });

  it('saves only the changed members, trimmed and cleared, and toasts it', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'organization-name', '  Atelier du Nord ');
    type(harness, 'organization-description', '   ');
    button('Save')?.click();

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(api['update']).toHaveBeenCalledWith({ name: 'Atelier du Nord', description: null }, 3);
    expect(toasts.success).toHaveBeenCalledWith('Organization updated', {
      description: 'Members see the new name and address.',
    });
    harness.detectChanges();
    expect(byTestId(harness, 'organization-unsaved')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/general');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('counts the description as it is sent and links the count to the field', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'organization-description', '  Studio  ');

    expect(byTestId(harness, 'organization-description-count')?.textContent.trim()).toBe('6 / 280');
    expect(
      byTestId(harness, 'organization-description')?.getAttribute('aria-describedby'),
    ).toContain('organization-description-count');
  });

  it('shows the errors of an invalid submit and focuses the first', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'organization-name', ' ');
    type(harness, 'organization-website', 'ftp://ateliernord.fr');
    button('Save')?.click();

    await expect
      .poll(() => byTestId(harness, 'organization-name-error')?.textContent.trim())
      .toBe('Enter the name of the organization.');
    expect(byTestId(harness, 'organization-website-error')?.textContent).toContain(
      'Enter a full address starting with https://',
    );
    expect(document.activeElement).toBe(byTestId(harness, 'organization-name'));
    expect(api['update']).not.toHaveBeenCalled();
  });

  it('refuses an address that does not match the slug rule', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'organization-slug', 'Atelier--Nord');
    button('Save')?.click();

    await expect
      .poll(() => byTestId(harness, 'organization-slug-error')?.textContent.trim())
      .toBe('Use 2 to 63 lowercase letters, digits and single dashes.');
  });

  it('opens the section at the new address after a slug change, keeping the query', async () => {
    const harness: RouterTestingHarness = await open(
      '/atelier-nord/organization/general?from=menu',
    );

    type(harness, 'organization-slug', 'nord');
    button('Save')?.click();

    await expect
      .poll(() => TestBed.inject(Router).url)
      .toBe('/nord/organization/general?from=menu');
    expect(api['update']).toHaveBeenCalledWith({ slug: 'nord' }, 3);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('redirects a navigation started during a slug change below the new address', async () => {
    let answer: (profile: OrganizationProfile) => void = (): void => undefined;
    api['update'].mockReturnValue(
      new Promise<OrganizationProfile>((resolve: (profile: OrganizationProfile) => void) => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await open();
    type(harness, 'organization-slug', 'nord');
    button('Save')?.click();
    await expect.poll(() => api['update'].mock.calls.length).toBe(1);

    void TestBed.inject(Router).navigateByUrl('/atelier-nord/organization/members?tab=all');
    await Promise.resolve();
    answer({ ...ATELIER_NORD, slug: 'nord', version: 4 });

    await expect.poll(() => TestBed.inject(Router).url).toBe('/nord/organization/members?tab=all');
  });

  it('lets a navigation to another organization started during a slug change go', async () => {
    let answer: (profile: OrganizationProfile) => void = (): void => undefined;
    api['update'].mockReturnValue(
      new Promise<OrganizationProfile>((resolve: (profile: OrganizationProfile) => void) => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await open();
    type(harness, 'organization-slug', 'nord');
    button('Save')?.click();
    await expect.poll(() => api['update'].mock.calls.length).toBe(1);

    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl(
      '/lumen/organization/billing',
    );
    await Promise.resolve();
    answer({ ...ATELIER_NORD, slug: 'nord', version: 4 });

    expect(await leaving).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/lumen/organization/billing');
  });

  it('opens the new address a reread brings, keeping the draft without asking', async () => {
    const harness: RouterTestingHarness = await open();
    api['current'].mockResolvedValue({
      ...ATELIER_NORD,
      slug: 'nord-lyon',
      logoId: 'upload-1',
      version: 4,
    });
    type(harness, 'organization-name', 'Nord');

    pick(harness, new File(['png'], 'logo.png', { type: 'image/png' }));

    await expect.poll(() => TestBed.inject(Router).url).toBe('/nord-lyon/organization/general');
    expect(button('Discard')).toBeUndefined();
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');
  });

  it.each([
    ['organization.slug-taken', 409, 'This address is already used by another organization.'],
    ['organization.slug-reserved', 422, 'This address is reserved: choose another one.'],
  ])('shows %s on the address', async (code: string, status: number, message: string) => {
    api['update'].mockRejectedValue(problem(status, code));
    const harness: RouterTestingHarness = await open();

    type(harness, 'organization-slug', 'home');
    button('Save')?.click();

    await expect
      .poll(() => byTestId(harness, 'organization-slug-error')?.textContent.trim())
      .toBe(message);
    expect(document.activeElement).toBe(byTestId(harness, 'organization-slug'));
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/general');
  });

  it('keeps the edits and takes the other fields of the latest version after a stale version', async () => {
    api['update'].mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    const harness: RouterTestingHarness = await open();
    api['current'].mockResolvedValue({
      ...ATELIER_NORD,
      name: 'Atelier Nord Lyon',
      website: 'https://nord.example',
      version: 5,
    });

    type(harness, 'organization-name', 'Nord');
    button('Save')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('The organization changed in the meantime', {
      description:
        'Its latest version shows where you changed nothing: check your edits, then save.',
    });
    await expect
      .poll(() => (byTestId(harness, 'organization-website') as HTMLInputElement).value)
      .toBe('https://nord.example');
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');

    button('Save')?.click();
    await expect.poll(() => api['update'].mock.calls.length).toBe(2);
    expect(api['update']).toHaveBeenLastCalledWith({ name: 'Nord' }, 5);
  });

  it('keeps the edits and toasts a refused save', async () => {
    api['update'].mockRejectedValue(problem(503, 'upstream.unavailable'));
    const harness: RouterTestingHarness = await open();

    type(harness, 'organization-name', 'Nord');
    button('Save')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('The organization could not be saved');
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');
    expect(byTestId(harness, 'organization-unsaved')).not.toBeNull();
  });

  it('keeps the edits silently when the organization context changed', async () => {
    api['update'].mockRejectedValue(problem(412, 'organization.context-changed'));
    const harness: RouterTestingHarness = await open();

    type(harness, 'organization-name', 'Nord');
    button('Save')?.click();

    await expect.poll(() => api['update'].mock.calls.length).toBe(1);
    await harness.fixture.whenStable();
    expect(toasts.error).not.toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');
  });

  it('shows nothing selected for a language this version does not know and sends none', async () => {
    api['current'].mockResolvedValue({ ...ATELIER_NORD, defaultLanguage: null });
    const harness: RouterTestingHarness = await open();

    expect(byTestId(harness, 'organization-language')?.textContent).toContain('Choose a language');
    type(harness, 'organization-name', 'Nord');
    button('Save')?.click();

    await expect.poll(() => api['update'].mock.calls.length).toBe(1);
    expect(api['update']).toHaveBeenCalledWith({ name: 'Nord' }, 3);
  });

  it('uploads a picked logo and toasts its file name', async () => {
    const harness: RouterTestingHarness = await open();
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'upload-1', version: 4 });

    pick(harness, new File(['png'], 'logo-atelier.png', { type: 'image/png' }));

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(toasts.success).toHaveBeenCalledWith('Logo updated', {
      description: 'logo-atelier.png shows in the sidebar and emails.',
    });
    expect(api['publishLogo']).toHaveBeenCalledWith('upload-1', 3);
    await expect
      .poll(() => byTestId(harness, 'organization-logo-tile')?.querySelector('img')?.src)
      .toBe('blob:logo');
  });

  it('toasts a file that is neither PNG nor SVG without sending it', async () => {
    const harness: RouterTestingHarness = await open();

    pick(harness, new File(['jpg'], 'logo.jpg', { type: 'image/jpeg' }));

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('Unsupported format', {
      description: 'Choose a PNG or SVG image.',
    });
    expect(api['reserveLogo']).not.toHaveBeenCalled();
  });

  it('toasts an image storage refuses', async () => {
    api['publishLogo'].mockRejectedValue(problem(422, 'media.invalid-image'));
    const harness: RouterTestingHarness = await open();

    pick(harness, new File(['png'], 'wide.png', { type: 'image/png' }));

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('Image refused', {
      description: 'Choose a square still image of 4,096 px per side at most.',
    });
  });

  it('removes the logo and toasts the initials shown instead', async () => {
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'logo-1' });
    const harness: RouterTestingHarness = await open();
    api['current'].mockResolvedValue({ ...ATELIER_NORD, version: 4 });

    byTestId(harness, 'organization-logo-remove')?.click();

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(toasts.success).toHaveBeenCalledWith('Logo removed', {
      description: 'The initials AN show instead.',
    });
    expect(api['removeLogo']).toHaveBeenCalledWith(3);
    await expect
      .poll(() => byTestId(harness, 'organization-logo-tile')?.textContent.trim())
      .toBe('AN');
  });

  it('takes a field someone else changed during a logo change and keeps the edits', async () => {
    const harness: RouterTestingHarness = await open();
    api['current'].mockResolvedValue({
      ...ATELIER_NORD,
      website: 'https://nord.example',
      logoId: 'upload-1',
      version: 4,
    });
    type(harness, 'organization-name', 'Nord');

    pick(harness, new File(['png'], 'logo.png', { type: 'image/png' }));
    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);

    expect(toasts.success).toHaveBeenCalledWith('Logo updated', expect.anything());
    expect((byTestId(harness, 'organization-website') as HTMLInputElement).value).toBe(
      'https://nord.example',
    );
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');
    expect(document.activeElement).toBe(byTestId(harness, 'organization-logo-input'));
  });

  it('toasts the conflict instead of the logo when a refresh collides with an edit', async () => {
    const harness: RouterTestingHarness = await open();
    api['current'].mockResolvedValue({
      ...ATELIER_NORD,
      name: 'Atelier Nord Lyon',
      logoId: 'upload-1',
      version: 4,
    });
    type(harness, 'organization-name', 'Nord');

    pick(harness, new File(['png'], 'logo.png', { type: 'image/png' }));
    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);

    expect(toasts.error).toHaveBeenCalledWith(
      'The organization changed in the meantime',
      expect.anything(),
    );
    expect(toasts.success).not.toHaveBeenCalled();
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');
  });

  it('toasts the conflict for a field edited while the upload ran', async () => {
    let published: () => void = (): void => undefined;
    api['publishLogo'].mockReturnValue(
      new Promise<void>((resolve: () => void) => {
        published = resolve;
      }),
    );
    const harness: RouterTestingHarness = await open();
    pick(harness, new File(['png'], 'logo.png', { type: 'image/png' }));
    await expect.poll(() => api['publishLogo'].mock.calls.length).toBe(1);

    type(harness, 'organization-name', 'Nord');
    api['current'].mockResolvedValue({
      ...ATELIER_NORD,
      name: 'Atelier Nord Lyon',
      logoId: 'upload-1',
      version: 4,
    });
    published();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith(
      'The organization changed in the meantime',
      expect.anything(),
    );
    expect(toasts.success).not.toHaveBeenCalled();
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');
  });

  it('keeps the draft and offers Retry when the reread after a logo change fails', async () => {
    const harness: RouterTestingHarness = await open();
    type(harness, 'organization-name', 'Nord');
    api['current'].mockRejectedValueOnce(problem(503, 'upstream.unavailable'));

    pick(harness, new File(['png'], 'logo.png', { type: 'image/png' }));

    await expect
      .poll(() => byTestId(harness, 'organization-refresh-failed')?.textContent ?? '')
      .toContain('could not be loaded');
    expect(toasts.success).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.textContent).not.toContain('Could not load this section');
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');

    api['current'].mockResolvedValue({
      ...ATELIER_NORD,
      website: 'https://nord.example',
      logoId: 'upload-1',
      version: 4,
    });
    byTestId(harness, 'organization-refresh-retry')?.click();

    await expect.poll(() => byTestId(harness, 'organization-refresh-failed')).toBeNull();
    expect((byTestId(harness, 'organization-website') as HTMLInputElement).value).toBe(
      'https://nord.example',
    );
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');
  });

  it('treats a save whose answer was lost as saved once the reread holds it', async () => {
    api['update'].mockRejectedValue(new HttpErrorResponse({ status: 0 }));
    const harness: RouterTestingHarness = await open();
    api['current'].mockResolvedValue({ ...ATELIER_NORD, slug: 'nord', version: 4 });

    type(harness, 'organization-slug', 'nord');
    button('Save')?.click();

    await expect.poll(() => TestBed.inject(Router).url).toBe('/nord/organization/general');
    expect(toasts.success).toHaveBeenCalledWith('Organization updated', expect.anything());
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('keeps the logo actions focusable but inert while a save runs', async () => {
    let answer: (profile: OrganizationProfile) => void = (): void => undefined;
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'logo-1' });
    api['update'].mockReturnValue(
      new Promise<OrganizationProfile>((resolve: (profile: OrganizationProfile) => void) => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await open();
    type(harness, 'organization-name', 'Nord');
    button('Save')?.click();
    await expect.poll(() => api['update'].mock.calls.length).toBe(1);
    harness.detectChanges();

    const remove: HTMLButtonElement | null = byTestId(
      harness,
      'organization-logo-remove',
    ) as HTMLButtonElement | null;
    const input: HTMLElement | null = byTestId(harness, 'organization-logo-input');
    expect(remove?.disabled).toBe(false);
    expect(remove?.getAttribute('aria-disabled')).toBe('true');
    expect(input?.getAttribute('aria-disabled')).toBe('true');
    remove?.click();
    const click: MouseEvent = new MouseEvent('click', { cancelable: true });
    input?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(api['removeLogo']).not.toHaveBeenCalled();

    answer({ ...ATELIER_NORD, logoId: 'logo-1', name: 'Nord', version: 4 });
    await expect
      .poll(() => byTestId(harness, 'organization-logo-remove')?.getAttribute('aria-disabled'))
      .toBeNull();
  });

  it('keeps the edits through a logo change', async () => {
    const harness: RouterTestingHarness = await open();
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'upload-1', version: 4 });
    type(harness, 'organization-name', 'Nord');

    pick(harness, new File(['png'], 'logo.png', { type: 'image/png' }));
    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    harness.detectChanges();

    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');
    button('Save')?.click();
    await expect.poll(() => api['update'].mock.calls.length).toBe(1);
    expect(api['update']).toHaveBeenCalledWith({ name: 'Nord' }, 4);
  });

  it('asks before leaving with unsaved changes', async () => {
    const harness: RouterTestingHarness = await open();
    type(harness, 'organization-name', 'Nord');

    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl(
      '/atelier-nord/organization/members',
    );
    await expect.poll(() => button('Discard')).toBeDefined();
    button('Discard')?.click();

    expect(await leaving).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/members');
  });

  it('waits for a save on its way instead of offering to discard it, then leaves once saved', async () => {
    let answer: (profile: OrganizationProfile) => void = (): void => undefined;
    api['update'].mockReturnValue(
      new Promise<OrganizationProfile>((resolve: (profile: OrganizationProfile) => void) => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await open();
    type(harness, 'organization-name', 'Nord');
    button('Save')?.click();
    await expect.poll(() => api['update'].mock.calls.length).toBe(1);

    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl(
      '/atelier-nord/organization/members',
    );
    await Promise.resolve();
    expect(button('Discard')).toBeUndefined();
    answer({ ...ATELIER_NORD, name: 'Nord', version: 4 });

    expect(await leaving).toBe(true);
    expect(button('Discard')).toBeUndefined();
  });

  it('asks once the save on its way is refused', async () => {
    let refuse: (error: unknown) => void = (): void => undefined;
    api['update'].mockReturnValue(
      new Promise<OrganizationProfile>(
        (_resolve: (profile: OrganizationProfile) => void, reject: (error: unknown) => void) => {
          refuse = reject;
        },
      ),
    );
    const harness: RouterTestingHarness = await open();
    type(harness, 'organization-name', 'Nord');
    button('Save')?.click();
    await expect.poll(() => api['update'].mock.calls.length).toBe(1);

    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl(
      '/atelier-nord/organization/members',
    );
    await Promise.resolve();
    expect(button('Discard')).toBeUndefined();
    refuse(problem(503, 'upstream.unavailable'));

    await expect.poll(() => button('Keep editing')).toBeDefined();
    button('Keep editing')?.click();
    expect(await leaving).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/organization/general');
    expect((byTestId(harness, 'organization-name') as HTMLInputElement).value).toBe('Nord');
  });
});
