import { inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import { RuntimeConfigSource } from './data-access/runtime-config-source';
import type { RuntimeConfig } from './runtime-config';

interface RuntimeConfigState {
  readonly _config: RuntimeConfig | null;
}

const initialState: RuntimeConfigState = { _config: null };

/**
 * Holds the configuration the environment mounts as `config.json`.
 *
 * The file is read when the application starts instead of being compiled in, so the same Docker
 * image runs in staging and in production. Loaded once and never reset: it does not depend on the
 * user or the organization.
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
  withMethods((store, source = inject(RuntimeConfigSource)) => ({
    /**
     * Reads `config.json` through {@link RuntimeConfigSource}; called once by the application
     * initializer. A failure leaves no configuration and rejects, which stops the start-up.
     */
    async load(): Promise<void> {
      patchState(store, { _config: await source.load() });
    },
  })),
);
