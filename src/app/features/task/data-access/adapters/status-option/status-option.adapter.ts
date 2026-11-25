import type { GetSpaceClientResult } from '@cadenway/api-client';
import { STATUS_KEYS, type StatusKey } from '@cadenway/contracts';

import { STATUS_LABELS } from '../../../constants/task-copy/task-copy.constants';
import type { StatusOption } from '../../../models/status-option/status-option.interface';
import { isMilestoneStatus } from '../../../utils/task-status/task-status.util';

/**
 * Function toStatusOptions
 *
 * @description
 * Maps the statuses of a space to the options of the pickers, in workflow order: the space's name
 * for a status wins over the default word unless it is blank, and a hidden status stays listed
 * with `hidden` so a task that already has it can still show it.
 *
 * @param {GetSpaceClientResult['statuses']} statuses - Statuses of a space.
 * @returns {readonly StatusOption[]} The ten options.
 */
export function toStatusOptions(
  statuses: GetSpaceClientResult['statuses'],
): readonly StatusOption[] {
  return STATUS_KEYS.map((key: StatusKey): StatusOption => {
    const status: GetSpaceClientResult['statuses'][StatusKey] = statuses[key];
    const name: string = status.name?.trim() ?? '';
    return {
      key,
      label: name === '' ? STATUS_LABELS[key] : name,
      category: status.category,
      hidden: status.hidden,
      milestone: isMilestoneStatus(key),
    };
  });
}
