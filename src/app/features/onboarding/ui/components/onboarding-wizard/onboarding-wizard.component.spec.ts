import { LiveAnnouncer } from '@angular/cdk/a11y';
import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import { NAVIGATION_REFRESH } from '@features/spaces/ports/navigation-refresh';
import type { LookColor } from '@features/spaces/utils/space-look';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { OnboardingApi } from '../../../data-access/services/onboarding-api/onboarding-api.service';
import type { OnboardingProgress } from '../../../models/onboarding/onboarding.interface';
import { OnboardingStore } from '../../../state/onboarding/onboarding.store';
import { OnboardingWizardStore } from '../../../state/onboarding-wizard/onboarding-wizard.store';
import { OnboardingWizard } from './onboarding-wizard.component';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization of the mockup.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o-atelier',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

/**
 * Constant RANKS
 *
 * @description
 * Rank of each role, for the faked `can()`.
 *
 * @type {Readonly<Record<WorkspaceRole, number>>}
 */
const RANKS: Readonly<Record<WorkspaceRole, number>> = { guest: 0, member: 1, admin: 2, owner: 3 };

/**
 * Function progress
 *
 * @description
 * An in-progress onboarding at a version.
 *
 * @param {number} version - The version.
 * @param {Partial<OnboardingProgress['wizard']>} [wizard] - Draft members to change.
 * @returns {OnboardingProgress} The progress.
 */
function progress(
  version: number,
  wizard: Partial<OnboardingProgress['wizard']> = {},
): OnboardingProgress {
  return {
    version,
    wizard: {
      status: 'in-progress',
      step: 'space',
      preset: 'dev',
      name: null,
      prefix: null,
      color: 'violet',
      ...wizard,
    },
    provisioning: null,
    checklist: {
      presentation: 'expanded',
      firstTaskCreated: false,
      invitationSent: false,
      boardTried: false,
    },
  };
}

/**
 * Interface Harness
 *
 * @description
 * The rendered assistant and its fakes.
 */
interface Harness {
  // #region Properties
  /**
   * Property fixture
   *
   * @description
   * The rendered assistant.
   *
   * @type {ComponentFixture<OnboardingWizard>}
   * @readonly
   */
  readonly fixture: ComponentFixture<OnboardingWizard>;

  /**
   * Property progress
   *
   * @description
   * The shared store's progress.
   *
   * @type {WritableSignal<OnboardingProgress | null>}
   * @readonly
   */
  readonly progress: WritableSignal<OnboardingProgress | null>;

  /**
   * Property failed
   *
   * @description
   * The shared store's failed first read.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly failed: WritableSignal<boolean>;

  /**
   * Property saveDraft
   *
   * @description
   * The shared store's draft save.
   *
   * @type {Mock}
   * @readonly
   */
  readonly saveDraft: Mock;

  /**
   * Property finish
   *
   * @description
   * The shared store's finish.
   *
   * @type {Mock}
   * @readonly
   */
  readonly finish: Mock;

  /**
   * Property reload
   *
   * @description
   * The shared store's reread.
   *
   * @type {Mock}
   * @readonly
   */
  readonly reload: Mock;

  /**
   * Property recordInvitation
   *
   * @description
   * The shared store's invitation marker.
   *
   * @type {Mock}
   * @readonly
   */
  readonly recordInvitation: Mock;

  /**
   * Property retryOwedInvitation
   *
   * @description
   * The shared store's owed marker retry.
   *
   * @type {Mock}
   * @readonly
   */
  readonly retryOwedInvitation: Mock;

  /**
   * Property invite
   *
   * @description
   * The API's invitation batch.
   *
   * @type {Mock}
   * @readonly
   */
  readonly invite: Mock;
  // #endregion
}

/**
 * Function render
 *
 * @description
 * Renders the assistant with the real assistant store over faked collaborators.
 *
 * @param {OnboardingProgress | null} initial - The progress shown.
 * @param {WorkspaceRole} [role] - The person's role.
 * @returns {Promise<Harness>} The harness.
 */
