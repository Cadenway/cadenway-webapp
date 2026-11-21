import type { StatusKey } from '@cadenway/contracts';

/**
 * Interface TaskStatusOption
 *
 * @description
 * One status option as the current space displays it.
 */
export interface TaskStatusOption {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Stable status identifier shared by the API and the design system.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly key: StatusKey;

  /**
   * Property label
   *
   * @description
   * Customized space label or the mockup default.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property selectable
   *
   * @description
   * Whether the current task can select this normal status.
   *
   * @type {boolean}
   * @readonly
   */
  readonly selectable: boolean;
  // #endregion
}

/**
 * Interface TaskDetailLink
 *
 * @description
 * A task name and the key used for internal navigation.
 */
export interface TaskDetailLink {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Task key local to the current organization.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property name
   *
   * @description
   * Visible task title.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;
  // #endregion
}

/**
 * Interface TaskDetailComment
 *
 * @description
 * Content already authorized by the task-detail operation.
 */
export interface TaskDetailComment {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Stable identity for tracking a comment when its content changes.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property body
   *
   * @description
   * Markdown content without provider or account credentials.
   *
   * @type {string}
   * @readonly
   */
  readonly body: string;
  // #endregion
}

/**
 * Interface TaskDetailView
 *
 * @description
 * Task detail ready for presentation and a versioned status change.
 */
export interface TaskDetailView extends TaskDetailLink {
  // #region Properties
  /**
   * Property description
   *
   * @description
   * Markdown content of the task, when supplied.
   *
   * @type {string | null}
   * @readonly
   */
  readonly description: string | null;

  /**
   * Property status
   *
   * @description
   * Latest status displayed by the page.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property version
   *
   * @description
   * Last confirmed version used for the next write precondition.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property mayEditStatus
   *
   * @description
   * Whether the current list grants editing and the task is active.
   *
   * @type {boolean}
   * @readonly
   */
  readonly mayEditStatus: boolean;

  /**
   * Property options
   *
   * @description
   * Current labels and selectable statuses from the space.
   *
   * @type {readonly TaskStatusOption[]}
   * @readonly
   */
  readonly options: readonly TaskStatusOption[];

  /**
   * Property space
   *
   * @description
   * Space breadcrumb and context for the list link.
   *
   * @type {{ readonly id: string; readonly name: string }}
   * @readonly
   */
  readonly space: { readonly id: string; readonly name: string };

  /**
   * Property list
   *
   * @description
   * List breadcrumb and destination for the return link.
   *
   * @type {{ readonly id: string; readonly name: string }}
   * @readonly
   */
  readonly list: { readonly id: string; readonly name: string };

  /**
   * Property parent
   *
   * @description
   * Parent task when this task is a subtask.
   *
   * @type {TaskDetailLink | null}
   * @readonly
   */
  readonly parent: TaskDetailLink | null;

  /**
   * Property subtasks
   *
   * @description
   * Direct subtasks the detail response includes.
   *
   * @type {readonly TaskDetailLink[]}
   * @readonly
   */
  readonly subtasks: readonly TaskDetailLink[];

  /**
   * Property comments
   *
   * @description
   * Authorized first comments page when the gateway reports it.
   *
   * @type {readonly TaskDetailComment[] | undefined}
   * @readonly
   */
  readonly comments: readonly TaskDetailComment[] | undefined;

  /**
   * Property commentsUnavailable
   *
   * @description
   * Whether the gateway reports a comments-only failure.
   *
   * @type {boolean}
   * @readonly
   */
  readonly commentsUnavailable: boolean;
  // #endregion
}

/**
 * Interface TaskStatusConfirmation
 *
 * @description
 * Server-confirmed result of one status mutation.
 */
export interface TaskStatusConfirmation {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Task key named by the successful mutation.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property status
   *
   * @description
   * Committed status used to replace the optimistic value.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property version
   *
   * @description
   * New task version from the committed response.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
/**
 * Interface TaskRouteContext
 *
 * @description
 * Identifies the task and the organization resolved together for the current route.
 */
export interface TaskRouteContext {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The tenant-scoped task key.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property organizationId
   *
   * @description
   * The expected organization associated with this task key.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;
  // #endregion
}
