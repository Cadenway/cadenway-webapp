import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ShellOverlay } from './shell-overlay.service';

describe('ShellOverlay', () => {
  it('keeps one overlay open at a time', () => {
    const overlay: ShellOverlay = TestBed.inject(ShellOverlay);

    expect(overlay.open('palette')).toBe(true);
    expect(overlay.open('shortcuts')).toBe(false);
    expect(overlay.isOpen('shortcuts')).toBe(false);
    overlay.close('shortcuts');
    expect(overlay.isOpen('palette')).toBe(true);

    overlay.close('palette');
    expect(overlay.anyOpen()).toBe(false);
    expect(overlay.open('shortcuts')).toBe(true);
    expect(overlay.openId()).toBe('shortcuts');
  });
});
