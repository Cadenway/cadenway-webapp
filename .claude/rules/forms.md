---
paths:
  - 'src/app/**/*form*'
  - 'src/app/**/forms/**'
  - 'src/app/**/*.validator.ts'
---

# Forms

- Use `cw-signal-forms` for the Signal Forms model, schema and field binding. Keep `ValidatorFn` out.
- Error messages are English source strings with `@@ids`, translated word for word to the mockup's
  French; a field shows its error after touch or submit.
- Submit is disabled while invalid; on submit the first invalid field receives focus.
- Settings forms show the "Modifications non enregistrées" bar with Annuler and Enregistrer.
