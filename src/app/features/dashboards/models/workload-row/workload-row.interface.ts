import type { Person } from '@features/task';

/**
 * Type WorkloadZone
 *
 * @description
 * How loaded a person is against the threshold: `critical` above it (`Overloaded`, grenat),
 * `high` from one task under it (`High load`, balise), `normal` otherwise (`App.dc.html` lines
 * 6688-6698).
 *
 * @type {'normal' | 'high' | 'critical'}
 */
export type WorkloadZone = 'normal' | 'high' | 'critical';

/**
 * Interface WorkloadRow
 *
 * @description
 * One person of `Workload per person`: who, how many open tasks they hold and its zone.
 */
export interface WorkloadRow {
  // #region Properties
  /**
   * Property person
   *
   * @description
   * The assignee, named from the member list.
   *
   * @type {Person}
   * @readonly
   */
  readonly person: Person;

  /**
   * Property count
   *
   * @description
   * Open tasks assigned to them.
   *
   * @type {number}
   * @readonly
   */
  readonly count: number;

  /**
   * Property zone
   *
   * @description
   * Their zone against the threshold.
   *
   * @type {WorkloadZone}
   * @readonly
   */
  readonly zone: WorkloadZone;
  // #endregion
}
