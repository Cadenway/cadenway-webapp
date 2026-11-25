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
- Submit stays enabled while the form is invalid, as in the mockup: an invalid submit shows the
  errors and focuses the first invalid field. Disable it only while its request is pending.
- Settings forms show the "Modifications non enregistrées" bar with Annuler and Enregistrer.
