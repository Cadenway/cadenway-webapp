import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { IntakeManagementService } from '@cadenway/api-client';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { NotFoundRouteError, UnavailableRouteError } from '@shared/route-errors';

import { IntakeFormApi } from './intake-form-api.service';

/**
 * Function configuration
 *
 * @description
 * The Sprint 14 form settings as the gateway answers them.
 *
 * @param {string | null} publicKey - Key of the publication.
 * @param {number} version - Version of the settings.
 * @returns {Record<string, unknown>} The settings.
 */
function configuration(publicKey: string | null, version: number): Record<string, unknown> {
  return {
    title: 'Request for “Sprint 14”',
    description: null,
    fields: {
      description: 'optional',
      priority: 'optional',
      dueDate: 'optional',
      contactEmail: 'required',
      attachments: 'optional',
    },
    defaultStatus: 'triage',
    defaultAssigneeId: null,
    publicKey,
    version,
  };
}

describe('IntakeFormApi', () => {
  let intake: Record<string, Mock>;
  let api: IntakeFormApi;

  beforeEach(() => {
    intake = {
      getIntakeFormConfiguration: vi.fn(() => of(configuration(null, 3))),
      updateIntakeFormConfiguration: vi.fn(() => of(configuration(null, 4))),
      publishIntakeForm: vi.fn(() => of(configuration('k'.repeat(43), 5))),
      disableIntakeForm: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: IntakeManagementService, useValue: intake }],
    });
    api = TestBed.inject(IntakeFormApi);
  });

  it('reads the settings of a list', async () => {
    expect((await api.configuration('list-sprint-14')).version).toBe(3);
    expect(intake['getIntakeFormConfiguration']).toHaveBeenCalledWith('list-sprint-14');
  });

  it('turns a failed read into the typed route error of the list', async () => {
    intake['getIntakeFormConfiguration'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 400, error: { status: 400 } })),
    );
    await expect(api.configuration('x')).rejects.toBeInstanceOf(NotFoundRouteError);
    intake['getIntakeFormConfiguration'].mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 503, error: { status: 503 } })),
    );
    await expect(api.configuration('x')).rejects.toBeInstanceOf(UnavailableRouteError);
  });

  it('changes settings against their version', async () => {
    expect(
      (await api.update('list-sprint-14', { fields: { dueDate: 'required' } }, 3)).version,
    ).toBe(4);
    expect(intake['updateIntakeFormConfiguration']).toHaveBeenCalledWith(
      'list-sprint-14',
      { fields: { dueDate: 'required' } },
      { headers: { 'If-Match': '"3"' } },
    );
  });

  it('publishes, then withdraws and reads the settings again', async () => {
    expect((await api.publish('list-sprint-14')).publicKey).toBe('k'.repeat(43));
    intake['getIntakeFormConfiguration'].mockReturnValueOnce(of(configuration(null, 6)));

    const disabled: Awaited<ReturnType<IntakeFormApi['disable']>> =
      await api.disable('list-sprint-14');

    expect(intake['disableIntakeForm']).toHaveBeenCalledWith('list-sprint-14');
    expect(disabled).toEqual(expect.objectContaining({ publicKey: null, version: 6 }));
  });
});
