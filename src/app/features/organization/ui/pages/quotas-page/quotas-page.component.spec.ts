import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, type DebugElement, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwMeter } from '@cadenway/ui/components/meter';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../../data-access/services/billing-api/billing-api.service';
import type { OrganizationSubscription } from '../../../models/organization-subscription/organization-subscription.interface';
import { SubscriptionStore } from '../../../state/subscription/subscription.store';
import { QuotasPage } from './quotas-page.component';

/**
 * Constant workspace
 *
 * @description
 * Atelier Nord, whose owner is signed in.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
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
    role: 'owner',
    plan: 'team',
  }),
  role: signal('owner'),
  can: () => true,
};

/**
 * Function usage
 *
 * @description
 * The mockup's Team plan (`Organisation.dc.html` lines 1627-1634) with the given seats and
 * storage used: 25 seats, 100 GB and 4 guests.
 *
 * @param {number} seatsUsed - Seats taken.
 * @param {number} storageUsedBytes - Bytes of attachments.
 * @returns {OrganizationSubscription} The subscription.
 */
function usage(seatsUsed: number, storageUsedBytes: number): OrganizationSubscription {
  return {
    plan: 'team',
    seatsUsed,
    seatsLimit: 25,
    storageUsedBytes,
    storageLimitBytes: 100_000_000_000,
    guestCount: 4,
  };
}

/**
 * Function httpError
 *
 * @description
 * A Billing refusal as the generated client rejects it.
 *
 * @param {number} status - HTTP status.
 * @returns {Error} The rejection.
 */
function httpError(status: number): Error {
  return new Error('Billing refused', {
    cause: new HttpErrorResponse({ status, url: '/v1/billing/subscription' }),
  });
}

/**
 * Interface Rendered
 *
 * @description
 * The rendered page and its fakes.
 */
interface Rendered {
  // #region Properties
  /**
   * Property fixture
   *
   * @description
   * The page.
   *
   * @type {ComponentFixture<QuotasPage>}
   * @readonly
   */
  readonly fixture: ComponentFixture<QuotasPage>;

  /**
   * Property toasts
   *
   * @description
   * Fake of the toast service.
   *
   * @type {{ success: Mock; error: Mock }}
   * @readonly
   */
  readonly toasts: { success: Mock; error: Mock };
  // #endregion
}

/**
 * Function render
 *
 * @description
 * Renders the page over the shared store, whose Billing read is faked.
 *
 * @param {Mock<() => Promise<OrganizationSubscription>>} subscription - Fake of the Billing read.
 * @returns {Rendered} The page and its fakes.
 */
function render(subscription: Mock<() => Promise<OrganizationSubscription>>): Rendered {
  const toasts: { success: Mock; error: Mock } = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideCadenwayIcons(),
      { provide: WORKSPACE_CONTEXT, useValue: workspace },
      { provide: BillingApi, useValue: { subscription } },
      { provide: CwToastService, useValue: toasts },
      SubscriptionStore,
    ],
  });
  const fixture: ComponentFixture<QuotasPage> = TestBed.createComponent(QuotasPage);
  fixture.detectChanges();
  return { fixture, toasts };
}

/**
 * Function renderAfterRead
 *
 * @description
 * Renders the page once the shared store already answered, as when the person comes from another
 * page of the organization.
 *
 * @param {Mock<() => Promise<OrganizationSubscription>>} subscription - Fake of the Billing read.
 * @returns {Promise<Rendered>} The page and its fakes, before its own refresh settled.
 */
async function renderAfterRead(
  subscription: Mock<() => Promise<OrganizationSubscription>>,
): Promise<Rendered> {
  const toasts: { success: Mock; error: Mock } = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideCadenwayIcons(),
      { provide: WORKSPACE_CONTEXT, useValue: workspace },
      { provide: BillingApi, useValue: { subscription } },
      { provide: CwToastService, useValue: toasts },
      SubscriptionStore,
    ],
  });
  TestBed.inject(SubscriptionStore);
  await TestBed.inject(ApplicationRef).whenStable();
  const fixture: ComponentFixture<QuotasPage> = TestBed.createComponent(QuotasPage);
  fixture.detectChanges();
  return { fixture, toasts };
}

