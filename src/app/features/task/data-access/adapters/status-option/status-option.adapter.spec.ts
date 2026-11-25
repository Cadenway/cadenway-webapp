import type { GetSpaceClientResult } from '@cadenway/api-client';
import { STATUS_CATEGORY_BY_KEY, STATUS_KEYS, type StatusKey } from '@cadenway/contracts';
import { describe, expect, it } from 'vitest';

import type { StatusOption } from '../../../models/status-option/status-option.interface';
import { toStatusOptions } from './status-option.adapter';

/**
 * Function statuses
 *
 * @description
 * The statuses of the Product space: `In review` renamed `Peer review`, `Waiting` hidden,
 * the other names blank or absent.
 *
 * @returns {GetSpaceClientResult['statuses']} The statuses.
 */
function statuses(): GetSpaceClientResult['statuses'] {
  return Object.fromEntries(
    STATUS_KEYS.map((key: StatusKey) => [
      key,
      {
        category: STATUS_CATEGORY_BY_KEY[key],
        name: key === 'review' ? 'Peer review' : key === 'todo' ? '  ' : null,
        hidden: key === 'waiting',
      },
    ]),
  ) as unknown as GetSpaceClientResult['statuses'];
}

describe('toStatusOptions', () => {
  it('lists the ten statuses in workflow order with the names of the space', () => {
    const options: readonly StatusOption[] = toStatusOptions(statuses());

    expect(options.map((option: StatusOption) => option.key)).toEqual([...STATUS_KEYS]);
    expect(options.find((option: StatusOption) => option.key === 'review')?.label).toBe(
      'Peer review',
    );
    expect(options.find((option: StatusOption) => option.key === 'todo')?.label).toBe('To do');
    expect(options.find((option: StatusOption) => option.key === 'progress')).toEqual({
      key: 'progress',
      label: 'In progress',
      category: 'active',
      hidden: false,
      milestone: false,
    });
  });

  it('keeps hidden statuses flagged and marks the four a milestone can take', () => {
    const options: readonly StatusOption[] = toStatusOptions(statuses());

    expect(options.find((option: StatusOption) => option.key === 'waiting')?.hidden).toBe(true);
    expect(
      options.filter((option: StatusOption) => option.milestone).map((o: StatusOption) => o.key),
    ).toEqual(['todo', 'blocked', 'done', 'cancelled']);
  });
});
