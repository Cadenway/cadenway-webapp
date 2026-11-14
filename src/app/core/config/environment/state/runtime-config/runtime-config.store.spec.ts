import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '../../models/runtime-config.interface';
import { RuntimeConfigSource } from '../../services/runtime-config-source/runtime-config-source.service';

import { RuntimeConfigStore } from './runtime-config.store';

/**
 * Constant localConfig
 *
 * @description
 * Gateway addresses returned by the test source.
 *
 * @type {RuntimeConfig}
 */
const localConfig: RuntimeConfig = {
  apiUrl: 'http://api.cadenway.localhost',
  realtimeUrl: 'http://realtime.cadenway.localhost',
};

/**
 * Function setup
 *
 * @description
 * Configures and returns a store with the supplied loader.
 *
 * @param {() => Promise<RuntimeConfig>} load - Test configuration loader.
 * @returns {InstanceType<typeof RuntimeConfigStore>} The configured store.
 */
function setup(load: () => Promise<RuntimeConfig>): InstanceType<typeof RuntimeConfigStore> {
  TestBed.configureTestingModule({
    providers: [{ provide: RuntimeConfigSource, useValue: { load } }],
  });
  return TestBed.inject(RuntimeConfigStore);
}

describe('RuntimeConfigStore', () => {
  it('refuses to give a configuration before it is loaded', () => {
    const store: InstanceType<typeof RuntimeConfigStore> = setup(() =>
      Promise.resolve(localConfig),
    );

    expect(() => store.config()).toThrow('before the application initializer ran');
  });

  it('exposes the configuration once loaded', async () => {
    const store: InstanceType<typeof RuntimeConfigStore> = setup(() =>
      Promise.resolve(localConfig),
    );

    await store.load();

    expect(store.config()).toEqual(localConfig);
  });

  it('keeps no configuration when loading fails', async () => {
    const store: InstanceType<typeof RuntimeConfigStore> = setup(() =>
      Promise.reject(new Error('HTTP 404')),
    );

    await expect(store.load()).rejects.toThrow('HTTP 404');
    expect(() => store.config()).toThrow();
  });
});
