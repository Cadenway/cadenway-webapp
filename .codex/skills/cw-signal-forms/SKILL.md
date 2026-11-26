---
name: cw-signal-forms
description: "How to build a Cadenway form with Signal Forms: model signal, schema rules, field binding, messages from the mockup, submit and focus behavior. Load it before any form."
---

# Signal Forms

```typescript
readonly model = signal({ email: '', password: '' });
readonly loginForm = form(this.model, (f) => {
  required(f.email, { message: $localize`:@@auth.signIn.emailRequired:Enter your email address.` });
  required(f.password, { message: $localize`:@@auth.signIn.passwordRequired:Enter your password.` });
});
```

Import `FormField` from `@angular/forms/signals` and add it to the component imports.

```html
<input cwInput type="email" [formField]="loginForm.email" />
```

- Messages: English source strings with a stable `@@feature.area.key` id in `$localize`; the French
  wording of the mockup screen's script goes, word for word, into `src/locale/messages.fr.json` only.
- Submit with `submit()`; on an invalid submit, focus the first invalid field. Map a `422` problem back
  to its fields.
- Read the state from the field, for example `loginForm.email().touched()`,
  `loginForm.email().invalid()` and `loginForm.email().errors()`. Keep that state in the form.
