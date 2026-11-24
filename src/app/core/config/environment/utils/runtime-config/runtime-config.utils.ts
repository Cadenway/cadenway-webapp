import type { RuntimeConfig } from '../../models/runtime-config.interface';

/**
 * Function parseRuntimeConfig
 *
 * @description
 * Validates the content of `config.json`.
 *
 * @param {unknown} value - Parsed JSON of the file.
 * @returns {RuntimeConfig} The configuration, with exactly the known keys.
 * @throws {TypeError} When the REST address is missing or a supplied address is invalid.
 */
export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('config.json must contain a JSON object.');
  }
  const source: Partial<Record<keyof RuntimeConfig, unknown>> = value;
  return {
    apiUrl: readAddress(source.apiUrl, 'apiUrl'),
    ...(source.realtimeUrl === undefined
      ? {}
      : { realtimeUrl: readAddress(source.realtimeUrl, 'realtimeUrl') }),
    ...(source.siteUrl === undefined ? {} : { siteUrl: readSiteAddress(source.siteUrl) }),
  };
}

/**
 * Function readAddress
 *
 * @description
 * Checks that a configured gateway address is a non-empty string.
 *
 * @param {unknown} value - Address to validate.
 * @param {keyof RuntimeConfig} key - Configuration key used in error messages.
 * @returns {string} The validated address.
 * @throws {TypeError} When the value is not a non-empty string.
 */
function readAddress(value: unknown, key: keyof RuntimeConfig): string {
  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`config.json: "${key}" must be a non-empty string.`);
  }
  return value;
}

/**
 * Function readSiteAddress
 *
 * @description
 * Checks that the public site address is an absolute HTTP or HTTPS URL without credentials, since
 * the application renders links to it, and drops a trailing slash so callers can append paths.
 *
 * @param {unknown} value - Address to validate.
 * @returns {string} The validated address, without a trailing slash.
 * @throws {TypeError} When the value is not an absolute HTTP or HTTPS URL without credentials.
 */
function readSiteAddress(value: unknown): string {
  const address: string = readAddress(value, 'siteUrl');
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new TypeError('config.json: "siteUrl" must be an absolute URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError('config.json: "siteUrl" must use HTTP or HTTPS without credentials.');
  }
  return address.replace(/\/+$/u, '');
}
