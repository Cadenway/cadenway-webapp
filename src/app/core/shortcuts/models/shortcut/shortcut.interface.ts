/**
 * Interface Shortcut
 *
 * @description
 * A keyboard binding and its handler.
 */
export interface Shortcut {
  // #region Properties
  /**
   * Property keys
   *
   * @description
   * Lowercase key combination.
   *
   * @type {string}
   */
  keys: string;

  /**
   * Property handler
   *
   * @description
   * Callback invoked on a match.
   *
   * @type {(event: KeyboardEvent) => void}
   */
  handler: (event: KeyboardEvent) => void;

  /**
   * Property allowInEditable
   *
   * @description
   * Whether editable targets are eligible.
   *
   * @type {boolean | undefined}
   */
  allowInEditable?: boolean;
  // #endregion
}
