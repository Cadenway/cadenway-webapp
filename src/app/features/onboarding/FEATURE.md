# Onboarding

## Purpose

The person's first launch in an organization (`App.dc.html`, artboard prop `onboarding`): the
four-step assistant (`Space`, `Template`, `Team`, `Import`) that provisions the first space, then
the `Getting started` checklist that ticks itself off as the person creates a task, invites a
member and tries the `Board` view. Both are overlays of the application shell, over the page
shown. Creating the organization belongs to Auth, which opens `/<slug>?onboarding=start`
afterwards; the space, lists and tasks the assistant creates belong to Spaces and Task once they
exist; the invitations are organization invitations, which Organization manages. Importing from
another tool is not built (gap B18): the `Import` screen only offers `Later`.

The assistant: `OnboardingWizardHost` (`ui/components/onboarding-wizard-host/`), the window
`OnboardingWizard` (`ui/components/onboarding-wizard/`), its four screens
(`ui/components/onboarding-{space,preset,team,import}-step/`), `OnboardingWizardStore`
(`state/onboarding-wizard/`) and the templates and import sources (`constants/`).

`OnboardingInviteField` (`cw-onboarding-invite-field`, `ui/components/onboarding-invite-field/`) is
internal, not a public entry: the presentational invitation field (`App.dc.html` lines 2694-2695)
that both the assistant's `Team` step and the getting-started invite dialog render. It edits the
list of addresses (`[(emails)]`, `disabled`) and sends nothing; the screen that renders it calls
`inviteMembers`. Its copy (`@@onboarding.invite.*`) is in `messages.json` and `messages.fr.json`.

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

`GettingStartedHost` renders the checklist, in its own chunk, and its invite dialog, in the
host's chunk so that a chunk failing to load never leaves its `ShellOverlay` held.
`OnboardingWizardHost` renders the assistant in its own chunk, only while it holds the
`onboarding.wizard` `ShellOverlay`.

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
  `InvitationsService.inviteMembers` (role `member`, 50 addresses per call; called by the
  assistant and the getting-started invite dialog). Core's `OrganizationPin` adds
  `If-Organization-Match` to the four onboarding operations and to `POST /v1/invitations`.
- `@core/api` (`readProblem`, `OrganizationSwitchPendingError`, `OrganizationPin`, which also
  fences the assistant's finish and dismissal).
- Workspace's `ports/workspace-context` (the current organization, which fences every write; its
  name in the assistant's welcome; `can('member')` for who sees the assistant; `can('admin')` for
  who may invite from the assistant and shows the checklist's invitation item).
- Spaces' `utils/space-look`: the `LookColor` type, `prefixFromName` for the first space's key
  prefix and `lookColorChoices` for the assistant's swatches and color names (`@@spaces.look.*`).
- Spaces' `ports/navigation-refresh` (`NAVIGATION_REFRESH.refresh()`, so the sidebar shows the
  space the assistant provisioned).
- Task's `.` entry: `TaskCreate`, whose `open({ listId })` the checklist's
  `Create your first task` calls on the first list, and whose `created` makes it read the
  progress again.
- `@shared/layout-slot` (`SlotContribution`, `SlotFeature`, `ShellOverlay`: the assistant holds
  `onboarding.wizard` while it shows, the invite dialog opens as `onboarding.invite-dialog`, and
  the checklist hides while `onboarding.wizard` is open).
- `@cadenway/ui` (`button`, `dialog` with `size="screen"`, `input`, `logo`, `progress`,
  `radio-group` cards without indicator, `skeleton`, `stepper` with `variant="segments"`,
  `toast`, `toggle-group`) and `@cadenway/icons`.

## Invariants

