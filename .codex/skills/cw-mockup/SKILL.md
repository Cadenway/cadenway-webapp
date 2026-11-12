---
name: cw-mockup
description: "Where the mockup lives (docs/maquette/source and the live artifact), what each artboard covers, how to read a .dc.html file and its properties, and which guide section maps each screen to Angular components. Load it before any screen or copy work."
---

# Reading the mockup

- **Live mockup**: [interactive artifact](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE). **Local copy**: `docs/maquette/source/*.dc.html`
  (read-only reference) with `docs/maquette/source/styles/app.css`.
- **Guide**: [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et) maps every element to a `cw-*` component, gives the
  data shapes, the behaviors and what the mockup only simulates.

## Artboards used by this app

| File | Screen | Feature |
| --- | --- | --- |
| `Main.dc.html`, `Inscription.dc.html`, `Mfa.dc.html`, `Otp.dc.html`, `MotDePasseOublie.dc.html`, `Reinitialisation.dc.html`, `Deconnexion.dc.html` | Sign-in and account entry | `auth` |
| `Organisations.dc.html` | Choose or create an organization | `auth` |
| `App.dc.html` | Shell, home, my tasks, spaces and their 9 views, task detail and creation, goals, docs, dashboards, trash, archives | `core`, `home`, `my-tasks`, `spaces`, `task`, `goals`, `docs`, `dashboards`, `trash`, `archives` |
| `Compte.dc.html` | Account (5 sections) | `account` |
| `Organisation.dc.html` | Organization settings (7 sections) | `organization` |
| `AppMobile.dc.html`, `OrganisationMobile.dc.html` | 390 px versions | same features, responsive |
| `StatutTache.dc.html`, `PrioriteTache.dc.html` | Status and priority icons | from `@cadenway/ui` |

## Reading a .dc.html

Markup with `{{holes}}`, `<sc-if>` and `<sc-for>`, then a `<script type="text/x-dc">` whose
`renderVals()` builds the values and whose methods are the behaviors. `data-props` on the script lists
the artboard properties (states you can display). Behavior lives in the script: read it for rules
(fast clicks, confirmations, toasts), not only the markup.
