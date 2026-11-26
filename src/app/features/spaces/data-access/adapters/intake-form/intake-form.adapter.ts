import type {
  IntakeFormConfiguration as IntakeFormConfigurationDto,
  IntakeFormPatch,
} from '@cadenway/api-client';

import type {
  IntakeFormChange,
  IntakeFormConfiguration,
} from '../../../models/intake-form/intake-form.interface';

/**
 * Function toIntakeFormConfiguration
 *
 * @description
 * Maps a list's form settings. A gateway that leaves out the attachments mode (optional in the
 * contract) hides the field.
 *
 * @param {IntakeFormConfigurationDto} dto - The settings read or written.
 * @returns {IntakeFormConfiguration} The display model.
 */
export function toIntakeFormConfiguration(
  dto: IntakeFormConfigurationDto,
): IntakeFormConfiguration {
  return {
    settings: {
      title: dto.title,
      description: dto.description ?? null,
      fields: {
        description: dto.fields.description,
        priority: dto.fields.priority,
        dueDate: dto.fields.dueDate,
        contactEmail: dto.fields.contactEmail,
        attachments: dto.fields.attachments ?? 'disabled',
      },
      defaultStatus: dto.defaultStatus,
      defaultAssigneeId: dto.defaultAssigneeId ?? null,
    },
    publicKey: dto.publicKey ?? null,
    version: dto.version,
  };
}

/**
 * Function toIntakeFormPatch
 *
 * @description
 * The merge patch of a change: only the settings it names. An empty introduction is sent as null,
 * which removes it.
 *
 * @param {IntakeFormChange} change - The changed settings.
 * @returns {IntakeFormPatch} The patch body.
 */
export function toIntakeFormPatch(change: IntakeFormChange): IntakeFormPatch {
  return {
    ...(change.title !== undefined ? { title: change.title } : {}),
    ...(change.description !== undefined
      ? { description: change.description?.trim() ? change.description : null }
      : {}),
    ...(change.fields && Object.keys(change.fields).length > 0
      ? { fields: { ...change.fields } }
      : {}),
    ...(change.defaultStatus !== undefined ? { defaultStatus: change.defaultStatus } : {}),
    ...(change.defaultAssigneeId !== undefined
      ? { defaultAssigneeId: change.defaultAssigneeId }
      : {}),
  };
}
