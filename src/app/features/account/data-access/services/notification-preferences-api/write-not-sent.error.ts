/**
 * Class WriteNotSentError
 *
 * @description
 * A preferences write that was never sent: the session lock or the identity check failed before
 * the patch left, so nothing can have been recorded.
 */
export class WriteNotSentError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps the failure that stopped the write.
   *
   * @param {unknown} cause - The failure.
   * @constructor
   */
  public constructor(cause: unknown) {
    super('The preferences write was not sent.', { cause });
    this.name = 'WriteNotSentError';
  }
  // #endregion
}
