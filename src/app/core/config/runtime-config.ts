/** Addresses of the two gateways, the only backends this application talks to. */
export interface RuntimeConfig {
  /** Base URL of cadenway-api-gateway (REST). */
  readonly apiUrl: string;
  /** Base URL of cadenway-realtime-gateway (WebSocket). */
  readonly realtimeUrl: string;
}

/**
 * Validates the content of `config.json`.
 *
 * @param value Parsed JSON of the file.
 * @returns The configuration, with exactly the known keys.
 * @throws {TypeError} When a gateway address is missing or is not a non-empty string.
 */
export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('config.json must contain a JSON object.');
  }
  const source = value as Partial<Record<keyof RuntimeConfig, unknown>>;
  return {
    apiUrl: readAddress(source.apiUrl, 'apiUrl'),
    realtimeUrl: readAddress(source.realtimeUrl, 'realtimeUrl'),
  };
}

function readAddress(value: unknown, key: keyof RuntimeConfig): string {
  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`config.json: "${key}" must be a non-empty string.`);
  }
  return value;
}
