import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { RealtimeConnection } from '@core/realtime';

import type { PresencePort } from '../../ports/presence/presence-port.interface';
import { PRESENCE } from '../../ports/presence/presence.token';
import { providePresence } from './presence.provider';

describe('providePresence', () => {
  it('publishes the workspace realtime connection as the presence', () => {
    const connection: PresencePort = {
      ownStatus: signal(null),
      status: signal('connected'),
      setPresence: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: RealtimeConnection, useValue: connection }, providePresence()],
    });

    expect(TestBed.inject(PRESENCE)).toBe(connection);
  });
});
