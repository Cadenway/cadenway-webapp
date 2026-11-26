import type { Signal } from '@angular/core';

/**
 * Interface ListDirectoryEntry
 *
 * @description
 * A list of the workspace as the sidebar shows it, for another feature to offer it (the command
 * palette's `Lists`).
 */
export interface ListDirectoryEntry {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * List identifier; the list opens at `/:org/l/:id`.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * List name (`Sprint 14`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property spaceId
   *
   * @description
   * Identifier of its space.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property spaceName
   *
   * @description
   * Name of its space (`Product`).
   *
   * @type {string}
   * @readonly
   */
  readonly spaceName: string;

  /**
   * Property icon
   *
   * @description
   * Its Bold Phosphor icon name, registered by `provideCadenwayIcons()`.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property tone
   *
   * @description
   * Literal text color class of its icon (`text-muted-foreground` for the default gray).
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;
  // #endregion
}

/**
 * Interface ListDirectoryPort
 *
 * @description
 * Read-only access to the lists of the workspace, in sidebar order (spaces in order, then their
 * lists in order of creation). It follows the sidebar's reads: empty until they land, and without
 * the lists of a space whose read failed.
 */
export interface ListDirectoryPort {
  // #region Properties
  /**
   * Property lists
   *
   * @description
   * Every unarchived list the caller sees.
   *
   * @type {Signal<readonly ListDirectoryEntry[]>}
   * @readonly
   */
  readonly lists: Signal<readonly ListDirectoryEntry[]>;
  // #endregion
}
