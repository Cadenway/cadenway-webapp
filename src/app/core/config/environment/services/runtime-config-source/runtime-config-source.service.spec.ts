import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { RuntimeConfig } from '../../models/runtime-config.interface';

import { RuntimeConfigSource } from './runtime-config-source.service';

/**
 * Constant localConfig
 *
 * @description
 * Gateway addresses returned by the fetch fixture.
 *
 * @type {RuntimeConfig}
 */
const localConfig: RuntimeConfig = {
  apiUrl: 'http://api.cadenway.localhost',
  realtimeUrl: 'http://realtime.cadenway.localhost',
};

describe('RuntimeConfigSource', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches config.json without the HTTP cache and validates it', async () => {
    const fetchConfig: Mock<() => Promise<Response>> = vi.fn(() =>
      Promise.resolve(Response.json({ ...localConfig, extra: 1 })),
    );
    vi.stubGlobal('fetch', fetchConfig);

    await expect(TestBed.inject(RuntimeConfigSource).load()).resolves.toEqual(localConfig);
    expect(fetchConfig).toHaveBeenCalledWith('config.json', { cache: 'no-store' });
  });

  it('fails when config.json is not served', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );

    await expect(TestBed.inject(RuntimeConfigSource).load()).rejects.toThrow('HTTP 404');
  });

  it('fails when config.json is not a valid configuration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ apiUrl: '' }))),
    );

    await expect(TestBed.inject(RuntimeConfigSource).load()).rejects.toThrow(TypeError);
  });
});
