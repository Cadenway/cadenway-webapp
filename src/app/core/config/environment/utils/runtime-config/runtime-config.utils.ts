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
  const apiUrl: string = readAddress(source.apiUrl, 'apiUrl');
  return source.realtimeUrl === undefined
    ? { apiUrl }
    : { apiUrl, realtimeUrl: readAddress(source.realtimeUrl, 'realtimeUrl') };
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
 */
function readAddress(value: unknown, key: keyof RuntimeConfig): string {
  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`config.json: "${key}" must be a non-empty string.`);
  }
  return value;
}
