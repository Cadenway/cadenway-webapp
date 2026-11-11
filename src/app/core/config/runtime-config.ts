import { Service, signal } from '@angular/core';

/** Addresses of the two gateways, the only backends this application talks to. */
export interface RuntimeConfig {
  /** Base URL of waypoint-api-gateway (REST). */
  readonly apiUrl: string;
  /** Base URL of waypoint-realtime-gateway (WebSocket). */
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

/**
 * Holds the configuration the environment mounts as `config.json`.
 *
 * The file is fetched when the application starts instead of being compiled in, so the same Docker
 * image runs in staging and in production.
 */
@Service()
export class RuntimeConfigStore {
  private readonly loaded = signal<RuntimeConfig | null>(null);

  /**
   * The loaded configuration.
   *
   * @throws {Error} When read before {@link load} has completed.
   */
  public get config(): RuntimeConfig {
    const config = this.loaded();
    if (config === null) {
      throw new Error('The runtime configuration is read before the application initializer ran.');
    }
    return config;
  }

  /**
   * Fetches and validates `config.json`; called once by the application initializer.
   *
   * @throws {Error} When the file cannot be fetched.
   * @throws {TypeError} When its content is not a valid configuration.
   */
  public async load(): Promise<void> {
    // `no-store`: a new deployment may mount a different file under the same URL.
    const response = await fetch('config.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`config.json could not be loaded (HTTP ${String(response.status)}).`);
    }
    this.loaded.set(parseRuntimeConfig(await response.json()));
  }
}
