/**
 * Interface SlotFeature
 *
 * @description
 * Contribution factory a feature publishes (`with<Thing>()`) and a route hands to a layout's
 * `provide<Layout>Slots(config)`. The factory runs in an injection context when the slot is first
 * injected, so the contribution may inject the feature's own services; the feature never imports
 * the layout.
 *
 * @template T - Shape the slot expects.
 */
export interface SlotFeature<T> {
  // #region Properties
  /**
   * Property useFactory
   *
   * @description
   * Builds the contribution when the slot is first injected.
   *
   * @type {() => T}
   * @readonly
   */
  readonly useFactory: () => T;
  // #endregion
}
