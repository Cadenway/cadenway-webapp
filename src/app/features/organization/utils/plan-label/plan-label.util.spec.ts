import { describe, expect, it } from 'vitest';

import { planName } from './plan-label.util';

describe('planName', () => {
  it('names the known plans with the mockup words', () => {
    expect(['free', 'team', 'enterprise'].map(planName)).toEqual(['Free', 'Team', 'Enterprise']);
  });

  it('shows a later plan key as it is', () => {
    expect(planName('scale')).toBe('scale');
    expect(planName('toString')).toBe('toString');
  });
});
