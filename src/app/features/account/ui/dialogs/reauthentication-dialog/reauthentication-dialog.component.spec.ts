import { HttpErrorResponse } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ReauthenticationApi } from '../../../data-access/services/reauthentication-api/reauthentication-api.service';
import type { ReauthenticationAnswer } from '../../../models/reauthentication/reauthentication.interface';
import { ReauthenticationCancelledError } from '../../../reauthentication/reauthentication-cancelled.error';
import { ReauthenticationService } from '../../../reauthentication/reauthentication.service';
import { ReauthenticationDialog } from './reauthentication-dialog.component';

/**
 * Function dialog
 *
 * @description
 * The open reauthentication dialog.
 *
 * @returns {HTMLElement | null} The dialog, or null while closed.
 */
function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

/**
 * Function button
 *
 * @description
 * A button of the dialog by its text.
 *
 * @param {string} text - Visible text.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function button(text: string): HTMLButtonElement | undefined {
  return [...(dialog()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(
    (candidate: HTMLButtonElement) => candidate.textContent.trim() === text,
  );
}

/**
 * Function type
 *
 * @description
 * Types a password into the dialog's password field.
 *
 * @param {string} value - Typed text.
 */
function type(value: string): void {
  const field: HTMLInputElement | null =
    dialog()?.querySelector<HTMLInputElement>('input[type="password"]') ?? null;
  if (field === null) throw new Error('Expected the password field.');
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

describe('ReauthenticationDialog', () => {
  let reauthenticate: Mock<(answer: ReauthenticationAnswer) => Promise<void>>;
  let fixture: ComponentFixture<ReauthenticationDialog>;
  let service: ReauthenticationService;

  beforeEach(async () => {
    reauthenticate = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        ReauthenticationService,
        { provide: ReauthenticationApi, useValue: { reauthenticate } },
      ],
    });
    service = TestBed.inject(ReauthenticationService);
    fixture = TestBed.createComponent(ReauthenticationDialog);
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Function ask
   *
   * @description
   * Runs an operation the gateway refuses once for want of a recent password authentication.
   *
   * @returns {Promise<string>} The operation's result.
   */
  async function ask(): Promise<string> {
    const operation: Mock<() => Promise<string>> = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new HttpErrorResponse({
          status: 403,
          error: { code: 'auth.reauthentication-required', details: { methods: ['password'] } },
        }),
      )
      .mockResolvedValue('saved');
    const result: Promise<string> = service.run(operation);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(dialog()?.textContent).toContain("Confirm it's you");
    });
    return result;
  }

  it('shows the field error on an empty submit without calling the gateway', async () => {
    void ask().catch(() => undefined);
    await vi.waitFor(() => {
      expect(button('Confirm')).toBeDefined();
    });

    button('Confirm')?.click();
    await fixture.whenStable();

    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain(
      'Enter your password.',
    );
    expect(reauthenticate).not.toHaveBeenCalled();
  });

  it('confirms the password and lets the operation run again', async () => {
    const result: Promise<string> = ask();
    await vi.waitFor(() => {
      expect(button('Confirm')).toBeDefined();
    });

    type('correct horse battery');
    button('Confirm')?.click();

    await expect(result).resolves.toBe('saved');
    expect(reauthenticate).toHaveBeenCalledWith({ password: 'correct horse battery' });
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(dialog()).toBeNull();
    });
  });

  it('shows the attempts left after a wrong password', async () => {
    reauthenticate.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 422,
        error: { code: 'auth.password-incorrect', details: { remainingAttempts: 2 } },
      }),
    );
    void ask().catch(() => undefined);
    await vi.waitFor(() => {
      expect(button('Confirm')).toBeDefined();
    });

    type('wrong');
    button('Confirm')?.click();

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain(
        'Incorrect password. Attempts left: 2.',
      );
    });
  });

  it('cancels the waiting operation from Cancel', async () => {
    const result: Promise<string> = ask();
    await vi.waitFor(() => {
      expect(button('Cancel')).toBeDefined();
    });

    button('Cancel')?.click();

    await expect(result).rejects.toBeInstanceOf(ReauthenticationCancelledError);
  });
});
