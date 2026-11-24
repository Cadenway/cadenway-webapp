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
palette use it; a refusal resolves `false` and leaves the page as it was).

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
  screen with « Se reconnecter ».
- The federated continuation is redeemed once per flow store, with an empty body; the gateway
  clears the cookie on every outcome.
- Sign-in, its second step, the address verification, the federated continuation, sign-out and
  the session's organization switch run under the exclusive `withSessionLock`. After a creation,
  the switch to the new organization, the check that it is current and the logo upload run under
  one exclusive lock, so another tab cannot redirect the logo.
- A session that opens remembers its account (name and address only) in `localStorage` only when
  « Rester connecté pendant 30 jours » is ticked, then opens `?next=`, else `/<slug>` of the
  session's organization, else `/organizations`. A reserved slug (`RESERVED_SLUGS` of
  `@core/routing`) always opens `/organizations`.
- The reset token is read from the URL fragment, then removed with a replacing navigation to
  `/reset`, so neither the address bar nor `router.url` keeps it; it is sent in bodies only.
- `AuthFlowStore` is provided by the auth root route and destroyed by the router when the person
  leaves the auth screens (`withAutoCleanupInjectors`), which also clears the tab's challenge
  token. `OrganizationChoiceStore` and `OrganizationCreateStore` are provided by their pages. A
  refused invitation waits 6 seconds for « Annuler » and is sent when the page closes.
- A failed organization list or invitation list shows its own inline error with « Réessayer »,
  never an empty list.
- A sign-up replaced by a newer one (`auth.sign-up-replaced`) returns to
  `/signup?reason=sign-up-replaced`. A creation whose logo could not be uploaded opens
  `/<slug>?notice=logo-upload-failed`, which the home screen explains.

## Copy not taken word for word from the mockup

These French units have no mockup wording, or adapt it to the contract.

| Unit                                                                                                                                                                                                                                                     | Reason                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `auth.login.unverified`, `auth.login.unavailable`, `auth.login.password-required`                                                                                                                                                                        | States the mockup does not draw: unverified address, unavailable gateway, empty password.                                  |
| `auth.federated.refused`, `auth.federated.title`, `auth.federated.heading`, `auth.federated.pending`                                                                                                                                                     | The provider return screen is not in the mockup.                                                                           |
| `auth.two-step.code-invalid`, `auth.two-step.key-refused`, `auth.two-step.locked`, `auth.two-step.expired`                                                                                                                                               | `Mfa.dc.html` draws no refused answer.                                                                                     |
| `auth.two-step.key-one`, `auth.two-step.backup-left-one`, `auth.reset.device-one`, `auth.reset.done-closed-one`, `auth.login.invalid-attempt-one`                                                                                                        | Singular forms of mockup sentences written for several.                                                                    |
| `auth.signup.name-required`, `auth.signup.password-short`, `auth.signup.password-compromised`, `auth.signup.replaced`                                                                                                                                    | Sign-up refusals of the contract the mockup does not draw.                                                                 |
| `auth.forgot.unavailable`, `auth.reset.unavailable`, `auth.reset.loading`                                                                                                                                                                                | Failure and loading states the mockup does not draw.                                                                       |
| `auth.forgot.once`                                                                                                                                                                                                                                       | The mockup says the link works « depuis ce navigateur »; the contract lets any browser use it.                             |
| `auth.reset.devices`, `auth.reset.done-closed`                                                                                                                                                                                                           | The mockup's « sauf celui-ci » does not apply: the reset runs without a session.                                           |
| `auth.organization-create.slug-invalid`, `auth.organization-create.slug-reserved`, `auth.organization-create.slug-taken`, `auth.organization-create.invites-invalid`, `auth.organization-create.invites-limit`, `auth.organization-create.name-required` | Creation refusals the mockup does not draw.                                                                                |
| `auth.organization-create.logo-error`                                                                                                                                                                                                                    | The contract accepts PNG and SVG only; the mockup also names JPEG.                                                         |
| `auth.organizations.mfa-required`, `auth.organizations.gone`, `auth.organizations.action-failed`, `auth.organizations.sign-out-failed`, `auth.organizations.loading`                                                                                     | Chooser failures and loading the mockup does not draw.                                                                     |
| `auth.organizations.invitations-failed`                                                                                                                                                                                                                  | Wording of the section error of `Organisation.dc.html`.                                                                    |
| `auth.logged-out.expired-body`, `auth.logged-out.all-body`                                                                                                                                                                                               | The mockup names the organization, its inactivity policy and the session count, which the signed-out screen does not know. |
| `auth.logged-out.route-title`, `auth.two-step.sign-in-again`                                                                                                                                                                                             | « Déconnexion » and « Se reconnecter » reuse mockup words in new places.                                                   |
