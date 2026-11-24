import type { CwStatusKey } from '@cadenway/ui/components/status-icon';

/**
 * Interface TaskSearchResult
 *
 * @description
 * A task the palette found or remembers: its key, its name and its status.
 */
export interface TaskSearchResult {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminates a task from a list.
   *
   * @type {'task'}
   * @readonly
   */
  readonly kind: 'task';

  /**
   * Property key
   *
   * @description
   * Task key (`CAD-482`), the address of the task (`/<slug>/t/<key>`).
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property name
   *
   * @description
   * Task name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property status
   *
   * @description
   * Workflow status key, drawn with `cw-status-icon`.
   *
   * @type {CwStatusKey}
   * @readonly
   */
  readonly status: CwStatusKey;
  // #endregion
}

/**
 * Interface ListSearchResult
 *
 * @description
 * A list the palette found: its identifier, its name and, when the caller may see it, the name of
 * its space.
 */
export interface ListSearchResult {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * Discriminates a list from a task.
   *
   * @type {'list'}
   * @readonly
   */
  readonly kind: 'list';

  /**
   * Property listId
   *
   * @description
   * List identifier, the address of the list (`/<slug>/l/<listId>`).
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property name
   *
   * @description
   * List name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property spaceName
   *
   * @description
   * Name of the list's space, or null when the caller has no direct access to that space.
   *
   * @type {string | null}
   * @readonly
   */
  readonly spaceName: string | null;
  // #endregion
}

/**
 * Type SearchResult
 *
 * @description
 * One match of the search across tasks and lists.
 *
 * @type {TaskSearchResult | ListSearchResult}
 */
export type SearchResult = TaskSearchResult | ListSearchResult;
