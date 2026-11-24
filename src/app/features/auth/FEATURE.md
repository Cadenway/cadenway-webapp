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

| Entry point   | Consumers            |
| ------------- | -------------------- |
| `auth.routes` | app                  |
| `.`           | errors, spaces, task |

`.` exports `withSessionLock` (cross-tab session lock, signature unchanged) and, until the
workspace routes replace their last consumers, the transitional `requireOrganization` guard and
`resolveOrganizationId` resolver (`/login` on `401`, `/organizations` otherwise).

## Dependencies

- `@cadenway/api-client` (`AuthService`, `OrganizationsService`, `InvitationsService`,
  `ProfileMediaService`) through `data-access/`; `@simplewebauthn/browser` for the security key.
- `@layouts/auth-layout` and `@layouts/auth-layout/providers` (root route only), `@core/theme`,
  `@core/config` (`siteUrl`), `@core/api` (`readProblem`).

## Invariants

- The gateway cookie is the only session credential. Passwords stay in page memory, and the
  pending sign-up password in `AuthFlowStore` memory, never in storage.
- Only a `200` with a session means signed in; a `202` is a two-step challenge. Its token lives in
  the flow store and the tab's `sessionStorage` (read again after a reload), never in a URL.
- The federated continuation is redeemed once per flow store, with an empty body; the gateway
  clears the cookie on every outcome.
- Sign-in, its second step, the address verification, the federated continuation, sign-out and
  the session's organization switch run under the exclusive `withSessionLock`.
- A session that opens remembers its account (name and address only) in `localStorage`, then
  opens `?next=`, else `/<slug>` of the session's organization, else `/organizations`.
- The reset token is read from the URL fragment, removed from the address bar and sent in bodies
  only.
- `AuthFlowStore` is provided by the auth root route; `OrganizationChoiceStore` and
  `OrganizationCreateStore` by their pages. A refused invitation waits 6 seconds for « Annuler »
  and is sent when the page closes.
- A just created or joined organization's session switch retries its `404` for a few seconds, as
  the contract asks; the logo upload follows the switch and never undoes the creation.
