import { formatNumber, formatPercent } from '@angular/common';
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
import { CwAlert, CwAlertActions, CwAlertDescription } from '@cadenway/ui/components/alert';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { provideCwMeterLabels } from '@cadenway/ui/components/meter';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { takesSingular } from '../../../models/member/plural-form.util';
import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { SubscriptionStore } from '../../../state/subscription/subscription.store';
import { planName } from '../../../utils/plan-label';
import {
  csvDelimiter,
  csvNumber,
  saveCsvFile,
  toCsv,
  usageFileName,
} from '../../../utils/usage-csv/usage-csv.util';
import {
  type QuotaMeter,
  QuotaMeters,
  quotaZone,
  type QuotaZone,
} from '../../components/quota-meters/quota-meters.component';

/**
 * Constant GIGABYTE
 *
 * @description
 * Bytes in a gigabyte, as Billing counts quotas and the storage banner shows them.
 *
 * @type {number}
 */
const GIGABYTE: number = 1_000_000_000;

/**
 * Component QuotasPage
 *
 * @description
 * The organization settings section `Quotas and usage` (`Organisation.dc.html` lines 380-408),
 * owner only: the title with `Export usage (CSV)` and the `<plan> plan limits` card with the
 * seats and attachment storage meters (balise from 80 %, grenat from 90 %) and the guests count,
 * which has no limit in the contract. It shows only what `getBillingSubscription` serves: the
 * cycle dates, the stat tiles, the API calls, automations and webhooks meters (gap B15), the
 * storage split, `See files` with the largest files dialog (gap B16) and the alerts card are not
 * rendered. It reads the shared `SubscriptionStore` of the `/:org` route, which outlives the
 * page, so the page reads it again when it opens (`SubscriptionStore.refresh()`, which keeps the
 * figures shown meanwhile; nothing more is sent while the first read is under way). The section
 * skeleton shows until the first answer, a failed read shows the section's error panel in place
 * with `Retry` (`SubscriptionStore.retry()`), and a failed refresh keeps the figures with the note
 * `The latest usage could not be loaded.` and its own `Retry`. A `403` or `404`, after which the
 * workspace recovery leaves the section, shows nothing. The export first refreshes the figures,
 * then writes the rows shown, client side, as `<slug>-usage-<yyyy>-<mm>.csv`, and toasts its
 * outcome; when the refresh fails it writes nothing and the note shows.
 */
