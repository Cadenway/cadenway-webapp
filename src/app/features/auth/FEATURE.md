# Auth

## Purpose

The public entry screens of the mockup (`Main`, `Otp`, `Mfa`, `Inscription`, `MotDePasseOublie`,
`Reinitialisation`, `Deconnexion` and `Organisations`): sign-in by password, provider, company
SSO or e-mail code, the two-step challenge, sign-up and its address verification, the forgotten
and reset password, the signed-out screen with the accounts remembered on the device, and the
choice or creation of an organization. Auth owns the `AuthLayout` slot contributions it binds
(theme button, legal links). Its ownership ends once a session has an organization: `/:org` and
everything below it belong to `workspace`.

## Routes

`AUTH_ROUTES`, mounted at `''` by `APP_ROUTES`. Its root route loads `AuthLayout`; a path none of
its children matches falls through to the next application route.

| Path                       | Screen                                                            | Guard            |
| -------------------------- | ----------------------------------------------------------------- | ---------------- |
| `/login`                   | Providers, company SSO entry, password, e-mail code entry         |                  |
| `/login/sso`               | Work address checked with `discoverSignInMethods`                 |                  |
| `/login/code`              | E-mail code sign-in (`Otp`, sign-in usage)                        |                  |
| `/login/two-step`          | Two-step challenge: app, security key, backup code                |                  |
| `/signup`                  | Account creation                                                  |                  |
| `/signup/verify`           | Address verification (`Otp`, verification usage)                  |                  |
| `/forgot`                  | Reset link request                                                |                  |
| `/reset#token=…`           | New password from the e-mail link                                 |                  |
| `/logged-out?reason=`      | `signed-out` (default), `expired` or `all-devices`                |                  |
| `/organizations`           | Organizations and received invitations; `?invitation=` stands out | `requireSession` |
| `/organizations/new`       | Organization creation                                             | `requireSession` |
| `/invite/:invitationId`    | E-mail invitation link; renders nothing                           | `openInvitation` |
| `/auth/federated/continue` | Provider return imposed by the gateway                            |                  |

`/login?next=<path>` keeps an application path (checked by `safeReturnUrl`) to open after sign-in.

## Public entry points

| Entry point   | Consumers                  |
| ------------- | -------------------------- |
| `auth.routes` | app                        |
| `.`           | workspace, account, search |

`.` exports `withSessionLock`, the cross-tab session lock that serializes organization switches with
the session cookie, and `SignOut`, which closes the session under that lock and opens
`/logged-out?reason=signed-out` with a replacing navigation (the account menu and the command
palette use it; a refusal resolves `false` and leaves the page as it was). `SignOut.leaveLocally()`
does the same on the device without the request: it forgets the person's device data and opens the
signed-out screen; Account calls it when the sign-out request fails after the account's deletion
was scheduled, whose session the gateway already ended.

## Dependencies

- `@cadenway/api-client` (`AuthService`, `OrganizationsService`, `InvitationsService`,
  `ProfileMediaService`) through `data-access/`; `@simplewebauthn/browser` for the security key.
- `@layouts/auth-layout` and `@layouts/auth-layout/providers` (root route only), `@core/theme`,
  `@core/config` (`siteUrl`), `@core/api` (`readProblem`).

## Invariants

- The gateway cookie is the only session credential. Passwords stay in page memory, and the
  pending sign-up password in `AuthFlowStore` memory, never in storage; leaving `/signup/verify`
  without verifying forgets it.
- Only a `200` with a session means signed in; a `202` is a two-step challenge. Its token lives in
  the flow store and the tab's `sessionStorage` (read again after a reload), never in a URL.
  Leaving `/login/two-step` without answering drops the challenge; an expired one keeps the
  screen with `Sign in again` (`auth.two-step.sign-in-again`).
- The federated continuation is redeemed once per flow store, with an empty body; the gateway
  clears the cookie on every outcome.
- Sign-in, its second step, the address verification, the federated continuation, sign-out and
  the session's organization switch run under the exclusive `withSessionLock`. After a creation,
  the switch to the new organization, the check that it is current and the logo upload run under
  one exclusive lock, so another tab cannot redirect the logo.
- A session that opens remembers its account (name and address only) in `localStorage` only when
  `Stay signed in for 30 days` (`auth.login.remember`) is ticked, then opens `?next=`, else `/<slug>` of the
  session's organization, else `/organizations`. A reserved slug (`RESERVED_SLUGS` of
  `@core/routing`) always opens `/organizations`.
- The reset token is read from the URL fragment, then removed with a replacing navigation to
  `/reset`, so neither the address bar nor `router.url` keeps it; it is sent in bodies only.
- `AuthFlowStore` is provided by the auth root route and destroyed by the router when the person
  leaves the auth screens (`withAutoCleanupInjectors`), which also clears the tab's challenge
  token. `OrganizationChoiceStore` and `OrganizationCreateStore` are provided by their pages. A
  refused invitation waits 6 seconds for `Undo` (`auth.undo`) and is sent when the page closes.
