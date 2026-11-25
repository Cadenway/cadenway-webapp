# Settings shell

**Reading guide:** [Architecture](../../../../docs/architecture.md#layouts-and-slots) · [Layout slots](../../shared/layout-slot/README.md).

The settings frame of mockups `Compte.dc.html` and `Organisation.dc.html`. The simplified 56 px applications rail (`nav[cwAppRail]`) comes first, then a rounded panel with the 240 px settings navigation and the `main` landmark holding the routed section.

- **Below 768 px**, the navigation stacks above the content and the whole panel scrolls.
- **From 768 px**, the panel stops wrapping (`md:flex-nowrap`), so the main area shrinks beside the navigation and each column scrolls on its own.

## Navigation name

The route that loads `SettingsShell` names the settings navigation through its `data`, typed with `satisfies`. The routes supply the English source strings with `$localize`. They read `Settings` for the account and `Organization settings` for the organization; their French translations live in `src/locale/messages.fr.json`.

```ts
data: { settingsNavigationLabel: $localize`:@@<feature>.<area>.<key>:…` } satisfies SettingsShellRouteData,
```

Without a label, the navigation has no `aria-label`.

## Slots

| Slot                 | Token                                     | Rendered                                                        |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `railNavigation`     | `SETTINGS_SHELL_RAIL_NAVIGATION_SLOT`     | The rail; each contribution renders its own `cw-app-rail-group` |
| `railFooter`         | `SETTINGS_SHELL_RAIL_FOOTER_SLOT`         | `cw-app-rail-footer` (search, theme, account avatar)            |
| `settingsNavigation` | `SETTINGS_SHELL_SETTINGS_NAVIGATION_SLOT` | The settings `nav` (back link, account and organization groups) |

- Contributions render in ascending `order` through `NgComponentOutlet` with their `inputs`.
- An empty slot renders nothing: without contributions there is no settings navigation landmark.
- Every contribution goes in the `providers` of the route that loads `SettingsShell`, and a child route cannot add to a slot (see the [slot contract](../../shared/layout-slot/README.md#contract)).
- A rail contribution gives its host `class: 'contents'`, so its items join the brick's flex layout.
- The routed section owns its centred column: `max-w-3xl` for the account, `max-w-4xl` for the organization.

## Phones

As in `Compte.dc.html`, the rail stays a 56 px column on every width (`phoneLayout="column"`).

## Public entries

| Entry point                         | Consumers                                                             |
| ----------------------------------- | --------------------------------------------------------------------- |
| `@layouts/settings-shell`           | Owner-root feature routes (`SettingsShell`, `SettingsShellRouteData`) |
| `@layouts/settings-shell/providers` | Owner-root feature routes (slot providers)                            |

The provider-only entry keeps the component behind the route's dynamic import. The slot tokens stay private to the layout.

## Rules

The layout provides `provideCwLocale(() => inject(LOCALE_ID))` and `provideCwPhoneSheets()` to its subtree, so `@cadenway/ui/core` stays out of the initial bundle. Its copy uses the `@@layouts.settings-shell.*` ids. It never calls the API or reads a feature store.
