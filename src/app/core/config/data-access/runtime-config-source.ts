import { Service } from '@angular/core';

import { parseRuntimeConfig, type RuntimeConfig } from '../runtime-config';

/** Reads `config.json`, the file the environment mounts next to the application. */
@Service()
export class RuntimeConfigSource {
  /**
   * Fetches and validates `config.json`.
   *
   * @throws {Error} When the file cannot be fetched.
   * @throws {TypeError} When its content is not a valid configuration.
   */
  public async load(): Promise<RuntimeConfig> {
    // `no-store`: a new deployment may mount a different file under the same URL.
    const response = await fetch('config.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`config.json could not be loaded (HTTP ${String(response.status)}).`);
    }
    return parseRuntimeConfig(await response.json());
  }
}
