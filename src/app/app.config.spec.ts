import { TestBed } from '@angular/core/testing';
import { type ExtraOptions, ROUTER_CONFIGURATION } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuntimeConfigStore } from '@core/config';

import { appConfig } from './app.config';

describe('appConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores the left history entry when a guard cancels a navigation', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        {
          provide: RuntimeConfigStore,
          useValue: { load: () => Promise.resolve(), config: () => ({}) },
        },
      ],
    });

    const options: ExtraOptions = TestBed.inject(ROUTER_CONFIGURATION);

    expect(options.canceledNavigationResolution).toBe('computed');
    expect(options.paramsInheritanceStrategy).toBe('always');
  });
});
