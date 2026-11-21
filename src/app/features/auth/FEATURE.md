# Auth

## Purpose

Sign-in, sign-up, MFA, codes, password, sign-out and organization choice.

## Routes

- `/connexion` opens a session with a password and handles a required authenticator code.
- `/organisations` lists the signed-in caller's organizations and changes the current session.
- `/accueil` displays the organization only after confirming it with the gateway.

## Public entry points

| Entry point   | Consumers    |
| ------------- | ------------ |
| `auth.routes` | app          |
| `.`           | spaces, task |

## Dependencies

`@cadenway/api-client` owns every HTTP operation. The root API interceptor supplies the gateway origin and lets the browser manage credentials.

## Invariants

- The gateway cookie is the only session credential. Passwords and second-step secrets are kept in page memory and are never persisted.
- Password sign-in opens the chooser only on a confirmed session. The second step supports the authenticator app. Email codes, account recovery, social sign-in and other challenge methods are later workflows.
- `SignInStore` and `OrganizationActionsStore` are page-scoped.
- A session without usable organization access cannot load private workspace features.
- Sign-in, its second step, sign-out and organization changes coordinate with organization-bound
  task requests through one origin-scoped browser lock. These operations require Web Locks in a
  secure context and fail without sending a request when the browser cannot acquire the lock.
