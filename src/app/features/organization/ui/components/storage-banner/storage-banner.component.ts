import { formatNumber } from '@angular/common';
import {
  Component,
  computed,
  DOCUMENT,
  inject,
  LOCALE_ID,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwBanner, CwBannerActions } from '@cadenway/ui/components/banner';
import { CwButton } from '@cadenway/ui/components/button';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { SubscriptionStore } from '../../../state/subscription/subscription.store';

/**
 * Constant GIGABYTE
 *
 * @description
 * Bytes in a gigabyte, as Billing counts quotas (the Free plan's 2,000,000,000 bytes are 2 Go).
 *
 * @type {number}
 */
const GIGABYTE: number = 1_000_000_000;

/**
 * Component StorageBanner
 *
 * @description
 * The `Storage nearly full` banner across the top of the shell (mockup `App.dc.html` lines
 * 20-29): shown when attachments use at least 90 % of the organization's storage quota, with the
 * used and included gigabytes, `Later` and the close button (both hide it for this browser
 * tab's session and this organization) and `Manage quotas`, which opens
 * `/<slug>/organization/quotas`. Billing answers an owner only, so nobody else sees it. It
 * reads the `SubscriptionStore` of the `/:org` route and is a `banners` slot contribution.
 */
@Component({
  selector: 'cw-storage-banner',
  imports: [CwBanner, CwBannerActions, CwButton, RouterLink],
  templateUrl: './storage-banner.component.html',
})
export class StorageBanner {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * Plan and usage of the current organization.
   *
   * @type {InstanceType<typeof SubscriptionStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof SubscriptionStore> = inject(SubscriptionStore);

  /**
   * Property workspace
   *
   * @description
   * Workspace context of the quota address and of the dismissal.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property locale
   *
   * @description
   * Application locale of the numbers.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property storage
   *
   * @description
   * The tab's session storage, or null when unavailable.
   *
   * @type {Storage | null}
   * @readonly
   */
  private readonly storage: Storage | null = sessionStorageOf(inject(DOCUMENT));

  /**
   * Property dismissedIds
   *
   * @description
   * Organizations whose banner was hidden in this tab, including before a reload.
   *
   * @type {WritableSignal<readonly string[]>}
   * @readonly
   */
  private readonly dismissedIds: WritableSignal<readonly string[]> = signal([]);

  /**
   * Property visible
   *
   * @description
   * Whether the banner shows for the current organization.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly visible: Signal<boolean> = computed((): boolean => {
    const id: string = this.workspace.organization().id;
    return (
      this.store.storageNearlyFull() &&
      !this.dismissedIds().includes(id) &&
      this.storage?.getItem(this.key(id)) !== '1'
    );
  });

  /**
   * Property quotasLink
   *
   * @description
   * Address of the quotas section.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly quotasLink: Signal<string> = computed(
    (): string => `/${this.workspace.organization().slug}/organization/quotas`,
  );
  // #endregion

  // #region Methods
  /**
   * Method description
   *
   * @description
   * The used and included gigabytes and the consequence (`· 92.4 GB used out of 100 GB. Beyond that,
   * new attachments will be refused.`).
   *
   * @param {OrganizationSubscription} subscription - Plan and usage.
   * @returns {string} The banner's description.
   */
  protected description(subscription: OrganizationSubscription): string {
    const used: string = formatNumber(
      subscription.storageUsedBytes / GIGABYTE,
      this.locale,
      '1.0-1',
    );
    const limit: string = formatNumber(
      subscription.storageLimitBytes / GIGABYTE,
      this.locale,
      '1.0-1',
    );
    return $localize`:@@organization.storage-banner.description:· ${used}:used: GB used out of ${limit}:limit: GB. Beyond that, new attachments will be refused.`;
  }

  /**
   * Method dismiss
   *
   * @description
   * Hides the banner of the current organization for the rest of the tab's session.
   */
  protected dismiss(): void {
    const id: string = this.workspace.organization().id;
    this.dismissedIds.update((ids: readonly string[]) => [...ids, id]);
    try {
      this.storage?.setItem(this.key(id), '1');
    } catch {
      return;
    }
  }

  /**
   * Method key
   *
   * @description
   * Session storage key of an organization's dismissal.
   *
   * @param {string} organizationId - The organization.
   * @returns {string} The storage key.
   */
  private key(organizationId: string): string {
    return `cadenway-storage-banner-dismissed:${organizationId}`;
  }
  // #endregion
}

/**
 * Function sessionStorageOf
 *
 * @description
 * The document's session storage, tolerating a browser that refuses access.
 *
 * @param {Document} document - The document.
 * @returns {Storage | null} The storage, or null.
 */
function sessionStorageOf(document: Document): Storage | null {
  try {
    return document.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
}
