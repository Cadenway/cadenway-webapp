import { TestBed } from '@angular/core/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from 'vitest';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let dark: MediaQueryList;
  let reduce: MediaQueryList;
  let addListener: Mock;
  beforeEach(() => {
    localStorage.clear();
    addListener = vi.fn();
    dark = {
      matches: false,
      addEventListener: addListener,
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    reduce = { matches: false } as MediaQueryList;
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => (query.includes('reduced-motion') ? reduce : dark)),
    );
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    localStorage.clear();
    Reflect.deleteProperty(document, 'startViewTransition');
    Reflect.deleteProperty(document.documentElement, 'animate');
  });
  it('reads and writes the preference and updates the document', () => {
    localStorage.setItem('cadenway-theme', 'dark');
    const service: ThemeService = TestBed.inject(ThemeService);
    expect(service.resolved()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    service.toggle();
    expect(localStorage.getItem('cadenway-theme')).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    service.set('system');
    expect(service.preference()).toBe('system');
  });
  it('follows system and storage changes', () => {
    const service: ThemeService = TestBed.inject(ThemeService);
    Object.defineProperty(dark, 'matches', { value: true });
    const listener: EventListener = addListener.mock.calls[0][1] as EventListener;
    listener(new Event('change'));
    expect(service.resolved()).toBe('dark');
    localStorage.setItem('cadenway-theme', 'light');
    window.dispatchEvent(new StorageEvent('storage', { key: 'cadenway-theme' }));
    expect(service.preference()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
  it('applies immediately when motion is reduced', () => {
    Object.defineProperty(reduce, 'matches', { value: true });
    const transition: Mock = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: transition,
    });
    const service: ThemeService = TestBed.inject(ThemeService);
    service.set('dark');
    expect(transition).not.toHaveBeenCalled();
    expect(service.resolved()).toBe('dark');
  });
  it('animates the new theme from the supplied origin', async () => {
    const animate: Mock = vi.fn();
    const transition: Mock = vi.fn((change: () => void) => {
      change();
      return { ready: Promise.resolve() };
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: transition,
    });
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      value: animate,
    });
    const service: ThemeService = TestBed.inject(ThemeService);
    service.set('dark', { x: 10, y: 20 });
    await Promise.resolve();
    expect(service.resolved()).toBe('dark');
    const args: unknown[] = animate.mock.calls[0] as unknown[];
    expect(args[0]).toEqual({
      clipPath: ['circle(0% at 10px 20px)', 'circle(150% at 10px 20px)'],
      filter: ['blur(8px)', 'blur(0px)'],
    });
    expect(args[1]).toEqual({
      duration: 700,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      pseudoElement: '::view-transition-new(root)',
    });
  });
  it('uses the bottom center as the default origin', async () => {
    const animate: Mock = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (change: () => void) => {
        change();
        return { ready: Promise.resolve() };
      },
    });
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      value: animate,
    });
    TestBed.inject(ThemeService).set('dark');
    await Promise.resolve();
    expect(animate.mock.calls[0][0]).toEqual({
      clipPath: ['circle(0% at 50% 100%)', 'circle(150% at 50% 100%)'],
      filter: ['blur(8px)', 'blur(0px)'],
    });
  });
  it('does not write or transition for an unchanged resolved theme', () => {
    const transition: Mock = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: transition,
    });
    const write: MockInstance = vi.spyOn(Storage.prototype, 'setItem');
    const service: ThemeService = TestBed.inject(ThemeService);
    service.set('light');
    expect(transition).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });
  it('computes consecutive toggles before transition callbacks run', () => {
    const changes: (() => void)[] = [];
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (change: () => void) => {
        changes.push(change);
        return { ready: new Promise(() => undefined) };
      },
    });
    const service: ThemeService = TestBed.inject(ThemeService);
    service.toggle();
    service.toggle();
    expect(service.resolved()).toBe('light');
    changes.forEach((change) => {
      change();
    });
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});
