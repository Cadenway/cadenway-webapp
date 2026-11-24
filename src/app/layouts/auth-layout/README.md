# Auth layout

**Reading guide:** [Architecture](../../../../docs/architecture.md#layouts-and-slots) · [Layout slots](../../shared/layout-slot/README.md).

The sign-in frame of mockup `Main.dc.html`, shared by the sign-in, sign-up, verification and password screens. A 56 px header holds the Cadenway lockup (`cw-logo variant="lockup"`, linking to `/`) and the header actions. A column centres the routed screen, and a footer holds the legal and help links.

The layout draws no card and fixes no width. Each screen owns its card and its width: 400 px in `Main`, 420 or 520 px elsewhere. It also owns the line below the card in `Main`, `Inscription` and `MotDePasseOublie`.

## Slots

| Slot            | Token                      | Rendered                                                 |
| --------------- | -------------------------- | -------------------------------------------------------- |
| `headerActions` | `AUTH_HEADER_ACTIONS_SLOT` | Right of the header (theme toggle, host name)            |
| `footerLinks`   | `AUTH_FOOTER_LINKS_SLOT`   | The footer (workspace name, Privacy, Terms of use, Help) |

Contributions render in ascending `order` through `NgComponentOutlet` with their `inputs`. An empty slot renders nothing: without footer links there is no footer landmark. Every contribution goes in the `providers` of the route that loads `AuthLayout`; a child route cannot add to a slot (see the [slot contract](../../shared/layout-slot/README.md#contract)).

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

The layout provides `provideCwLocale(() => inject(LOCALE_ID))` and `provideCwPhoneSheets({ bottom: 8 })` to its subtree. There is no tab bar here, so a phone sheet sits 8 px above the bottom of the screen. These providers keep `@cadenway/ui/core` out of the initial bundle. The layout's copy uses the `@@layouts.auth-layout.*` ids. It never calls the API or reads a feature store.
