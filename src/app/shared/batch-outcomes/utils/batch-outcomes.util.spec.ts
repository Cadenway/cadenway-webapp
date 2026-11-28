import { describe, expect, it } from 'vitest';

import { matchBatchOutcomes } from './batch-outcomes.util';

describe('matchBatchOutcomes', () => {
  it('matches every address sent to its result, without regard to case', () => {
    expect(
      matchBatchOutcomes(
        ['Marc.Roux@ateliernord.fr', 'lucie@example.com'],
        [
          { email: 'lucie@example.com', outcome: 'invited' },
          { email: 'marc.roux@ateliernord.fr', outcome: 'already-member' },
        ],
      ),
    ).toEqual({
      settled: [
        { email: 'Marc.Roux@ateliernord.fr', outcome: 'already-member' },
        { email: 'lucie@example.com', outcome: 'invited' },
      ],
      unknown: [],
    });
  });

  it('calls an address the answer leaves out unknown', () => {
    expect(
      matchBatchOutcomes(
        ['lucie@example.com', 'paul@example.com'],
        [{ email: 'lucie@example.com', outcome: 'invited' }],
      ),
    ).toEqual({
      settled: [{ email: 'lucie@example.com', outcome: 'invited' }],
      unknown: ['paul@example.com'],
    });
  });

  it('counts a repeated result once and calls conflicting results unknown', () => {
    expect(
      matchBatchOutcomes(
        ['lucie@example.com', 'paul@example.com', 'LUCIE@example.com'],
        [
          { email: 'lucie@example.com', outcome: 'invited' },
          { email: 'Lucie@example.com', outcome: 'invited' },
          { email: 'paul@example.com', outcome: 'invited' },
          { email: 'paul@example.com', outcome: 'already-invited' },
          { email: 'zoe@example.com', outcome: 'invited' },
        ],
      ),
    ).toEqual({
      settled: [{ email: 'lucie@example.com', outcome: 'invited' }],
      unknown: ['paul@example.com'],
    });
  });
});
