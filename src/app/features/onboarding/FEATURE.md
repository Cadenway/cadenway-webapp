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

What exists so far is the foundation (the state, the data access and the internal invitation
field) and the `Getting started` checklist with its invite dialog. The assistant comes with step
9's wizard package.

`OnboardingInviteField` (`cw-onboarding-invite-field`, `ui/components/onboarding-invite-field/`) is
internal, not a public entry: the presentational invitation field (`App.dc.html` lines 2694-2695)
that both the assistant's `Team` step and the getting-started invite dialog render. It edits the
list of addresses (`[(emails)]`, `disabled`) and sends nothing; the screen that renders it calls
`inviteMembers`. The getting-started invite dialog renders it, so its copy
(`@@onboarding.invite.*`) is in `messages.json` and `messages.fr.json`.

`GettingStartedPanel` (`cw-getting-started-panel`, `ui/components/getting-started-panel/`) and
`OnboardingInviteDialog` (`cw-onboarding-invite-dialog`, `ui/dialogs/onboarding-invite-dialog/`)
are internal and presentational; `GettingStartedHost` renders both from `GettingStartedStore`
(`state/getting-started/`), which it provides.

## Routes

None: overlays only. `provideOnboarding()` provides the state on `/:org`, and the hosts mount in
the application shell's `overlays` slot (not in the settings shells):

| Contribution             | Id                           | Order | Host                                                 |
| ------------------------ | ---------------------------- | ----- | ---------------------------------------------------- |
| `withGettingStarted()`   | `onboarding.getting-started` | 40    | `GettingStartedHost` (`cw-getting-started-host`)     |
| `withOnboardingWizard()` | `onboarding.wizard`          | 50    | `OnboardingWizardHost` (`cw-onboarding-wizard-host`) |

`GettingStartedHost` renders the checklist and its invite dialog, each in its own chunk;
`OnboardingWizardHost` renders nothing yet (step 9, wizard package).

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
- Workspace's `ports/workspace-context` (the current organization, which fences every write;
  `can('admin')` shows the checklist's invitation item; the assistant's role checks come with
  step 9, wizard package).
- Spaces' `utils/space-look`: the `LookColor` type today; `prefixFromName` and
  `lookColorChoices` for the first space's prefix and color names (step 9, wizard package).
- Task's `.` entry: `TaskCreate`, whose `open({ listId })` the checklist's
  `Create your first task` calls on the first list, and whose `created` makes it read the
  progress again.
- Not used yet, declared for the next package: Spaces' `ports/navigation-refresh`
  (`NAVIGATION_REFRESH`, to show the provisioned space in the sidebar; step 9, wizard package).
- `@shared/layout-slot` (`SlotContribution`, `SlotFeature`, `ShellOverlay`: the invite dialog
  opens as `onboarding.invite-dialog`, and the checklist hides while `onboarding.wizard` is open).
- `@cadenway/ui` (`button`, `dialog`, `input`, `progress`, `toast`) and `@cadenway/icons`.

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
- `OnboardingInviteField` is its own `<form>`, so a host never nests it in another form. Any text,
  blank text included, must match the mockup's pattern once trimmed
  (`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`, line 5258); only an empty field is valid, and `Add` then adds
  nothing. Once the field is touched (blurred, or submitted with `Add`), an invalid address shows
  the error under the field, which describes it, and `CwInput` sets `aria-invalid` from the same
  field state. A valid address is added once, compared without regard to case (the mockup
  compares it as typed), and the field empties and is untouched again. The focus returns to
  the field after an add, and after a removal goes to the remove button now at that place, else
  the last one, else the field. The mockup's guest badge (line 2695) is not drawn (gap G5).
- The `Getting started` checklist (`App.dc.html` lines 2712-2727, behaviour 5299-5319) shows
  when the assistant finished (`wizard.status` `finished`) and provisioned the first space, the
  presentation is not `dismissed`, and the assistant is not the open `ShellOverlay`
  (`onboarding.wizard`). Nothing shows while the progress is unread, nor when its first read
  failed (a shell widget for almost nobody: no error card); a later failed read keeps it.
- It has the three items the contract records, in the mockup's order: `Create your first task`
  (`firstTaskCreated`, set by the gateway when the person creates a task in the space),
  `Invite a team member` (`invitationSent`; shown to an owner or administrator only, since
  `inviteMembers` refuses the others) and `Try the Board view` (`boardTried`). The counter reads
  `{done} of {total}` over the items shown. The mockup's reminder and mobile items have no marker
  (gaps G2 and G3) and are not shipped. A done item stays pressable, as in the mockup.
- `Create your first task` opens `TaskCreate` on `provisioning.firstListId`; `Try the Board view`
  opens `/<slug>/l/<firstListId>/board`; `Invite a team member` opens the invite dialog, not the
  list's share dialog the mockup opens (sharing a list sends no organization invitation, so it
  could not record the marker).
- The collapse toggle and `Hide “Getting started”` change the presentation at once through
  `setPresentation`; a refusal restores the confirmed one with a failure toast
  (`The list could not be updated`, `“Getting started” could not be hidden`, not in the
  mockup), and a write
  dropped for a changed organization (`OnboardingWriteDroppedError`) shows nothing. The
  dismissal is final.
- The board watcher records `boardTried` when the address is a list's `Board` view
  (`/<slug>/l/<id>/board`, any list), on each `NavigationEnd` and for the address shown when the
  progress arrives, only while the checklist applies and the marker is not recorded. Its write
  stays silent: a navigation into another organization's board is dropped by the store's
  organization fence, and a refusal is retried on the next board visit.
- With no realtime fact for onboarding (gap G8), the checklist reads the progress again after
  each `TaskCreate.created` and when the tab becomes visible, only while `firstTaskCreated` is
  not set. It does not poll.
- The invite dialog (titled `Invite a team member`, with `Cancel` and `Invite`) invites the
  addresses as members, then toasts the outcome (`{n} invitation(s) sent`, the skipped addresses
  as the description, or `No invitation sent` when every address was skipped) and closes; it then
  records `invitationSent` when at least one address was invited, silently. A failure keeps the
  dialog and its addresses with `The invitations could not be sent` (and the daily-limit line for
  `429 invitation.daily-limit-reached`); nothing shows when the organization changed meanwhile.
  The addresses empty each time it opens.
