# Intake

## Purpose

The public request form of a list (`/f/:publicKey`) and the form renderer that the Spaces form
view reuses as its preview. The form's settings and publication belong to Spaces; the task a
request creates belongs to the task service and is read through Task.

## Routes

`INTAKE_ROUTES` is mounted below `/f` by `APP_ROUTES`, before the workspace, so `f` is a reserved
organization slug (`RESERVED_SLUGS`).

- `:publicKey` loads `IntakePage` (title `Request form`) with the icons. It needs no session and
  renders without a shell, on the canvas. A failed read renders the default error boundary: the
  gateway's `404` (unknown, disabled, archived or removed form alike) and a malformed key (`400`)
  are not found; anything else is unavailable with `Retry`.

## Public entry points

| Entry point     | Consumers |
| --------------- | --------- |
| `intake.routes` | app       |
| `.`             | spaces    |

`.` publishes `IntakeForm` (`cw-intake-form`), the renderer: inputs `form`
(`IntakeFormSettings`: title, description, the mode of each field), `organization`
(`IntakeOrganization`, the badge, or null), `pending`, `sent` (the title of the request just sent,
which shows `Request sent`) and `failure`; outputs `submitted` (`IntakeRequest`) and `restarted`.
It provides the English texts of its bricks itself. It also publishes `INTAKE_FIELD_KEYS`,
`intakeFieldLabels()` and `intakeFieldIcons()` (the mockup's `FORM_FIELDS`), and the models
`IntakeFieldKey`, `IntakeFieldMode`, `IntakeFormSettings`, `IntakeOrganization` and
`IntakeRequest`.

## Dependencies

- `@cadenway/api-client` through `data-access/`: `PublicIntakeService` (`getPublicIntakeForm`,
  `startPublicIntakeAttachmentUpload`, `completePublicIntakeAttachmentUpload`,
  `submitPublicIntakeForm`), and `HttpClient` for the signed upload to object storage only.
- `@core/api` (problem reader) and `@shared/route-errors`.
- `@cadenway/ui` (`button`, `calendar`, `date-picker`, `dropzone`, `input`, `priority-icon`,
  `select`, `skeleton`, `textarea`) and `@cadenway/icons`.

## Invariants

- `PublicIntakeStore`, page-scoped on `IntakePage`: the published form (primary read) and the
  sending of a request. Each draft has a private applicant key (32 random bytes, unpadded
  base64url); each file gets its own reservation key and is uploaded once per draft (start, signed
  multipart post without credentials, completion, which is still asked after a transfer with no
  answer); each submission body keeps its `Idempotency-Key`, so a retry of the same body after a
  lost answer replays it, while a changed body gets a new key. The draft key is sent with the
  submission only when it carries attachments. A `409 attachment.upload-not-ready` is retried
  three times, one second apart, with the same keys. A send stops, without storing an upload or submitting, once the key or the
  draft it began with is no longer shown. A request sent starts a new draft; a late
  answer for another key is dropped.
- The renderer validates as the mockup's `fmErrsOf` (`App.dc.html` lines 7733-7746): the title
  always, the other fields when required, the address whenever one is typed. A field shows its
  error once touched or after a send; the summary (`n fields to fix before sending.`) and the
  files error after a send. An invalid send focuses the first invalid field. A hidden field is
  neither validated nor emitted, and the submission leaves it out, since the contract refuses it.
  At most five files of 25 MiB each; others are refused with a message.
- Failures show above the send button: a `404` says the form no longer accepts requests, an
  `attachment.*` refusal that a file could not be received, anything else that the request could
  not be sent.

## Known gaps

- The published form does not name its organization: the public page shows no organization badge
  (the Spaces preview does).
- The receipt is opaque and names no task: the public confirmation gives no reference and has no
  `Open <id>` (`App.dc.html` line 1120), which the requester could not open anyway.
- The not-found state's `Back to home` leads a requester without a session to sign-in.

## Copy not taken word for word from the mockup

| Unit                                                                                                                                                                       | Reason                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `intake.sent.text`                                                                                                                                                         | The mockup's text names the task's reference, which the receipt lacks. |
| `intake.failure.*`, `intake.files.rejected`                                                                                                                                | The mockup draws no failed send and no refused file.                   |
| `intake.route.title`, `intake.page.loading`                                                                                                                                | Route title; the mockup's `Chargement du formulaire`.                  |
| `intake.select.*`, `intake.date.*` (except `placeholder`, `dialog`, `clear`), `intake.calendar.*` (except the months), `intake.files.*` (except `title`, `hint`, `remove`) | The bricks' own default texts.                                         |
| `intake.form.errors-one`                                                                                                                                                   | Singular form of the summary.                                          |
