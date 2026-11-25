import type {
  CreateTaskClientResult,
  ListListsClientResult,
  ListSpacesClientResult,
  ListTaskTemplatesClientResult,
  TasksService,
} from '@cadenway/api-client';

import type {
  CreatedTask,
  ListDestination,
  TaskDraft,
  TaskTemplateOption,
} from '../../../models/task-create/task-create.interface';

/**
 * Type TaskCreationBody
 *
 * @description
 * Request body of `TasksService.createTask`.
 *
 * @type {Parameters<TasksService['createTask']>[1]}
 */
export type TaskCreationBody = Parameters<TasksService['createTask']>[1];

/**
 * Type SubtaskCreationBody
 *
 * @description
 * Request body of `TasksService.createSubtask`.
 *
 * @type {Parameters<TasksService['createSubtask']>[1]}
 */
export type SubtaskCreationBody = Parameters<TasksService['createSubtask']>[1];

/**
 * Function toListDestination
 *
 * @description
 * Maps a list of a space to a destination of the create dialog.
 *
 * @param {ListSpacesClientResult['items'][number]} space - Space of the list.
 * @param {ListListsClientResult['items'][number]} list - The list.
 * @returns {ListDestination} The destination.
 */
export function toListDestination(
  space: ListSpacesClientResult['items'][number],
  list: ListListsClientResult['items'][number],
): ListDestination {
  return {
    listId: list.id,
    listName: list.name,
    spaceId: space.id,
    spaceName: space.name,
    sprintEnd: list.sprint?.endDate ?? null,
  };
}

/**
 * Function toTaskTemplateOption
 *
 * @description
 * Maps a template saved in a space to an option of the template menu.
 *
 * @param {ListTaskTemplatesClientResult['items'][number]} template - Template returned by the gateway.
 * @returns {TaskTemplateOption} The option.
 */
export function toTaskTemplateOption(
  template: ListTaskTemplatesClientResult['items'][number],
): TaskTemplateOption {
  return {
    id: template.id,
    name: template.name,
    title: template.title,
    description: template.description ?? '',
    priority: template.priority,
    labels: [...template.labels],
    checklist: [...template.checklist],
    subtasks: [...template.subtasks],
  };
}

/**
 * Function toTaskCreation
 *
 * @description
 * Maps the dialog's draft to the creation body: empty parts are left out, and the cancel reason
 * and note are sent only with the `cancelled` status, which requires them.
 *
 * @param {TaskDraft} draft - Submitted draft.
 * @returns {TaskCreationBody} The request body of `POST /v1/lists/{listId}/tasks`.
 */
export function toTaskCreation(draft: TaskDraft): TaskCreationBody {
  const cancelled: boolean = draft.status === 'cancelled' && draft.cancelReason !== null;
  return {
    name: draft.name,
    ...(draft.description === '' ? {} : { description: draft.description }),
    status: draft.status,
    ...(cancelled
      ? {
          cancelReason: draft.cancelReason,
          cancelNote: draft.cancelNote === '' ? null : draft.cancelNote,
        }
      : {}),
    priority: draft.priority,
    assigneeIds: [...draft.assigneeIds],
    dueDate: draft.due,
    labels: [...draft.labels],
    ...(draft.subtasks.length === 0
      ? {}
      : { subtasks: draft.subtasks.map((name: string) => ({ name })) }),
    ...(draft.checklist.length === 0
      ? {}
      : { checklist: draft.checklist.map((text: string) => ({ text })) }),
  };
}

/**
 * Function toSubtaskCreation
 *
 * @description
 * Maps the dialog's draft to the body that creates it as a subtask: a subtask is created alone,
 * so drafted subtasks and checklist entries are not part of it.
 *
 * @param {TaskDraft} draft - Submitted draft.
 * @returns {SubtaskCreationBody} The request body of `POST /v1/tasks/{taskKey}/subtasks`.
 */
export function toSubtaskCreation(draft: TaskDraft): SubtaskCreationBody {
  const body: TaskCreationBody = toTaskCreation(draft);
  return {
    name: body.name,
    ...(body.description === undefined ? {} : { description: body.description }),
    status: body.status,
    ...(body.cancelReason === undefined
      ? {}
      : { cancelReason: body.cancelReason, cancelNote: body.cancelNote }),
    priority: body.priority,
    assigneeIds: body.assigneeIds,
    dueDate: body.dueDate,
    labels: body.labels,
  };
}

/**
 * Function toCreatedTask
 *
 * @description
 * Maps the created task to what the toast and the listening lists need.
 *
 * @param {CreateTaskClientResult} task - Task returned by the gateway.
 * @param {number} subtasks - Number of subtasks sent with it.
 * @returns {CreatedTask} The created task.
 */
export function toCreatedTask(task: CreateTaskClientResult, subtasks: number): CreatedTask {
  return { key: task.key, listId: task.listId, status: task.status, subtasks };
}
