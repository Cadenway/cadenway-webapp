import { describe, expect, it } from 'vitest';

import { type InviteBatch, planInviteBatches } from './invite-batches.util';

/**
 * Function addresses
 *
 * @description
 * Numbered Atelier Nord addresses.
 *
 * @param {number} from - First number.
 * @param {number} count - How many.
 * @returns {string[]} The addresses.
 */
function addresses(from: number, count: number): string[] {
  return Array.from(
    { length: count },
    (_unused: unknown, index: number): string => `member${String(from + index)}@ateliernord.fr`,
  );
}

/**
 * Function counter
 *
 * @description
 * Gives the keys `new-1`, `new-2`... in call order.
 *
 * @returns {() => string} The key source.
 */
function counter(): () => string {
  let count: number = 0;
  return (): string => {
    count += 1;
    return `new-${String(count)}`;
  };
}

describe('planInviteBatches', () => {
  it('cuts the addresses into batches of the given size under new keys', () => {
    const emails: string[] = addresses(0, 120);

    expect(planInviteBatches(emails, [], 50, counter())).toEqual([
      { emails: emails.slice(0, 50), key: 'new-1' },
      { emails: emails.slice(50, 100), key: 'new-2' },
      { emails: emails.slice(100), key: 'new-3' },
    ]);
  });

  it('replays an unresolved batch unchanged first, and batches the leftover apart', () => {
    const leftover: string = 'member0@ateliernord.fr';
    const lost: InviteBatch = { emails: addresses(50, 50), key: 'lost' };

    expect(planInviteBatches([leftover, ...lost.emails], [lost], 50, counter())).toEqual([
      lost,
      { emails: [leftover], key: 'new-1' },
    ]);
  });

  it('does not replay an unresolved batch one of whose addresses changed', () => {
    const lost: InviteBatch = { emails: addresses(0, 3), key: 'lost' };
    const kept: InviteBatch = { emails: addresses(10, 2), key: 'kept' };
    const edited: string[] = ['member0@ateliernord.fr', 'other@ateliernord.fr', ...addresses(2, 1)];

    expect(planInviteBatches([...edited, ...kept.emails], [lost, kept], 50, counter())).toEqual([
      kept,
      { emails: edited, key: 'new-1' },
    ]);
  });

  it('sends nothing for no address', () => {
    expect(
      planInviteBatches([], [{ emails: ['a@ateliernord.fr'], key: 'k' }], 50, counter()),
    ).toEqual([]);
  });
});
