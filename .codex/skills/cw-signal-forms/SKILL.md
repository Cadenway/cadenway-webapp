---
name: cw-signal-forms
description: "How to build a Cadenway form with Signal Forms: model signal, schema rules, field binding, messages from the mockup, submit and focus behavior. Load it before any form."
---

# Signal Forms

```typescript
readonly model = signal({ email: '', password: '' });
readonly loginForm = form(this.model, (f) => {
  required(f.email);
  required(f.password);
});
```

Import `FormField` from `@angular/forms/signals` and add it to the component imports.

```html
<input cwInput type="email" [formField]="loginForm.email" />
```

- Messages: take them from the mockup screen's script, word for word.
- Read the state from the field, for example `loginForm.email().touched()`,
  `loginForm.email().invalid()` and `loginForm.email().errors()`. Keep that state in the form.
