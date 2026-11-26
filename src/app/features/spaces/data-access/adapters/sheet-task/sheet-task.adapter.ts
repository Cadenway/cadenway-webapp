import type {
  CustomFieldDefinition,
  TaskSummary as TaskSummaryDto,
  TaskTimeSummary,
} from '@cadenway/api-client';

import type {
  SheetCustomField,
  SheetFieldValue,
  SheetTaskFacts,
} from '../../../models/sheet-view/sheet-view.interface';

/**
 * Function toSheetTaskFacts
 *
 * @description
 * Keeps what the sheet shows of a task of a list page beyond its summary: the estimate and the
 * custom field values, at the task's version. Values of a kind the sheet does not show are left
 * out.
 *
 * @param {TaskSummaryDto} task - A task as `queryListTasks` answers it.
 * @returns {SheetTaskFacts} The sheet's facts of the task.
 */
export function toSheetTaskFacts(task: TaskSummaryDto): SheetTaskFacts {
  const values: Record<string, SheetFieldValue> = {};
  for (const [id, value] of Object.entries(task.customFieldValues ?? {})) {
    if (typeof value === 'number' || typeof value === 'string') values[id] = value;
  }
  return {
    key: task.key,
    version: task.version,
    estimateMinutes: task.estimateMinutes,
    customFieldValues: values,
  };
}

/**
 * Function toSheetCustomField
 *
 * @description
 * Maps an active custom field definition of the list's space to a sheet column; a kind other than
 * `number` or `text` (none in this delivery of the contract) has no column.
 *
 * @param {CustomFieldDefinition} field - A definition as `listListCustomFields` answers it.
 * @returns {SheetCustomField | null} The column, or null for an unsupported kind.
 */
export function toSheetCustomField(field: CustomFieldDefinition): SheetCustomField | null {
  if (field.type !== 'number' && field.type !== 'text') return null;
  return {
    id: field.id,
    name: field.name,
    type: field.type,
    position: field.position,
    sprintPoints: field.type === 'number' && field.sprintPoints,
  };
}

/**
 * Function toSpentMinutes
 *
 * @description
 * The time spent on a task from its time summary, in whole minutes (subtasks counted apart).
 *
 * @param {TaskTimeSummary} summary - The summary as `getTaskTimeSummary` answers it.
 * @returns {number} The minutes logged.
 */
export function toSpentMinutes(summary: TaskTimeSummary): number {
  return Math.max(0, Math.round(summary.totalMinutes));
}
