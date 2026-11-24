# App shell

**Reading guide:** [Architecture](../../../../docs/architecture.md) · [Layout slot model](../../shared/layout-slot/index.ts).

The application frame of mockup `App.dc.html` (lines 17-300): the banners across the top, the 56 px applications rail (`nav[cwAppRail]`, a 56 px bottom tab bar below 768 px, for which the panel keeps `max-md:mb-14`), and the rounded main panel. The panel holds the space sidebar (`cw-sidebar`, `collapsible="offcanvas"`) and the `main` landmark with the routed screen.

The sidebar starts closed below 1024 px, where it covers the content (`max-lg:absolute`), and open from 1024 px, where it pushes the content. Below 768 px `cw-sidebar` itself makes it a drawer with a backdrop. While it is closed, a ghost `button[cwSidebarToggle]` above the routed screen opens it; the route provides its `phosphorSidebarSimpleBold` icon through `provideCadenwayIcons()`.

## Slots

| Slot                   | Token                                  | Rendered                                                               |
| ---------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `banners`              | `APP_SHELL_BANNERS_SLOT`               | Above everything (`cw-banner` with `placement="top"`, storage quota)   |
| `organizationSwitcher` | `APP_SHELL_ORGANIZATION_SWITCHER_SLOT` | First in the rail, in a desktop-only `cw-app-rail-group` and separator |
| `railNavigation`       | `APP_SHELL_RAIL_NAVIGATION_SLOT`       | The rail; each contribution renders its own `cw-app-rail-group`        |
| `railFooter`           | `APP_SHELL_RAIL_FOOTER_SLOT`           | `cw-app-rail-footer` (search, theme, account menu)                     |
| `sidebarHeader`        | `APP_SHELL_SIDEBAR_HEADER_SLOT`        | `cw-sidebar-header` (organization switcher row, Search… Ctrl K)        |
| `sidebar`              | `APP_SHELL_SIDEBAR_SLOT`               | The scrolling body of `cw-sidebar` (favorites, spaces)                 |
| `sidebarFooter`        | `APP_SHELL_SIDEBAR_FOOTER_SLOT`        | `cw-sidebar-footer` (sprint progress, trash, archives)                 |
| `overlays`             | `APP_SHELL_OVERLAYS_SLOT`              | After the shell (command palette, shortcuts dialog)                    |

Contributions render in ascending `order` through `NgComponentOutlet` with their `inputs`; an empty slot renders nothing, its wrapper included. A rail or sidebar contribution gives its host `class: 'contents'` so its items join the brick's flex layout.

```ts
providers: [
  provideCadenwayIcons(),
  provideAppShellSlots({ railNavigation: [/* SlotFeature from a feature entry */] }),
],
```

## Public entries

| Entry point                    | Consumers                                  |
| ------------------------------ | ------------------------------------------ |
| `@layouts/app-shell`           | Owner-root feature routes (`AppShell`)     |
| `@layouts/app-shell/providers` | Owner-root feature routes (slot providers) |

The provider-only entry keeps the component behind the route's dynamic import. The slot tokens stay private to the layout.

## Rules

The layout provides `provideCwLocale(() => inject(LOCALE_ID))` and `provideCwPhoneSheets()` to its subtree, so `@cadenway/ui/core` stays out of the initial bundle. Its copy uses the `@@layouts.app-shell.*` ids. It never calls the API or reads a feature store.
