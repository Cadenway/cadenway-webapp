import type { LookColor } from './look.type';

/**
 * Interface LookColorChoice
 *
 * @description
 * A color of a `Color` group with its name and swatch.
 */
export interface LookColorChoice {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The color key.
   *
   * @type {LookColor}
   * @readonly
   */
  readonly value: LookColor;

  /**
   * Property label
   *
   * @description
   * Its name (`Amethyst`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property swatch
   *
   * @description
   * Background class of its swatch, a literal class of the tokens.
   *
   * @type {string}
   * @readonly
   */
  readonly swatch: string;
  // #endregion
}
