import { describe, expect, it } from 'vitest';

import type { StatusOption } from '../../models/status-option/status-option.interface';
import {
  defaultStatusOptions,
  isClosedStatus,
  nextStatus,
  pickableStatuses,
  statusLabel,
} from './task-status.util';

describe('task status rules', () => {
  it('advances along NEXT_STATUS and stops on the statuses chosen by hand', () => {
    expect(nextStatus('triage', false)).toBe('todo');
    expect(nextStatus('todo', false)).toBe('progress');
    expect(nextStatus('testing', false)).toBe('done');
    expect(nextStatus('waiting', false)).toBe('progress');
    expect(nextStatus('done', false)).toBeNull();
    expect(nextStatus('cancelled', false)).toBeNull();
  });

  it('moves an upcoming or at-risk milestone to `Reached` only', () => {
    expect(nextStatus('todo', true)).toBe('done');
    expect(nextStatus('blocked', true)).toBe('done');
    expect(nextStatus('done', true)).toBeNull();
  });

  it('treats done and cancelled as closed', () => {
    expect(isClosedStatus('done')).toBe(true);
    expect(isClosedStatus('cancelled')).toBe(true);
    expect(isClosedStatus('blocked')).toBe(false);
  });

  it('offers the visible statuses and keeps the current one even when hidden', () => {
    const options: readonly StatusOption[] = defaultStatusOptions().map((option: StatusOption) =>
      option.key === 'waiting' || option.key === 'testing' ? { ...option, hidden: true } : option,
    );

    expect(pickableStatuses(options, 'todo', false).map((o: StatusOption) => o.key)).not.toContain(
      'waiting',
    );
    expect(pickableStatuses(options, 'waiting', false).map((o: StatusOption) => o.key)).toContain(
      'waiting',
    );
  });

  it('gives a milestone its four statuses with their words', () => {
    expect(pickableStatuses([], 'todo', true).map((o: StatusOption) => o.label)).toEqual([
      'Upcoming',
      'At risk',
      'Reached',
      'Cancelled',
    ]);
    expect(statusLabel('blocked', [], true)).toBe('At risk');
  });

  it('excludes hidden milestone statuses', () => {
    const options: readonly StatusOption[] = defaultStatusOptions().map((option: StatusOption) =>
      option.key === 'blocked' ? { ...option, hidden: true } : option,
    );
    expect(
      pickableStatuses(options, 'todo', true).some(
        (option: StatusOption) => option.key === 'blocked',
      ),
    ).toBe(false);
  });

  it('names a status after the space, else with its default word', () => {
    const options: readonly StatusOption[] = defaultStatusOptions().map((option: StatusOption) =>
      option.key === 'review' ? { ...option, label: 'Peer review' } : option,
    );

    expect(statusLabel('review', options, false)).toBe('Peer review');
    expect(statusLabel('done', [], false)).toBe('Done');
  });
});
