/**
 * Constant PLAN_NAMES
 *
 * @description
 * Display names of the plan keys Billing reports today (`Free`, `Team`, `Enterprise`).
 *
 * @type {Readonly<Record<string, string>>}
 */
const PLAN_NAMES: Readonly<Record<string, string>> = {
  free: $localize`:@@organization.plan.free:Free`,
  team: $localize`:@@organization.plan.team:Team`,
  enterprise: $localize`:@@organization.plan.enterprise:Enterprise`,
};

/**
 * Function planName
 *
 * @description
 * Names a plan key for display. Billing may add plan keys later (its contract says so): an
 * unknown key is shown as it is rather than hidden.
 *
 * @param {string} plan - Plan key (`free`, `team`, `enterprise`, or a later key).
 * @returns {string} The plan's display name.
 */
export function planName(plan: string): string {
  return Object.hasOwn(PLAN_NAMES, plan) ? PLAN_NAMES[plan] : plan;
}
