import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import { parseRuntimeConfig, type RuntimeConfig } from './runtime-config';

interface RuntimeConfigState {
  readonly _config: RuntimeConfig | null;
}

const initialState: RuntimeConfigState = { _config: null };

/**
 * Holds the configuration the environment mounts as `config.json`.
 *
 * The file is fetched when the application starts instead of being compiled in, so the same Docker
 * image runs in staging and in production.
 */
export const RuntimeConfigStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ _config }) => ({
    /**
     * The loaded configuration.
     *
     * @throws {Error} When read before `load` has completed.
     */
    config: (): RuntimeConfig => {
      const config = _config();
      if (config === null) {
        throw new Error(
          'The runtime configuration is read before the application initializer ran.',
        );
      }
      return config;
    },
  })),
  withMethods((store) => ({
    /**
     * Fetches and validates `config.json`; called once by the application initializer.
     *
     * @throws {Error} When the file cannot be fetched.
     * @throws {TypeError} When its content is not a valid configuration.
     */
    async load(): Promise<void> {
      // `no-store`: a new deployment may mount a different file under the same URL.
      const response = await fetch('config.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`config.json could not be loaded (HTTP ${String(response.status)}).`);
      }
      patchState(store, { _config: parseRuntimeConfig(await response.json()) });
    },
  })),
);
