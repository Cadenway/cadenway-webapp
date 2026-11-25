/**
 * Interface Person
 *
 * @description
 * A member of the organization as the people pickers and the avatars show them.
 */
export interface Person {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * User id, the one tasks list among their assignees.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Full name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property initials
   *
   * @description
   * One or two capital letters drawn in the avatar (`CM` for Camille Martin).
   *
   * @type {string}
   * @readonly
   */
  readonly initials: string;

  /**
   * Property avatar
   *
   * @description
   * Address of the profile picture, or null: the avatar then draws the initials. The member list
   * gives only an avatar id, so the adapter leaves it null until a picture address is available.
   *
   * @type {string | null}
   * @readonly
   */
  readonly avatar: string | null;
  // #endregion
}
