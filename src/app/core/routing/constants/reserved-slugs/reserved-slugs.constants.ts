/**
 * Constant RESERVED_SLUGS
 *
 * @description
 * Every fixed first segment of the application's addresses: Auth's public screens (`login`,
 * `signup`, `forgot`, `reset`, `logged-out`, `organizations`, `invite`, `auth`), the workspace's
 * slug-less e-mail links (`home`, `account`, `org`) and intake's public forms (`f`). An
 * organization whose slug is one of them cannot be opened at `/<slug>`: the fixed route wins, so
 * a redirect there would loop. organization-service will refuse these slugs; until it does, the
 * application never navigates to `/<slug>` for one of them and opens `/organizations` instead.
 * `app.routes.spec.ts` checks the list against the route tables.
 *
 * @type {ReadonlySet<string>}
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'login',
  'signup',
  'forgot',
  'reset',
  'logged-out',
  'organizations',
  'invite',
  'auth',
  'home',
  'account',
  'org',
  'f',
]);

/**
 * Function isReservedSlug
 *
 * @description
 * Whether an organization slug collides with a fixed first segment, compared without regard to
 * case since the router matches paths case-sensitively but slugs are lowercase.
 *
 * @param {string} slug - Organization slug.
 * @returns {boolean} Whether `/<slug>` would open a fixed route instead of the workspace.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Function workspacePath
 *
 * @description
 * The address of an organization's workspace, or `/organizations` when its slug is reserved or
 * empty, so a navigation never lands on a fixed route or loops.
 *
 * @param {string} slug - Organization slug.
 * @returns {string} `/<slug>` or `/organizations`.
 */
export function workspacePath(slug: string): string {
  return slug === '' || isReservedSlug(slug) ? '/organizations' : `/${slug}`;
}
