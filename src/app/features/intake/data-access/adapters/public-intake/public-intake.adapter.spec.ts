import { describe, expect, it } from 'vitest';

import type {
  IntakeFormSettings,
  IntakeRequest,
} from '../../../models/intake-form/intake-form.interface';
import { toIntakeFormSettings, toIntakeSubmission } from './public-intake.adapter';

/**
 * Constant form
 *
 * @description
 * The Sprint 14 form with the mockup's defaults, the priority hidden.
 *
 * @type {IntakeFormSettings}
 */
const form: IntakeFormSettings = {
  title: 'Request for “Sprint 14”',
  description: null,
  fields: {
    description: 'optional',
    priority: 'disabled',
    dueDate: 'optional',
    contactEmail: 'required',
    attachments: 'optional',
  },
};

/**
 * Constant request
 *
 * @description
 * A request filled in at Atelier Nord, with a priority left over from before it was hidden.
 *
 * @type {IntakeRequest}
 */
const request: IntakeRequest = {
  title: 'Export the invoices as CSV',
  description: '',
  priority: 'haute',
  dueDate: '2026-12-04',
  contactEmail: 'camille.martin@ateliernord.fr',
  files: [],
};

describe('public intake adapter', () => {
  it('maps the published form and hides attachments a gateway leaves out', () => {
    expect(
      toIntakeFormSettings({
        title: 'Request',
        description: 'Describe your need.',
        fields: {
          description: 'required',
          priority: 'optional',
          dueDate: 'disabled',
          contactEmail: 'optional',
        },
      }),
    ).toEqual({
      title: 'Request',
      description: 'Describe your need.',
      fields: {
        description: 'required',
        priority: 'optional',
        dueDate: 'disabled',
        contactEmail: 'optional',
        attachments: 'disabled',
      },
    });
  });

  it('sends the shown fields filled in, never a hidden or empty one', () => {
    expect(toIntakeSubmission(request, form, [])).toEqual({
      title: 'Export the invoices as CSV',
      dueDate: '2026-12-04',
      contactEmail: 'camille.martin@ateliernord.fr',
    });
  });

  it('sends the uploads only while the form shows attachments', () => {
    expect(toIntakeSubmission(request, form, ['a1']).attachmentIds).toEqual(['a1']);
    expect(
      toIntakeSubmission(
        request,
        { ...form, fields: { ...form.fields, attachments: 'disabled' } },
        ['a1'],
      ).attachmentIds,
    ).toBeUndefined();
  });
});
