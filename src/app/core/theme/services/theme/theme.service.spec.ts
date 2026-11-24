import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

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
    expect(localStorage.getItem('cadenway-theme')).toBeNull();
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
    Reflect.deleteProperty(document, 'startViewTransition');
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
      clipPath: [
        'circle(0px at 10px 20px)',
        `circle(${String(Math.hypot(Math.max(10, window.innerWidth - 10), Math.max(20, window.innerHeight - 20)))}px at 10px 20px)`,
      ],
    });
    expect(args[1]).toEqual({
      duration: 400,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      pseudoElement: '::view-transition-new(root)',
    });
    Reflect.deleteProperty(document, 'startViewTransition');
    Reflect.deleteProperty(document.documentElement, 'animate');
  });
});
