import { describe, expect, it } from 'vitest';

import { toIntakeFormConfiguration, toIntakeFormPatch } from './intake-form.adapter';

describe('intake form adapter', () => {
  it('maps the settings, hiding attachments a gateway leaves out', () => {
    expect(
      toIntakeFormConfiguration({
        title: 'Request for “Sprint 14”',
        description: null,
        fields: {
          description: 'optional',
          priority: 'optional',
          dueDate: 'optional',
          contactEmail: 'required',
        },
        defaultStatus: 'triage',
        defaultAssigneeId: null,
        publicKey: null,
        version: 1,
      }),
    ).toEqual({
      settings: {
        title: 'Request for “Sprint 14”',
        description: null,
        fields: {
          description: 'optional',
          priority: 'optional',
          dueDate: 'optional',
          contactEmail: 'required',
          attachments: 'disabled',
        },
        defaultStatus: 'triage',
        defaultAssigneeId: null,
      },
      publicKey: null,
      version: 1,
    });
  });

  it('patches only the changed settings and removes a blank introduction', () => {
    expect(toIntakeFormPatch({ fields: { dueDate: 'required' } })).toEqual({
      fields: { dueDate: 'required' },
    });
    expect(toIntakeFormPatch({ description: '  ', defaultAssigneeId: null })).toEqual({
      description: null,
      defaultAssigneeId: null,
    });
    expect(toIntakeFormPatch({ title: 'Bug report', defaultStatus: 'todo' })).toEqual({
      title: 'Bug report',
      defaultStatus: 'todo',
    });
  });
});
