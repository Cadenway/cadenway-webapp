import type {
  ArchivedListPage,
  ArchivedTaskPage,
  FavoritePage,
  Home,
  OnboardingState,
  TrashEntryPage,
} from '@cadenway/api-client';

/**
 * The answers of the reads the workspace shell makes beside the page shown, by `METHOD /path`,
 * for an established member who has none of them: no favorite, an empty trash and empty archives,
 * an empty home screen, and the onboarding state `getOnboarding` answers before any write
 * (`in-progress` at version 1, which opens neither the assistant nor the checklist).
 */
const workspaceReads: Readonly<Record<string, unknown>> = {
  'GET /v1/me/favorites': { items: [], nextCursor: null } satisfies FavoritePage,
  'GET /v1/me/home': {
    stats: { assigned: 0, late: 0, dueToday: 0, done: 0 },
    priorities: [],
    sprints: [],
    lists: [],
  } satisfies Home,
  'GET /v1/me/onboarding': {
    version: 1,
    wizard: {
      status: 'in-progress',
      step: 'space',
      preset: 'dev',
      name: null,
      prefix: null,
      color: 'violet',
    },
    provisioning: null,
    checklist: {
      presentation: 'expanded',
      firstTaskCreated: false,
      invitationSent: false,
      boardTried: false,
    },
  } satisfies OnboardingState,
  'GET /v1/trash/entries': { items: [], nextCursor: null, total: 0 } satisfies TrashEntryPage,
  'GET /v1/archives/lists': { items: [], nextCursor: null, total: 0 } satisfies ArchivedListPage,
  'GET /v1/archives/tasks': { items: [], nextCursor: null, total: 0 } satisfies ArchivedTaskPage,
};

/**
 * The answer of a shell read a spec does not answer itself; a spec answers its own routes first.
 *
 * @param {string} key - The request, as `METHOD /path`.
 * @returns {{ json: unknown } | undefined} The answer, or undefined for another route.
 */
export function workspaceRead(key: string): { json: unknown } | undefined {
  return key in workspaceReads ? { json: workspaceReads[key] } : undefined;
}
