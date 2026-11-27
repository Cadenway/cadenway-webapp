# Onboarding

## Purpose

The person's first launch in an organization (`App.dc.html`, artboard prop `onboarding`): the
four-step assistant (`Space`, `Template`, `Team`, `Import`) that provisions the first space, then
the `Getting started` checklist that ticks itself off as the person creates a task, invites a
member and tries the `Board` view. Both are overlays of the application shell, over the page
shown. Creating the organization belongs to Auth, which will open `/<slug>?onboarding=start`
afterwards (step 9, wizard package); the space, lists and tasks the assistant creates belong to
Spaces and Task once they exist; the invitations are organization invitations, which
Organization manages.

What exists so far is the foundation: the state, the data access and two hosts that render
nothing. The assistant comes with step 9's wizard package, the checklist with its getting-started
package.

## Routes

None: overlays only. `provideOnboarding()` provides the state on `/:org`, and the hosts mount in
the application shell's `overlays` slot (not in the settings shells):

| Contribution             | Id                           | Order | Host                                                 |
| ------------------------ | ---------------------------- | ----- | ---------------------------------------------------- |
| `withGettingStarted()`   | `onboarding.getting-started` | 40    | `GettingStartedHost` (`cw-getting-started-host`)     |
| `withOnboardingWizard()` | `onboarding.wizard`          | 50    | `OnboardingWizardHost` (`cw-onboarding-wizard-host`) |

Both hosts render nothing yet (step 9, wizard and getting-started packages).

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
  `InvitationsService.inviteMembers` (role `member`; called from step 9, wizard and
  getting-started packages). Core's `OrganizationPin` adds `If-Organization-Match` to the four
  onboarding operations.
- `@core/api` (`readProblem`, `OrganizationSwitchPendingError`).
- Workspace's `ports/workspace-context` (the current organization, which fences every write; the
  role checks come with step 9, wizard and getting-started packages).
- Spaces' `utils/space-look`: the `LookColor` type today; `prefixFromName` and
  `lookColorChoices` for the first space's prefix and color names (step 9, wizard package).
- Not used yet, declared for the next packages: Spaces' `ports/navigation-refresh`
  (`NAVIGATION_REFRESH`, to show the provisioned space in the sidebar; step 9, wizard package)
  and Task's `.` entry (`TaskCreate`, for the checklist's `Create your first task`; step 9,
  getting-started package).
- `@shared/layout-slot` (`SlotContribution`, `SlotFeature`).

## Invariants

- Who sees the assistant (step 9, wizard package): `getOnboarding` answers an `in-progress` state
  at version 1 for every member, so it does not tell (contract gap G1). The assistant will open
  when Auth's creation opened `/<slug>?onboarding=start`, and by itself on Home only when the
  draft was saved past version 1; never for a guest (`finishOnboarding` refuses one). It will
  close with `Set up later` only, never with Escape or a click outside, since dismissal is final.
- `OnboardingStore` is route-scoped on `/:org` (`provideOnboarding()`) and shared by both hosts;
  leaving `/:org` destroys it. It reads nothing until a screen calls `load()`, then holds the
  latest progress the gateway answered (`progress`, null while unread or when the first read
  failed; `loading`, `failed`, `reload()`). A later failed read keeps the progress shown, and an
  answer older than the version shown is dropped. The reads are hand-written rather than a
  `resource()`: they share the writes' version and queue, and a failed refresh keeps the
  progress shown.
- Every write and every answer is fenced on the organization it started in: the store compares
  its organization with the workspace's and with `OrganizationPin`'s (both committed
  synchronously by the resolver; the pin's organization stamps the requests), checks its own
  generation, which an organization switch moves, and that it is not destroyed. Once any of them
  differs, nothing more is sent or applied for the previous organization, and the caller gets
  `OnboardingWriteDroppedError`, never a stale result. Leaving `/:org` destroys the store: its
  reads are aborted, its queue is reset, and its queued or unanswered writes, a reread or a resend
  after a `412` included, are dropped, so none goes out under the next organization's pin.
  The same error answers a write the organization pin blocked (`OrganizationSwitchPendingError`)
  or the gateway refused for another session organization (`412 organization.context-changed`);
  such a write is neither retried nor rolled back in the next organization. A switch drops the
  progress, aborts the reads, starts a new write queue (the next organization's writes never wait
  behind the previous one's) and reads the new organization's progress when a screen had asked.
- Writes (`saveDraft`, `dismiss`, `finish`, `setPresentation`, `recordInvitation`,
  `recordBoardTried`) are sent one after the other, each with the version the previous one
  answered. Their outcomes are classified:
  - after `412 request.version-mismatch` a draft or checklist write reads the progress and sends
    once more, unless the read shows the change, a closed assistant or a dismissed checklist; a
    failed read keeps the `412`;
  - an uncertain outcome (`isUncertainOnboardingWrite`: no answer, `408`, `5xx`,
    `409 idempotency.request-in-progress`) reads the progress and resolves when it shows the
    change, else rejects with the original failure;
  - a definite refusal rejects, after a read for `409 onboarding.wizard-closed`,
    `409 onboarding.checklist-unavailable` or a second `412`.
- `finish` never sends twice and never reads by itself after an uncertain outcome: its caller
  sends again with the same `Idempotency-Key`, which replays the original answer. After a `412`
  or a `409` it reads the progress and rejects, and the caller chooses a new key for a new body.
- `setPresentation` shows the presentation at once, keeps it when the read after an uncertain
  outcome shows it, and restores the confirmed one after a refusal, rejecting for the caller's
  toast (step 9, getting-started package). Only the latest call clears what it showed.
  Presentation and `boardTried` are sent only once a space is provisioned; a marker already
  recorded is not sent again. `invitationSent` is to be recorded only after `inviteMembers`
  invited at least one address; any other outcome, an unknown one included, counts as not sent.
- A draft color a later contract adds reads as `gris`, as `LookColorValue` says; the assistant
  draws no `gris` swatch (step 9, wizard package, decides how to show it).
- The checklist will have the three items the contract records (step 9, getting-started
  package): `firstTaskCreated`, set by the gateway; `invitationSent`; `boardTried`. The mockup's
  reminder and mobile items have no marker (gaps G2 and G3). A failed checklist read will show
  nothing.
