# App shell

**Reading guide:** [Architecture](../../../../docs/architecture.md#layouts-and-slots) · [Layout slots](../../shared/layout-slot/README.md).

The application frame of mockup `App.dc.html` (lines 17-300): the banners across the top, the 56 px applications rail (`nav[cwAppRail]`, a 56 px bottom tab bar below 768 px, for which the panel keeps `max-md:mb-14`), and the rounded main panel. The panel holds the space sidebar (`cw-sidebar`, `collapsible="offcanvas"`) and the `main` landmark with the routed screen.

## Sidebar

- **Behavior.** The sidebar keeps the default `cw-sidebar` behavior. It starts expanded, pushes the content from 768 px, and is a drawer with a backdrop below 768 px.
- From 768 to 1023 px the expanded sidebar floats over the content (`overlayBelow="lg"`, closed by
  default, Escape or an outside click closes it), and its backdrop stays inside the main panel
  (`backdrop="container"`), clear of the phone tab bar.
- **Toggles.** The first row of the sidebar header ends with the collapse button, so it sits on the organization row (mockup line 196). While the sidebar is collapsed, an expand toggle sits above the routed screen. Neither toggle declares a keyboard shortcut: the mockup keeps Ctrl B for bold in the editors (line 3639). `cw-sidebar` 0.8.0 still binds Ctrl B itself, without an option to turn it off.
- **Focus.** Opening with a toggle moves focus to the first control of the sidebar. A collapse that leaves focus in the sidebar returns it to the control that opened it, or else to the expand toggle.
- **Screen toggle.** A screen can render the expand toggle itself through `SHELL_SIDEBAR` and `claimToggle(destroyRef)` (see [the port](../../shared/layout-slot/README.md#shell-sidebar-port)). `AppShellSidebar`, provided by the shell, holds this state.
- **Icon.** The route provides the `phosphorSidebarSimpleBold` icon through `provideCadenwayIcons()`.

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

The shell renders one `cw-toaster` after the overlays, where contributions show their toasts through `CwToastService`; its texts use the `@@layouts.app-shell.toast-*` ids.

Contributions render in ascending `order` through `NgComponentOutlet` with their `inputs`. An empty slot renders nothing, its wrapper included. A rail or sidebar contribution gives its host `class: 'contents'`, so its items join the brick's flex layout.

Every contribution goes in the `providers` of the route that loads `AppShell`; a child route cannot add to a slot. Page-level additions go through the core page-to-shell services (see the [slot contract](../../shared/layout-slot/README.md#contract)).

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

The provider-only entry keeps the component behind the route's dynamic import. The slot tokens and `AppShellSidebar` stay private to the layout. Screens use `SHELL_SIDEBAR` from `@shared/layout-slot`.

## Rules

The layout provides `provideCwLocale(() => inject(LOCALE_ID))`, `provideCwPhoneSheets()` and `AppShellSidebar` to its subtree, so `@cadenway/ui/core` stays out of the initial bundle. Its copy uses the `@@layouts.app-shell.*` ids. It never calls the API or reads a feature store.
