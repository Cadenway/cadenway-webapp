import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationCreateStore } from '../../../state/organization-create/organization-create.store';
import { OrganizationCreatePage } from './organization-create-page.component';

/**
 * Function render
 *
 * @description
 * Renders the creation page with a faked creation and types a name.
 *
 * @param {unknown} result - What the creation resolves to.
 * @param {string} name - The typed name.
 * @returns {Promise<{ host: HTMLElement; fixture: ComponentFixture<OrganizationCreatePage>; navigate: Mock; create: Mock }>}
 * The page and its fakes.
 */
async function render(
  result: unknown,
  name: string,
): Promise<{
  host: HTMLElement;
  fixture: ComponentFixture<OrganizationCreatePage>;
  navigate: Mock;
  create: Mock;
}> {
  const create: Mock = vi.fn(() => Promise.resolve(result));
  TestBed.configureTestingModule({
    imports: [OrganizationCreatePage],
    providers: [provideRouter([]), provideCadenwayIcons()],
  });
  TestBed.overrideComponent(OrganizationCreatePage, {
    set: {
      providers: [
        { provide: OrganizationCreateStore, useValue: { creating: signal(false), create } },
      ],
    },
  });
  const navigate: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<OrganizationCreatePage> =
    TestBed.createComponent(OrganizationCreatePage);
  await fixture.whenStable();
  const host: HTMLElement = fixture.nativeElement as HTMLElement;
  const input: HTMLInputElement | null = host.querySelector('#org-name');
  if (input === null) throw new Error('Expected the name.');
  input.value = name;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
  return { host, fixture, navigate, create };
}

/**
 * Function submit
 *
 * @description
 * Submits the creation form.
 *
 * @param {HTMLElement} host - The page.
 * @param {ComponentFixture<OrganizationCreatePage>} fixture - Its fixture.
 * @returns {Promise<void>} Resolves once settled.
 */
async function submit(
  host: HTMLElement,
  fixture: ComponentFixture<OrganizationCreatePage>,
): Promise<void> {
  host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  await fixture.whenStable();
}

describe('OrganizationCreatePage', () => {
  it('previews the address and opens the new workspace', async () => {
    const { host, fixture, navigate, create }: Awaited<ReturnType<typeof render>> = await render(
      { ok: true, destination: '/studio-nord', logoFailed: false },
      'Studio Nörd',
    );

    expect(host.querySelector<HTMLInputElement>('#org-slug')?.value).toBe('studio-nord');
    await submit(host, fixture);

    expect(create).toHaveBeenCalledWith({
      name: 'Studio Nörd',
      teamSize: '6-20',
      primaryUse: 'product-engineering',
      inviteEmails: [],
      logo: null,
    });
    expect(navigate).toHaveBeenCalledWith('/studio-nord', { replaceUrl: true });
  });

  it('marks the empty logo with the draft initials and sizes a chosen logo', async () => {
    const createObjectURL: Mock = vi.fn(() => 'blob:logo');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const { host, fixture }: Awaited<ReturnType<typeof render>> = await render(
      { ok: true },
      'Studio Nord',
    );

    expect(host.textContent).toContain('SN');
    expect(host.querySelector('label[for="org-invite"]')?.textContent).toContain(
      'Inviter des collègues (facultatif)',
    );
    const input: HTMLInputElement | null = host.querySelector('#org-logo');
    if (input === null) throw new Error('Expected the logo input.');
    for (const [size, caption] of [
      [2048, 'logo.png · 2 Ko'],
      [1_572_864, 'logo.png · 1,5 Mo'],
    ] as const) {
      const file: File = new File([new Uint8Array(size)], 'logo.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      expect(host.querySelector('#org-logo-help')?.textContent.trim()).toBe(caption);
    }
    vi.unstubAllGlobals();
  });

  it('refuses a name without an address before sending', async () => {
    const { host, create }: Awaited<ReturnType<typeof render>> = await render({ ok: true }, '***');

    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('shows a reserved or taken address on the name', async () => {
    for (const [code, message] of [
      ['organization.slug-reserved', 'Cette adresse est réservée : choisissez un autre nom.'],
      ['organization.slug-taken', 'Cette adresse est déjà utilisée : choisissez un autre nom.'],
      [
        'organization.slug-invalid',
        'Ce nom ne donne pas d’adresse valide : utilisez au moins 2 lettres ou chiffres.',
      ],
    ] as const) {
      TestBed.resetTestingModule();
      const { host, fixture, navigate }: Awaited<ReturnType<typeof render>> = await render(
        { ok: false, problem: { status: 422, code, remainingAttempts: null }, created: null },
        'Settings',
      );
      await submit(host, fixture);

      expect(host.querySelector('[role="alert"]')?.textContent).toContain(message);
      expect(navigate).not.toHaveBeenCalled();
    }
  });

  it('opens the chooser when the organization exists but the session could not move', async () => {
    const { host, fixture, navigate }: Awaited<ReturnType<typeof render>> = await render(
      {
        ok: false,
        problem: { status: 404, code: 'organization.not-found', remainingAttempts: null },
        created: { id: 'org-studio' },
      },
      'Studio Nord',
    );
    await submit(host, fixture);

    expect(navigate).toHaveBeenCalledWith('/organizations', { replaceUrl: true });
  });
});
