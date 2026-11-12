import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RuntimeConfigSource } from './data-access/runtime-config-source';
import type { RuntimeConfig } from './runtime-config';
import { RuntimeConfigStore } from './runtime-config-store';

const localConfig: RuntimeConfig = {
  apiUrl: 'http://api.cadenway.localhost',
  realtimeUrl: 'http://realtime.cadenway.localhost',
};

function setup(load: () => Promise<RuntimeConfig>) {
  TestBed.configureTestingModule({
    providers: [{ provide: RuntimeConfigSource, useValue: { load } }],
  });
  return TestBed.inject(RuntimeConfigStore);
}

describe('RuntimeConfigStore', () => {
  it('refuses to give a configuration before it is loaded', () => {
    const store = setup(() => Promise.resolve(localConfig));

    expect(() => store.config()).toThrow('before the application initializer ran');
  });

  it('exposes the configuration once loaded', async () => {
    const store = setup(() => Promise.resolve(localConfig));

    await store.load();

    expect(store.config()).toEqual(localConfig);
  });

  it('keeps no configuration when loading fails', async () => {
    const store = setup(() => Promise.reject(new Error('HTTP 404')));

    await expect(store.load()).rejects.toThrow('HTTP 404');
    expect(() => store.config()).toThrow();
  });
});
