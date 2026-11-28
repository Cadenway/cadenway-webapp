import { Service } from '@angular/core';

import type { RuntimeConfig } from '../../models/runtime-config.interface';
import { parseRuntimeConfig } from '../../utils/runtime-config/runtime-config.utils';

/**
 * Service RuntimeConfigSource
 *
 * @description
 * Reads `/config.json`, mounted by the environment at the site root, beside the `/en/` and `/fr/`
 * builds: it is fetched from the root, never relative to the locale base href.
 */
@Service()
export class RuntimeConfigSource {
  // #region Methods
  /**
   * Method load
   *
   * @description
   * Fetches and validates `config.json`.
   *
   * @returns {Promise<RuntimeConfig>} The validated configuration.
   * @throws {Error} When the file cannot be fetched.
   * @throws {TypeError} When its content is not a valid configuration.
   */
  public async load(): Promise<RuntimeConfig> {
    // `no-store`: a new deployment may mount a different file under the same URL.
    const response: Response = await fetch('/config.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`config.json could not be loaded (HTTP ${String(response.status)}).`);
    }
    return parseRuntimeConfig(await response.json());
  }
  // #endregion
}
