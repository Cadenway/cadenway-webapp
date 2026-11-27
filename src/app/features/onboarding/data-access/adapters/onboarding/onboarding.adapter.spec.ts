import type { OnboardingState } from '@cadenway/api-client';
import { describe, expect, it } from 'vitest';

import {
  ifMatch,
  toChecklistPatch,
  toDraftPatch,
  toFinish,
  toInvitationOutcome,
  toOnboardingProgress,
} from './onboarding.adapter';

/**
 * Constant INITIAL
 *
 * @description
 * The state the gateway returns before the first write, as the contract's example gives it.
 *
 * @type {OnboardingState}
 */
const INITIAL: OnboardingState = {
  version: 1,
  wizard: {
    status: 'in-progress',
    step: 'space',
    preset: 'dev',
    name: null,
    prefix: null,
    color: 'violet',
  },
  provisioning: null,
  checklist: {
    presentation: 'expanded',
    firstTaskCreated: false,
    invitationSent: false,
    boardTried: false,
  },
};

describe('onboarding adapter', () => {
  it('maps the initial state and a provisioned one', () => {
    expect(toOnboardingProgress(INITIAL)).toEqual({
      version: 1,
      wizard: {
        status: 'in-progress',
        step: 'space',
        preset: 'dev',
        name: null,
        prefix: null,
        color: 'violet',
      },
      provisioning: null,
      checklist: {
        presentation: 'expanded',
        firstTaskCreated: false,
        invitationSent: false,
        boardTried: false,
      },
    });
    expect(
      toOnboardingProgress({
        ...INITIAL,
        version: 4,
        wizard: { ...INITIAL.wizard, status: 'finished', name: 'Product', prefix: 'PRO' },
        provisioning: { spaceId: 'sp-product', firstListId: 'l-backlog' },
      }),
    ).toMatchObject({
      version: 4,
      wizard: { status: 'finished', name: 'Product', prefix: 'PRO' },
      provisioning: { spaceId: 'sp-product', firstListId: 'l-backlog' },
    });
  });

  it('reads an unknown status as dismissed and an unknown color as gris', () => {
    expect(
      toOnboardingProgress({
        ...INITIAL,
        wizard: { ...INITIAL.wizard, status: 'not-offered', color: 'aurora' },
      }).wizard,
    ).toMatchObject({ status: 'dismissed', color: 'gris' });
    expect(
      toOnboardingProgress({ ...INITIAL, wizard: { ...INITIAL.wizard, color: 'lagon' } }).wizard
        .color,
    ).toBe('lagon');
  });

  it('sends only the members of a change that are given', () => {
    expect(toDraftPatch({ step: 'preset', name: 'Product', prefix: null })).toEqual({
      step: 'preset',
      name: 'Product',
      prefix: null,
    });
    expect(toChecklistPatch({ boardTried: true })).toEqual({ boardTried: true });
    expect(toFinish({ name: 'Product', prefix: 'PRO', preset: 'blank', color: 'azur' })).toEqual({
      name: 'Product',
      prefix: 'PRO',
      preset: 'blank',
      color: 'azur',
    });
  });

  it('counts only invited addresses as sent', () => {
    expect(
      toInvitationOutcome({
        invitations: [
          { email: 'ines.robert@ateliernord.fr', outcome: 'invited', invitationId: null },
          { email: 'hugo.martin@ateliernord.fr', outcome: 'already-member', invitationId: null },
          { email: 'lea.bernard@ateliernord.fr', outcome: 'seat-limit', invitationId: null },
        ],
      }),
    ).toEqual({ invited: 1, skipped: 2, alreadyInvited: 0 });
  });

  it('counts the addresses already invited apart', () => {
    expect(
      toInvitationOutcome({
        invitations: [
          { email: 'ines.robert@ateliernord.fr', outcome: 'already-invited', invitationId: null },
          { email: 'hugo.martin@ateliernord.fr', outcome: 'already-member', invitationId: null },
        ],
      }),
    ).toEqual({ invited: 0, skipped: 2, alreadyInvited: 1 });
  });

  it('quotes the version as the precondition', () => {
    expect(ifMatch(7)).toEqual({ 'If-Match': '"7"' });
  });
});