/**
 * Function settle
 *
 * @description
 * Waits for the read and renders its outcome.
 *
 * @param {ComponentFixture<QuotasPage>} fixture - The page.
 * @returns {Promise<HTMLElement>} The page element.
 */
async function settle(fixture: ComponentFixture<QuotasPage>): Promise<HTMLElement> {
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/**
 * Function row
 *
 * @description
 * A row of the limits card by its quota.
 *
 * @param {HTMLElement} host - The page element.
 * @param {string} id - `seats`, `storage` or `guests`.
 * @returns {HTMLElement | null} The row, when rendered.
 */
function row(host: HTMLElement, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-testid="quota-${id}"]`);
}

describe('QuotasPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows the section skeleton, then the mockup meters with their zones and notes', async () => {
    let answer: (value: OrganizationSubscription) => void = () => undefined;
    const { fixture }: Rendered = render(
      vi.fn(
        () =>
          new Promise<OrganizationSubscription>((resolve) => {
            answer = resolve;
          }),
      ),
    );
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
        'Loading the section',
      );
    });

    answer(usage(18, 92_400_000_000));
    await settle(fixture);

    expect(host.querySelector('[data-testid="quotas-skeleton"]')).toBeNull();
    expect(host.querySelector('h1')?.textContent.trim()).toBe('Quotas and usage');
    expect(host.querySelector('h2')?.textContent.trim()).toBe('Team plan limits');
    expect(host.textContent).toContain('alert threshold at 80%');
    expect(
      fixture.debugElement
        .queryAll(By.directive(CwMeter))
        .map((meter: DebugElement) => (meter.componentInstance as CwMeter).marker()),
    ).toEqual([20, 80_000_000_000]);
    expect(row(host, 'seats')?.getAttribute('data-zone')).toBe('normal');
    expect(
      row(host, 'seats')?.querySelector('[role="meter"]')?.getAttribute('aria-valuetext'),
    ).toBe('18 / 25');
    expect(row(host, 'seats')?.textContent).toContain('7 free seats. Guests do not take a seat.');
    expect(row(host, 'storage')?.getAttribute('data-zone')).toBe('critical');
    expect(row(host, 'storage')?.textContent).toContain('92.4 GB / 100 GB');
    expect(row(host, 'storage')?.textContent).toContain(
      'Critical: beyond 100 GB, new attachments will be refused.',
    );
    expect(row(host, 'guests')?.querySelector('[role="meter"]')).toBeNull();
    expect(row(host, 'guests')?.textContent).toContain('Guests');
    expect(row(host, 'guests')?.textContent).toContain('4');
    expect(row(host, 'guests')?.textContent).toContain('Free, limited to specific lists.');
    expect(host.textContent).not.toContain('API calls');
    expect(host.textContent).not.toContain('Webhooks');
  });

  it('turns a meter high from 80 % and writes the room left, with a singular free seat', async () => {
    const { fixture }: Rendered = render(vi.fn(() => Promise.resolve(usage(24, 85_000_000_000))));
    const host: HTMLElement = await settle(fixture);

    expect(row(host, 'seats')?.getAttribute('data-zone')).toBe('critical');
    expect(row(host, 'seats')?.textContent).toContain('1 free seat. Guests do not take a seat.');
    expect(row(host, 'storage')?.getAttribute('data-zone')).toBe('high');
    expect(row(host, 'storage')?.textContent).toContain(
      'High: 15 GB free before new attachments are refused.',
    );
  });

  it('writes the free room of a storage below 80 %', async () => {
    const { fixture }: Rendered = render(vi.fn(() => Promise.resolve(usage(20, 40_000_000_000))));
    const host: HTMLElement = await settle(fixture);

    expect(row(host, 'seats')?.getAttribute('data-zone')).toBe('high');
    expect(row(host, 'storage')?.getAttribute('data-zone')).toBe('normal');
    expect(row(host, 'storage')?.textContent).toContain('60 GB free.');
  });

  it('shows the error panel on a failed read and reads again on Retry', async () => {
    const subscription: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValue(usage(18, 92_400_000_000));
    const { fixture }: Rendered = render(subscription);
    const host: HTMLElement = await settle(fixture);

    expect(host.querySelector('[data-testid="quotas-failed"]')?.getAttribute('role')).toBe('alert');
    expect(host.textContent).toContain('Could not load this section');
    expect(row(host, 'seats')).toBeNull();

    host.querySelector<HTMLButtonElement>('[data-testid="quotas-retry"]')?.click();
    await settle(fixture);

    expect(subscription).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-testid="quotas-failed"]')).toBeNull();
    expect(row(host, 'seats')?.textContent).toContain('18 / 25');
  });

  it('shows neither meters nor an error when billing refuses the person', async () => {
    const { fixture }: Rendered = render(vi.fn(() => Promise.reject(httpError(403))));
    const host: HTMLElement = await settle(fixture);

    expect(host.querySelector('[data-testid="quotas-failed"]')).toBeNull();
    expect(host.querySelector('[data-testid="quotas-skeleton"]')).toBeNull();
    expect(row(host, 'seats')).toBeNull();
  });

  it('reads the figures again when the page opens over an earlier read', async () => {
    const subscription: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(usage(18, 92_400_000_000))
      .mockResolvedValue(usage(20, 95_000_000_000));
    const { fixture }: Rendered = await renderAfterRead(subscription);
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(row(host, 'seats')?.textContent).toContain('18 / 25');
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(row(host, 'seats')?.textContent).toContain('20 / 25');
    });
    expect(subscription).toHaveBeenCalledTimes(2);
    expect(row(host, 'storage')?.textContent).toContain('95 GB / 100 GB');
    expect(host.querySelector('[data-testid="quotas-refresh-failed"]')).toBeNull();
  });

  it('sends no second read when the page opens during the first one', async () => {
    const subscription: Mock<() => Promise<OrganizationSubscription>> = vi.fn(() =>
      Promise.resolve(usage(18, 92_400_000_000)),
    );
    const { fixture }: Rendered = render(subscription);
    await settle(fixture);

    expect(subscription).toHaveBeenCalledTimes(1);
  });

  it('keeps the figures with a note when the refresh fails, and refreshes on Retry', async () => {
    const subscription: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(usage(18, 92_400_000_000))
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValue(usage(19, 92_400_000_000));
    const { fixture }: Rendered = await renderAfterRead(subscription);
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    await vi.waitFor(async () => {
      await settle(fixture);
      expect(host.querySelector('[data-testid="quotas-refresh-failed"]')?.textContent).toContain(
        'The latest usage could not be loaded. The figures shown may be out of date.',
      );
    });
    expect(host.querySelector('[data-testid="quotas-refresh-failed"]')?.getAttribute('role')).toBe(
      'alert',
    );
    expect(host.querySelector('[data-testid="quotas-failed"]')).toBeNull();
    expect(row(host, 'seats')?.textContent).toContain('18 / 25');

    host.querySelector<HTMLButtonElement>('[data-testid="quotas-refresh-retry"]')?.click();
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(row(host, 'seats')?.textContent).toContain('19 / 25');
    });
    expect(subscription).toHaveBeenCalledTimes(3);
    expect(host.querySelector('[data-testid="quotas-refresh-failed"]')).toBeNull();
  });

  it('clears the figures when the refresh finds the owner revoked', async () => {
    const subscription: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(usage(18, 92_400_000_000))
      .mockRejectedValueOnce(httpError(403));
    const { fixture }: Rendered = await renderAfterRead(subscription);
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    expect(row(host, 'seats')).not.toBeNull();

    await vi.waitFor(async () => {
      await settle(fixture);
      expect(row(host, 'seats')).toBeNull();
    });
    expect(host.querySelector('[data-testid="quotas-export"]')).toBeNull();
    expect(host.querySelector('[data-testid="quotas-refresh-failed"]')).toBeNull();
    expect(host.querySelector('[data-testid="quotas-failed"]')).toBeNull();
  });

  it('exports the usage read again just before, and toasts the file name', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 27, 10, 0));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    let saved: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      saved = blob as Blob;
      return 'blob:usage';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const subscription: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(usage(17, 90_000_000_000))
      .mockResolvedValue(usage(18, 92_400_000_000));
    const { fixture, toasts }: Rendered = render(subscription);
    const host: HTMLElement = await settle(fixture);

    host.querySelector<HTMLButtonElement>('[data-testid="quotas-export"]')?.click();
    await vi.waitFor(() => {
      expect(toasts.success).toHaveBeenCalledWith('Export ready', {
        description: 'atelier-nord-usage-2026-11.csv downloaded.',
      });
    });

    expect(subscription).toHaveBeenCalledTimes(2);
    expect(await saved?.text()).toBe(
      [
        'Section,Metric,Value,Limit,Usage or change',
        'Team plan limits,Seats,18,25,72.0%',
        'Team plan limits,Storage (GB),92.4,100,92.4%',
        'Team plan limits,Guests,4,,',
        '',
      ].join('\r\n'),
    );
  });

  it('writes the share above the limit as it is in the export', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    let saved: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      saved = blob as Blob;
      return 'blob:usage';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const { fixture, toasts }: Rendered = render(
      vi.fn(() => Promise.resolve(usage(27, 105_000_000_000))),
    );
    const host: HTMLElement = await settle(fixture);

    expect(row(host, 'seats')?.getAttribute('data-zone')).toBe('critical');
    host.querySelector<HTMLButtonElement>('[data-testid="quotas-export"]')?.click();
    await vi.waitFor(() => {
      expect(toasts.success).toHaveBeenCalled();
    });

    const text: string = (await saved?.text()) ?? '';
    expect(text).toContain('Team plan limits,Seats,27,25,108.0%');
    expect(text).toContain('Team plan limits,Storage (GB),105,100,105.0%');
  });

  it('writes nothing when the figures cannot be read again before the export', async () => {
    const createObjectURL: ReturnType<typeof vi.spyOn> = vi.spyOn(URL, 'createObjectURL');
    const subscription: Mock<() => Promise<OrganizationSubscription>> = vi
      .fn<() => Promise<OrganizationSubscription>>()
      .mockResolvedValueOnce(usage(18, 92_400_000_000))
      .mockRejectedValue(httpError(503));
    const { fixture, toasts }: Rendered = render(subscription);
    const host: HTMLElement = await settle(fixture);

    host.querySelector<HTMLButtonElement>('[data-testid="quotas-export"]')?.click();
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(host.querySelector('[data-testid="quotas-refresh-failed"]')).not.toBeNull();
    });

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
    expect(row(host, 'seats')?.textContent).toContain('18 / 25');
  });

  it('toasts why when the browser refuses the download', async () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('Blocked');
    });
    const { fixture, toasts }: Rendered = render(
      vi.fn(() => Promise.resolve(usage(18, 92_400_000_000))),
    );
    const host: HTMLElement = await settle(fixture);

    host.querySelector<HTMLButtonElement>('[data-testid="quotas-export"]')?.click();

    await vi.waitFor(() => {
      expect(toasts.error).toHaveBeenCalledWith('Export not possible', {
        description:
          'The browser blocked the download. Allow downloads for this page, then try again.',
      });
    });
    expect(toasts.success).not.toHaveBeenCalled();
  });
});
