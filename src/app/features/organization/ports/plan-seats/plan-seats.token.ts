import { InjectionToken } from '@angular/core';

import type { PlanSeatsPort } from './plan-seats-port.interface';

/**
 * Constant PLAN_SEATS
 *
 * @description
 * The plan and free seats of the workspace's organization, provided on `/:org` by
 * `provideOrganizationUsage()`.
 *
 * @type {InjectionToken<PlanSeatsPort>}
 */
export const PLAN_SEATS: InjectionToken<PlanSeatsPort> = new InjectionToken<PlanSeatsPort>(
  'PLAN_SEATS',
);
