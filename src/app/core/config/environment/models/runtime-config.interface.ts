/**
 * Interface RuntimeConfig
 *
 * @description
 * REST gateway address, with the optional Realtime gateway and public site addresses.
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

  /**
   * Property siteUrl
   *
   * @description
   * Base URL of the public site (privacy, terms and help pages), when the environment has one.
   * Screens that link to the site hide those links when it is absent.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly siteUrl?: string;

  /**
   * Property statusUrl
   *
   * @description
   * Address of the public status page, when the environment has one. The unavailable error state
   * offers « État du service » only when it is set.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly statusUrl?: string;
  // #endregion
}
