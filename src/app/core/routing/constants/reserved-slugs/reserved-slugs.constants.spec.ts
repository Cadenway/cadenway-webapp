import { describe, expect, it } from 'vitest';

import { isReservedSlug, workspacePath } from './reserved-slugs.constants';

describe('reserved slugs', () => {
  it('recognizes the fixed first segments without regard to case', () => {
    expect(isReservedSlug('home')).toBe(true);
    expect(isReservedSlug('Organizations')).toBe(true);
    expect(isReservedSlug('atelier-nord')).toBe(false);
  });

  it('opens the organization choice instead of a reserved or empty slug', () => {
    expect(workspacePath('atelier-nord')).toBe('/atelier-nord');
    expect(workspacePath('home')).toBe('/organizations');
    expect(workspacePath('login')).toBe('/organizations');
    expect(workspacePath('')).toBe('/organizations');
  });
});
