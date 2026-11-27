import {
  booleanAttribute,
  Component,
  type ElementRef,
  inject,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
  type Signal,
  viewChild,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import {
  CwTable,
  CwTableBody,
  CwTableCell,
  CwTableContainer,
  CwTableHead,
  CwTableHeader,
  CwTableRow,
} from '@cadenway/ui/components/table';
import { CwTooltip } from '@cadenway/ui/components/tooltip';
import { NgIcon } from '@ng-icons/core';

import { invoiceAmount, invoicePeriod } from '../../../models/invoice/invoice-format.util';
import type {
  KnownInvoiceStatus,
  OrganizationInvoice,
} from '../../../models/invoice/invoice.interface';

/**
 * Interface InvoiceStatusView
 *
 * @description
 * How a status shows: its word, its icon and the icon's tone.
 */
interface InvoiceStatusView {
  // #region Properties
  /**
   * Property label
   *
   * @description
   * The status word.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property icon
   *
   * @description
   * Phosphor icon name.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property tone
   *
   * @description
   * Literal Tailwind class of the icon's colour.
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;
  // #endregion
}

/**
 * Constant STATUS_VIEWS
 *
 * @description
 * The statuses Billing reports today. `Paid` is the mockup's (jade check, line 1911).
 *
 * @type {Readonly<Record<KnownInvoiceStatus, InvoiceStatusView>>}
 */
const STATUS_VIEWS: Readonly<Record<KnownInvoiceStatus, InvoiceStatusView>> = {
  paid: {
    label: $localize`:@@organization.billing.status-paid:Paid`,
    icon: 'phosphorCheckCircleFill',
    tone: 'text-jade',
  },
  open: {
    label: $localize`:@@organization.billing.status-open:Awaiting payment`,
    icon: 'phosphorClockBold',
    tone: 'text-balise',
  },
  uncollectible: {
    label: $localize`:@@organization.billing.status-uncollectible:Uncollectible`,
    icon: 'phosphorWarningCircleFill',
    tone: 'text-destructive',
  },
  void: {
    label: $localize`:@@organization.billing.status-void:Void`,
    icon: 'phosphorMinusCircleFill',
    tone: 'text-muted-foreground',
  },
};

/**
 * Component InvoicesTable
 *
 * @description
 * The `Invoices` table of the `Billing` section (mockup `Organisation.dc.html` lines 360-376):
 * `Number`, `Period`, `Amount`, `Status` and the PDF link, labelled `Download invoice <number> as
 * PDF`, which opens Stripe's PDF in a new tab when the invoice has one. The period names its
 * months in UTC and the amount follows the invoice's currency, both in `LOCALE_ID`. A status a
 * later contract adds shows its key. While a page is read the rows give way to skeleton rows; a
 * completed page without invoices shows `No invoices yet`. `Previous` and `Next` emit
 * `previousPage` and `nextPage` and move the focus to the table's caption (`Invoices`), since the
 * pressed button is disabled while the page is read; the pagination stays while `paged`. Below
 * 768 px the rows become cards: the header row is hidden, the number takes the full width and the
 * link goes to the right.
 */
@Component({
  selector: 'cw-invoices-table',
  imports: [
    CwButton,
    CwEmpty,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    CwTable,
    CwTableBody,
    CwTableCell,
    CwTableContainer,
    CwTableHead,
    CwTableHeader,
    CwTableRow,
    CwTooltip,
    NgIcon,
  ],
  host: { class: 'flex flex-col gap-3' },
  templateUrl: './invoices-table.component.html',
})
export class InvoicesTable {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * Invoices of the page shown.
   *
   * @type {InputSignal<readonly OrganizationInvoice[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly OrganizationInvoice[]> =
    input.required<readonly OrganizationInvoice[]>();

  /**
   * Property loading
   *
   * @description
   * Whether the page shown is being read.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly loading: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property hasPrevious
   *
   * @description
   * Whether a page comes before.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly hasPrevious: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property hasNext
   *
   * @description
   * Whether a page comes after.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly hasNext: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property paged
   *
   * @description
   * Whether the pagination shows. The page keeps it true while a page it opened is read, so the
   * buttons do not disappear under the keyboard focus.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly paged: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property previousPage
   *
   * @description
   * Emits when `Previous` is pressed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly previousPage: OutputEmitterRef<void> = output();

  /**
   * Property nextPage
   *
   * @description
   * Emits when `Next` is pressed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly nextPage: OutputEmitterRef<void> = output();

  /**
   * Property skeleton
   *
   * @description
   * Skeleton rows shown while a page is read, as many as the mockup's invoices.
   *
   * @type {readonly number[]}
   * @readonly
   */
  protected readonly skeleton: readonly number[] = [0, 1, 2, 3];

  /**
   * Property caption
   *
   * @description
   * The table's caption, which takes the focus after a page change: the pressed button is
   * disabled while the page is read, which would drop the focus to the document.
   *
   * @type {Signal<ElementRef<HTMLElement>>}
   * @readonly
   */
  private readonly caption: Signal<ElementRef<HTMLElement>> =
    viewChild.required<ElementRef<HTMLElement>>('caption');

  /**
   * Property locale
   *
   * @description
   * Locale of the periods and amounts.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);
  // #endregion

  // #region Methods
  /**
   * Method openPrevious
   *
   * @description
   * Asks for the previous page and moves the focus to the table's caption.
   */
  protected openPrevious(): void {
    this.previousPage.emit();
    this.caption().nativeElement.focus();
  }

  /**
   * Method openNext
   *
   * @description
   * Asks for the next page and moves the focus to the table's caption.
   */
  protected openNext(): void {
    this.nextPage.emit();
    this.caption().nativeElement.focus();
  }

  /**
   * Method period
   *
   * @description
   * The invoiced period (`November 2026`).
   *
   * @param {OrganizationInvoice} invoice - The invoice.
   * @returns {string} The period.
   */
  protected period(invoice: OrganizationInvoice): string {
    return invoicePeriod(invoice, this.locale);
  }

  /**
   * Method amount
   *
   * @description
   * The total in its currency.
   *
   * @param {OrganizationInvoice} invoice - The invoice.
   * @returns {string} The amount.
   */
  protected amount(invoice: OrganizationInvoice): string {
    return invoiceAmount(invoice, this.locale);
  }

  /**
   * Method status
   *
   * @description
   * How the invoice's status shows; a later key shows as it is, with a neutral icon.
   *
   * @param {OrganizationInvoice} invoice - The invoice.
   * @returns {InvoiceStatusView} The status view.
   */
  protected status(invoice: OrganizationInvoice): InvoiceStatusView {
    return Object.hasOwn(STATUS_VIEWS, invoice.status)
      ? STATUS_VIEWS[invoice.status as KnownInvoiceStatus]
      : { label: invoice.status, icon: 'phosphorCircleDashedBold', tone: 'text-muted-foreground' };
  }

  /**
   * Method downloadLabel
   *
   * @description
   * The accessible name and tooltip of the PDF link (mockup line 1913).
   *
   * @param {OrganizationInvoice} invoice - The invoice.
   * @returns {string} The label.
   */
  protected downloadLabel(invoice: OrganizationInvoice): string {
    return $localize`:@@organization.billing.download:Download invoice ${invoice.number}:number: as PDF`;
  }
  // #endregion
}