@Component({
  selector: 'cw-quotas-page',
  imports: [
    CwAlert,
    CwAlertActions,
    CwAlertDescription,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    NgIcon,
    QuotaMeters,
  ],
  providers: [
    provideCwMeterLabels(() => ({
      free: $localize`:@@organization.quotas.meter-free:Free`,
      unmeasured: $localize`:@@organization.quotas.meter-unmeasured:Not measured`,
      threshold: $localize`:@@organization.quotas.meter-threshold:Capacity`,
    })),
  ],
  templateUrl: './quotas-page.component.html',
})
export class QuotasPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * Plan and usage of the current organization, shared with the shell.
   *
   * @type {InstanceType<typeof SubscriptionStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof SubscriptionStore> = inject(SubscriptionStore);

  /**
   * Property skeletonRows
   *
   * @description
   * Rows of the skeleton card, one per meter.
   *
   * @type {readonly number[]}
   * @readonly
   */
  protected readonly skeletonRows: readonly number[] = [0, 1, 2];

  /**
   * Property exporting
   *
   * @description
   * Whether an export is refreshing the figures; another click meanwhile does nothing.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly exporting: WritableSignal<boolean> = signal(false);

  /**
   * Property workspace
   *
   * @description
   * Workspace context of the export's file name.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property locale
   *
   * @description
   * Application locale of the numbers and of the CSV separators.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property document
   *
   * @description
   * Document the download goes through.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property toasts
   *
   * @description
   * Toasts of the export's outcome.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property limitsTitle
   *
   * @description
   * Title of the limits card, also the export's section column (`Team plan limits`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly limitsTitle: Signal<string> = computed((): string => {
    const plan: string = planName(this.store.current()?.plan ?? '');
    return $localize`:@@organization.quotas.limits-title:${plan}:plan: plan limits`;
  });

  /**
   * Property meters
   *
   * @description
   * Rows of the limits card for the subscription read: seats, storage and guests; empty while
   * unread.
   *
   * @type {Signal<readonly QuotaMeter[]>}
   * @readonly
   */
  protected readonly meters: Signal<readonly QuotaMeter[]> = computed((): readonly QuotaMeter[] => {
    const subscription: OrganizationSubscription | null = this.store.current();
    if (subscription === null) return [];
    return [
      this.seats(subscription),
      this.storage(subscription),
      {
        id: 'guests',
        label: $localize`:@@organization.quotas.guests:Guests`,
        used: subscription.guestCount,
        limit: null,
        text: this.count(subscription.guestCount),
        note: $localize`:@@organization.quotas.guests-note:Free, limited to specific lists.`,
        zone: 'normal',
      },
    ];
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the shared subscription again, since the figures shown may date from an earlier page.
   *
   * @constructor
   */
  public constructor() {
    void this.store.refresh();
  }
  // #endregion

  // #region Methods
  /**
   * Method exportUsage
   *
   * @description
   * Downloads the usage shown as CSV (`Organisation.dc.html` lines 1943-1950): `Section`,
   * `Metric`, `Value`, `Limit` and `Usage or change`, one row per meter, the storage in
   * gigabytes, the guests without a limit or a share, and the share of the limit as it is, above
   * 100 % too (only the gauge stops at its end). Numbers use the locale's decimal separator without
   * grouping, and the cells its separator (`;` in French). The figures are read again first; when
   * that read fails nothing is written and the refresh note shows. Toasts `Export ready` with the
   * file name, or `Export not possible` when the browser refuses the download.
   *
   * @returns {Promise<void>} Resolves once the file was handed to the browser or given up.
   */
  protected async exportUsage(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    const fresh: boolean = await this.store.refresh().finally((): void => {
      this.exporting.set(false);
    });
    if (!fresh || this.store.current() === null) return;
    const section: string = this.limitsTitle();
    const rows: string[][] = [
      [
        $localize`:@@organization.quotas.csv-section:Section`,
        $localize`:@@organization.quotas.csv-metric:Metric`,
        $localize`:@@organization.quotas.csv-value:Value`,
        $localize`:@@organization.quotas.csv-limit:Limit`,
        $localize`:@@organization.quotas.csv-usage:Usage or change`,
      ],
    ];
    for (const meter of this.meters()) {
      const storage: boolean = meter.id === 'storage';
      const scale: number = storage ? GIGABYTE : 1;
      const digits: number = storage ? 1 : 0;
      rows.push([
        section,
        storage ? $localize`:@@organization.quotas.csv-storage:Storage (GB)` : meter.label,
        csvNumber(meter.used / scale, this.locale, digits),
        meter.limit === null ? '' : csvNumber(meter.limit / scale, this.locale, digits),
        meter.limit === null || meter.limit <= 0
          ? ''
          : formatPercent(meter.used / meter.limit, this.locale, '1.1-1'),
      ]);
    }
    const fileName: string = usageFileName(this.workspace.organization().slug, new Date());
    if (!saveCsvFile(this.document, fileName, toCsv(rows, csvDelimiter(this.locale)))) {
      this.toasts.error($localize`:@@organization.quotas.export-failed:Export not possible`, {
        description: $localize`:@@organization.quotas.export-failed-text:The browser blocked the download. Allow downloads for this page, then try again.`,
      });
      return;
    }
    this.toasts.success($localize`:@@organization.quotas.exported:Export ready`, {
      description: $localize`:@@organization.quotas.exported-text:${fileName}:file: downloaded.`,
    });
  }

  /**
   * Method seats
   *
   * @description
   * The seats row: `18 / 25` and `7 free seats. Guests do not take a seat.`
   * (`Organisation.dc.html` line 1629), the singular picked by `Intl.PluralRules`.
   *
   * @param {OrganizationSubscription} subscription - Plan and usage.
   * @returns {QuotaMeter} The row.
   */
  private seats(subscription: OrganizationSubscription): QuotaMeter {
    const freeSeats: number = Math.max(0, subscription.seatsLimit - subscription.seatsUsed);
    const free: string = this.count(freeSeats);
    return {
      id: 'seats',
      label: $localize`:@@organization.quotas.seats:Seats`,
      used: subscription.seatsUsed,
      limit: subscription.seatsLimit,
      text: `${this.count(subscription.seatsUsed)} / ${this.count(subscription.seatsLimit)}`,
      note: takesSingular(freeSeats)
        ? $localize`:@@organization.quotas.seats-note-one:${free}:free: free seat. Guests do not take a seat.`
        : $localize`:@@organization.quotas.seats-note:${free}:free: free seats. Guests do not take a seat.`,
      zone: quotaZone(subscription.seatsUsed, subscription.seatsLimit),
    };
  }

  /**
   * Method storage
   *
   * @description
   * The attachment storage row, in gigabytes: `92.4 GB / 100 GB`, and by zone the free room, the
   * room left before new attachments are refused, or that they will be refused beyond the limit
   * (`Organisation.dc.html` line 1630).
   *
   * @param {OrganizationSubscription} subscription - Plan and usage.
   * @returns {QuotaMeter} The row.
   */
  private storage(subscription: OrganizationSubscription): QuotaMeter {
    const used: string = this.gigabytes(subscription.storageUsedBytes);
    const limit: string = this.gigabytes(subscription.storageLimitBytes);
    const free: string = this.gigabytes(
      Math.max(0, subscription.storageLimitBytes - subscription.storageUsedBytes),
    );
    const zone: QuotaZone = quotaZone(
      subscription.storageUsedBytes,
      subscription.storageLimitBytes,
    );
    const notes: Readonly<Record<QuotaZone, string>> = {
      critical: $localize`:@@organization.quotas.storage-note-critical:Critical: beyond ${limit}:limit: GB, new attachments will be refused.`,
      high: $localize`:@@organization.quotas.storage-note-high:High: ${free}:free: GB free before new attachments are refused.`,
      normal: $localize`:@@organization.quotas.storage-note:${free}:free: GB free.`,
    };
    return {
      id: 'storage',
      label: $localize`:@@organization.quotas.storage:Storage`,
      used: subscription.storageUsedBytes,
      limit: subscription.storageLimitBytes,
      text: $localize`:@@organization.quotas.storage-value:${used}:used: GB / ${limit}:limit: GB`,
      note: notes[zone],
      zone,
    };
  }

  /**
   * Method count
   *
   * @description
   * A count in the locale (`1,234`).
   *
   * @param {number} value - The count.
   * @returns {string} The text.
   */
  private count(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  /**
   * Method gigabytes
   *
   * @description
   * Bytes as gigabytes of 10^9 bytes with at most one decimal, as the storage banner writes them.
   *
   * @param {number} bytes - The amount.
   * @returns {string} The text, without the unit.
   */
  private gigabytes(bytes: number): string {
    return formatNumber(bytes / GIGABYTE, this.locale, '1.0-1');
  }
  // #endregion
}