- Who sees the assistant: `getOnboarding` answers an `in-progress` state at version 1 for every
  member, so it does not tell (contract gap G1). `OnboardingWizardHost` opens it when the address
  carries `?onboarding=start` (Auth's creation): it reads the progress and shows the window at
  once, with a skeleton card until the progress is known, then keeps it while the assistant is
  `in-progress`. The parameter stays in the address until the launch is durable: at version 1
  `OnboardingWizardStore.saveStart()` saves the initial draft (the screen, the default name, its
  prefix, the color and the template), and once the progress is past version 1, or the assistant
  is closed, the host removes the parameter with `replaceUrl`, keeping the path and the other
  parameters (`notice=` included). A reload before that save reopens the assistant from the
  parameter; a failed first save keeps it, the assistant stays usable, and the next draft save
  makes the launch durable; a dropped one does nothing. Otherwise the assistant opens by itself
  only on the workspace root (`/<slug>`, without `?task=`) once the progress shows `in-progress`
  past version 1, so it never covers a deep link; it reads the progress only there. Never for a
  guest (`can('member')`; `finishOnboarding` refuses one), whose parameter is removed at once.
- The window (`OnboardingWizard`) is an edge-to-edge `cw-dialog` (`size="screen"`) without a close
  button that Escape and a click outside do not close: only `Set up later` dismisses, since
  dismissal is final. The dialog brick also closes itself on a history move (Back, Forward: the
  CDK's `closeOnNavigation`); the window then shows itself again at once, focused on its title.
  It is named by the card's `h1` (`cwDialogTitle` imposes an `h2`), which takes the focus on open,
  after each screen change and after a Retry removes its alert; a screen change is announced as
  `Step n of 4: <name>`. The step bar is `cw-stepper variant="segments"` (not clickable), with
  every `provideCwStepperLabels` key given in English, and the `Step n of 4` line is the
  assistant's own.
- While the assistant should show, the host holds `onboarding.wizard` in `ShellOverlay`, taken as
  soon as no other shell overlay is open, and renders the window only while it holds it: it never
  shows over the palette or the shortcuts, which cannot open over it either. It releases the hold
  when the assistant closes or the host is destroyed. The getting-started checklist stays hidden
  under the assistant because it honours that hold, which only the host owns.
- `OnboardingWizardStore` is provided by `OnboardingWizardHost`, so a finish keeps running while
  the window shows its result; an organization switch starts it over. It takes the draft from the
  progress once (a null name reads as `Product`, the field's placeholder; a `gris` color, which
  has no swatch, shows and is sent as `violet`, the first swatch and the contract's default), and
  later reads never overwrite the edits. `Continue` and `Back` change the screen locally, then
  save the whole draft (`step`, `name`, `prefix` derived with `prefixFromName`, `color`,
  `preset`) without waiting; a failed save keeps the screen, and the next save sends everything
  again. After `409 onboarding.wizard-closed` it closes, and opens the first list when a space
  exists. The `Space` screen cannot continue while the name is blank (`aria-invalid`), as in the
  mockup. The invitation addresses and the import choice stay in memory (gap G6).
- Every step of a finish or a dismissal is fenced like `OnboardingStore`'s writes: once the store
  is destroyed, or the workspace or `OrganizationPin` shows another organization than the one it
  started in, nothing more is sent, applied, refreshed, navigated or toasted.
- `Set up later` closes at once, then sends the dismissal; a read in flight is awaited first (the
  shared store reads before it writes), and only a failed read closes without a write. A definite
  refusal, or an unknown outcome after which the progress still shows the assistant `in-progress`,
  shows a failure toast (the choice was not saved, the assistant may come back); a dropped write
  or `409 onboarding.wizard-closed` shows none. Once settled, when a space exists (a finish whose
  outcome was unknown did create it), it refreshes the navigation and opens the first list. A
  failed read shows an inline error in the card whose Retry calls `reload()`.
- The `Team` screen shows no invitation form to a person who may not invite, and offers `Skip`.
  Its primary button reads `Continue` once an address is added or typed; moving on first commits
  the typed address (`commitPending()`), and an invalid one keeps the screen with the field's
  error, so a typed address is never lost. The `Import` screen shows `Trello`, `Jira` and
  `CSV file` disabled and `Later` checked (gap B18): the screen keeps its place, so the counter
  stays `of 4` as in the mockup and the contract's `import` step.
- Invitations go out on the `Team` screen, then the finish provisions the space. `Continue` on
  `Team` commits the typed address, then invites the addresses not sent yet as members, in
  batches of 50 (the `inviteMembers` limit), when the person is an owner or an administrator
  (`OnboardingApi.invite`), and only then saves the step and moves on; it shows its loading state
  meanwhile, with `Back`, `Set up later` and the field disabled. Organization invitations hold on
  their own and the draft does not keep the addresses (gap G6), so sending them there means a
  reload resuming at `Import` loses none, and the finish invites no one (nor invents any).
- Within a batch, an address answered `invited`, `already-invited` or `already-member` is done
  and never sent again: going back to `Team` keeps it as a pill, and `Continue` sends only the
  others. Any other outcome (one a later contract adds counts as not sent; the adapter lists
  them in `notSent`) leaves the address unsent for a later `Continue`, and shows
  `{n} address(es) could not be invited`; the screen still changes. A batch whose outcome is
  unknown keeps its addresses unsent, keeps the screen and shows
  `The invitations may not have been sent` / `Press Continue to send them again: it is safe.`
  (an address the lost batch reached then answers `already-invited`); a refused batch (a `429`
  daily limit included) shows `The invitations could not be sent` and the screen still changes.
- The invitation marker: once a batch invited an address or found one `already-invited`, the
  assistant records `invitationSent` at once (`recordInvitation`), which the contract allows
  during the assistant (`updateOnboardingChecklist`: "the caller can record an invitation outcome
  during the wizard or afterwards"). A failed marker write stays owed in the route's
  `OnboardingStore` (`owesInvitation`); the finish sends it again (`retryOwedInvitation`), and so
  does the getting-started checklist on its occasions, so leaving after `Set up later` throws
  nothing and keeps the debt. A full page reload before the marker is recorded forgets the debt,
  as for the checklist; the next batch that reaches an address records it again.
- `Create the space` (`App.dc.html` lines 5276-5298), with `Back` and `Set up later` disabled and a
  second click ignored while it runs:
  1. sends `finishOnboarding` with the trimmed name, the derived prefix, the template and the
     color. After `409 space.prefix-taken` it tries the first two letters followed by `A` to `Z`,
     each prefix once (a fallback equal to the base is skipped) and each with a new key, silently,
     then asks for another name. An unknown outcome (`isUncertainOnboardingWrite`) shows an inline
     error whose Retry sends the same body with the same `Idempotency-Key`; a new key is taken
     only after a definite refusal or a changed body. A stale version is retried once with a new
     key; `403 organization.role-forbidden` and other refusals show an inline error. A dropped
     write (`OnboardingWriteDroppedError`) shows nothing;
  2. once provisioned, sends an owed invitation marker again (`retryOwedInvitation`), refreshes
     the navigation, opens `/<slug>/l/<firstListId>`, then shows the toast
     `Space “<name>” created` with `<n> lists` and `<n> invitations sent` (this session's invited
     outcomes only; never the mockup's import part, gap B18), and closes.
- The contract reports no seat outcome for an invitation (`InvitationResult.outcome` is
  `invited`, `already-member` or `already-invited`; "sending an invitation does not consume a
  seat", `members.yaml`), so the assistant has no seat-limit message; any other outcome counts
  as not sent.
- The template cards and the import cards are written out instead of repeated with `@for`
  (`@cadenway/ui` 0.11.0 bug). Under `@for`, `cw-radio-group`'s `tabStop` computed reads every
  item's `value()` while the first item renders, before the later repeated items have their
  inputs; when the checked item is not the first, it throws
  `NG0950: Input "value" is required but no value is available yet`. Reproduction: the `Template`
  screen under `@for` with the draft preset `agency` (checked item index 2) throws on render; the
  `Import` screen would too, since `Later` is index 3. Account's presence picker uses `@for` and
  works because its checked item comes first.
- Deviations from the mockup's accents: the checked template and import cards' icon (and the
  import card's name) are `text-primary`, as in the mockup; the segments of the step bar, the
  checked cards' border and fill and the checked swatch's ring keep the design system's ink tones
  where the mockup uses primary, since the token rule forbids primary fills.
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
  recorded is not sent again, nor a write queued behind another once the progress shows its
  change (any write but `finish`). `invitationSent` is to be recorded only once `inviteMembers`
  answered `invited` or `already-invited` for at least one address; any other outcome, an unknown
  one included, counts as not sent.
- A draft color a later contract adds reads as `gris`, as `LookColorValue` says; the assistant
  draws no `gris` swatch and shows such a draft with the first swatch (`violet`) checked.
- `OnboardingInviteField` is its own `<form>`, so a host never nests it in another form. Any text,
  blank text included, must match the mockup's pattern once trimmed
  (`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`, line 5258); only an empty field is valid, and `Add` then adds
  nothing. Once the field is touched (blurred, or submitted with `Add`), an invalid address shows
  the error under the field, which describes it, and `CwInput` sets `aria-invalid` from the same
  field state. A valid address is added once, compared without regard to case (the mockup
  compares it as typed), and the field empties and is untouched again. The focus returns to
  the field after an add, and after a removal goes to the remove button now at that place, else
  the last one, else the field. The mockup's guest badge (line 2695) is not drawn (gap G5).
  A host with its own submit button reads `hasText` (text typed and not added) and calls
  `commitPending()` before sending, which does what `Add` does: an empty field commits nothing,
  a valid address is added, and an invalid one marks the field touched, shows its error, takes
  the focus and returns false, so the host sends nothing. A typed address is never dropped
  silently.
- `GettingStartedStore` is component-scoped: `GettingStartedHost` provides it, so it lives with
  the application shell (a settings shell destroys it) and reads the route's `OnboardingStore`.
  Its invite dialog, toasts and listeners end with it: destroying it closes the dialog's
  `ShellOverlay` and dismisses the toasts it showed.
- While the assistant covers the shell, its host holds the `ShellOverlay` id `onboarding.wizard`;
  the checklist reads that id to stay hidden under it.
- The `Getting started` checklist (`App.dc.html` lines 2712-2727, behaviour 5299-5319) shows
  when the assistant finished (`wizard.status` `finished`) and provisioned the first space, the
  presentation is not `dismissed`, and the assistant is not the open `ShellOverlay`
  (`onboarding.wizard`). Nothing shows while the progress is unread, nor when its first read
  failed; a later failed read keeps it. A failed first read is read again when the tab becomes
  visible and after a `TaskCreate.created`. Showing nothing is a deliberate, accepted product
  exception to the secondary-read rule of `docs/architecture.md` (Errors and loading: a shell
  widget keeps an inline error with Retry): the checklist applies to almost nobody, so an error
  card for every member would be noise.
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
  `setPresentation`. A refusal restores the confirmed one with a failure toast
  (`The list could not be updated`, `“Getting started” could not be hidden`); an unknown outcome
  the store's read did not settle shows
  `Your change to “Getting started” may not have been saved`; a write dropped for a changed
  organization (`OnboardingWriteDroppedError`) shows nothing. None of these toasts is in the mockup. The dismissal is final; once the panel leaves,
  the focus moves to the page's `main` landmark (given `tabindex="-1"` when it has none).
- The board watcher records `boardTried` on each `NavigationEnd` (keyed by the navigation, so
  board to board counts) whose address is a list's `Board` view (`/<slug>/l/<id>/board`, any
  list), and for the address shown when the progress arrives, only while the checklist applies
  and the marker is not recorded. Its write stays silent: a navigation into another
  organization's board is dropped by the store's organization fence, and a refusal is sent again
  on the next board navigation.
- With no realtime fact for onboarding (gap G8), the checklist reads the progress again after
  each `TaskCreate.created`, when the tab becomes visible and when the host is created over a
  progress already read (a task created from a settings shell), only while `firstTaskCreated` is
  not set. It does not poll.
- The invite dialog (titled `Invite a team member`, with `Cancel` and `Invite`) belongs to the
  organization it was opened in: an organization change (the workspace's, or
  `OrganizationPin.organizationChanges`) closes it, which empties its addresses, and dismisses
  the toasts the checklist showed; `Invite` sends nothing once the workspace or the pin shows
  another organization. It invites the addresses as members, then toasts the outcome
  (`{n} invitation(s) sent`, the skipped addresses as the description, or `No invitation sent`
  when none was invited) and closes. A batch the organization pin dropped
  (`OrganizationSwitchPendingError`, `412 organization.context-changed`) closes it with no
  toast. A refusal keeps the dialog and its addresses with `The invitations could not be sent`
  (and the daily-limit line for `429 invitation.daily-limit-reached`); an unknown outcome
  (`isUncertainOnboardingWrite`) keeps them with `The invitations may not have been sent` /
  `Sending again is safe.`, since a second batch answers `already-invited` for an address the
  first one reached. A `400 request.invalid` naming addresses is not mapped back to them: the
  field has no error input. The addresses empty each time it opens. `Invite`, enabled once an
  address is added or typed, first commits the typed one (`commitPending()`); an invalid typed
  address blocks the batch with the field's error.
- Each opening of the invite dialog has its own generation, which closing it, an organization
  change and the store's destruction move on. A batch's answer closes the dialog, empties it or
  toasts only while the dialog that sent it is still the one shown, in its organization, and its
  store alive: an earlier batch answering after the dialog was closed and opened again, after a
  switch to another organization, or after a new host replaced its own, leaves the dialog shown
  and its addresses alone, and shows no toast. Its `Invite` is not busy with that earlier batch.
  Recording the marker does not depend on the dialog: it follows the batch, for the organization
  the batch went to only.
- The checklist records `invitationSent` when the batch invited an address or found one
  `already-invited` (an invitation is out for it, perhaps from a batch whose answer was lost).
  When that marker write fails other than by a drop, `OnboardingStore` keeps it owed
  (`owesInvitation`): being route-scoped on `/:org`, it survives a change to a settings shell and
  back. `GettingStartedStore` calls `retryOwedInvitation()` on its refresh occasions (the tab
  shown again, a task created), when its host is created and when the panel shows again, until
  the progress shows `invitationSent`. An organization change or leaving `/:org` clears the debt.
  A full page reload forgets it, which is accepted: the next batch that invites an address, or
  finds it `already-invited`, records the marker again.

## Copy not taken word for word from the mockup

These assistant units have no mockup wording (step 9 spec, A.6), pending product approval.

| Unit                                                                                                                                           | Reason                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `onboarding.wizard.load-failed`, `onboarding.wizard.retry`                                                                                     | The progress read failed; the mockup has no read.                                                                              |
| `onboarding.wizard.finish-unknown`, `onboarding.wizard.finish-failed`, `onboarding.wizard.finish-forbidden`, `onboarding.wizard.finish-prefix` | `finishOnboarding` failures the mockup does not draw.                                                                          |
| `onboarding.wizard.toast.invitations-failed`, `onboarding.wizard.toast.invitations-failed-text`                                                | A refused `inviteMembers` on leaving the `Team` screen.                                                                        |
| `onboarding.wizard.toast.invitations-unknown`, `onboarding.wizard.toast.invitations-unknown-text`                                              | An `inviteMembers` whose outcome is unknown on leaving the `Team` screen.                                                      |
| `onboarding.wizard.toast.not-invited-one`, `onboarding.wizard.toast.not-invited-other`                                                         | Addresses a batch answered with an outcome other than invited, already invited or already a member.                            |
| `onboarding.wizard.toast.skip-failed`, `onboarding.wizard.toast.skip-failed-text`                                                              | A refused or unconfirmed `Set up later`.                                                                                       |
| `onboarding.wizard.announcement`, `onboarding.wizard.stepper.*`                                                                                | Screen reader text of the step change and of the step bar.                                                                     |
| `onboarding.wizard.preset.*.lists` (English)                                                                                                   | The gateway creates the contract's French list names for every template (gap G7); the English source previews them in English. |