- A failed organization list or invitation list shows its own inline error with `Retry` (`auth.retry`),
  never an empty list.
- `Sign out` (`auth.organizations.sign-out`), which `Organisations.dc.html` draws in the header, sits at the top of the
  chooser card: the header slots are bound once by the auth root route, so one screen cannot add
  its own header action.
- A sign-up replaced by a newer one (`auth.sign-up-replaced`) returns to
  `/signup?reason=sign-up-replaced`.
- A creation opens `/<slug>` (`/organizations` for a reserved slug). It becomes
  `/<slug>?onboarding=start`, which asks Onboarding's assistant to open, with step 9's wizard
  package. A creation whose logo could not be uploaded adds `notice=logo-upload-failed` to the
  destination's query (built as a `UrlTree`, so it joins `onboarding=start`), which the home screen
  explains.

## Known gaps

- When the creation succeeds but moving the session to the new organization fails, the page opens
  `/organizations`: the person reaches the workspace from the chooser, without
  `?onboarding=start`, so the assistant (step 9, wizard package) never opens for that
  organization. Contract gap G1 of step 9 (`getOnboarding` cannot tell who was offered the
  assistant) keeps the client from offering it there.

## Copy not taken word for word from the mockup

These units have no mockup wording, or adapt it to the contract.

| Unit                                                                                                                                                                                                                                                     | Reason                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `auth.login.unverified`, `auth.login.unavailable`, `auth.login.password-required`                                                                                                                                                                        | States the mockup does not draw: unverified address, unavailable gateway, empty password.                                  |
| `auth.federated.refused`, `auth.federated.title`, `auth.federated.heading`, `auth.federated.pending`                                                                                                                                                     | The provider return screen is not in the mockup.                                                                           |
| `auth.two-step.code-invalid`, `auth.two-step.key-refused`, `auth.two-step.locked`, `auth.two-step.expired`                                                                                                                                               | `Mfa.dc.html` draws no refused answer.                                                                                     |
| `auth.two-step.key-one`, `auth.two-step.backup-left-one`, `auth.reset.device-one`, `auth.reset.done-closed-one`, `auth.login.invalid-attempt-one`                                                                                                        | Singular forms of mockup sentences written for several.                                                                    |
| `auth.signup.name-required`, `auth.signup.password-short`, `auth.signup.password-compromised`, `auth.signup.replaced`                                                                                                                                    | Sign-up refusals of the contract the mockup does not draw.                                                                 |
| `auth.forgot.unavailable`, `auth.reset.unavailable`, `auth.reset.loading`                                                                                                                                                                                | Failure and loading states the mockup does not draw.                                                                       |
| `auth.forgot.once`                                                                                                                                                                                                                                       | The mockup says the link works from this browser only; the contract lets any browser use it.                               |
| `auth.reset.devices`, `auth.reset.done-closed`                                                                                                                                                                                                           | The mockup's "except this one" does not apply: the reset runs without a session.                                           |
| `auth.organization-create.slug-invalid`, `auth.organization-create.slug-reserved`, `auth.organization-create.slug-taken`, `auth.organization-create.invites-invalid`, `auth.organization-create.invites-limit`, `auth.organization-create.name-required` | Creation refusals the mockup does not draw.                                                                                |
| `auth.organization-create.logo-error`                                                                                                                                                                                                                    | The contract accepts PNG and SVG only; the mockup also names JPEG.                                                         |
| `auth.organizations.mfa-required`, `auth.organizations.gone`, `auth.organizations.action-failed`, `auth.organizations.sign-out-failed`, `auth.organizations.loading`                                                                                     | Chooser failures and loading the mockup does not draw.                                                                     |
| `auth.organizations.invitations-failed`                                                                                                                                                                                                                  | Wording of the section error of `Organisation.dc.html`.                                                                    |
| `auth.logged-out.expired-body`, `auth.logged-out.all-body`                                                                                                                                                                                               | The mockup names the organization, its inactivity policy and the session count, which the signed-out screen does not know. |
| `auth.logged-out.route-title`, `auth.two-step.sign-in-again`                                                                                                                                                                                             | `Signed out` and `Sign in again` reuse mockup words in new places.                                                         |
| `auth.code.help`, `auth.code.help-plain`                                                                                                                                                                                                                 | The mockup names the sender `no-reply@cadenway.example`, an address the runtime configuration does not provide.            |
| `auth.signup-verify.unavailable`                                                                                                                                                                                                                         | A verification failure the mockup does not draw; the sign-in wording does not fit sign-up.                                 |
| `auth.signup.email-invalid`                                                                                                                                                                                                                              | `Inscription.dc.html` draws no invalid address; the sign-in wording names "your account".                                  |
| `auth.sso.email-hint`                                                                                                                                                                                                                                    | The mockup lists the recognized domains, which the contract does not expose; the hint reuses the mockup's example address. |
| `auth.two-step.key-recognized-generic`                                                                                                                                                                                                                   | The key name is known only when the account has a single key.                                                              |
