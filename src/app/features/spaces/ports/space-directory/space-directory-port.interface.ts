import type { Signal } from '@angular/core';

/**
 * Type SpaceDirectoryRole
 *
 * @description
 * The caller's role on a space itself, from the least to the most: `view`, `comment` or `edit`
 * (settings, lists, documents and goals of the space).
 *
 * @type {'edit' | 'comment' | 'view'}
 */
export type SpaceDirectoryRole = 'edit' | 'comment' | 'view';

/**
 * Interface SpaceDirectoryEntry
 *
 * @description
 * A space of the workspace as the sidebar shows it, for another feature to name it, mark it and
 * decide what the caller may do in it (the documents' space column and `New document`, the space of
 * an archived list, the goals the caller may create).
 */
export interface SpaceDirectoryEntry {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Space identifier; its overview opens at `/:org/spaces/:id`.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Space name (`Product`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property icon
   *
   * @description
   * Its Bold Phosphor icon name, registered by `provideCadenwayIcons()`, or null when the space
   * shows the first letter of its name instead.
   *
   * @type {string | null}
   * @readonly
   */
  readonly icon: string | null;

  /**
   * Property tone
   *
   * @description
   * Literal text color class of its mark (`text-muted-foreground` for the default gray).
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;

  /**
   * Property callerRole
   *
   * @description
   * The caller's role on the space itself, or null when the caller sees only some of its lists
   * through their grants, as a guest does (no list, document or goal may be created in it). A
   * space the gateway sends without a role reads as `edit`, an unknown role as `view`. The
   * gateway still answers `403` to a write the role does not allow.
   *
   * @type {SpaceDirectoryRole | null}
   * @readonly
   */
  readonly callerRole: SpaceDirectoryRole | null;
  // #endregion
}

/**
 * Interface SpaceDirectoryPort
 *
 * @description
 * Read-only access to the spaces of the workspace, in sidebar order. It follows the sidebar's
 * read: empty until it lands or when it failed, and refreshed with it.
 */
export interface SpaceDirectoryPort {
  // #region Properties
  /**
   * Property spaces
   *
   * @description
   * Every space the caller sees.
   *
   * @type {Signal<readonly SpaceDirectoryEntry[]>}
   * @readonly
   */
  readonly spaces: Signal<readonly SpaceDirectoryEntry[]>;
  // #endregion
}
