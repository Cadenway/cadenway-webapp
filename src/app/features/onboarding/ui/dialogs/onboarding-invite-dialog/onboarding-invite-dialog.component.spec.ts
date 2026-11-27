import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OnboardingInviteDialog } from './onboarding-invite-dialog.component';

/**
 * Function find
 *
 * @description
 * Finds an element of the document by `data-testid` (the dialog renders in an overlay).
 *
 * @param {string} id - The test id.
 * @returns {HTMLElement | null} The element.
 */
function find(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/**
 * Function open
 *
 * @description
 * Renders the dialog open and records what it submits.
 *
 * @returns {Promise<[ComponentFixture<OnboardingInviteDialog>, Mock]>} The dialog and the record.
 */
async function open(): Promise<[ComponentFixture<OnboardingInviteDialog>, Mock]> {
  TestBed.configureTestingModule({
    imports: [OnboardingInviteDialog],
    providers: [provideCadenwayIcons()],
  });
  const fixture: ComponentFixture<OnboardingInviteDialog> =
    TestBed.createComponent(OnboardingInviteDialog);
  const submitted: Mock = vi.fn();
  fixture.componentInstance.submitted.subscribe((emails: readonly string[]) => {
    submitted(emails);
  });
  fixture.componentRef.setInput('open', true);
  await fixture.whenStable();
  return [fixture, submitted];
}

/**
 * Function add
 *
 * @description
 * Types an address in the field and presses `Add`.
 *
 * @param {ComponentFixture<OnboardingInviteDialog>} fixture - The dialog.
 * @param {string} email - The address.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function add(
  fixture: ComponentFixture<OnboardingInviteDialog>,
  email: string,
): Promise<void> {
  const field: HTMLInputElement = find('onboarding-invite-email') as HTMLInputElement;
  field.value = email;
  field.dispatchEvent(new Event('input'));
  await fixture.whenStable();
  find('onboarding-invite-add')?.click();
  await fixture.whenStable();
  await fixture.whenStable();
}

/**
 * Function typeOnly
 *
 * @description
 * Types an address in the field without pressing `Add`.
 *
 * @param {ComponentFixture<OnboardingInviteDialog>} fixture - The dialog.
 * @param {string} email - The address.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function typeOnly(
  fixture: ComponentFixture<OnboardingInviteDialog>,
  email: string,
): Promise<void> {
  const field: HTMLInputElement = find('onboarding-invite-email') as HTMLInputElement;
  field.value = email;
  field.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

/**
 * Function submitButton
 *
 * @description
 * The `Invite` button.
 *
 * @returns {HTMLButtonElement} The button.
 */
function submitButton(): HTMLButtonElement {
  return find('onboarding-invite-submit') as HTMLButtonElement;
}

describe('OnboardingInviteDialog', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('is titled with the item it comes from and renders the invitation field', async () => {
    await open();

    expect(document.querySelector('[role="dialog"] h2')?.textContent.trim()).toBe(
      'Invite a team member',
    );
    expect(find('onboarding-invite-email')).not.toBeNull();
  });

  it('enables Invite once an address is added, then submits the addresses', async () => {
    const [fixture, submitted]: [ComponentFixture<OnboardingInviteDialog>, Mock] = await open();
    expect(submitButton().disabled).toBe(true);

    await add(fixture, 'ines.robert@ateliernord.fr');
    await add(fixture, 'marc.roux@ateliernord.fr');
    expect(submitButton().disabled).toBe(false);
    submitButton().click();

    expect(submitted).toHaveBeenCalledWith([
      'ines.robert@ateliernord.fr',
      'marc.roux@ateliernord.fr',
    ]);
  });

  it('disables the field while the invitations are sent', async () => {
    const [fixture, submitted]: [ComponentFixture<OnboardingInviteDialog>, Mock] = await open();
    await add(fixture, 'ines.robert@ateliernord.fr');

    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();
    submitButton().click();

    expect((find('onboarding-invite-email') as HTMLInputElement).disabled).toBe(true);
    expect(submitButton().getAttribute('aria-busy')).toBe('true');
    expect(submitted).not.toHaveBeenCalled();
  });

  it('starts with no address each time it opens', async () => {
    const [fixture]: [ComponentFixture<OnboardingInviteDialog>, Mock] = await open();
    await add(fixture, 'ines.robert@ateliernord.fr');

    fixture.componentRef.setInput('open', false);
    await fixture.whenStable();
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();

    expect(find('onboarding-invite-pill')).toBeNull();
    expect(submitButton().disabled).toBe(true);
  });

  it('keeps only the addresses the host kept after a send, and sends only those again', async () => {
    const [fixture, submitted]: [ComponentFixture<OnboardingInviteDialog>, Mock] = await open();
    await add(fixture, 'ines.robert@ateliernord.fr');
    await add(fixture, 'marc.roux@ateliernord.fr');

    fixture.componentRef.setInput('kept', ['marc.roux@ateliernord.fr']);
    await fixture.whenStable();

    expect(
      [...document.querySelectorAll('[data-testid="onboarding-invite-pill"]')].map(
        (pill: Element): string => pill.textContent.trim(),
      ),
    ).toEqual([expect.stringContaining('marc.roux@ateliernord.fr')]);
    submitButton().click();
    expect(submitted).toHaveBeenCalledWith(['marc.roux@ateliernord.fr']);
  });

  it('forgets an address typed but not added once it closes', async () => {
    const [fixture, submitted]: [ComponentFixture<OnboardingInviteDialog>, Mock] = await open();
    await typeOnly(fixture, 'marc.roux@ateliernord.fr');

    fixture.componentRef.setInput('open', false);
    await fixture.whenStable();
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();

    expect((find('onboarding-invite-email') as HTMLInputElement).value).toBe('');
    expect(submitButton().disabled).toBe(true);
    submitButton().click();
    expect(submitted).not.toHaveBeenCalled();
  });

  it('sends the address still typed in the field with the pills', async () => {
    const [fixture, submitted]: [ComponentFixture<OnboardingInviteDialog>, Mock] = await open();
    await add(fixture, 'ines.robert@ateliernord.fr');
    await typeOnly(fixture, 'marc.roux@ateliernord.fr');

    submitButton().click();

    expect(submitted).toHaveBeenCalledWith([
      'ines.robert@ateliernord.fr',
      'marc.roux@ateliernord.fr',
    ]);
  });

  it('enables Invite for a typed address alone and sends it', async () => {
    const [fixture, submitted]: [ComponentFixture<OnboardingInviteDialog>, Mock] = await open();
    await typeOnly(fixture, 'marc.roux@ateliernord.fr');
    expect(submitButton().disabled).toBe(false);

    submitButton().click();

    expect(submitted).toHaveBeenCalledWith(['marc.roux@ateliernord.fr']);
  });

  it('sends nothing and shows the error for an invalid typed address', async () => {
    const [fixture, submitted]: [ComponentFixture<OnboardingInviteDialog>, Mock] = await open();
    await add(fixture, 'ines.robert@ateliernord.fr');
    await typeOnly(fixture, 'marc.roux@');

    submitButton().click();
    await fixture.whenStable();

    expect(submitted).not.toHaveBeenCalled();
    expect(find('onboarding-invite-error')?.textContent.trim()).toBe(
      'Enter a full address, for example ines.robert@ateliernord.fr.',
    );
    expect(document.activeElement).toBe(find('onboarding-invite-email'));
  });
});
