import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationSwitchPendingError, readProblem } from '@core/api';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { refusedFields } from '../../data-access/adapters/organization/organization.adapter';
import { OrganizationApi } from '../../data-access/services/organization-api/organization-api.service';
import type {
  OrganizationLogoOutcome,
  OrganizationProfile,
  OrganizationSaveResult,
} from '../../models/organization/organization-profile.interface';
import { OrganizationProfileStore } from './organization-profile.store';

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
  description: null,
  website: 'https://ateliernord.fr',
  defaultLanguage: 'fr',
  logoId: null,
  initials: 'AN',
  version: 3,
};

/**
 * Function problem
 *
 * @description
 * A refused call of the gateway.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @param {Record<string, unknown>} [details] - Problem details.
 * @returns {HttpErrorResponse} The error.
 */
function problem(
  status: number,
  code: string,
  details?: Record<string, unknown>,
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: { type: 'about:blank', title: '', status, code, ...(details ? { details } : {}) },
  });
}

/**
 * Function organization
 *
 * @description
 * A workspace organization.
 *
 * @param {string} id - Identifier.
 * @param {string} slug - Address.
 * @returns {WorkspaceOrganization} The organization.
 */
function organization(id: string, slug: string): WorkspaceOrganization {
  return { id, slug, name: slug, initials: 'AN', role: 'owner', plan: 'team' };
}

/**
 * Function png
 *
 * @description
 * A picked PNG file.
 *
 * @param {number} [size] - Size in bytes.
 * @returns {File} The file.
 */
