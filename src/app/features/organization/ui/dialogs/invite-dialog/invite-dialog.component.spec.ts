import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { InviteDialog, type InviteRequest, parseAddresses } from './invite-dialog.component';

/**
 * Function find
 *
 * @description
 * Finds an element by `data-testid` in the overlays.
 *
 * @param {string} id - The test id.
 * @returns {HTMLElement | null} The element.
 */
function find(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/**
 * Function text
 *
 * @description
 * The trimmed, single-spaced text of an element.
 *
 * @param {HTMLElement | null} element - The element.
 * @returns {string} Its text.
 */
function text(element: HTMLElement | null): string {
  return (element?.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

/**
 * Function addresses
 *
 * @description
 * A list of distinct addresses of Atelier Nord.
 *
 * @param {number} count - How many.
 * @returns {string} The addresses, comma-separated.
 */
function addresses(count: number): string {
  return Array.from(
    { length: count },
    (_value: unknown, index: number) => `p${String(index)}@ateliernord.fr`,
  ).join(', ');
}

/**
 * Function open
 *
 * @description
 * Opens the dialog with the seats of the Team plan.
 *
 * @param {number | null} seatsFree - Free seats; null when unknown.
 * @returns {Promise<[ComponentFixture<InviteDialog>, Mock]>} The dialog and its submit listener.
 */
async function open(seatsFree: number | null): Promise<[ComponentFixture<InviteDialog>, Mock]> {
  TestBed.configureTestingModule({ imports: [InviteDialog], providers: [provideCadenwayIcons()] });
  const fixture: ComponentFixture<InviteDialog> = TestBed.createComponent(InviteDialog);
  const submitted: Mock = vi.fn();
  fixture.componentInstance.submitted.subscribe((request: InviteRequest) => {
    submitted(request);
  });
  fixture.componentRef.setInput('seatsFree', seatsFree);
  fixture.componentRef.setInput('planName', 'Team');
  fixture.componentRef.setInput('open', true);
  await fixture.whenStable();
  return [fixture, submitted];
}

/**
 * Function type
 *
 * @description
 * Types addresses in the field.
 *
 * @param {ComponentFixture<InviteDialog>} fixture - The dialog.
 * @param {string} value - What is typed.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function type(fixture: ComponentFixture<InviteDialog>, value: string): Promise<void> {
  const field: HTMLTextAreaElement = find('invite-emails') as HTMLTextAreaElement;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

/**
 * Function submit
 *
 * @description
 * Presses `Invite`.
 *
 * @param {ComponentFixture<InviteDialog>} fixture - The dialog.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function submit(fixture: ComponentFixture<InviteDialog>): Promise<void> {
  find('invite-submit')?.click();
  await fixture.whenStable();
  await fixture.whenStable();
}

/**
 * Function pickGuest
 *
 * @description
 * Picks `Guest` in the `Role` select.
 *
 * @param {ComponentFixture<InviteDialog>} fixture - The dialog.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function pickGuest(fixture: ComponentFixture<InviteDialog>): Promise<void> {
  find('invite-role')?.querySelector<HTMLElement>('[role="combobox"], button')?.click();
  await fixture.whenStable();
  const option: HTMLElement | undefined = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item: HTMLElement) => item.textContent.includes('Guest'));
  option?.click();
  await fixture.whenStable();
}

describe('parseAddresses', () => {
  it('splits on spaces, commas, semicolons and line breaks and keeps each address once', () => {
    expect(
      parseAddresses(
        'marc.roux@ateliernord.fr, lucie@example.com;\nMARC.ROUX@ateliernord.fr  zoe@a.io',
      ),
    ).toEqual({
      valid: ['marc.roux@ateliernord.fr', 'lucie@example.com', 'zoe@a.io'],
      invalid: [],
    });
  });

  it('refuses what the contract refuses', () => {
    const long: string = `${'a'.repeat(250)}@x.fr`;

    expect(parseAddresses(`lucie@ .lea@a.fr a..b@a.fr marc@a.f marc@a ${long}`).valid).toEqual([]);
    expect(
      parseAddresses(`lucie@ .lea@a.fr a..b@a.fr marc@a.f marc@a ${long}`).invalid,
    ).toHaveLength(6);
  });
});

describe('InviteDialog', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('counts the seats left and refuses more members than free seats', async () => {
    const [fixture, submitted]: [ComponentFixture<InviteDialog>, Mock] = await open(3);

    expect(text(find('invite-seats'))).toBe('3 seats available on the Team plan.');
    await type(fixture, addresses(2));
    expect(text(find('invite-hint'))).toBe('2 valid addresses · 1 seat left afterwards');
    await type(fixture, addresses(4));
    expect(text(find('invite-hint'))).toBe(
      '4 valid addresses · only 3 free seats: add some from Billing',
    );
    await submit(fixture);

    expect(text(find('invite-error'))).toBe('Not enough free seats: add some from Billing.');
    expect(submitted).not.toHaveBeenCalled();
  });

  it('lets guests through without a seat', async () => {
    const [fixture, submitted]: [ComponentFixture<InviteDialog>, Mock] = await open(1);

    await pickGuest(fixture);
    await type(fixture, addresses(3));
    expect(text(find('invite-hint'))).toBe('3 valid addresses · guests do not take a seat');
    await submit(fixture);

    expect(submitted).toHaveBeenCalledWith({
      emails: ['p0@ateliernord.fr', 'p1@ateliernord.fr', 'p2@ateliernord.fr'],
      role: 'guest',
    });
  });

  it('refuses more than 50 addresses at a time', async () => {
    const [fixture, submitted]: [ComponentFixture<InviteDialog>, Mock] = await open(null);

    await type(fixture, addresses(51));
    await submit(fixture);

    expect(text(find('invite-error'))).toBe('Invite at most 50 addresses at a time.');
    expect(submitted).not.toHaveBeenCalled();
  });

  it('names the invalid addresses and those the API refused', async () => {
    const [fixture, submitted]: [ComponentFixture<InviteDialog>, Mock] = await open(null);

    await type(fixture, 'marc.roux@ateliernord.fr, lucie@');
    await submit(fixture);
    expect(text(find('invite-error'))).toBe('Check these addresses: lucie@.');
    await type(fixture, 'marc.roux@ateliernord.fr lucie@example.com');
    fixture.componentRef.setInput('refused', ['marc.roux@ateliernord.fr']);
    await fixture.whenStable();

    expect(text(find('invite-error'))).toBe('Check these addresses: marc.roux@ateliernord.fr.');
    expect(submitted).not.toHaveBeenCalled();
  });

  it('forgets the refused addresses once they change and when it opens again', async () => {
    const [fixture, submitted]: [ComponentFixture<InviteDialog>, Mock] = await open(null);
    await type(fixture, 'marc.roux@ateliernord.fr');
    await submit(fixture);
    fixture.componentRef.setInput('refused', ['marc.roux@ateliernord.fr']);
    await fixture.whenStable();
    expect(find('invite-error')).not.toBeNull();

    await type(fixture, 'marc.roux@ateliernord.fr ');
    expect(find('invite-error')).toBeNull();
    fixture.componentRef.setInput('open', false);
    await fixture.whenStable();
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    await type(fixture, 'marc.roux@ateliernord.fr');
    await submit(fixture);

    expect(find('invite-error')).toBeNull();
    expect(submitted).toHaveBeenCalledTimes(2);
  });

  it('starts empty, as a member, each time it opens again', async () => {
    const [fixture, submitted]: [ComponentFixture<InviteDialog>, Mock] = await open(null);
    await pickGuest(fixture);
    await type(fixture, addresses(2));

    fixture.componentRef.setInput('open', false);
    await fixture.whenStable();
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();

    expect((find('invite-emails') as HTMLTextAreaElement).value).toBe('');
    await type(fixture, addresses(1));
    await submit(fixture);
    expect(submitted).toHaveBeenCalledWith({ emails: ['p0@ateliernord.fr'], role: 'member' });
  });

  it('replaces the addresses with those kept to send again, keeping the role', async () => {
    const [fixture, submitted]: [ComponentFixture<InviteDialog>, Mock] = await open(null);
    await pickGuest(fixture);
    await type(fixture, addresses(3));
    await submit(fixture);

    fixture.componentRef.setInput('kept', ['p1@ateliernord.fr', 'p2@ateliernord.fr']);
    await fixture.whenStable();
    expect((find('invite-emails') as HTMLTextAreaElement).value).toBe(
      'p1@ateliernord.fr, p2@ateliernord.fr',
    );
    await submit(fixture);

    expect(submitted).toHaveBeenLastCalledWith({
      emails: ['p1@ateliernord.fr', 'p2@ateliernord.fr'],
      role: 'guest',
    });
  });
});
