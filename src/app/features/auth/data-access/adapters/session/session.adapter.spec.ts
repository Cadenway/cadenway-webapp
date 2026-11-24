import { HttpResponse } from '@angular/common/http';
import type { SignedIn, SignInChallenge } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import { openedSession, signInOutcome } from './session.adapter';

/**
 * Constant signedIn
 *
 * @description
 * A `200` sign-in body for Camille Martin of Atelier Nord.
 *
 * @type {SignedIn}
 */
const signedIn: SignedIn = {
  user: {
    id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
    name: 'Camille Martin',
    email: 'camille.martin@ateliernord.fr',
    language: 'fr',
    displayName: null,
    jobTitle: null,
    timeZone: 'Europe/Paris',
    version: 2,
  },
  session: { id: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60', expiresAt: '2099-12-08T13:07:00Z' },
};

/**
 * Constant challenge
 *
 * @description
 * A `202` challenge body offering every method plus one the screen does not know.
 *
 * @type {SignInChallenge}
 */
const challenge: SignInChallenge = {
  token: 'fixture-challenge-token',
  expiresAt: '2099-12-08T13:07:00Z',
  email: 'camille.martin@ateliernord.fr',
  name: 'Camille Martin',
  primaryMethod: 'authenticator-app',
  methods: ['backup-code', 'passkey-later', 'authenticator-app', 'security-key'],
  securityKeys: [{ name: 'YubiKey 5C NFC' }],
  backupCodesRemaining: 7,
  lockedUntil: null,
};

describe('signInOutcome', () => {
  it('opens a session only for a 200 with a session', () => {
    expect(signInOutcome(new HttpResponse({ status: 200, body: signedIn }))).toEqual({
      kind: 'signed-in',
      account: { name: 'Camille Martin', email: 'camille.martin@ateliernord.fr' },
    });
    expect(() => signInOutcome(new HttpResponse({ status: 202, body: signedIn }))).toThrow();
  });

  it('keeps the challenge token apart and the known methods in tab order', () => {
    expect(signInOutcome(new HttpResponse({ status: 202, body: challenge }))).toEqual({
      kind: 'challenge',
      token: 'fixture-challenge-token',
      challenge: {
        email: 'camille.martin@ateliernord.fr',
        name: 'Camille Martin',
        methods: ['authenticator-app', 'security-key', 'backup-code'],
        securityKeys: ['YubiKey 5C NFC'],
        backupCodesRemaining: 7,
      },
    });
  });
});

describe('openedSession', () => {
  it('refuses an answer without a session', () => {
    expect(openedSession(new HttpResponse({ status: 200, body: signedIn })).name).toBe(
      'Camille Martin',
    );
    expect(() => openedSession(new HttpResponse({ status: 204 }))).toThrow();
  });
});