function png(size: number = 4): File {
  return new File([new Uint8Array(size)], 'logo-atelier.png', { type: 'image/png' });
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

describe('OrganizationProfileStore', () => {
  let api: Record<string, Mock>;
  let shown: WritableSignal<WorkspaceOrganization>;
  let revoked: string[];
  let createUrl: Mock;

  /**
   * Function store
   *
   * @description
   * Provides the store with the faked data access and waits for its first read.
   *
   * @returns {Promise<InstanceType<typeof OrganizationProfileStore>>} The store.
   */
  async function store(): Promise<InstanceType<typeof OrganizationProfileStore>> {
    TestBed.configureTestingModule({
      providers: [
        OrganizationProfileStore,
        { provide: OrganizationApi, useValue: api },
        { provide: WORKSPACE_CONTEXT, useValue: { organization: shown } },
      ],
    });
    const instance: InstanceType<typeof OrganizationProfileStore> =
      TestBed.inject(OrganizationProfileStore);
    await TestBed.inject(ApplicationRef).whenStable();
    return instance;
  }

  beforeEach(() => {
    let created: number = 0;
    revoked = [];
    createUrl = vi.fn(() => {
      created += 1;
      return `blob:logo-${String(created)}`;
    });
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    });
    api = {
      current: vi.fn(() => Promise.resolve(ATELIER_NORD)),
      update: vi.fn(() => Promise.resolve({ ...ATELIER_NORD, slug: 'nord', version: 4 })),
      logo: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
      reserveLogo: vi.fn(() =>
        Promise.resolve({ uploadId: 'upload-1', url: 'https://files.test', fields: {} }),
      ),
      sendLogo: vi.fn(() => Promise.resolve()),
      publishLogo: vi.fn(() => Promise.resolve()),
      removeLogo: vi.fn(() => Promise.resolve()),
      refusedFields: vi.fn((error: unknown) => refusedFields(readProblem(error)?.details ?? null)),
    };
    shown = signal(organization('org-nord', 'atelier-nord'));
  });

  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it('reads the organization', async () => {
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(instance.current()).toEqual(ATELIER_NORD);
    expect(instance.logoUrl()).toBeNull();
    expect(api['logo']).not.toHaveBeenCalled();
  });

  it('reads the logo image of an organization that has one', async () => {
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'logo-1' });
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    await expect.poll(() => instance.logoUrl()).toBe('blob:logo-1');
  });

  it('shows the initials when the logo image cannot be read', async () => {
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'logo-1' });
    api['logo'].mockRejectedValue(problem(404, 'media.not-found'));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(instance.logoUrl()).toBeNull();
    expect(instance.current()).not.toBeNull();
  });

  it('reads the organization shown again after a switch', async () => {
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    api['current'].mockResolvedValue({ ...ATELIER_NORD, id: 'org-sud', name: 'Atelier Sud' });

    shown.set(organization('org-sud', 'atelier-sud'));
    expect(instance.current()).toBeNull();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(instance.current()?.name).toBe('Atelier Sud');
  });

  it('saves a change from the version read and shows the answer', async () => {
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    const result: OrganizationSaveResult = await instance.save({ slug: 'nord' });

    expect(api['update']).toHaveBeenCalledWith({ slug: 'nord' }, 3);
    expect(result).toEqual({ outcome: 'saved' });
    expect(instance.current()?.version).toBe(4);
    expect(instance.saving()).toBe(false);
    expect(instance.movedTo()).toBe('nord');
  });

  it('reads no logo image again for a save that keeps the logo', async () => {
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'logo-1' });
    api['update'].mockResolvedValue({
      ...ATELIER_NORD,
      logoId: 'logo-1',
      name: 'Nord',
      version: 4,
    });
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    await expect.poll(() => instance.logoUrl()).toBe('blob:logo-1');

    await instance.save({ name: 'Nord' });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(api['logo']).toHaveBeenCalledTimes(1);
    expect(instance.logoUrl()).toBe('blob:logo-1');
    expect(revoked).toEqual([]);
  });

  it('aborts the read of a replaced logo and shows no image for it', async () => {
    let late: (image: Blob) => void = (): void => undefined;
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    api['logo'].mockReturnValueOnce(
      new Promise<Blob>((resolve: (image: Blob) => void) => {
        late = resolve;
      }),
    );
    api['current'].mockResolvedValueOnce({ ...ATELIER_NORD, logoId: 'logo-1', version: 4 });
    expect(await instance.uploadLogo(png())).toBe('updated');
    await expect.poll(() => api['logo'].mock.calls.length).toBe(1);

    api['current'].mockResolvedValueOnce({ ...ATELIER_NORD, logoId: 'logo-2', version: 5 });
    expect(await instance.uploadLogo(png())).toBe('updated');
    await expect.poll(() => instance.logoUrl()).toBe('blob:logo-1');
    late(new Blob(['old'], { type: 'image/png' }));
    await TestBed.inject(ApplicationRef).whenStable();

    const first: AbortSignal = (api['logo'].mock.calls[0] as [AbortSignal])[0];
    expect(first.aborted).toBe(true);
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(instance.logoUrl()).toBe('blob:logo-1');
  });

  it('sends nothing for an empty change', async () => {
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.save({})).toEqual({ outcome: 'skipped' });
    expect(api['update']).not.toHaveBeenCalled();
  });

  it('marks the save as on its way until it ends', async () => {
    let answer: (profile: OrganizationProfile) => void = (): void => undefined;
    api['update'].mockReturnValue(
      new Promise<OrganizationProfile>((resolve: (profile: OrganizationProfile) => void) => {
        answer = resolve;
      }),
    );
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    let settled: boolean = false;

    const saving: Promise<OrganizationSaveResult> = instance.save({ name: 'Nord' });
    void instance.sent().then(() => {
      settled = true;
    });
    expect(instance.saving()).toBe(true);
    expect(await instance.save({ name: 'Other' })).toEqual({ outcome: 'skipped' });
    await Promise.resolve();
    expect(settled).toBe(false);

    answer({ ...ATELIER_NORD, name: 'Nord', version: 4 });
    await saving;
    await expect.poll(() => settled).toBe(true);
    expect(instance.saving()).toBe(false);
  });

  it('keeps waiting in sent() for the save on its way after a skipped one', async () => {
    let answer: (profile: OrganizationProfile) => void = (): void => undefined;
    api['update'].mockReturnValue(
      new Promise<OrganizationProfile>((resolve: (profile: OrganizationProfile) => void) => {
        answer = resolve;
      }),
    );
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    let settled: boolean = false;

    const saving: Promise<OrganizationSaveResult> = instance.save({ name: 'Nord' });
    expect(await instance.save({ name: 'Other' })).toEqual({ outcome: 'skipped' });
    void instance.sent().then(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    answer({ ...ATELIER_NORD, name: 'Nord', version: 4 });
    await saving;
    await expect.poll(() => settled).toBe(true);
  });

  it.each([
    ['organization.slug-taken', 409, 'slug-taken'],
    ['organization.slug-reserved', 422, 'slug-reserved'],
  ])('refuses the address for %s', async (code: string, status: number, reason: string) => {
    api['update'].mockRejectedValue(problem(status, code, { slug: 'home' }));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.save({ slug: 'home' })).toEqual({
      outcome: 'refused',
      refusals: [{ field: 'slug', reason }],
    });
    expect(instance.current()).toEqual(ATELIER_NORD);
  });

  it('names the fields of a 400 request.invalid, or fails without one', async () => {
    api['update'].mockRejectedValueOnce(
      problem(400, 'request.invalid', { issues: [{ in: 'body', path: 'website' }] }),
    );
    api['update'].mockRejectedValueOnce(
      problem(400, 'request.invalid', { issues: [{ in: 'body', path: '' }] }),
    );
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.save({ website: 'ftp://atelier' })).toEqual({
      outcome: 'refused',
      refusals: [{ field: 'website', reason: 'invalid' }],
    });
    expect(await instance.save({ website: 'ftp://atelier' })).toEqual({ outcome: 'failed' });
  });

  it('reads the latest organization again after a stale version', async () => {
    api['update'].mockRejectedValue(problem(412, 'request.version-mismatch', { version: 5 }));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    api['current'].mockResolvedValue({ ...ATELIER_NORD, name: 'Atelier du Nord', version: 5 });

    expect(await instance.save({ name: 'Nord' })).toEqual({ outcome: 'outdated' });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(api['current']).toHaveBeenCalledTimes(2);
    expect(instance.current()?.name).toBe('Atelier du Nord');
  });

  it('reads nothing more when the reread after a logo change meets a switch in progress', async () => {
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    api['current'].mockRejectedValue(new OrganizationSwitchPendingError());

    expect(await instance.uploadLogo(png())).toBe('unreconciled');
    await TestBed.inject(ApplicationRef).whenStable();

    expect(api['current']).toHaveBeenCalledTimes(2);
    expect(instance.organization.status()).not.toBe('error');
    expect(instance.current()).toEqual(ATELIER_NORD);
  });

  it('keeps the last confirmed organization when the reread after a logo change fails', async () => {
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    api['current'].mockRejectedValueOnce(problem(503, 'upstream.unavailable'));

    expect(await instance.uploadLogo(png())).toBe('unreconciled');
    await TestBed.inject(ApplicationRef).whenStable();

    expect(instance.organization.status()).not.toBe('error');
    expect(instance.current()).toEqual(ATELIER_NORD);
    expect(instance.refreshFailed()).toBe(true);

    api['current'].mockResolvedValueOnce({ ...ATELIER_NORD, logoId: 'upload-1', version: 4 });
    expect(await instance.retryRefresh()).toBe(true);
    expect(instance.refreshFailed()).toBe(false);
    expect(instance.current()?.version).toBe(4);
  });

  it('ends a stale save unreconciled when its reread fails', async () => {
    api['update'].mockRejectedValue(problem(412, 'request.version-mismatch'));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    api['current'].mockRejectedValue(problem(503, 'upstream.unavailable'));

    expect(await instance.save({ name: 'Nord' })).toEqual({ outcome: 'unreconciled' });
    expect(instance.organization.status()).not.toBe('error');
    expect(instance.refreshFailed()).toBe(true);
  });

  it('forgets a failed reread for another organization', async () => {
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    api['current'].mockRejectedValueOnce(problem(503, 'upstream.unavailable'));
    await instance.uploadLogo(png());
    expect(instance.refreshFailed()).toBe(true);

    shown.set(organization('org-sud', 'atelier-sud'));

    expect(instance.refreshFailed()).toBe(false);
  });

  it.each([
    ['no answer', new HttpErrorResponse({ status: 0 })],
    ['a gateway timeout', problem(504, 'upstream.timeout')],
  ])(
    'treats a save that ends with %s as saved once the reread holds it',
    async (_case: string, error: Error) => {
      api['update'].mockRejectedValue(error);
      const instance: InstanceType<typeof OrganizationProfileStore> = await store();
      api['current'].mockResolvedValue({ ...ATELIER_NORD, slug: 'nord', version: 4 });

      expect(await instance.save({ slug: 'nord' })).toEqual({ outcome: 'saved' });
      expect(instance.current()?.version).toBe(4);
      expect(instance.movedTo()).toBe('nord');
    },
  );

  it('fails a save whose answer was lost when the reread does not hold it', async () => {
    api['update'].mockRejectedValue(new HttpErrorResponse({ status: 0 }));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.save({ slug: 'nord' })).toEqual({ outcome: 'failed' });
    expect(api['current']).toHaveBeenCalledTimes(2);
  });

  it('ends a save whose answer was lost unreconciled when the reread fails too', async () => {
    api['update'].mockRejectedValue(new HttpErrorResponse({ status: 0 }));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    api['current'].mockRejectedValue(new HttpErrorResponse({ status: 0 }));

    expect(await instance.save({ slug: 'nord' })).toEqual({ outcome: 'unreconciled' });
    expect(instance.current()).toEqual(ATELIER_NORD);
    expect(instance.refreshFailed()).toBe(true);
  });

  it('publishes the same upload once after a transfer that ended without an answer', async () => {
    api['sendLogo'].mockRejectedValue(new HttpErrorResponse({ status: 0 }));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.uploadLogo(png())).toBe('updated');
    expect(api['publishLogo']).toHaveBeenCalledTimes(1);
    expect(api['publishLogo']).toHaveBeenCalledWith('upload-1', 3);
  });

  it('fails an uncertain transfer the publication finds not ready', async () => {
    api['sendLogo'].mockRejectedValue(new HttpErrorResponse({ status: 0 }));
    api['publishLogo'].mockRejectedValue(problem(409, 'media.upload-not-ready'));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.uploadLogo(png())).toBe('failed');
    expect(api['publishLogo']).toHaveBeenCalledTimes(1);
    expect(instance.logoChange()).toBeNull();
  });

  it('fails a transfer storage refuses without publishing it', async () => {
    api['sendLogo'].mockRejectedValue(problem(403, 'storage.signature-expired'));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.uploadLogo(png())).toBe('failed');
    expect(api['reserveLogo']).toHaveBeenCalledTimes(1);
    expect(api['publishLogo']).not.toHaveBeenCalled();
  });

  it('sends nothing more once the page is gone during an upload', async () => {
    let sent: () => void = (): void => undefined;
    api['sendLogo'].mockReturnValue(
      new Promise<void>((resolve: () => void) => {
        sent = resolve;
      }),
    );
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    const changing: Promise<OrganizationLogoOutcome> = instance.uploadLogo(png());
    await expect.poll(() => api['sendLogo'].mock.calls.length).toBe(1);
    TestBed.resetTestingModule();
    sent();

    expect(await changing).toBe('cancelled');
    expect(api['publishLogo']).not.toHaveBeenCalled();
  });

  it.each([
    ['a changed organization context', problem(412, 'organization.context-changed')],
    ['a switch in progress', new OrganizationSwitchPendingError()],
  ])('leaves %s to the workspace recovery', async (_case: string, error: Error) => {
    api['update'].mockRejectedValue(error);
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.save({ name: 'Nord' })).toEqual({ outcome: 'context-changed' });
    expect(api['current']).toHaveBeenCalledTimes(1);
  });

  it('drops the answer of a save that ends after an organization switch', async () => {
    let answer: (profile: OrganizationProfile) => void = (): void => undefined;
    api['update'].mockReturnValue(
      new Promise<OrganizationProfile>((resolve: (profile: OrganizationProfile) => void) => {
        answer = resolve;
      }),
    );
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    const south: OrganizationProfile = { ...ATELIER_NORD, id: 'org-sud', name: 'Atelier Sud' };
    api['current'].mockResolvedValue(south);

    const saving: Promise<OrganizationSaveResult> = instance.save({ name: 'Nord' });
    shown.set(organization('org-sud', 'atelier-sud'));
    await TestBed.inject(ApplicationRef).whenStable();
    answer({ ...ATELIER_NORD, name: 'Nord', version: 4 });

    expect(await saving).toEqual({ outcome: 'cancelled' });
    expect(instance.current()).toEqual(south);
  });

  it('uploads a logo, publishes it from the version read and reads the organization again', async () => {
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'upload-1', version: 4 });
    const file: File = png();

    const changing: Promise<OrganizationLogoOutcome> = instance.uploadLogo(file);
    expect(instance.logoChange()).toBe('upload');
    expect(await changing).toBe('updated');

    expect(api['sendLogo']).toHaveBeenCalledWith(
      { uploadId: 'upload-1', url: 'https://files.test', fields: {} },
      file,
    );
    expect(api['publishLogo']).toHaveBeenCalledWith('upload-1', 3);
    expect(instance.current()?.version).toBe(4);
    expect(instance.logoChange()).toBeNull();
    await expect.poll(() => instance.logoUrl()).toBe('blob:logo-1');
  });

  it.each([
    ['a JPEG', new File(['x'], 'logo.jpg', { type: 'image/jpeg' }), 'unsupported'],
    ['an empty file', png(0), 'unreadable'],
    ['a file over 5 MiB', png(5 * 1024 * 1024 + 1), 'too-large'],
  ])('refuses %s before sending anything', async (_case: string, file: File, outcome: string) => {
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.uploadLogo(file)).toBe(outcome);
    expect(api['reserveLogo']).not.toHaveBeenCalled();
  });

  it.each([
    ['media.invalid-image', 422, 'invalid-image'],
    ['media.unsupported-type', 422, 'unsupported'],
    ['media.upload-superseded', 409, 'failed'],
  ])(
    'ends a refused publication %s as %s',
    async (code: string, status: number, outcome: string) => {
      api['publishLogo'].mockRejectedValue(problem(status, code));
      const instance: InstanceType<typeof OrganizationProfileStore> = await store();

      expect(await instance.uploadLogo(png())).toBe(outcome);
      expect(instance.logoChange()).toBeNull();
    },
  );

  it('sends nothing more once the organization switches during an upload', async () => {
    let sent: () => void = (): void => undefined;
    api['sendLogo'].mockReturnValue(
      new Promise<void>((resolve: () => void) => {
        sent = resolve;
      }),
    );
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    const changing: Promise<OrganizationLogoOutcome> = instance.uploadLogo(png());
    await expect.poll(() => api['sendLogo'].mock.calls.length).toBe(1);
    shown.set(organization('org-sud', 'atelier-sud'));
    sent();

    expect(await changing).toBe('cancelled');
    expect(api['publishLogo']).not.toHaveBeenCalled();
  });

  it('skips a save while a logo change runs', async () => {
    let sent: () => void = (): void => undefined;
    api['sendLogo'].mockReturnValue(
      new Promise<void>((resolve: () => void) => {
        sent = resolve;
      }),
    );
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    const changing: Promise<OrganizationLogoOutcome> = instance.uploadLogo(png());
    expect(await instance.save({ name: 'Nord' })).toEqual({ outcome: 'skipped' });
    sent();
    await changing;
  });

  it('removes the logo from the version read and revokes its image', async () => {
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'logo-1' });
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    await expect.poll(() => instance.logoUrl()).toBe('blob:logo-1');
    api['current'].mockResolvedValue({ ...ATELIER_NORD, version: 4 });

    expect(await instance.removeLogo()).toBe('removed');

    expect(api['removeLogo']).toHaveBeenCalledWith(3);
    expect(instance.logoUrl()).toBeNull();
    expect(revoked).toEqual(['blob:logo-1']);
  });

  it('reads the organization again after a stale logo removal', async () => {
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'logo-1' });
    api['removeLogo'].mockRejectedValue(problem(412, 'request.version-mismatch'));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(await instance.removeLogo()).toBe('outdated');
    await TestBed.inject(ApplicationRef).whenStable();
    expect(api['current']).toHaveBeenCalledTimes(2);
  });

  it('revokes the image shown when the page goes away', async () => {
    api['current'].mockResolvedValue({ ...ATELIER_NORD, logoId: 'logo-1' });
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();
    await expect.poll(() => instance.logoUrl()).toBe('blob:logo-1');

    TestBed.resetTestingModule();

    expect(revoked).toEqual(['blob:logo-1']);
  });

  it('exposes a failed read as the resource error', async () => {
    api['current'].mockRejectedValue(problem(503, 'upstream.unavailable'));
    const instance: InstanceType<typeof OrganizationProfileStore> = await store();

    expect(instance.organization.status()).toBe('error');
    expect(instance.current()).toBeNull();
  });
});
