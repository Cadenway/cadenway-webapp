import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { ThemeService } from '@core/theme';

import { ThemeToggle } from './theme-toggle.component';

describe('ThemeToggle', () => {
  it('is named after the theme it switches to and toggles from its centre', async () => {
    const resolved: WritableSignal<'light' | 'dark'> = signal('light');
    const toggle: Mock = vi.fn();
    TestBed.configureTestingModule({
      imports: [ThemeToggle],
      providers: [
        provideCadenwayIcons(),
        { provide: ThemeService, useValue: { resolved, toggle } },
      ],
    });
    const fixture: ComponentFixture<ThemeToggle> = TestBed.createComponent(ThemeToggle);
    await fixture.whenStable();
    const button: HTMLButtonElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    );

    expect(button?.getAttribute('aria-label')).toBe('Switch to the dark theme');
    button?.click();
    const origin: { x: number; y: number } | undefined = toggle.mock.calls[0]?.[0] as
      { x: number; y: number } | undefined;
    expect(Number.isFinite(origin?.x)).toBe(true);
    expect(Number.isFinite(origin?.y)).toBe(true);

    resolved.set('dark');
    await fixture.whenStable();
    expect(button?.getAttribute('aria-label')).toBe('Switch to the light theme');
  });
});
