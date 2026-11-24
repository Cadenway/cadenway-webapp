import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  InvitationsService,
  type JoinedOrganization,
  type MyOrganizationPage,
  type Organization,
  type OrganizationCreated,
  OrganizationsService,
  ProfileMediaService,
  type ProfileMediaUpload,
  type ReceivedInvitation as ReceivedInvitationDto,
  type ReceivedInvitationPage,
} from '@cadenway/api-client';
import { firstValueFrom, from } from 'rxjs';

import { readProblem } from '@core/api';

import type {
  OrganizationChoice,
  OrganizationDraft,
  ReceivedInvitation,
} from '../../../models/organization/organization.interface';
import { withSessionLock } from '../../../services/session-lock/session-lock.service';
import {
  organizationChoice,
  receivedInvitation,
} from '../../adapters/organization/organization.adapter';

/**
 * Constant MEMBERSHIP_ATTEMPTS
 *
 * @description
 * Attempts of a session switch to an organization the caller has just created or joined: the
 * membership takes a few seconds to reach identity-service, which answers `404` meanwhile.
 *
 * @type {number}
 */
const MEMBERSHIP_ATTEMPTS: number = 5;

/**
 * Constant RETRY_DELAY_MS
 *
 * @description
 * Delay between two attempts of a call the contract asks to retry, in milliseconds.
 *
 * @type {number}
 */
const RETRY_DELAY_MS: number = 1_000;

/**
 * Function delay
 *
 * @description
 * Waits before a retried call.
 *
 * @param {number} milliseconds - Delay.
 * @returns {Promise<void>} Resolves after the delay.
 */
function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Function retryOn
 *
 * @description
 * Repeats a call while it fails with a given status and code, up to a number of attempts.
 *
 * @template T
 * @param {() => Promise<T>} call - The call to repeat.
 * @param {(status: number, code: string | null) => boolean} retryable - Which failures to retry.
 * @param {number} attempts - Total attempts.
 * @returns {Promise<T>} The first success, or the last failure.
 */
async function retryOn<T>(
  call: () => Promise<T>,
  retryable: (status: number, code: string | null) => boolean,
  attempts: number,
): Promise<T> {
  for (let attempt: number = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error: unknown) {
      const problem: ReturnType<typeof readProblem> = readProblem(error);
      if (attempt >= attempts || problem === null || !retryable(problem.status, problem.code)) {
        throw error;
      }
      await delay(RETRY_DELAY_MS);
    }
  }
}

