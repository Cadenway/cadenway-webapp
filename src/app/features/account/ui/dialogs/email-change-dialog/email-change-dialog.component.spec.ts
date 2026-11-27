import { Component, signal, viewChild, type Signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ProfileStore } from '../../../state/profile/profile.store';
import { EmailChangeDialog } from './email-change-dialog.component';

/**
 * Component Host
 *
 * @description
 * Renders the dialog for Camille Martin's address.
 */
@Component({
  selector: 'cw-host',
  imports: [EmailChangeDialog],
  template: `<cw-email-change-dialog
    currentEmail="camille.martin@ateliernord.fr"
    (changed)="changed($event)"
  />`,
})
class Host {
  // #region Properties
  /**
   * Property dialog
   *
   * @description
   * The dialog under test.
   *
   * @type {Signal<EmailChangeDialog>}
   * @readonly
   */
  public readonly dialog: Signal<EmailChangeDialog> = viewChild.required(EmailChangeDialog);

  /**
   * Property changed
   *
   * @description
   * Records the new addresses the dialog emits.
   *
   * @type {Mock}
   * @readonly
   */
  public readonly changed: Mock = vi.fn();
  // #endregion
}

/**
 * Function byTestId
 *
 * @description
 * An element of the document by its test id.
 *
 * @param {ComponentFixture<Host>} fixture - The fixture.
 * @param {string} id - Test id.
 * @returns {HTMLElement | null} The element, when rendered.
 */
function byTestId(fixture: ComponentFixture<Host>, id: string): HTMLElement | null {
  fixture.detectChanges();
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/**
 * Function typeAddress
 *
 * @description
 * Types the new address.
 *
 * @param {ComponentFixture<Host>} fixture - The fixture.
 * @param {string} value - The address.
 */
function typeAddress(fixture: ComponentFixture<Host>, value: string): void {
  const field: HTMLInputElement = byTestId(fixture, 'email-change-address') as HTMLInputElement;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

/**
 * Function typeCode
 *
 * @description
 * Types the one-time code.
 *
 * @param {ComponentFixture<Host>} fixture - The fixture.
 * @param {string} value - The digits.
 */
function typeCode(fixture: ComponentFixture<Host>, value: string): void {
  const field: HTMLInputElement = document.getElementById('email-change-code') as HTMLInputElement;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

/**
 * Function submit
 *
 * @description
 * Clicks the dialog's main button.
 *
 * @param {ComponentFixture<Host>} fixture - The fixture.
 */
function submit(fixture: ComponentFixture<Host>): void {
  byTestId(fixture, 'email-change-submit')?.click();
  fixture.detectChanges();
}

describe('EmailChangeDialog', () => {
  let store: { emailPending: Signal<boolean>; requestEmailChange: Mock; confirmEmailChange: Mock };
  let toasts: { success: Mock; error: Mock };
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    store = {
      emailPending: signal(false),
      requestEmailChange: vi.fn(() =>
        Promise.resolve({
          outcome: 'sent',
          code: { email: 'camille@ateliernord.fr', resendAvailableAt: Date.now() + 30_000 },
        }),
      ),
      confirmEmailChange: vi.fn(() => Promise.resolve('confirmed')),
    };
    toasts = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        { provide: ProfileStore, useValue: store },
        { provide: CwToastService, useValue: toasts },
      ],
    });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    fixture.componentInstance.dialog().show();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens on its first step', () => {
    const dialog: HTMLElement | null = byTestId(fixture, 'email-change-dialog');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'Change the email address',
    );
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Step 1 of 2');
    expect(dialog).not.toBeNull();
  });

  it('refuses a malformed address and the current one before sending anything', async () => {
    typeAddress(fixture, 'camille@');
    submit(fixture);
    await expect
      .poll(() => byTestId(fixture, 'email-change-address-error')?.textContent)
      .toContain('Invalid address: check the format');

    typeAddress(fixture, ' Camille.Martin@AtelierNord.fr ');
    submit(fixture);
    await expect
      .poll(() => byTestId(fixture, 'email-change-address-error')?.textContent)
      .toContain('This is already your current address');
    expect(store.requestEmailChange).not.toHaveBeenCalled();
  });

  it('asks for a code, then shows the code step with the countdown', async () => {
    typeAddress(fixture, 'Camille@AtelierNord.fr');
    submit(fixture);

    await expect
      .poll(() => byTestId(fixture, 'email-change-sent-to')?.textContent)
      .toContain('Code sent to camille@ateliernord.fr');
    expect(store.requestEmailChange).toHaveBeenCalledWith('camille@ateliernord.fr');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Step 2 of 2');
    expect(byTestId(fixture, 'email-change-resend')?.textContent).toMatch(
      /Resend the code in 0:[0-3]\d/u,
    );
    expect(byTestId(fixture, 'email-change-resend')).toHaveProperty('disabled', true);
  });

  it('shows an address another account uses on the field', async () => {
    store.requestEmailChange.mockResolvedValueOnce({
      outcome: 'refused',
      reason: 'taken',
      resendAvailableAt: null,
    });
    typeAddress(fixture, 'lucas@ateliernord.fr');
    submit(fixture);

    await expect
      .poll(() => byTestId(fixture, 'email-change-address-error')?.textContent)
      .toContain('An account already uses this address.');
  });

  it('shows a wrong code on the field, then confirms a right one', async () => {
    typeAddress(fixture, 'camille@ateliernord.fr');
    submit(fixture);
    await expect.poll(() => byTestId(fixture, 'email-change-sent-to')).not.toBeNull();

    submit(fixture);
    await expect
      .poll(() => byTestId(fixture, 'email-change-code-error')?.textContent)
      .toContain('Enter the 6 digits of the code.');
    expect(store.confirmEmailChange).not.toHaveBeenCalled();

    store.confirmEmailChange.mockResolvedValueOnce('wrong-code');
    typeCode(fixture, '731406');
    submit(fixture);
    await expect
      .poll(() => byTestId(fixture, 'email-change-code-error')?.textContent)
      .toContain('Wrong or expired code');

    typeCode(fixture, '731407');
    submit(fixture);
    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(store.confirmEmailChange).toHaveBeenLastCalledWith('731407', 'camille@ateliernord.fr');
    expect(toasts.success).toHaveBeenCalledWith('Email address changed', {
      description: 'camille@ateliernord.fr is verified and now receives your emails.',
    });
    expect(fixture.componentInstance.changed).toHaveBeenCalledWith('camille@ateliernord.fr');
  });

  it('goes back to the first step, keeping the address', async () => {
    typeAddress(fixture, 'camille@ateliernord.fr');
    submit(fixture);
    await expect.poll(() => byTestId(fixture, 'email-change-back')).not.toBeNull();

    byTestId(fixture, 'email-change-back')?.click();
    fixture.detectChanges();

    expect((byTestId(fixture, 'email-change-address') as HTMLInputElement).value).toBe(
      'camille@ateliernord.fr',
    );
  });
});
