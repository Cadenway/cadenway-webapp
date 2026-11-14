/**
 * Interface RuntimeConfig
 *
 * @description
 * Addresses of the two gateways used by the application.
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
   * Base URL of the WebSocket gateway.
   *
   * @type {string}
   * @readonly
   */
  readonly realtimeUrl: string;
  // #endregion
}
