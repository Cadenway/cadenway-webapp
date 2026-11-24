import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { PresencePort } from '../../ports/presence/presence-port.interface';
import { PRESENCE } from '../../ports/presence/presence.token';
import { providePresence } from '../../providers/presence/presence.provider';

describe('providePresence', () => {
  it('publishes an in-memory presence starting online', () => {
    TestBed.configureTestingModule({ providers: [providePresence()] });
    const presence: PresencePort = TestBed.inject(PRESENCE);

    expect(presence.ownStatus()).toBe('online');
    presence.setPresence('away');
    expect(presence.ownStatus()).toBe('away');
  });
});
