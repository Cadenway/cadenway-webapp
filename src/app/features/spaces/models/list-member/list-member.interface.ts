/**
 * Interface ListMember
 *
 * @description
 * A person the list is shared with, for the avatars of the header.
 */
export interface ListMember {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property name
   *
   * @description
   * Directory name, or null when the directory does not list the person.
   *
   * @type {string | null}
   * @readonly
   */
  readonly name: string | null;
  // #endregion
}

/**
 * Interface ListMembers
 *
 * @description
 * The first people a list is shared with and how many there are.
 */
export interface ListMembers {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * First grants, in the order access was given.
   *
   * @type {readonly ListMember[]}
   * @readonly
   */
  readonly items: readonly ListMember[];

  /**
   * Property total
   *
   * @description
   * Every grant of the list.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}
