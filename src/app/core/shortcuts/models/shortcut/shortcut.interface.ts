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
   * Lowercase key, optionally preceded by `mod`, `alt`, or `shift` separated by `+`
   * (for example `mod+k` or `shift+alt+x`). `mod` is Command on macOS and Control elsewhere.
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
