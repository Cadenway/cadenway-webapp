import type { IntakeFieldKey, IntakeFieldMode, IntakeFormSettings } from '@features/intake';

import type { StatusKey } from '../list-view-config/list-view-config.interface';

/**
 * Interface IntakeFormDraft
 *
 * @description
 * The settings of a list's request form an editor changes: what the form shows, and the status
 * and assignee of the task each request creates.
 */
export interface IntakeFormDraft extends IntakeFormSettings {
  // #region Properties
  /**
   * Property defaultStatus
   *
   * @description
   * Status of the created task.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly defaultStatus: StatusKey;

  /**
   * Property defaultAssigneeId
   *
   * @description
   * User assigned to the created task, or null for nobody.
   *
   * @type {string | null}
   * @readonly
   */
  readonly defaultAssigneeId: string | null;
  // #endregion
}

/**
 * Interface IntakeFormConfiguration
 *
 * @description
 * A list's request form as its editors see it.
 */
export interface IntakeFormConfiguration {
  // #region Properties
  /**
   * Property settings
   *
   * @description
   * The saved settings.
   *
   * @type {IntakeFormDraft}
   * @readonly
   */
  readonly settings: IntakeFormDraft;

  /**
   * Property publicKey
   *
   * @description
   * Key of the current publication, the last segment of the public link, or null when the form is
   * not published.
   *
   * @type {string | null}
   * @readonly
   */
  readonly publicKey: string | null;

  /**
   * Property version
   *
   * @description
   * Version of the settings, the `If-Match` precondition of a change.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Interface IntakeFormChange
 *
 * @description
 * The settings an editor changed, each one optional; only the fields named change mode.
 */
export interface IntakeFormChange {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * New heading.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly title?: string;

  /**
   * Property description
   *
   * @description
   * New introduction, or null to remove it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly description?: string | null;

  /**
   * Property fields
   *
   * @description
   * New modes of some fields.
   *
   * @type {Partial<Record<IntakeFieldKey, IntakeFieldMode>> | undefined}
   * @readonly
   */
  readonly fields?: Partial<Record<IntakeFieldKey, IntakeFieldMode>>;

  /**
   * Property defaultStatus
   *
   * @description
   * New status of the created task.
   *
   * @type {StatusKey | undefined}
   * @readonly
   */
  readonly defaultStatus?: StatusKey;

  /**
   * Property defaultAssigneeId
   *
   * @description
   * New assignee of the created task, or null for nobody.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly defaultAssigneeId?: string | null;
  // #endregion
}
