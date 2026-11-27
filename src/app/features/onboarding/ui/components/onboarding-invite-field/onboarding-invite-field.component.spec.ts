import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, describe, expect, it } from 'vitest';

import { OnboardingInviteField } from './onboarding-invite-field.component';

/**
 * Function find
 *
 * @description
 * Finds an element by `data-testid`.
 *
 * @param {string} id - The test id.
 * @returns {HTMLElement | null} The element.
 */
function find(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/**
 * Function field
 *
 * @description
 * The `Email address` field.
 *
 * @returns {HTMLInputElement} The field.
 */
function field(): HTMLInputElement {
  return find('onboarding-invite-email') as HTMLInputElement;
}

/**
 * Function removeButtons
 *
 * @description
 * The pills' remove buttons, in list order.
 *
 * @returns {HTMLButtonElement[]} The buttons.
 */
function removeButtons(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-testid="onboarding-invite-pill"] button',
    ),
  ];
}

/**
 * Function pills
 *
 * @description
 * The addresses the pills show, in list order.
 *
 * @returns {string[]} The addresses.
 */
function pills(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="onboarding-invite-pill"]')].map(
    (pill: HTMLElement): string => pill.textContent.trim(),
  );
}

/**
 * Function render
 *
 * @description
 * Renders the field with the given addresses.
 *
 * @param {readonly string[]} emails - The addresses already added.
 * @param {boolean} disabled - Whether the field is disabled.
 * @returns {Promise<ComponentFixture<OnboardingInviteField>>} The field.
 */
async function render(
  emails: readonly string[] = [],
  disabled: boolean = false,
): Promise<ComponentFixture<OnboardingInviteField>> {
  TestBed.configureTestingModule({
    imports: [OnboardingInviteField],
    providers: [provideCadenwayIcons()],
  });
  const fixture: ComponentFixture<OnboardingInviteField> =
    TestBed.createComponent(OnboardingInviteField);
  fixture.componentRef.setInput('emails', emails);
  fixture.componentRef.setInput('disabled', disabled);
  await fixture.whenStable();
  return fixture;
}

/**
 * Function type
 *
 * @description
 * Types an address in the field.
 *
 * @param {ComponentFixture<OnboardingInviteField>} fixture - The field.
 * @param {string} value - What is typed.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function type(
  fixture: ComponentFixture<OnboardingInviteField>,
  value: string,
): Promise<void> {
  field().value = value;
  field().dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

/**
 * Function add
 *
 * @description
 * Presses `Add`.
 *
 * @param {ComponentFixture<OnboardingInviteField>} fixture - The field.
 * @returns {Promise<void>} Resolves once rendered.
 */
async function add(fixture: ComponentFixture<OnboardingInviteField>): Promise<void> {
  const button: HTMLButtonElement = find('onboarding-invite-add') as HTMLButtonElement;
  button.focus();
  button.click();
  await fixture.whenStable();
  await fixture.whenStable();
}

