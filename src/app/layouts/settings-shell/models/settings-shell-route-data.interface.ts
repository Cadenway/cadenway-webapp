/**
 * Interface SettingsShellRouteData
 *
 * @description
 * Route `data` of the route that loads `SettingsShell`, declared with `satisfies` so a missing or
 * misspelled key fails the type check.
 */
export interface SettingsShellRouteData {
  // #region Properties
  /**
   * Property settingsNavigationLabel
   *
   * @description
   * Localized accessible name of the settings navigation: `Settings` for the account settings,
   * `Organization settings` for the organization settings, from a `$localize` string the
   * route owns.
   *
   * @type {string}
   * @readonly
   */
  readonly settingsNavigationLabel: string;
  // #endregion
}
