/**
 * Interface TaskMoveTarget
 *
 * @description
 * A list tasks may move to (`Move to` of the task menu and of a selection bar), with its icon,
 * its tone and its space.
 */
export interface TaskMoveTarget {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * Destination list.
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
   * Its space's name.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceName: string;

  /**
   * Property icon
   *
   * @description
   * Icon of the list (its own, the sprint's lightning or the bullets).
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property tone
   *
   * @description
   * Text class of the list's color, `text-muted-foreground` for grey.
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;
  // #endregion
}
