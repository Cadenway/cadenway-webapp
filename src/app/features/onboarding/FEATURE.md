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

The assistant is built: `OnboardingWizardHost` (`ui/components/onboarding-wizard-host/`), the
window `OnboardingWizard` (`ui/components/onboarding-wizard/`), its four screens
(`ui/components/onboarding-{space,preset,team,import}-step/`), `OnboardingWizardStore`
(`state/onboarding-wizard/`) and the templates and import sources (`constants/`). The checklist
comes with step 9's getting-started package.

`OnboardingInviteField` (`cw-onboarding-invite-field`, `ui/components/onboarding-invite-field/`) is
internal, not a public entry: the presentational invitation field (`App.dc.html` lines 2694-2695)
that both the assistant's `Team` step and the getting-started invite dialog render. It edits the
list of addresses (`[(emails)]`, `disabled`) and sends nothing; the screen that renders it calls
`inviteMembers`. The assistant's `Team` step renders it, so its copy (`@@onboarding.invite.*`) is
in `messages.json` and `messages.fr.json`.

## Routes

None: overlays only. `provideOnboarding()` provides the state on `/:org`, and the hosts mount in
the application shell's `overlays` slot (not in the settings shells):

| Contribution             | Id                           | Order | Host                                                 |
| ------------------------ | ---------------------------- | ----- | ---------------------------------------------------- |
| `withGettingStarted()`   | `onboarding.getting-started` | 40    | `GettingStartedHost` (`cw-getting-started-host`)     |
| `withOnboardingWizard()` | `onboarding.wizard`          | 50    | `OnboardingWizardHost` (`cw-onboarding-wizard-host`) |

`OnboardingWizardHost` renders the assistant in its own chunk; `GettingStartedHost` renders
nothing yet (step 9, getting-started package).

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
- Workspace's `ports/workspace-context` (the current organization, which fences every write; its
  name in the assistant's welcome; `can('member')` for who sees the assistant and `can('admin')`
  for who may invite).
- Spaces' `utils/space-look`: the `LookColor` type, `prefixFromName` for the first space's key
  prefix and `lookColorChoices` for the assistant's swatches and color names (`@@spaces.look.*`).
- Spaces' `ports/navigation-refresh` (`NAVIGATION_REFRESH.refresh()`, so the sidebar shows the
  provisioned space).
- Not used yet, declared for the next package: Task's `.` entry (`TaskCreate`, for the
  checklist's `Create your first task`; step 9, getting-started package).
