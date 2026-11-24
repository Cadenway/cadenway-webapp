# Layout slots

**Reading guide:** [Architecture, Layouts and slots](../../../../docs/architecture.md#layouts-and-slots).

The non-visual contract between the shells of `src/app/layouts/` and the features that fill them. A layout never imports a feature: it declares slots, and the route that loads it binds the features' contributions.

## Model

- `SlotContribution { id; order; component; inputs? }`: a standalone component the layout renders with `NgComponentOutlet`, in ascending `order`, with its optional `inputs`.
- `SlotFeature<T> { useFactory }`: what a feature publishes as `with<Thing>()`. The factory runs in an injection context when the layout first reads the slot, so it may inject the feature's services.
- `slotProviders(slot, features)`: one `multi` factory provider per feature. Each layout wraps it in its `provide<Layout>Slots(config)` entry.
- `injectSlot(slot)`: reads a slot as optional and sorts it by `order`; ties keep their registration order and an unprovided slot is an empty list.

## Contract

- **Where contributions go.** Every contribution belongs in the `providers` of the route that loads the shell. The layout reads its slots once, from that route's injector, when it is created. Contributions in a child route's providers never reach it (`app-shell.component.spec.ts` proves it with a nested route). Several `provide<Layout>Slots` calls in the same route add up.
- **Page-level additions** (breadcrumb, page actions, tabs, selection) go through the core page-to-shell services, not through slots.
- **Unique ids.** Ids must be unique within a slot, because layouts track rendered contributions by id. `injectSlot` throws in development mode (`ngDevMode`) on a duplicate, naming the slot and the id. It does not dedupe: a silent drop would hide a wiring mistake. Production builds skip the check.
- **Empty slots render nothing**, the layout's wrapper for that slot included.

## Shell sidebar port

`SHELL_SIDEBAR` (`ShellSidebar`: `expanded`, `toggleClaimed`, `toggle()`, `claimToggle(destroyRef)`) lets a routed screen drive the collapsible sidebar of the shell that hosts it. A screen cannot import a layout, so `AppShell` provides this token with its layout-scoped `AppShellSidebar`. Inject it as optional. A screen that renders the expand toggle itself, in its breadcrumb row for example (`App.dc.html` lines 279-281), calls `claimToggle(inject(DestroyRef))`, and the shell hides its own toggle while the screen lives.

## Public entry

| Entry point           | Consumers                                                                       |
| --------------------- | ------------------------------------------------------------------------------- |
| `@shared/layout-slot` | Layouts, feature `providers/` (`SlotFeature`), routed screens (`SHELL_SIDEBAR`) |
