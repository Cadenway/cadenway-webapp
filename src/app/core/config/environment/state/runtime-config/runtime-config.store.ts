import { inject, type Signal, type Type } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import type { RuntimeConfig } from '../../models/runtime-config.interface';
import { RuntimeConfigSource } from '../../services/runtime-config-source/runtime-config-source.service';

/**
 * Interface RuntimeConfigState
 *
 * @description
 * Internal state of the runtime configuration store.
 */
interface RuntimeConfigState {
  // #region Properties
  /**
   * Property _config
   *
   * @description
   * Configuration loaded at application startup, or null before loading.
   *
   * @type {RuntimeConfig | null}
   * @readonly
   */
  readonly _config: RuntimeConfig | null;
  // #endregion
}

/**
 * Interface RuntimeConfigStoreInstance
 *
 * @description
 * Configuration operations exposed to application consumers.
 */
interface RuntimeConfigStoreInstance {
  // #region Properties
  /**
   * Property config
   *
   * @description
   * Configuration loaded at application startup.
   *
   * @type {Signal<RuntimeConfig>}
   * @readonly
   */
  readonly config: Signal<RuntimeConfig>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Loads configuration before the application starts.
   *
   * @returns {Promise<void>} Resolves after configuration has loaded.
   */
  load(): Promise<void>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * State before the configuration is loaded.
 *
 * @type {RuntimeConfigState}
 */
const initialState: RuntimeConfigState = { _config: null };

/**
 * Function createRuntimeConfigStore
 *
 * @description
 * Creates the injectable signal store for application configuration.
 *
 * @returns {typeof RuntimeConfigStore} Injectable store constructor.
 */
function createRuntimeConfigStore(): Type<RuntimeConfigStoreInstance> {
  return signalStore(
    { providedIn: 'root' },
    withState(initialState),
    withComputed(({ _config }: { _config: Signal<RuntimeConfig | null> }) => ({
      /**
       * The loaded configuration.
       *
       * @throws {Error} When read before `load` has completed.
       */
      config: (): RuntimeConfig => {
        const config: RuntimeConfig | null = _config();
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
       * Reads `config.json` through {@link RuntimeConfigSource} during initialization.
       * A failure leaves no configuration and rejects, stopping startup.
       */
      async load(): Promise<void> {
        patchState(store, { _config: await source.load() });
      },
    })),
  );
}

/**
 * Constant RuntimeConfigStore
 *
 * @description
 * Holds the configuration the environment mounts as `config.json`.
 *
 * The file is read when the application starts instead of being compiled in, so the same Docker
 * image runs in staging and in production. Loaded once and never reset: it does not depend on the
 * user or the organization.
 *
 * @type {ReturnType<typeof createRuntimeConfigStore>}
 */
export const RuntimeConfigStore: ReturnType<typeof createRuntimeConfigStore> =
  createRuntimeConfigStore();