/**
 * Service OrganizationApi
 *
 * @description
 * The organization chooser's access to the gateway: the caller's organizations and received
 * invitations, the session's current organization, the creation and its logo upload. A session
 * switch runs under the exclusive session lock.
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
   * Property invitations
   *
   * @description
   * Generated invitation operations.
   *
   * @type {InvitationsService}
   * @readonly
   */
  private readonly invitations: InvitationsService = inject(InvitationsService);

  /**
   * Property media
   *
   * @description
   * Generated logo upload operations.
   *
   * @type {ProfileMediaService}
   * @readonly
   */
  private readonly media: ProfileMediaService = inject(ProfileMediaService);

  /**
   * Property http
   *
   * @description
   * Sends the logo bytes to the signed object-storage destination the gateway returns; never used
   * for the API itself.
   *
   * @type {HttpClient}
   * @readonly
   */
  private readonly http: HttpClient = inject(HttpClient);
  // #endregion

  // #region Methods
  /**
   * Method listMine
   *
   * @description
   * Lists every organization of the caller, following the pages, sorted as the gateway sorts them.
   *
   * @returns {Promise<readonly OrganizationChoice[]>} The organizations.
   */
  public async listMine(): Promise<readonly OrganizationChoice[]> {
    const items: OrganizationChoice[] = [];
    let cursor: string | undefined;
    do {
      const page: MyOrganizationPage = await firstValueFrom(
        this.organizations.listMyOrganizations({ cursor, limit: 100 }),
      );
      items.push(...page.items.map(organizationChoice));
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    return items;
  }

  /**
   * Method listReceivedInvitations
   *
   * @description
   * Lists the pending invitations addressed to the caller, most recent first.
   *
   * @returns {Promise<readonly ReceivedInvitation[]>} The invitations.
   */
  public async listReceivedInvitations(): Promise<readonly ReceivedInvitation[]> {
    const items: ReceivedInvitation[] = [];
    let cursor: string | undefined;
    do {
      const page: ReceivedInvitationPage = await firstValueFrom(
        this.invitations.listReceivedInvitations({ cursor, limit: 100 }),
      );
      items.push(
        ...page.items.map((item: ReceivedInvitationDto): ReceivedInvitation =>
          receivedInvitation(item),
        ),
      );
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    return items;
  }

  /**
   * Method acceptInvitation
   *
   * @description
   * Joins the organization of an invitation. The session does not move to it.
   *
   * @param {string} invitationId - Invitation identifier.
   * @returns {Promise<OrganizationChoice>} The joined organization.
   */
  public async acceptInvitation(invitationId: string): Promise<OrganizationChoice> {
    const joined: JoinedOrganization = await firstValueFrom(
      this.invitations.acceptInvitation(invitationId, {}),
    );
    return organizationChoice(joined);
  }

  /**
   * Method refuseInvitation
   *
   * @description
   * Refuses an invitation for good: it leaves both lists.
   *
   * @param {string} invitationId - Invitation identifier.
   * @returns {Promise<void>} Resolves once refused.
   */
  public async refuseInvitation(invitationId: string): Promise<void> {
    await firstValueFrom(this.invitations.refuseInvitation(invitationId, {}));
  }

  /**
   * Method choose
   *
   * @description
   * Makes an organization the current one of the session. For an organization just created or
   * joined, a `404` is retried for a few seconds while the membership propagates.
   *
   * @param {string} organizationId - Organization identifier.
   * @param {boolean} justJoined - Whether the caller has just created or joined it.
   * @returns {Promise<void>} Resolves once the session moved.
   */
  public async choose(organizationId: string, justJoined: boolean = false): Promise<void> {
    await retryOn(
      () =>
        firstValueFrom(
          withSessionLock(() => this.organizations.switchOrganization({ organizationId })),
        ),
      (status: number) => status === 404,
      justJoined ? MEMBERSHIP_ATTEMPTS : 1,
    );
  }

  /**
   * Method current
   *
   * @description
   * Reads the session's current organization; `403 organization.not-selected` or `404` reject
   * when the caller still has to choose.
   *
   * @returns {Promise<{ readonly id: string; readonly slug: string }>} Its id and address.
   */
  public async current(): Promise<{ readonly id: string; readonly slug: string }> {
    const organization: Organization = await firstValueFrom(
      this.organizations.getCurrentOrganization({ cache: 'no-store' }),
    );
    return { id: organization.id, slug: organization.slug };
  }

  /**
   * Method create
   *
   * @description
   * Creates an organization owned by the caller, its address derived from the name by the
   * gateway, and invites the given addresses as members. A `404 user.not-synchronized` is retried
   * once after a second, as the contract asks.
   *
   * @param {OrganizationDraft} draft - The submitted form.
   * @returns {Promise<OrganizationChoice>} The created organization.
   */
  public async create(draft: OrganizationDraft): Promise<OrganizationChoice> {
    const created: OrganizationCreated = await retryOn(
      () =>
        firstValueFrom(
          this.organizations.createOrganization({
            name: draft.name,
            teamSize: draft.teamSize,
            primaryUse: draft.primaryUse,
            ...(draft.inviteEmails.length > 0 ? { inviteEmails: [...draft.inviteEmails] } : {}),
          }),
        ),
      (status: number, code: string | null) => status === 404 && code === 'user.not-synchronized',
      2,
    );
    return organizationChoice(created.organization);
  }

  /**
   * Method enterCreated
   *
   * @description
   * Moves the session to an organization the caller has just created and uploads its logo, all
   * under one exclusive session lock, so no other tab can switch the session in between and send
   * the logo to another organization. The switch retries its `404` for a few seconds while the
   * membership propagates. Before uploading, the session's current organization is read again and
   * must be the created one; a logo that cannot be uploaded never undoes the creation.
   *
   * @param {string} organizationId - The created organization.
   * @param {File | null} logo - A PNG or SVG image of at most 5 MiB, or null.
   * @returns {Promise<{ readonly logoFailed: boolean }>} Whether a chosen logo was not uploaded;
   * rejects when the session could not move to the organization.
   */
  public async enterCreated(
    organizationId: string,
    logo: File | null,
  ): Promise<{ readonly logoFailed: boolean }> {
    return firstValueFrom(
      withSessionLock(() => from(this.enterCreatedUnlocked(organizationId, logo))),
    );
  }

  /**
   * Method enterCreatedUnlocked
   *
   * @description
   * The sequence of `enterCreated`, run while the caller holds the exclusive session lock.
   *
   * @param {string} organizationId - The created organization.
   * @param {File | null} logo - The logo, or null.
   * @returns {Promise<{ readonly logoFailed: boolean }>} Whether a chosen logo was not uploaded.
   */
  private async enterCreatedUnlocked(
    organizationId: string,
    logo: File | null,
  ): Promise<{ readonly logoFailed: boolean }> {
    await retryOn(
      () => firstValueFrom(this.organizations.switchOrganization({ organizationId })),
      (status: number) => status === 404,
      MEMBERSHIP_ATTEMPTS,
    );
    if (logo === null) return { logoFailed: false };
    try {
      if ((await this.current()).id !== organizationId) return { logoFailed: true };
      await this.uploadLogo(logo);
      return { logoFailed: false };
    } catch {
      return { logoFailed: true };
    }
  }

  /**
   * Method uploadLogo
   *
   * @description
   * Uploads the logo of the session's current organization: reserves an upload, sends the bytes to
   * the signed form destination, then publishes the verified reservation. The caller must be its
   * owner or an admin, and the session must already be in it.
   *
   * @param {File} logo - A PNG or SVG image of at most 5 MiB.
   * @returns {Promise<void>} Resolves once the logo is published.
   */
  private async uploadLogo(logo: File): Promise<void> {
    const upload: ProfileMediaUpload = await firstValueFrom(
      this.media.startOrganizationLogoUpload(
        {
          contentType: logo.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/png',
          sizeBytes: logo.size,
        },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      ),
    );
    const body: FormData = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) body.append(name, value);
    body.append('file', logo);
    await firstValueFrom(this.http.post(upload.url, body, { responseType: 'text' }));
    await firstValueFrom(this.media.setOrganizationLogo({ uploadId: upload.uploadId }));
  }
  // #endregion
}
