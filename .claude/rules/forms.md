---
paths:
  - 'src/app/**/*form*'
  - 'src/app/**/forms/**'
  - 'src/app/**/*.validator.ts'
---

# Forms

- **Signal Forms only**: `form()` over a `signal()` model, rules in the schema, fields bound with
  `[formField]`. Never `ReactiveFormsModule`, `FormBuilder`, `FormGroup`, `FormControl`, `ValidatorFn`.
- Error messages are the mockup's, in French; a field shows its error after touch or submit.
- Submit is disabled while invalid; on submit the first invalid field receives focus.
- Settings forms show the "Modifications non enregistrées" bar with Annuler and Enregistrer.
