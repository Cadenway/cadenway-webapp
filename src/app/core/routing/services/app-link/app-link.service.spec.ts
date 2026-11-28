import { APP_BASE_HREF } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { AppLinkService } from './app-link.service';

describe('AppLinkService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('puts the locale segment of the base href before the path, on the page origin', () => {
    TestBed.configureTestingModule({ providers: [{ provide: APP_BASE_HREF, useValue: '/fr/' }] });

    expect(TestBed.inject(AppLinkService).absolute('/atelier-nord/t/CAD-482')).toBe(
      `${location.origin}/fr/atelier-nord/t/CAD-482`,
    );
  });

  it('follows the other locale build the same way', () => {
    TestBed.configureTestingModule({ providers: [{ provide: APP_BASE_HREF, useValue: '/en/' }] });

    expect(TestBed.inject(AppLinkService).absolute('/f/public-key')).toBe(
      `${location.origin}/en/f/public-key`,
    );
  });
});
