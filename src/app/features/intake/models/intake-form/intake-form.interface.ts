/**
 * Type IntakeFieldKey
 *
 * @description
 * A configurable field of a request form, in the mockup's order (`FORM_FIELDS` of
 * `App.dc.html`): the description, the priority, the due date, the requester's email and the
 * attachments. The title is always asked and is not configurable.
 *
 * @type {'description' | 'priority' | 'dueDate' | 'contactEmail' | 'attachments'}
 */
export type IntakeFieldKey =
  'description' | 'priority' | 'dueDate' | 'contactEmail' | 'attachments';

/**
 * Type IntakeFieldMode
 *
 * @description
 * Whether the form hides a field (`disabled`), asks it (`optional`) or requires it (`required`).
 *
 * @type {'disabled' | 'optional' | 'required'}
 */
export type IntakeFieldMode = 'disabled' | 'optional' | 'required';

/**
 * Type IntakePriority
 *
 * @description
 * A priority the requester may choose, from the most to the least urgent.
 *
 * @type {'urgente' | 'haute' | 'moyenne' | 'basse'}
 */
export type IntakePriority = 'urgente' | 'haute' | 'moyenne' | 'basse';

/**
 * Interface IntakeFormSettings
 *
 * @description
 * What a request form shows: its heading, its introduction and the mode of each field.
 */
export interface IntakeFormSettings {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * Heading of the form.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property description
   *
   * @description
   * Introduction under the heading, or null when there is none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly description: string | null;

  /**
   * Property fields
   *
   * @description
   * Mode of each configurable field.
   *
   * @type {Readonly<Record<IntakeFieldKey, IntakeFieldMode>>}
   * @readonly
   */
  readonly fields: Readonly<Record<IntakeFieldKey, IntakeFieldMode>>;
  // #endregion
}

/**
 * Interface IntakeRequest
 *
 * @description
 * A request as the requester filled it in. A hidden field is empty.
 */
export interface IntakeRequest {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * The request in one sentence, trimmed.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property description
   *
   * @description
   * Context, steps and expected result, trimmed; empty when not given.
   *
   * @type {string}
   * @readonly
   */
  readonly description: string;

  /**
   * Property priority
   *
   * @description
   * Chosen priority, or null.
   *
   * @type {IntakePriority | null}
   * @readonly
   */
  readonly priority: IntakePriority | null;

  /**
   * Property dueDate
   *
   * @description
   * Requested due date (`YYYY-MM-DD`), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly dueDate: string | null;

  /**
   * Property contactEmail
   *
   * @description
   * Requester's address, trimmed; empty when not given.
   *
   * @type {string}
   * @readonly
   */
  readonly contactEmail: string;

  /**
   * Property files
   *
   * @description
   * Attached files, at most five of 25 MiB each.
   *
   * @type {readonly File[]}
   * @readonly
   */
  readonly files: readonly File[];
  // #endregion
}

/**
 * Interface IntakeOrganization
 *
 * @description
 * The organization badge above the form's heading.
 */
export interface IntakeOrganization {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Name of the organization.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property initials
   *
   * @description
   * One or two letters drawn in the badge.
   *
   * @type {string}
   * @readonly
   */
  readonly initials: string;
  // #endregion
}

/**
 * Type IntakeFailure
 *
 * @description
 * Why a request was not sent: the form no longer accepts requests (`closed`), an attached file
 * was refused (`file`), or anything else (`unavailable`).
 *
 * @type {'closed' | 'file' | 'unavailable'}
 */
export type IntakeFailure = 'closed' | 'file' | 'unavailable';
