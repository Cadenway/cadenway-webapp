import type { FieldTree, ValidationError } from '@angular/forms/signals';

/**
 * Function focusFirstError
 *
 * @description
 * Moves focus to the first field of a form that holds an error, client or server, as the forms
 * rule requires after a refused submit. Does nothing when the form has no error.
 *
 * @template T
 * @param {FieldTree<T>} form - The submitted form.
 */
export function focusFirstError<T>(form: FieldTree<T>): void {
  const first: ValidationError.WithFieldTree | undefined = form().errorSummary().at(0);
  first?.fieldTree().focusBoundControl();
}

/**
 * Function serverError
 *
 * @description
 * Builds the error a submit action returns to show a gateway refusal on one field.
 *
 * @param {FieldTree<unknown>} field - The field the refusal concerns.
 * @param {string} message - The translated message.
 * @returns {ValidationError.WithOptionalFieldTree} The error, of kind `server`.
 */
export function serverError(
  field: FieldTree<unknown>,
  message: string,
): ValidationError.WithOptionalFieldTree {
  return { kind: 'server', message, fieldTree: field };
}
