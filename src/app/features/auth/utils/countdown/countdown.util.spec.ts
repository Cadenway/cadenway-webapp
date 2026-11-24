import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Countdown } from './countdown.util';

describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts whole seconds down to zero and formats them as m:ss', () => {
    const countdown: Countdown = TestBed.runInInjectionContext(() => new Countdown());

    countdown.start(30);
    expect(countdown.label()).toBe('0:30');
    expect(countdown.running()).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(countdown.label()).toBe('0:29');
    vi.advanceTimersByTime(29_000);
    expect(countdown.remaining()).toBe(0);
    expect(countdown.running()).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(countdown.remaining()).toBe(0);
  });

  it('restarts from the new duration and stops with its injection context', () => {
    const injector: EnvironmentInjector = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector),
    );
    const countdown: Countdown = runInInjectionContext(injector, () => new Countdown());

    countdown.start(45);
    vi.advanceTimersByTime(10_000);
    countdown.start(45);
    expect(countdown.label()).toBe('0:45');
    injector.destroy();
    vi.advanceTimersByTime(10_000);
    expect(countdown.remaining()).toBe(45);
  });
});
