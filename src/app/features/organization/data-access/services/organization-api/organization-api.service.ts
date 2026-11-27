import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { OrganizationsService, ProfileMediaService } from '@cadenway/api-client';
import { firstValueFrom, fromEvent, NEVER, type Observable, takeUntil } from 'rxjs';

import { readProblem } from '@core/api';

import type {
  OrganizationField,
  OrganizationLogoUpload,
  OrganizationProfile,
  OrganizationProfileChange,
} from '../../../models/organization/organization-profile.interface';
import {
  refusedFields,
  toOrganizationLogoUpload,
  toOrganizationPatch,
  toOrganizationProfile,
} from '../../adapters/organization/organization.adapter';

/**
 * Function ifMatch
 *
 * @description
 * The `If-Match` header of a change made from a version (`"3"`).
 *
 * @param {number} version - Version the change was made from.
 * @returns {{ readonly 'If-Match': string }} The header.
 */
function ifMatch(version: number): { readonly 'If-Match': string } {
  return { 'If-Match': `"${String(version)}"` };
}

/**
 * Service OrganizationApi
 *
 * @description
 * The organization feature's access to the current organization and its logo
 * (`OrganizationsService` of `openapi/public/organizations.yaml` and the logo operations of
 * `ProfileMediaService`, `openapi/public/profile-media.yaml`), mapped to display models. The
 * writes answer the owner and administrators only and need no recent authentication; each sends
 * `If-Match` with the version it was made from, so a stale one rejects with
 * `412 request.version-mismatch`. The organization pin (`If-Organization-Match`) is added by Core's
 * interceptor.
 */
@Service()
export class OrganizationApi {
  // #region Properties
  /**
   * Property organizations
   *
   * @description
   * Generated organization operations.
   *
   * @type {OrganizationsService}
   * @readonly
   */
  private readonly organizations: OrganizationsService = inject(OrganizationsService);

  /**
   * Property media
   *
   * @description
   * Generated logo operations.
   *
   * @type {ProfileMediaService}
   * @readonly
   */
  private readonly media: ProfileMediaService = inject(ProfileMediaService);

  /**
   * Property http
   *
   * @description
   * Sends the logo bytes to the signed object-storage destination the gateway returns, without
   * application credentials; never used for the API itself.
   *
   * @type {HttpClient}
   * @readonly
   */
  private readonly http: HttpClient = inject(HttpClient);
  // #endregion

  // #region Methods
  /**
   * Method current
   *
   * @description
   * Reads the current organization of the session.
   *
   * @returns {Promise<OrganizationProfile>} The organization.
   */
  public async current(): Promise<OrganizationProfile> {
    return toOrganizationProfile(await firstValueFrom(this.organizations.getCurrentOrganization()));
  }

  /**
   * Method update
   *
   * @description
   * Changes the organization from the version it was read at. `409 organization.slug-taken`,
   * `422 organization.slug-reserved` and `400 request.invalid` refuse a field.
   *
   * @param {OrganizationProfileChange} change - What changes.
   * @param {number} version - Version the change was made from.
   * @returns {Promise<OrganizationProfile>} The organization after the change.
   */
  public async update(
    change: OrganizationProfileChange,
    version: number,
  ): Promise<OrganizationProfile> {
    return toOrganizationProfile(
      await firstValueFrom(
        this.organizations.updateCurrentOrganization(toOrganizationPatch(change), {
          headers: ifMatch(version),
        }),
      ),
    );
  }

  /**
   * Method refusedFields
   *
   * @description
   * The form fields a `400 request.invalid` refusal of `update` names in its issues.
   *
   * @param {unknown} error - The refusal.
   * @returns {readonly OrganizationField[]} The refused fields, each once; none for another error.
   */
  public refusedFields(error: unknown): readonly OrganizationField[] {
    return refusedFields(readProblem(error)?.details ?? null);
  }

  /**
   * Method logo
   *
   * @description
   * Reads the image of the current logo, a PNG whatever was uploaded; `404 media.not-found`
   * without one. Aborting the signal cancels the request, and the promise rejects with the
   * signal's reason.
   *
   * @param {AbortSignal} [signal] - Cancels the read.
   * @returns {Promise<Blob>} The image.
   */
  public async logo(signal?: AbortSignal): Promise<Blob> {
    signal?.throwIfAborted();
    const aborted: Observable<Event> = signal === undefined ? NEVER : fromEvent(signal, 'abort');
    const image: Blob | null = await firstValueFrom(
      this.media.getOrganizationLogo().pipe(takeUntil(aborted)),
      { defaultValue: null },
    );
    signal?.throwIfAborted();
    if (image === null) throw new Error('The logo read ended without an image.');
    return image;
  }

  /**
   * Method reserveLogo
   *
   * @description
   * Reserves the upload of a logo with a fresh `Idempotency-Key`.
   *
   * @param {File} file - A PNG or SVG image of at most 5 MiB.
   * @returns {Promise<OrganizationLogoUpload>} The signed destination.
   */
  public async reserveLogo(file: File): Promise<OrganizationLogoUpload> {
    return toOrganizationLogoUpload(
      await firstValueFrom(
        this.media.startOrganizationLogoUpload(
          {
            contentType: file.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/png',
            sizeBytes: file.size,
          },
          { headers: { 'Idempotency-Key': crypto.randomUUID() } },
        ),
      ),
    );
  }

  /**
   * Method sendLogo
   *
   * @description
   * Sends the image to its signed destination: every signed field unchanged, then the file.
   *
   * @param {OrganizationLogoUpload} upload - The reservation.
   * @param {File} file - The image reserved for.
   * @returns {Promise<void>} Resolves once storage accepted the transfer.
   */
  public async sendLogo(upload: OrganizationLogoUpload, file: File): Promise<void> {
    const body: FormData = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) body.append(name, value);
    body.append('file', file);
    await firstValueFrom(this.http.post(upload.url, body, { responseType: 'text' }));
  }

  /**
   * Method publishLogo
   *
   * @description
   * Publishes a sent image as the logo, from the organization's version.
   *
   * @param {string} uploadId - The reservation.
   * @param {number} version - Version of the organization.
   * @returns {Promise<void>} Resolves once the logo is the organization's.
   */
  public async publishLogo(uploadId: string, version: number): Promise<void> {
    await firstValueFrom(
      this.media.setOrganizationLogo({ uploadId }, { headers: ifMatch(version) }),
    );
  }

  /**
   * Method removeLogo
   *
   * @description
   * Removes the logo, from the organization's version.
   *
   * @param {number} version - Version of the organization.
   * @returns {Promise<void>} Resolves once the organization has no logo.
   */
  public async removeLogo(version: number): Promise<void> {
    await firstValueFrom(this.media.deleteOrganizationLogo({ headers: ifMatch(version) }));
  }
  // #endregion
}
