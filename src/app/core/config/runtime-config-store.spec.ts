import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuntimeConfigStore } from './runtime-config-store';

const localConfig = {
  apiUrl: 'http://api.cadenway.localhost',
  realtimeUrl: 'http://realtime.cadenway.localhost',
};

describe('RuntimeConfigStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to give a configuration before it is loaded', () => {
    const store = TestBed.inject(RuntimeConfigStore);

    expect(() => store.config()).toThrow('before the application initializer ran');
  });

  it('exposes the content of config.json once loaded', async () => {
    const fetchConfig = vi.fn(() => Promise.resolve(Response.json(localConfig)));
    vi.stubGlobal('fetch', fetchConfig);
    const store = TestBed.inject(RuntimeConfigStore);

    await store.load();

    expect(fetchConfig).toHaveBeenCalledWith('config.json', { cache: 'no-store' });
    expect(store.config()).toEqual(localConfig);
  });

  it('fails when config.json is not served', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );
    const store = TestBed.inject(RuntimeConfigStore);

    await expect(store.load()).rejects.toThrow('HTTP 404');
    expect(() => store.config()).toThrow();
  });

  it('fails on an invalid config.json and keeps no configuration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ apiUrl: '' }))),
    );
    const store = TestBed.inject(RuntimeConfigStore);

    await expect(store.load()).rejects.toThrow(TypeError);
    expect(() => store.config()).toThrow();
  });
});
