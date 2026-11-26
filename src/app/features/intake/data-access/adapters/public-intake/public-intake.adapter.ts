import type { IntakeSubmission, PublicIntakeForm } from '@cadenway/api-client';

import type {
  IntakeFormSettings,
  IntakeRequest,
} from '../../../models/intake-form/intake-form.interface';

/**
 * Function toIntakeFormSettings
 *
 * @description
 * Maps the published projection of a form. A gateway that leaves out the attachments mode
 * (optional in the contract) hides the field.
 *
 * @param {PublicIntakeForm} dto - The published form.
 * @returns {IntakeFormSettings} What the form shows.
 */
export function toIntakeFormSettings(dto: PublicIntakeForm): IntakeFormSettings {
  return {
    title: dto.title,
    description: dto.description ?? null,
    fields: {
      description: dto.fields.description,
      priority: dto.fields.priority,
      dueDate: dto.fields.dueDate,
      contactEmail: dto.fields.contactEmail,
      attachments: dto.fields.attachments ?? 'disabled',
    },
  };
}

/**
 * Function toIntakeSubmission
 *
 * @description
 * The body of a submission: the title, then each field the form shows and the requester filled
 * in. The contract refuses a hidden field, so a field the form disables is left out even when a
 * value remains; an empty optional field is left out too, and the attachments only when files
 * were uploaded.
 *
 * @param {IntakeRequest} request - The request as filled in.
 * @param {IntakeFormSettings} form - The form it was filled in.
 * @param {readonly string[]} attachmentIds - The verified uploads of its files, in order.
 * @returns {IntakeSubmission} The submission body.
 */
export function toIntakeSubmission(
  request: IntakeRequest,
  form: IntakeFormSettings,
  attachmentIds: readonly string[],
): IntakeSubmission {
  const shown: (key: keyof IntakeFormSettings['fields']) => boolean = (key) =>
    form.fields[key] !== 'disabled';
  return {
    title: request.title,
    ...(shown('description') && request.description ? { description: request.description } : {}),
    ...(shown('priority') && request.priority ? { priority: request.priority } : {}),
    ...(shown('dueDate') && request.dueDate ? { dueDate: request.dueDate } : {}),
    ...(shown('contactEmail') && request.contactEmail
      ? { contactEmail: request.contactEmail }
      : {}),
    ...(shown('attachments') && attachmentIds.length > 0
      ? { attachmentIds: [...attachmentIds] }
      : {}),
  };
}
