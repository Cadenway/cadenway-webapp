import { describe, expect, it } from 'vitest';

import { offsetLabel, timeZoneOptions } from '../../../models/profile/time-zone.util';
import {
  organizationIdsOf,
  profileInitials,
  resendAvailableAtOf,
  toProfilePatch,
} from './profile.adapter';

describe('profile adapter', () => {
  it('derives the initials of the first two words', () => {
    expect(profileInitials('  camille   Martin Roux ')).toBe('CM');
    expect(profileInitials('ana')).toBe('A');
    expect(profileInitials('   ')).toBe('');
  });

  it('keeps out of the patch what the change leaves out, and keeps a null that clears', () => {
    expect(toProfilePatch({ displayName: null })).toEqual({ displayName: null });
    expect(toProfilePatch({ name: 'Camille Martin', timeZone: 'Europe/Paris' })).toEqual({
      name: 'Camille Martin',
      timeZone: 'Europe/Paris',
    });
  });

  it('reads the details of the refusals', () => {
    expect(resendAvailableAtOf({ resendAvailableAt: '2026-11-27T10:00:30Z' })).toBe(
      Date.parse('2026-11-27T10:00:30Z'),
    );
    expect(resendAvailableAtOf({ resendAvailableAt: 'soon' })).toBeNull();
    expect(resendAvailableAtOf(null)).toBeNull();
    expect(organizationIdsOf({ organizationIds: ['org-nord', 3] })).toEqual(['org-nord']);
    expect(organizationIdsOf(null)).toEqual([]);
  });

  it('labels the time zones with their offset, as the mockup writes it', () => {
    const winter: Date = new Date('2026-01-15T12:00:00Z');
    expect(offsetLabel('Europe/Paris', winter)).toBe('UTC+1');
    expect(offsetLabel('America/Montreal', winter)).toBe('UTC−5');
    expect(offsetLabel('Not/AZone', winter)).toBe('');
    const options: readonly { value: string; label: string }[] = timeZoneOptions(
      'Not/AZone',
      winter,
    );
    expect(options.find((option) => option.value === 'Europe/Paris')?.label).toBe(
      'Europe/Paris (UTC+1)',
    );
    expect(options.find((option) => option.value === 'Not/AZone')?.label).toBe('Not/AZone');
  });
});