async function render(
  initial: OnboardingProgress | null,
  role: WorkspaceRole = 'owner',
): Promise<Harness> {
  const progressSignal: WritableSignal<OnboardingProgress | null> = signal(initial);
  const failed: WritableSignal<boolean> = signal(false);
  const saveDraft: Mock = vi.fn(() => Promise.resolve(progress(2)));
  const finish: Mock = vi.fn(() =>
    Promise.resolve({
      ...progress(3, { status: 'finished' }),
      provisioning: { spaceId: 'sp-product', firstListId: 'l-backlog' },
    }),
  );
  const reload: Mock = vi.fn(() => Promise.resolve());
  const recordInvitation: Mock = vi.fn(() => Promise.resolve());
  const retryOwedInvitation: Mock = vi.fn(() => Promise.resolve());
  const invite: Mock = vi.fn((emails: readonly string[]) =>
    Promise.resolve({ invited: emails.length, skipped: 0, alreadyInvited: 0 }),
  );
  TestBed.configureTestingModule({
    imports: [OnboardingWizard],
    providers: [
      provideCadenwayIcons(),
      OnboardingWizardStore,
      {
        provide: OnboardingStore,
        useValue: {
          progress: progressSignal,
          loading: signal(initial === null),
          failed,
          reload,
          saveDraft,
          dismiss: vi.fn(() => Promise.resolve(progress(2, { status: 'dismissed' }))),
          finish,
          recordInvitation,
          retryOwedInvitation,
        },
      },
      { provide: OnboardingApi, useValue: { invite } },
      { provide: OrganizationPin, useValue: { current: signal('o-atelier') } },
      {
        provide: WORKSPACE_CONTEXT,
        useValue: {
          organization: signal(ATELIER_NORD),
          role: signal(role),
          can: (needed: WorkspaceRole): boolean => RANKS[role] >= RANKS[needed],
        },
      },
      { provide: NAVIGATION_REFRESH, useValue: { refresh: vi.fn(), refreshCounts: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      { provide: CwToastService, useValue: { show: vi.fn(), error: vi.fn() } },
    ],
  });
  const fixture: ComponentFixture<OnboardingWizard> = TestBed.createComponent(OnboardingWizard);
  await fixture.whenStable();
  await fixture.whenStable();
  return {
    fixture,
    progress: progressSignal,
    failed,
    saveDraft,
    finish,
    reload,
    recordInvitation,
    retryOwedInvitation,
    invite,
  };
}

/**
 * Function find
 *
 * @description
 * Finds an element of the window by test id.
 *
 * @param {string} id - Test id.
 * @returns {HTMLElement | null} The element.
 */
function find(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/**
 * Function all
 *
 * @description
 * Finds the elements of the window matching a selector.
 *
 * @param {string} selector - CSS selector.
 * @returns {HTMLElement[]} The elements.
 */
function all(selector: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(selector)];
}

/**
 * Function labelOf
 *
 * @description
 * The text of the label naming a control.
 *
 * @param {HTMLElement} control - The control.
 * @returns {string} The label's text.
 */
function labelOf(control: HTMLElement): string {
  return document.querySelector(`label[for="${control.id}"]`)?.textContent.trim() ?? '';
}

/**
 * Function title
 *
 * @description
 * The card's title.
 *
 * @returns {HTMLHeadingElement | null} The title.
 */
function title(): HTMLHeadingElement | null {
  return document.querySelector<HTMLHeadingElement>('[data-testid="onboarding-card"] h1');
}

/**
 * Function click
 *
 * @description
 * Clicks an element and waits for the view to settle.
 *
 * @param {ComponentFixture<OnboardingWizard>} fixture - The fixture.
 * @param {HTMLElement | null} element - The element.
 * @returns {Promise<void>} Resolves once settled.
 */
async function click(
  fixture: ComponentFixture<OnboardingWizard>,
  element: HTMLElement | null,
): Promise<void> {
  element?.click();
  await fixture.whenStable();
  await fixture.whenStable();
}

describe('OnboardingWizard', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('is a modal window named by its title, focused on open, with the step bar', async () => {
    await render(progress(1));

    const dialog: HTMLElement | null = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    const heading: HTMLHeadingElement | null = title();
    expect(heading?.textContent.trim()).toBe('Welcome to Atelier Nord');
    expect(dialog?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(document.activeElement).toBe(heading);
    expect(find('onboarding-position')?.textContent.trim()).toBe('Step 1 of 4');

    const steps: HTMLElement | null = document.querySelector('ol[aria-label="Steps"]');
    expect(steps).not.toBeNull();
    const items: HTMLElement[] = all('ol[aria-label="Steps"] li');
    expect(items.map((item: HTMLElement) => item.textContent.trim())).toEqual([
      'Space — step 1, current',
      'Template — step 2, to come',
      'Team — step 3, to come',
      'Import — step 4, to come',
    ]);
    expect(items[0]?.getAttribute('aria-current')).toBe('step');
    expect(document.querySelectorAll('ol[aria-label="Steps"] button')).toHaveLength(0);
    expect(find('onboarding-skip')?.textContent.trim()).toBe('Set up later');
    expect(find('onboarding-back')).toBeNull();
  });

  it('names the space field and the twelve color swatches, the draft color checked', async () => {
    await render(progress(1));

    const name: HTMLInputElement = find('onboarding-space-name') as HTMLInputElement;
    expect(labelOf(name)).toBe('Space name');
    expect(name.value).toBe('Product');
    expect(name.placeholder).toBe('Product');
    expect(name.getAttribute('aria-invalid')).toBeNull();

    const swatches: HTMLElement[] = all('[data-testid="onboarding-space-colors"] button');
    expect(find('onboarding-space-colors')?.getAttribute('aria-label')).toBe('Color');
    expect(swatches.map((swatch: HTMLElement) => swatch.getAttribute('aria-label'))).toEqual([
      'Amethyst',
      'Indigo',
      'Azure',
      'Lagoon',
      'Jade',
      'Olive',
      'Beacon',
      'Carnelian',
      'Garnet',
      'Pink',
      'Fuchsia',
      'Slate',
    ]);
    expect(find('onboarding-space-colors')?.getAttribute('role')).toBe('radiogroup');
    expect(swatches.map((swatch: HTMLElement) => swatch.getAttribute('role'))).toEqual(
      Array.from({ length: 12 }, () => 'radio'),
    );
    expect(swatches[0]?.getAttribute('aria-checked')).toBe('true');
  });

  it('shows a gray draft color as the first swatch', async () => {
    await render(progress(1, { color: 'gris' as LookColor }));

    expect(
      all('[data-testid="onboarding-space-colors"] [aria-checked="true"]').map(
        (swatch: HTMLElement) => swatch.getAttribute('aria-label'),
      ),
    ).toEqual(['Amethyst']);
  });

  it('resumes a saved draft with its color and template checked', async () => {
    const { fixture }: Harness = await render(
      progress(3, { name: 'Design', color: 'azur', preset: 'agency' }),
    );

    expect((find('onboarding-space-name') as HTMLInputElement).value).toBe('Design');
    expect(
      all('[data-testid="onboarding-space-colors"] [aria-checked="true"]').map(
        (swatch: HTMLElement) => swatch.getAttribute('aria-label'),
      ),
    ).toEqual(['Azure']);

    await click(fixture, find('onboarding-next'));

    expect(
      all('[data-testid="onboarding-presets"] [role="radio"][aria-checked="true"]').map(labelOf),
    ).toEqual([expect.stringContaining('Agency and clients')]);
  });

  it('marks a blank name invalid and cannot continue', async () => {
    const { fixture, saveDraft }: Harness = await render(progress(1));
    const name: HTMLInputElement = find('onboarding-space-name') as HTMLInputElement;

    name.value = '  ';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(name.getAttribute('aria-invalid')).toBe('true');
    const next: HTMLButtonElement = find('onboarding-next') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    await click(fixture, next);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('continues to the template screen, saves the draft and focuses the new title', async () => {
    const { fixture, saveDraft }: Harness = await render(progress(1));

    await click(fixture, all('[data-testid="onboarding-space-colors"] button')[2] ?? null);
    await click(fixture, find('onboarding-next'));

    expect(saveDraft).toHaveBeenCalledWith({
      step: 'preset',
      name: 'Product',
      prefix: 'PRO',
      color: 'azur',
      preset: 'dev',
    });
    expect(title()?.textContent.trim()).toBe('Choose a starting point');
    expect(document.activeElement).toBe(title());
    expect(find('onboarding-position')?.textContent.trim()).toBe('Step 2 of 4');
    expect(
      all('ol[aria-label="Steps"] li').map((item: HTMLElement) =>
        item.getAttribute('aria-current'),
      ),
    ).toEqual([null, 'step', null, null]);

    const group: HTMLElement | null = find('onboarding-presets');
    expect(group?.getAttribute('role')).toBe('radiogroup');
    expect(group?.getAttribute('aria-label')).toBe('Space template');
    const radios: HTMLElement[] = all('[data-testid="onboarding-presets"] [role="radio"]');
    expect(radios.map(labelOf)).toEqual([
      'Software developmentBacklog, sprint and bugs, with code review.Backlog · Sprint 1 · Bugs',
      'MarketingEditorial calendar and campaigns.Editorial calendar · Campaigns',
      'Agency and clientsOne project per client, centralized requests.Client projects · Requests',
      'Start from scratchA single empty list, over to you.First list',
    ]);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');

    await click(fixture, radios[1] ?? null);
    await click(fixture, find('onboarding-back'));

    expect(saveDraft).toHaveBeenLastCalledWith({
      step: 'space',
      name: 'Product',
      prefix: 'PRO',
      color: 'azur',
      preset: 'mkt',
    });
    expect(title()?.textContent.trim()).toBe('Welcome to Atelier Nord');
  });

  it('invites the team when leaving the team screen, then creates the space', async () => {
    const { fixture, finish, invite, recordInvitation, retryOwedInvitation }: Harness =
      await render(progress(2, { step: 'team' }));

    expect(title()?.textContent.trim()).toBe('Invite your team');
    expect(find('onboarding-next')?.textContent.trim()).toBe('Skip');

    const field: HTMLInputElement = find('onboarding-invite-email') as HTMLInputElement;
    expect(labelOf(field)).toBe('Email address');
    field.value = 'ines.robert@ateliernord.fr';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    await click(fixture, find('onboarding-invite-add'));

    expect(find('onboarding-next')?.textContent.trim()).toBe('Continue');
    await click(fixture, find('onboarding-next'));

    expect(title()?.textContent.trim()).toBe('Import your existing projects');
    const sources: HTMLElement | null = find('onboarding-imports');
    expect(sources?.getAttribute('role')).toBe('radiogroup');
    expect(sources?.getAttribute('aria-label')).toBe('Source tool');
    const radios: HTMLButtonElement[] = all(
      '[data-testid="onboarding-imports"] [role="radio"]',
    ) as HTMLButtonElement[];
    expect(radios.map(labelOf)).toEqual(['Trello', 'Jira', 'CSV file', 'Later']);
    expect(radios.map((radio: HTMLButtonElement) => radio.disabled)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(radios[3]?.getAttribute('aria-checked')).toBe('true');
    expect(find('onboarding-next')?.textContent.trim()).toBe('Create the space');

    await click(fixture, find('onboarding-next'));

    await vi.waitFor(() => {
      expect(retryOwedInvitation).toHaveBeenCalledTimes(1);
    });
    expect(recordInvitation).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(invite).toHaveBeenCalledWith(['ines.robert@ateliernord.fr'], expect.any(String));
  });

  it('keeps an address typed without Add when continuing from the team screen', async () => {
    const { fixture, invite }: Harness = await render(progress(2, { step: 'team' }));
    const field: HTMLInputElement = find('onboarding-invite-email') as HTMLInputElement;

    field.value = 'ines.robert@ateliernord.fr';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(find('onboarding-next')?.textContent.trim()).toBe('Continue');
    await click(fixture, find('onboarding-next'));

    expect(title()?.textContent.trim()).toBe('Import your existing projects');
    await click(fixture, find('onboarding-next'));
    await vi.waitFor(() => {
      expect(invite).toHaveBeenCalledWith(['ines.robert@ateliernord.fr'], expect.any(String));
    });
  });

  it('stays on the team screen and shows the error for an invalid typed address', async () => {
    const { fixture, saveDraft }: Harness = await render(progress(2, { step: 'team' }));
    const field: HTMLInputElement = find('onboarding-invite-email') as HTMLInputElement;

    field.value = 'ines.robert@ateliernord';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const next: HTMLButtonElement = find('onboarding-next') as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    await click(fixture, next);

    expect(title()?.textContent.trim()).toBe('Invite your team');
    expect(find('onboarding-invite-error')?.textContent.trim()).toBe(
      'Enter a full address, for example ines.robert@ateliernord.fr.',
    );
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('shows no invitation form to a person who may not invite', async () => {
    await render(progress(2, { step: 'team' }), 'member');

    expect(find('onboarding-invite-email')).toBeNull();
    expect(find('onboarding-next')?.textContent.trim()).toBe('Skip');
  });

  it('shows a skeleton while the progress is read', async () => {
    await render(null);

    expect(title()?.textContent.trim()).toBe('Welcome to Atelier Nord');
    expect(find('onboarding-loading')).not.toBeNull();
    expect(find('onboarding-next')).toBeNull();
  });

  it('shows an inline error whose Retry reads the progress again', async () => {
    const { fixture, failed, reload }: Harness = await render(null);
    failed.set(true);
    await fixture.whenStable();

    const error: HTMLElement | null = find('onboarding-load-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('Your setup could not be loaded.');
    await click(fixture, find('onboarding-load-retry'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('announces the screen shown after each move', async () => {
    const { fixture }: Harness = await render(progress(1));
    const announce: Mock = vi
      .spyOn(TestBed.inject(LiveAnnouncer), 'announce')
      .mockResolvedValue(undefined);

    await click(fixture, find('onboarding-next'));
    await click(fixture, find('onboarding-back'));

    expect(announce.mock.calls).toEqual([
      ['Step 2 of 4: Template', 'polite'],
      ['Step 1 of 4: Space', 'polite'],
    ]);
  });

  it('stays open, on the same window, through a history move', async () => {
    const { fixture }: Harness = await render(progress(1));
    const dialog: Element | null = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    for (let round: number = 0; round < 4; round += 1) {
      await fixture.whenStable();
      await new Promise<void>((resolve: () => void) => setTimeout(resolve));
    }

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);
    expect(find('onboarding-wizard')).not.toBeNull();
    expect(document.activeElement).toBe(title());
  });

  it('moves the focus to the title once Retry removed its alert', async () => {
    const { fixture, failed }: Harness = await render(null);
    failed.set(true);
    await fixture.whenStable();
    find('onboarding-load-retry')?.focus();

    failed.set(false);
    await click(fixture, find('onboarding-load-retry'));

    expect(document.activeElement).toBe(title());
  });

  it('shows an unknown finish outcome with a Retry', async () => {
    const { fixture, finish }: Harness = await render(progress(2, { step: 'import' }));
    finish.mockRejectedValueOnce(new Error('network'));

    await click(fixture, find('onboarding-next'));

    const error: HTMLElement | null = find('onboarding-finish-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain(
      'The space may not have been created. Retry: it will be created only once.',
    );
    await click(fixture, find('onboarding-finish-retry'));

    await vi.waitFor(() => {
      expect(finish).toHaveBeenCalledTimes(2);
    });
    expect(finish.mock.calls[1]?.[1]).toBe(finish.mock.calls[0]?.[1]);
    expect(document.activeElement).toBe(title());
  });
});
