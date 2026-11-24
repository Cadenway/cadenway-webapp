# Settings shell

**Reading guide:** [Architecture](../../../../docs/architecture.md) · [Layout slot model](../../shared/layout-slot/index.ts).

The settings frame of mockups `Compte.dc.html` and `Organisation.dc.html`: the simplified 56 px applications rail (`nav[cwAppRail]`, a bottom tab bar below 768 px, for which the frame keeps `max-md:pb-14`), then a rounded panel with the 240 px « Settings » navigation and the `main` landmark holding the routed section. Below 768 px the navigation stacks above the content and the whole panel scrolls; from 768 px the navigation and the content scroll on their own.

## Slots

| Slot                 | Token                                     | Rendered                                                        |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `railNavigation`     | `SETTINGS_SHELL_RAIL_NAVIGATION_SLOT`     | The rail; each contribution renders its own `cw-app-rail-group` |
| `railFooter`         | `SETTINGS_SHELL_RAIL_FOOTER_SLOT`         | `cw-app-rail-footer` (search, theme, account avatar)            |
| `settingsNavigation` | `SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT` | The settings `nav` (back link, account and organization groups) |

Contributions render in ascending `order` through `NgComponentOutlet` with their `inputs`; an empty slot renders nothing: without contributions there is no settings navigation landmark. A rail contribution gives its host `class: 'contents'` so its items join the brick's flex layout. The routed section owns its centred column (`max-w-3xl` for the account, `max-w-4xl` for the organization).

## Public entries

| Entry point                         | Consumers                                   |
| ----------------------------------- | ------------------------------------------- |
| `@layouts/settings-shell`           | Owner-root feature routes (`SettingsShell`) |
| `@layouts/settings-shell/providers` | Owner-root feature routes (slot providers)  |

The provider-only entry keeps the component behind the route's dynamic import. The slot tokens stay private to the layout.

## Rules

The layout provides `provideCwLocale(() => inject(LOCALE_ID))` and `provideCwPhoneSheets()` to its subtree, so `@cadenway/ui/core` stays out of the initial bundle. Its copy uses the `@@layouts.settings-shell.*` ids. It never calls the API or reads a feature store.
