/**
 * Interface ViewOption
 *
 * @description
 * A choice of a view menu or filter: its value and its label in the user's language.
 */
export interface ViewOption<T extends string = string> {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * Chosen value.
   *
   * @type {T}
   * @readonly
   */
  readonly value: T;

  /**
   * Property label
   *
   * @description
   * Label shown.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Interface FilterChip
 *
 * @description
 * An active filter of the chips row: « Statut est l’un de À faire, En cours ».
 */
export interface FilterChip {
  // #region Properties
  /**
   * Property field
   *
   * @description
   * Filter field.
   *
   * @type {'status' | 'priority' | 'assignee' | 'label'}
   * @readonly
   */
  readonly field: 'status' | 'priority' | 'assignee' | 'label';

  /**
   * Property icon
   *
   * @description
   * Icon of the field.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property name
   *
   * @description
   * Name of the field (« Statut »).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property operator
   *
   * @description
   * « est » for one value, « est l’un de » for several.
   *
   * @type {string}
   * @readonly
   */
  readonly operator: string;

  /**
   * Property values
   *
   * @description
   * Values kept, joined.
   *
   * @type {string}
   * @readonly
   */
  readonly values: string;
  // #endregion
}
