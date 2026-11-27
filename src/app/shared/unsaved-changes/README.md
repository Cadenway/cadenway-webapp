# Unsaved changes

**Reading guide:** [Architecture](../../../../docs/architecture.md) · [Routing rule](../../../../.claude/rules/routing.md).

The non-visual contract that keeps a settings form from losing its edits. The settings pages of
`Compte.dc.html` and `Organisation.dc.html` hold forms with an `Unsaved changes` footer; this entry
makes leaving such a page ask first.

## Model

- `UnsavedChanges { hasUnsavedChanges(): boolean; confirmDiscard(): Promise<boolean> }`: what the
  routed page implements. `confirmDiscard()` opens the page's own confirmation and resolves true to
  discard and leave, false to keep editing.
- `unsavedChangesGuard`: the `CanDeactivateFn<UnsavedChanges>` of the route. A clean page leaves at
  once; a dirty one waits for `confirmDiscard()`. A navigation to the URL already shown (a
  workspace recovery, a `Retry`) reruns the route on the reused page and goes without asking.
- `warnBeforeUnload(dirty)`: asks the browser to confirm closing or reloading the tab while
  `dirty()` holds. Call it in the page's injection context; the listener goes with the page.

## Usage

```ts
{ path: 'profile', canDeactivate: [unsavedChangesGuard], loadComponent: … }
```

The page renders Workspace's `cw-discard-changes-dialog` (`@features/workspace/ui/dialogs/discard-changes-dialog`)
and returns its `ask()` from `confirmDiscard()`. The visual `Unsaved changes` footer stays a
composition inside each form card (`cw-card-footer`, the dot and the text, then `Cancel` and
`Save`), since its text varies per card.

## Public entry

| Entry point               | Consumers                                                 |
| ------------------------- | --------------------------------------------------------- |
| `@shared/unsaved-changes` | Feature routes (`canDeactivate`) and their settings pages |

## Rules

It is non-visual: it never imports `@cadenway/ui`, a feature or a layout.