- `@cadenway/ui`: `dialog` (`size="screen"`), `stepper` (`variant="segments"`), `radio-group`
  (cards without indicator), `toggle-group`, `input`, `button`, `logo`, `skeleton` and `toast`
  (`CwToastService`, the shell's toaster).
- `@shared/layout-slot` (`SlotContribution`, `SlotFeature`, and `ShellOverlay`, where the assistant
  holds `onboarding.wizard` while it shows).

## Invariants

- Who sees the assistant: `getOnboarding` answers an `in-progress` state at version 1 for every
  member, so it does not tell (contract gap G1). `OnboardingWizardHost` opens it when the address
  carries `?onboarding=start` (Auth's creation): it reads the parameter once, removes it with
  `replaceUrl` and keeps the path and the other parameters (`notice=` included), reads the
  progress and shows the window at once, with a skeleton card until the progress is known, then
  keeps it while the assistant is `in-progress`. Otherwise it opens by itself only on the
  workspace root (`/<slug>`, without `?task=`) once the progress shows `in-progress` past version
  1, so it never covers a deep link; it reads the progress only there. Never for a guest
  (`can('member')`; `finishOnboarding` refuses one).
- The window (`OnboardingWizard`) is an edge-to-edge `cw-dialog` (`size="screen"`) without a close
  button that Escape and a click outside do not close: only `Set up later` dismisses, since
  dismissal is final. It is named by the card's `h1` (`cwDialogTitle` imposes an `h2`), which takes
  the focus on open and after each screen change; the change is announced as `Step n of 4:
<name>`. The step bar is `cw-stepper variant="segments"` (not clickable) and the `Step n of 4`
  line is the assistant's own. While it shows, the host holds `onboarding.wizard` in
  `ShellOverlay` (as soon as no other shell overlay is open), so the getting-started checklist
  stays hidden and the palette and shortcuts cannot open over it; it releases it when the window
  closes or the host is destroyed.
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
- `Set up later` closes at once and sends the dismissal; when the progress could not be read, it
  only closes and writes nothing. A failed read shows an inline error in the card whose Retry
  calls `reload()`.
- `Create the space` (`App.dc.html` lines 5276-5298) sends `finishOnboarding` with the trimmed
  name, the derived prefix, the template and the color, `Back` and `Set up later` disabled
  meanwhile. After `409 space.prefix-taken` it tries the first two letters followed by `A` to `Z`,
  each with a new key, silently, then asks for another name. An unknown outcome
  (`isUncertainOnboardingWrite`) shows an inline error whose Retry sends the same body with the
  same `Idempotency-Key`; a new key is taken only after a definite refusal or a changed body. A
  stale version is retried once with a new key; `403 organization.role-forbidden` and other
  refusals show an inline error. A dropped write (`OnboardingWriteDroppedError`) shows nothing.
  Once provisioned, it invites the addresses as members when the person is an owner or an
  administrator (`OnboardingApi.invite`), records `invitationSent` when at least one was invited,
  refreshes the navigation, opens `/<slug>/l/<firstListId>`, shows the toast `Space “<name>”
created` with `<n> lists` and `<n> invitations sent` (invited outcomes only; never the
  mockup's import part, gap B18) and closes. A failed invitation (a `429` daily limit included)
  keeps the space and adds a failure toast.
- The `Team` screen shows no invitation form to a person who may not invite, and offers `Skip`.
  The `Import` screen shows `Trello`, `Jira` and `CSV file` disabled and `Later` checked (gap
  B18): the screen keeps its place, so the counter stays `of 4` as in the mockup and the
  contract's `import` step. The template cards and the import cards are written out instead of
  repeated with `@for`: `cw-radio-group` reads every item's value while it renders the first one,
  before a repeated item has its inputs.
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
  draws no `gris` swatch and shows such a draft with the first swatch (`violet`) checked.
- `OnboardingInviteField` is its own `<form>`, so a host never nests it in another form. `Add`
  checks the trimmed address against the mockup's pattern (`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`, line
  5258); an invalid one shows the error under the field with `aria-invalid` from that submit on,
  not on blur, and an empty field adds nothing. A valid address is added once, compared without
  regard to case (the mockup compares it as typed), and the field empties. The focus returns to
  the field after an add, and after a removal goes to the remove button now at that place, else
  the last one, else the field. The mockup's guest badge (line 2695) is not drawn (gap G5).
- The checklist will have the three items the contract records (step 9, getting-started
  package): `firstTaskCreated`, set by the gateway; `invitationSent`; `boardTried`. The mockup's
  reminder and mobile items have no marker (gaps G2 and G3). A failed checklist read will show
  nothing.

## Copy not taken word for word from the mockup

These assistant units have no mockup wording (step 9 spec, A.6), pending product approval.

| Unit                                                                                                                                           | Reason                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `onboarding.wizard.load-failed`, `onboarding.wizard.retry`                                                                                     | The progress read failed; the mockup has no read.                                                                              |
| `onboarding.wizard.finish-unknown`, `onboarding.wizard.finish-failed`, `onboarding.wizard.finish-forbidden`, `onboarding.wizard.finish-prefix` | `finishOnboarding` failures the mockup does not draw.                                                                          |
| `onboarding.wizard.toast.invitations-failed`, `onboarding.wizard.toast.invitations-failed-text`                                                | A failed `inviteMembers` after the space exists.                                                                               |
| `onboarding.wizard.announcement`, `onboarding.wizard.stepper.*`                                                                                | Screen reader text of the step change and of the step bar.                                                                     |
| `onboarding.wizard.preset.*.lists` (English)                                                                                                   | The gateway creates the contract's French list names for every template (gap G7); the English source previews them in English. |
