import { describe, expect, it } from 'vitest';

import type { RuntimeConfig } from '../../models/runtime-config.interface';

import { parseRuntimeConfig } from './runtime-config.utils';

/**
 * Constant localConfig
 *
 * @description
 * Gateway addresses used by the configuration parser tests.
 *
 * @type {RuntimeConfig}
 */
const localConfig: RuntimeConfig = {
  apiUrl: 'http://api.cadenway.localhost',
  realtimeUrl: 'http://realtime.cadenway.localhost',
};

describe('parseRuntimeConfig', () => {
  it('keeps the two gateway addresses and drops unknown keys', () => {
    expect(parseRuntimeConfig({ ...localConfig, extra: true })).toEqual(localConfig);
  });

  it('allows REST startup without Realtime', () => {
    expect(parseRuntimeConfig({ apiUrl: localConfig.apiUrl })).toEqual({
      apiUrl: localConfig.apiUrl,
    });
  });

  it('keeps an optional public site address without its trailing slash', () => {
    expect(
      parseRuntimeConfig({ apiUrl: localConfig.apiUrl, siteUrl: 'https://cadenway.localhost/' }),
    ).toEqual({ apiUrl: localConfig.apiUrl, siteUrl: 'https://cadenway.localhost' });
  });

  it('refuses a public site address that is not an HTTP URL without credentials', () => {
    for (const siteUrl of [
      '',
      'cadenway.localhost',
      'javascript:alert(1)',
      'https://a:b@x.test',
      4,
    ]) {
      expect(() => parseRuntimeConfig({ apiUrl: localConfig.apiUrl, siteUrl })).toThrow(TypeError);
    }
  });

  it('keeps an optional status page address and refuses one that is not an HTTP URL', () => {
    expect(
      parseRuntimeConfig({
        apiUrl: localConfig.apiUrl,
        statusUrl: 'https://status.cadenway.test/',
      }),
    ).toEqual({ apiUrl: localConfig.apiUrl, statusUrl: 'https://status.cadenway.test' });
    for (const statusUrl of ['', 'status.cadenway.test', 'javascript:alert(1)', 4]) {
      expect(() => parseRuntimeConfig({ apiUrl: localConfig.apiUrl, statusUrl })).toThrow(
        TypeError,
      );
    }
  });

  it('refuses a missing REST address or an invalid configured address', () => {
    expect(() => parseRuntimeConfig({ realtimeUrl: localConfig.realtimeUrl })).toThrow(TypeError);
    expect(() => parseRuntimeConfig({ ...localConfig, realtimeUrl: '' })).toThrow(TypeError);
    expect(() => parseRuntimeConfig(null)).toThrow(TypeError);
  });
});
