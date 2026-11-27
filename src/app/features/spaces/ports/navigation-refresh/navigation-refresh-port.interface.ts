/**
 * Interface NavigationRefreshPort
 *
 * @description
 * Lets another feature tell the sidebar that one of its own writes changed what the sidebar shows,
 * since no realtime notice reaches the sidebar for it: a restore, a purge or an emptying of the
 * trash, an unarchived list or task. Each call only schedules reads; it never fails, and a read
 * already in flight is followed by one more.
 */
export interface NavigationRefreshPort {
  // #region Methods
  /**
   * Method refresh
   *
   * @description
   * Reads the spaces and every space's lists and counts again, after a write that may bring a list
   * or a space back to the sidebar (a restore with `listRestored` or `spaceRestored`, an
   * unarchived list). The favorites are read again too, so a favorite list or space that comes back
   * shows again in `Favorites` and in the rail, and so are the trash and archive counts.
   */
  refresh(): void;

  /**
   * Method refreshCounts
   *
   * @description
   * Reads the trash and archive counts of the sidebar footer again, after a write that changes
   * only them (a purge, an emptied trash, an unarchived task). A count still in its first read is
   * read once more when that read ends.
   */
  refreshCounts(): void;
  // #endregion
}
