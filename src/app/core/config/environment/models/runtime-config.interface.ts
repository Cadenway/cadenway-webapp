/**
 * Interface RuntimeConfig
 *
 * @description
 * REST gateway address and optional Realtime gateway address.
 */
export interface RuntimeConfig {
  // #region Properties
  /**
   * Property apiUrl
   *
   * @description
   * Base URL of the REST gateway.
   *
   * @type {string}
   * @readonly
   */
  readonly apiUrl: string;

  /**
   * Property realtimeUrl
   *
   * @description
   * Base URL of the WebSocket gateway, when enabled.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly realtimeUrl?: string;
  // #endregion
}
