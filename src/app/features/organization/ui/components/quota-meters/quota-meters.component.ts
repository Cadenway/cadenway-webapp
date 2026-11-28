import { Component, input, type InputSignal } from '@angular/core';
import {
  CwCard,
  CwCardAction,
  CwCardContent,
  CwCardHeader,
  CwCardTitle,
} from '@cadenway/ui/components/card';
import { CwMeter, type CwMeterFormat } from '@cadenway/ui/components/meter';

/**
 * Type QuotaZone
 *
 * @description
 * Level of a quota, as the mockup draws it (`Organisation.dc.html` lines 1636-1645): `high`
 * (balise) from 80 % of the limit, `critical` (grenat) from 90 %, `normal` below.
 *
 * @type {'normal' | 'high' | 'critical'}
 */
export type QuotaZone = 'normal' | 'high' | 'critical';

/**
 * Interface QuotaMeter
 *
 * @description
 * One row of the `<plan> plan limits` card, with its texts already written by the page.
 */
export interface QuotaMeter {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Stable key of the row, also its test id suffix.
   *
   * @type {'seats' | 'storage' | 'guests'}
   * @readonly
   */
  readonly id: 'seats' | 'storage' | 'guests';

  /**
   * Property label
   *
   * @description
   * Name of the quota, the meter's accessible name.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property used
   *
   * @description
   * Amount used, in the unit of `limit`.
   *
   * @type {number}
   * @readonly
   */
  readonly used: number;

  /**
   * Property limit
   *
   * @description
   * Amount the plan includes, or null when the contract states none (guests): the row then shows
   * its count and note without a gauge.
   *
   * @type {number | null}
   * @readonly
   */
  readonly limit: number | null;

  /**
   * Property text
   *
   * @description
   * Value written at the right of the label and read as the meter's value (`18 / 25`).
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property note
   *
   * @description
   * Message under the gauge; its icon and color follow the zone.
   *
   * @type {string}
   * @readonly
   */
  readonly note: string;

  /**
   * Property zone
   *
   * @description
   * Level of the quota, which colors the gauge and its note.
   *
   * @type {QuotaZone}
   * @readonly
   */
  readonly zone: QuotaZone;
  // #endregion
}

/**
 * Function quotaZone
 *
 * @description
 * The zone of a quota: `critical` from 90 % of the limit, `high` from 80 %, `normal` below or
 * without a positive limit. The 90 % matches `SubscriptionStore.quotaCritical`, so a critical
 * meter here is the one behind the navigation's `Critical quota` alert.
 *
 * @param {number} used - Amount used.
 * @param {number} limit - Amount included.
 * @returns {QuotaZone} The zone.
 */
export function quotaZone(used: number, limit: number): QuotaZone {
  if (limit <= 0) return 'normal';
  if (used >= 0.9 * limit) return 'critical';
  return used >= 0.8 * limit ? 'high' : 'normal';
}

/**
 * Component QuotaMeters
 *
 * @description
 * The `<plan> plan limits` card of the quotas section (`Organisation.dc.html` lines 397-408):
 * the title with the `alert threshold at 80%` legend and its mark glyph, then one `cw-meter` per
 * quota with a limit, its value at the right of its label, the 80 % alert mark on its track
 * (`marker`, which changes neither the zone nor the value text), its zone forced from
 * `QuotaMeter.zone` (so the 90 % critical zone holds rather than the brick's 95 %) and its note; a
 * quota without a limit shows its label, value and note without a gauge. Presentational: the page
 * writes the texts.
 */
@Component({
  selector: 'cw-quota-meters',
  imports: [CwCard, CwCardAction, CwCardContent, CwCardHeader, CwCardTitle, CwMeter],
  templateUrl: './quota-meters.component.html',
})
export class QuotaMeters {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * Card title (`Team plan limits`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly title: InputSignal<string> = input.required<string>();

  /**
   * Property meters
   *
   * @description
   * Rows of the card, in their order.
   *
   * @type {InputSignal<readonly QuotaMeter[]>}
   * @readonly
   */
  public readonly meters: InputSignal<readonly QuotaMeter[]> =
    input.required<readonly QuotaMeter[]>();
  // #endregion

  // #region Methods
  /**
   * Method format
   *
   * @description
   * The meter's value formatter, which writes the page's text for the header and `aria-valuetext`.
   *
   * @param {QuotaMeter} meter - The row.
   * @returns {CwMeterFormat} The formatter.
   */
  protected format(meter: QuotaMeter): CwMeterFormat {
    return (): string => meter.text;
  }
  // #endregion
}
