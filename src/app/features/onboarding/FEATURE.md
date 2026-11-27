# Onboarding

## Purpose

The person's first launch in an organization (`App.dc.html`, artboard prop `onboarding`): the
four-step assistant (`Space`, `Template`, `Team`, `Import`) that provisions the first space, then
the `Getting started` checklist that ticks itself off as the person creates a task, invites a
member and tries the `Board` view. Both are overlays of the application shell, over the page
shown. Creating the organization, and opening `/<slug>?onboarding=start` afterwards, belong to
Auth; the space, lists and tasks the assistant creates belong to Spaces and Task once they exist;
the invitations are organization invitations, which Organization manages.

## Routes

None: overlays only. `provideOnboarding()` provides the state on `/:org`, and the hosts mount in
the application shell's `overlays` slot (not in the settings shells):

| Contribution             | Id                           | Order | Host                                                 |
| ------------------------ | ---------------------------- | ----- | ---------------------------------------------------- |
| `withGettingStarted()`   | `onboarding.getting-started` | 40    | `GettingStartedHost` (`cw-getting-started-host`)     |
| `withOnboardingWizard()` | `onboarding.wizard`          | 50    | `OnboardingWizardHost` (`cw-onboarding-wizard-host`) |

Both hosts render nothing yet; the assistant and the checklist come with the next packages of
step 9.

## Public entry points

| Entry point | Consumers |
| ----------- | --------- |
| `providers` | workspace |

`providers` publishes `provideOnboarding()` (the route-scoped `OnboardingStore`, for the `/:org`
route), `withGettingStarted()` and `withOnboardingWizard()` (the `overlays` contributions above).

## Dependencies

- `@cadenway/api-client` through `data-access/` (`OnboardingApi`): `MyTasksService`
  (`getOnboarding`, `updateOnboarding`, `updateOnboardingChecklist` and `finishOnboarding`, each
  write with `If-Match: "<version>"`, `finishOnboarding` with an `Idempotency-Key` too) and
  `InvitationsService.inviteMembers` (role `member`). Core's `OrganizationPin` adds
  `If-Organization-Match` to the four onboarding operations.
- `@core/api` (`readProblem`).
- Workspace's `ports/workspace-context` (the current organization; the role checks of the
  assistant and the checklist).
- Spaces' `utils/space-look` (`prefixFromName`, `lookColorChoices`, `LookColor`), the prefix and
  color names of the first space, and its `ports/navigation-refresh` (`NAVIGATION_REFRESH`), to
  show the provisioned space in the sidebar.
- Task's `.` entry (`TaskCreate`), for the checklist's `Create your first task`.
- `@shared/layout-slot` (`SlotContribution`, `SlotFeature`).

## Invariants

- Who sees the assistant: `getOnboarding` answers an `in-progress` state at version 1 for every
  member, so it does not tell (contract gap G1). The assistant opens when Auth's creation opened
  `/<slug>?onboarding=start`, and by itself on Home only when the draft was saved past version 1;
  never for a guest (`finishOnboarding` refuses one). It is closed with `Set up later` only, never
  with Escape or a click outside, since dismissal is final.
- `OnboardingStore` is route-scoped on `/:org` (`provideOnboarding()`) and shared by both hosts;
  leaving `/:org` destroys it. It reads nothing until a screen calls `load()`, then holds the
  latest progress the gateway answered (`progress`, null while unread or when the first read
  failed; `loading`, `failed`, `reload()`). A later failed read keeps the progress shown, and an
  answer older than the version shown is dropped. An organization switch drops the progress and
  every answer still under way, never sends a write queued for the previous organization, and
  reads the new organization's progress if a screen had asked for it.
- Writes (`saveDraft`, `dismiss`, `finish`, `setPresentation`, `recordInvitation`,
  `recordBoardTried`) go through the store, one after the other, each with the version the
  previous one answered. After `412 request.version-mismatch` a draft or checklist write reads the
  progress and sends once more; after `409 onboarding.wizard-closed` or
  `409 onboarding.checklist-unavailable` it reads the progress, then rejects. `finish` never sends
  twice by itself (an idempotency replay can repeat a refusal): it reads the progress and rejects,
  and its caller chooses the next key, the same one after an unknown outcome, a new one for a new
  body.
- `setPresentation` shows the presentation at once and restores the confirmed one when the save
  fails, rejecting for the caller's toast. Presentation and `boardTried` are sent only once a
  space is provisioned; a marker already recorded is not sent again. `invitationSent` is recorded
  only after `inviteMembers` invited at least one address; any other outcome, an unknown one
  included, counts as not sent.
- The checklist has the three items the contract records (`firstTaskCreated`, set by the
  gateway; `invitationSent`; `boardTried`). The mockup's reminder and mobile items have no marker
  (gaps G2 and G3). A failed checklist read shows nothing.
