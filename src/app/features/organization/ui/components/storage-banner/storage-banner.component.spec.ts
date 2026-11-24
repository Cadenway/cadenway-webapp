import { signal, type Type } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../../data-access/services/billing-api/billing-api.service';
import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { PlanSummary } from '../plan-summary/plan-summary.component';
import { StorageBanner } from './storage-banner.component';

/**
 * Function workspaceAs
 *
 * @description
 * Atelier Nord as the workspace port shows it to a person of the given role.
 *
 * @param {WorkspaceRole} role - The person's role.
 * @returns {WorkspaceContextPort} The port.
 */
function workspaceAs(role: WorkspaceRole): WorkspaceContextPort {
  return {
    user: signal({
      id: 'u1',
      name: 'Camille Martin',
      firstName: 'Camille',
      displayName: null,
      email: 'camille.martin@ateliernord.fr',
      initials: 'CM',
    }),
    organization: signal({
      id: 'o1',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
      initials: 'AN',
      role,
      plan: 'team',
    }),
    role: signal(role),
    can: () => role === 'owner',
  };
}

/**
 * Function usage
 *
 * @description
 * The mockup's Team plan with the given attachment storage used.
 *
 * @param {number} usedBytes - Bytes used out of 100 GB.
 * @returns {OrganizationSubscription} The subscription.
 */
function usage(usedBytes: number): OrganizationSubscription {
  return {
    plan: 'team',
    seatsUsed: 18,
    seatsLimit: 25,
    storageUsedBytes: usedBytes,
    storageLimitBytes: 100_000_000_000,
  };
}

/**
 * Function render
 *
 * @description
 * Renders a usage widget for a role and a subscription.
 *
 * @template T
 * @param {Type<T>} component - Widget to render.
 * @param {WorkspaceRole} role - The person's role.
 * @param {Mock<() => Promise<OrganizationSubscription>>} subscription - Fake of the Billing read.
 * @returns {Promise<ComponentFixture<T>>} The rendered widget.
 */
async function render<T>(
  component: Type<T>,
  role: WorkspaceRole,
  subscription: Mock<() => Promise<OrganizationSubscription>>,
): Promise<ComponentFixture<T>> {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      provideCadenwayIcons(),
      { provide: WORKSPACE_CONTEXT, useValue: workspaceAs(role) },
      { provide: BillingApi, useValue: { subscription } },
    ],
  });
  const fixture: ComponentFixture<T> = TestBed.createComponent(component);
  await vi.waitFor(async () => {
    await fixture.whenStable();
    expect(subscription.mock.calls.length > 0 || role !== 'owner').toBe(true);
  });
  await fixture.whenStable();
  return fixture;
}

describe('StorageBanner', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('warns an owner from 90 % of the storage quota, with the mockup figures', async () => {
    const fixture: ComponentFixture<StorageBanner> = await render(
      StorageBanner,
      'owner',
      vi.fn(() => Promise.resolve(usage(92_400_000_000))),
    );
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Stockage presque plein');
    expect(host.textContent).toContain(
      '92,4 Go utilisés sur 100 Go. Au-delà, les nouvelles pièces jointes seront refusées.',
    );
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/atelier-nord/organization/quotas');
  });

  it('stays hidden below 90 %', async () => {
    const fixture: ComponentFixture<StorageBanner> = await render(
      StorageBanner,
      'owner',
      vi.fn(() => Promise.resolve(usage(89_000_000_000))),
    );

    expect((fixture.nativeElement as HTMLElement).querySelector('cw-banner')).toBeNull();
  });

  it('never asks Billing for anyone but an owner', async () => {
    const subscription: Mock<() => Promise<OrganizationSubscription>> = vi.fn(() =>
      Promise.resolve(usage(99_000_000_000)),
    );
    const fixture: ComponentFixture<StorageBanner> = await render(
      StorageBanner,
      'member',
      subscription,
    );

    expect(subscription).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('cw-banner')).toBeNull();
  });

  it('hides for the session after « Plus tard »', async () => {
    const fixture: ComponentFixture<StorageBanner> = await render(
      StorageBanner,
      'owner',
      vi.fn(() => Promise.resolve(usage(95_000_000_000))),
    );
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.trim() === 'Plus tard')
      ?.click();
    await fixture.whenStable();

    expect(host.querySelector('cw-banner:not([hidden])')).toBeNull();
    expect(sessionStorage.getItem('cadenway-storage-banner-dismissed:o1')).toBe('1');
  });
});

describe('PlanSummary', () => {
  it('shows the plan and the seats, linking to billing', async () => {
    const fixture: ComponentFixture<PlanSummary> = await render(
      PlanSummary,
      'owner',
      vi.fn(() => Promise.resolve(usage(1))),
    );
    const link: HTMLAnchorElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      'a',
    );

    expect(link?.textContent.trim()).toBe('Plan Équipe · 18 / 25 sièges');
    expect(link?.getAttribute('href')).toBe('/atelier-nord/organization/billing');
  });

  it('shows nothing when Billing fails', async () => {
    const fixture: ComponentFixture<PlanSummary> = await render(
      PlanSummary,
      'owner',
      vi.fn(() => Promise.reject(new Error('unavailable'))),
    );

    expect((fixture.nativeElement as HTMLElement).querySelector('a')).toBeNull();
  });
});
