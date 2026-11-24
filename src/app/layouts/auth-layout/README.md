# Auth layout

**Reading guide:** [Architecture](../../../../docs/architecture.md) · [Layout slot model](../../shared/layout-slot/index.ts).

The sign-in frame of mockup `Main.dc.html`, shared by the sign-in, sign-up, verification and password screens. A 56 px header holds the Cadenway lockup (`cw-logo variant="lockup"`, linking to `/`) and the header actions. The routed screen sits in a centred card of at most 400 px (`p-6`, `sm:p-8`, a 24 px column), and a footer holds the legal and help links.

## Slots

| Slot            | Token                      | Rendered                                                 |
| --------------- | -------------------------- | -------------------------------------------------------- |
| `headerActions` | `AUTH_HEADER_ACTIONS_SLOT` | Right of the header (theme toggle, host name)            |
| `footerLinks`   | `AUTH_FOOTER_LINKS_SLOT`   | The footer (workspace name, Privacy, Terms of use, Help) |

Contributions render in ascending `order` through `NgComponentOutlet` with their `inputs`. An empty slot renders nothing: without footer links there is no footer landmark. A route binds the features a feature publishes:

```ts
providers: [provideAuthLayoutSlots({ headerActions: [/* SlotFeature from a feature entry */] })],
```

## Public entries

| Entry point                      | Consumers                                  |
| -------------------------------- | ------------------------------------------ |
| `@layouts/auth-layout`           | Owner-root feature routes (`AuthLayout`)   |
| `@layouts/auth-layout/providers` | Owner-root feature routes (slot providers) |

The provider-only entry keeps the component behind the route's dynamic import. The slot tokens stay private to the layout.

## Rules

The layout provides `provideCwLocale(() => inject(LOCALE_ID))` and `provideCwPhoneSheets()` to its subtree, so `@cadenway/ui/core` stays out of the initial bundle. Its copy uses the `@@layouts.auth-layout.*` ids. It never calls the API or reads a feature store.
