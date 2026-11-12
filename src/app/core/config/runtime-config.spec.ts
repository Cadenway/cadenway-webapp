import { describe, expect, it } from 'vitest';

import { parseRuntimeConfig, type RuntimeConfig } from './runtime-config';

const localConfig: RuntimeConfig = {
  apiUrl: 'http://api.cadenway.localhost',
  realtimeUrl: 'http://realtime.cadenway.localhost',
};

describe('parseRuntimeConfig', () => {
  it('keeps the two gateway addresses and drops unknown keys', () => {
    expect(parseRuntimeConfig({ ...localConfig, extra: true })).toEqual(localConfig);
  });

  it('refuses a file without a gateway address', () => {
    expect(() => parseRuntimeConfig({ apiUrl: localConfig.apiUrl })).toThrow(TypeError);
    expect(() => parseRuntimeConfig({ ...localConfig, realtimeUrl: '' })).toThrow(TypeError);
    expect(() => parseRuntimeConfig(null)).toThrow(TypeError);
  });
});