describe('OnboardingInviteField', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('labels the field, keeps the example placeholder and asks for an email keyboard', async () => {
    await render();

    const label: HTMLLabelElement | null = document.querySelector<HTMLLabelElement>(
      `label[for="${field().id}"]`,
    );
    expect(label?.textContent.trim()).toBe('Email address');
    expect(field().getAttribute('inputmode')).toBe('email');
    expect(field().placeholder).toBe('ines.robert@ateliernord.fr');
    expect(find('onboarding-invite-add')?.textContent.trim()).toBe('Add');
    expect(find('onboarding-invite-list')).toBeNull();
  });

  it('adds a valid address once, trimmed, then empties the field and focuses it', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render();

    await type(fixture, '  ines.robert@ateliernord.fr ');
    await add(fixture);

    expect(fixture.componentInstance.emails()).toEqual(['ines.robert@ateliernord.fr']);
    expect(pills()).toEqual(['ines.robert@ateliernord.fr']);
    expect(field().value).toBe('');
    expect(document.activeElement).toBe(field());
    expect(find('onboarding-invite-error')).toBeNull();
  });

  it('ignores a duplicate, compared without regard to case, and still empties the field', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render([
      'ines.robert@ateliernord.fr',
    ]);

    await type(fixture, 'Ines.Robert@AtelierNord.fr');
    await add(fixture);

    expect(fixture.componentInstance.emails()).toEqual(['ines.robert@ateliernord.fr']);
    expect(pills()).toEqual(['ines.robert@ateliernord.fr']);
    expect(field().value).toBe('');
  });

  it('shows the error and sets aria-invalid for an incomplete address, until it becomes valid', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render();

    await type(fixture, 'ines.robert@ateliernord');
    expect(find('onboarding-invite-error')).toBeNull();
    expect(field().getAttribute('aria-invalid')).toBeNull();

    await add(fixture);

    const error: HTMLElement | null = find('onboarding-invite-error');
    expect(error?.textContent.trim()).toBe(
      'Enter a full address, for example ines.robert@ateliernord.fr.',
    );
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(field().getAttribute('aria-describedby')).toBe(error?.id);
    expect(document.activeElement).toBe(field());
    expect(fixture.componentInstance.emails()).toEqual([]);
    expect(field().value).toBe('ines.robert@ateliernord');

    await type(fixture, 'ines.robert@ateliernord.fr');

    expect(find('onboarding-invite-error')).toBeNull();
    expect(field().getAttribute('aria-invalid')).toBeNull();
  });

  it('shows the error with aria-invalid together once an incomplete address is blurred', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render();

    await type(fixture, 'ines.robert@ateliernord');
    field().dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const error: HTMLElement | null = find('onboarding-invite-error');
    expect(error?.textContent.trim()).toBe(
      'Enter a full address, for example ines.robert@ateliernord.fr.',
    );
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(field().getAttribute('aria-describedby')).toBe(error?.id);
  });

  it('shows neither the error nor aria-invalid when an empty field is blurred', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render();

    field().dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(find('onboarding-invite-error')).toBeNull();
    expect(field().getAttribute('aria-invalid')).toBeNull();
    expect(field().getAttribute('aria-describedby')).toBeNull();
  });

  it('adds nothing and shows no error when the field is empty', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render();

    await add(fixture);

    expect(fixture.componentInstance.emails()).toEqual([]);
    expect(find('onboarding-invite-error')).toBeNull();
    expect(field().getAttribute('aria-invalid')).toBeNull();
    expect(document.activeElement).toBe(field());
  });

  it('shows the error for blank text and adds nothing', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render();

    await type(fixture, '   ');
    await add(fixture);

    expect(fixture.componentInstance.emails()).toEqual([]);
    expect(find('onboarding-invite-error')?.textContent.trim()).toBe(
      'Enter a full address, for example ines.robert@ateliernord.fr.',
    );
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field());
  });

  it('removes an address and moves the focus to the next pill, then to the field', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render([
      'ines.robert@ateliernord.fr',
      'marc.roux@ateliernord.fr',
    ]);

    expect(removeButtons().map((button: HTMLButtonElement) => button.ariaLabel)).toEqual([
      'Remove ines.robert@ateliernord.fr',
      'Remove marc.roux@ateliernord.fr',
    ]);

    removeButtons()[0]?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.emails()).toEqual(['marc.roux@ateliernord.fr']);
    expect(pills()).toEqual(['marc.roux@ateliernord.fr']);
    expect(document.activeElement).toBe(removeButtons()[0]);

    removeButtons()[0]?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.emails()).toEqual([]);
    expect(find('onboarding-invite-list')).toBeNull();
    expect(document.activeElement).toBe(field());
  });

  it('moves the focus to the previous pill after removing the last one', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render([
      'ines.robert@ateliernord.fr',
      'marc.roux@ateliernord.fr',
    ]);

    removeButtons()[1]?.click();
    await fixture.whenStable();

    expect(pills()).toEqual(['ines.robert@ateliernord.fr']);
    expect(document.activeElement).toBe(removeButtons()[0]);
  });

  it('disables the field and every button, and adds nothing, when disabled', async () => {
    const fixture: ComponentFixture<OnboardingInviteField> = await render(
      ['ines.robert@ateliernord.fr'],
      true,
    );

    expect(field().disabled).toBe(true);
    expect((find('onboarding-invite-add') as HTMLButtonElement).disabled).toBe(true);
    expect(removeButtons().every((button: HTMLButtonElement) => button.disabled)).toBe(true);

    field().value = 'marc.roux@ateliernord.fr';
    field().dispatchEvent(new Event('input'));
    field().form?.requestSubmit();
    await fixture.whenStable();

    expect(fixture.componentInstance.emails()).toEqual(['ines.robert@ateliernord.fr']);
  });

  describe('commitPending', () => {
    it('accepts an empty field and adds nothing', async () => {
      const fixture: ComponentFixture<OnboardingInviteField> = await render([
        'marc.roux@ateliernord.fr',
      ]);

      expect(fixture.componentInstance.hasText()).toBe(false);
      expect(fixture.componentInstance.commitPending()).toBe(true);
      expect(fixture.componentInstance.emails()).toEqual(['marc.roux@ateliernord.fr']);
    });

    it('adds a valid typed address and empties the field', async () => {
      const fixture: ComponentFixture<OnboardingInviteField> = await render([
        'marc.roux@ateliernord.fr',
      ]);
      await type(fixture, ' ines.robert@ateliernord.fr ');
      expect(fixture.componentInstance.hasText()).toBe(true);

      expect(fixture.componentInstance.commitPending()).toBe(true);
      await fixture.whenStable();

      expect(fixture.componentInstance.emails()).toEqual([
        'marc.roux@ateliernord.fr',
        'ines.robert@ateliernord.fr',
      ]);
      expect(field().value).toBe('');
      expect(find('onboarding-invite-error')).toBeNull();
    });

    it('refuses an invalid typed address, shows the error and focuses the field', async () => {
      const fixture: ComponentFixture<OnboardingInviteField> = await render();
      await type(fixture, 'ines.robert@');

      expect(fixture.componentInstance.commitPending()).toBe(false);
      await fixture.whenStable();

      expect(fixture.componentInstance.emails()).toEqual([]);
      expect(find('onboarding-invite-error')?.textContent.trim()).toBe(
        'Enter a full address, for example ines.robert@ateliernord.fr.',
      );
      expect(field().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(field());
    });
  });
});
