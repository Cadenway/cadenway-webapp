import {
  Component,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
} from '@angular/core';
import { CwAvatar } from '@cadenway/ui/components/avatar';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import { CwMenu, CwMenuItem, CwMenuSeparator } from '@cadenway/ui/components/menu';
import { NgIcon } from '@ng-icons/core';

import type { DocumentRow } from '../../../models/document/document.interface';
import { updatedLabel } from '../../../utils/updated-label/updated-label.util';

/**
 * Component DocumentTable
 *
 * @description
 * The table of the catalog (`App.dc.html` lines 1906-1921): `Title`, `Space`, `Author` and
 * `Modified`, one button per row (the file icon and the title, the space's name, the author's
 * avatar and name, `—` while either is unknown, and the date of the last save), and
 * `No document matches.` when no row is left. The table keeps its 640 px and scrolls sideways
 * inside its card on a narrower screen. A row's context menu (right click, Shift F10, the Menu key
 * or a long press; lines 7362-7372) offers `Open`, `Copy the link`, and for a document the caller
 * may edit `Edit` and `Delete`, which the document page also offers. It emits the row of each
 * action; the page acts. `searching` marks the table busy while another search is read;
 * `deletingId` dims the row whose deletion waits.
 */
@Component({
  selector: 'cw-document-table',
  imports: [CwAvatar, CwContextMenuTriggerFor, CwMenu, CwMenuItem, CwMenuSeparator, NgIcon],
  templateUrl: './document-table.component.html',
})
export class DocumentTable {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The rows, the most recently saved first.
   *
   * @type {InputSignal<readonly DocumentRow[]>}
   * @readonly
   */
  public readonly rows: InputSignal<readonly DocumentRow[]> =
    input.required<readonly DocumentRow[]>();

  /**
   * Property searching
   *
   * @description
   * Whether another search is read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly searching: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property deletingId
   *
   * @description
   * The document whose deletion waits, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly deletingId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property opened
   *
   * @description
   * A row, or its menu's `Open`, was chosen.
   *
   * @type {OutputEmitterRef<DocumentRow>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<DocumentRow> = output<DocumentRow>();

  /**
   * Property editRequested
   *
   * @description
   * A row menu's `Edit` was chosen.
   *
   * @type {OutputEmitterRef<DocumentRow>}
   * @readonly
   */
  public readonly editRequested: OutputEmitterRef<DocumentRow> = output<DocumentRow>();

  /**
   * Property linkCopyRequested
   *
   * @description
   * A row menu's `Copy the link` was chosen.
   *
   * @type {OutputEmitterRef<DocumentRow>}
   * @readonly
   */
  public readonly linkCopyRequested: OutputEmitterRef<DocumentRow> = output<DocumentRow>();

  /**
   * Property deleteRequested
   *
   * @description
   * A row menu's `Delete` was chosen.
   *
   * @type {OutputEmitterRef<DocumentRow>}
   * @readonly
   */
  public readonly deleteRequested: OutputEmitterRef<DocumentRow> = output<DocumentRow>();

  /**
   * Property locale
   *
   * @description
   * Application locale of the dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);
  // #endregion

  // #region Methods
  /**
   * Method rowOf
   *
   * @description
   * The row the open context menu acts on.
   *
   * @param {unknown} data - The menu's data.
   * @returns {DocumentRow | null} The row, or null while closed.
   */
  protected rowOf(data: unknown): DocumentRow | null {
    return this.rows().find((row: DocumentRow): boolean => row === data) ?? null;
  }

  /**
   * Method updated
   *
   * @description
   * The `Modified` cell of a row.
   *
   * @param {DocumentRow} row - The row.
   * @returns {string} The label.
   */
  protected updated(row: DocumentRow): string {
    return updatedLabel(row.document.updatedAt, this.locale, 'start');
  }
  // #endregion
}
