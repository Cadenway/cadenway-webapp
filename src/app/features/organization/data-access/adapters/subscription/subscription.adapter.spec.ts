import { describe, expect, it } from 'vitest';

import { toOrganizationSubscription } from './subscription.adapter';

describe('toOrganizationSubscription', () => {
  it('keeps the plan, the seats and the attachment storage', () => {
    expect(
      toOrganizationSubscription({
        plan: 'team',
        seats: { used: 18, limit: 25 },
        guestCount: 2,
        storage: { attachmentBytesUsed: 92_400_000_000, limitBytes: 100_000_000_000 },
      }),
    ).toEqual({
      plan: 'team',
      seatsUsed: 18,
      seatsLimit: 25,
      storageUsedBytes: 92_400_000_000,
      storageLimitBytes: 100_000_000_000,
    });
  });
});
