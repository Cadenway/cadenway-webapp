import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../../data-access/services/billing-api/billing-api.service';
import { InvitationsApi } from '../../../data-access/services/invitations-api/invitations-api.service';
import { MembersApi } from '../../../data-access/services/members-api/members-api.service';
import type { InvitationList } from '../../../models/invitation/invitation.interface';
import type { MemberPage, OrganizationMember } from '../../../models/member/member.interface';
import { SubscriptionStore } from '../../../state/subscription/subscription.store';
import { MembersTable } from '../../components/members-table/members-table.component';
import { InviteDialog } from '../../dialogs/invite-dialog/invite-dialog.component';
import { MembersPage } from './members-page.component';

/**
 * Function person
 *
 * @description
 * A member of Atelier Nord, as the mockup lists them.
 *
 * @param {string} id - Membership id.
 * @param {string} name - Full name.
 * @param {OrganizationMember['role']} role - Role.
 * @param {boolean | null} twoStep - Two-step flag as the caller may know it.
 * @returns {OrganizationMember} The member.
 */
function person(
  id: string,
  name: string,
  role: OrganizationMember['role'],
  twoStep: boolean | null,
): OrganizationMember {
  return {
    id,
    userId: `u-${id}`,
    name,
    email: `${id}@ateliernord.fr`,
    role,
    twoStepVerification: twoStep,
    version: 1,
  };
}

/**
 * Function members
 *
 * @description
 * The first page of members, with the mockup's counts.
 *
 * @param {boolean} known - Whether the caller knows the two-step flags (owner or administrator).
 * @returns {MemberPage} The page.
 */
function members(known: boolean): MemberPage {
  const flag: (value: boolean) => boolean | null = (value: boolean) => (known ? value : null);
  return {
    items: [
      person('cm', 'Camille Martin', 'owner', flag(true)),
      person('ir', 'Inès Robert', 'admin', flag(true)),
      person('tb', 'Théo Bernard', 'member', flag(false)),
      person('ng', 'Nadia Garnier', 'guest', flag(true)),
    ],
    total: 4,
    counts: { owner: 1, admin: 1, member: 1, guest: 1 },
    nextCursor: null,
    truncated: false,
  };
}

/**
 * Constant INVITATIONS
 *
 * @description
 * The pending invitations the fake API answers.
 *
 * @type {InvitationList}
 */
const INVITATIONS: InvitationList = {
  items: [
    {
      id: 'i1',
      email: 'marc.roux@ateliernord.fr',
      role: 'member',
      invitedBy: 'Inès Robert',
      expired: false,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 - 60_000).toISOString(),
    },
    {
      id: 'i3',
      email: 'atelier@nordstudio.fr',
      role: 'member',
      invitedBy: 'Hugo Dubois',
      expired: true,
      expiresAt: '2026-11-02T10:00:00Z',
    },
  ],
  total: 2,
};

/**
 * Interface Fakes
 *
 * @description
 * Fakes of the page's data access and toasts.
 */
interface Fakes {
  // #region Properties
  /**
   * Property members
   *
   * @description
   * Fake of `MembersApi`.
   *
   * @type {Record<'page' | 'all' | 'changeRole' | 'remove', Mock>}
   * @readonly
   */
  readonly members: Record<'page' | 'all' | 'changeRole' | 'remove', Mock>;

  /**
   * Property invitations
   *
   * @description
   * Fake of `InvitationsApi`.
   *
   * @type {Record<'list' | 'invite' | 'resend' | 'revoke', Mock>}
   * @readonly
   */
  readonly invitations: Record<'list' | 'invite' | 'resend' | 'revoke', Mock>;

  /**
   * Property toasts
   *
   * @description
   * Fake of the toast service.
   *
   * @type {Record<'success' | 'error' | 'info' | 'warning', Mock>}
   * @readonly
   */
  readonly toasts: Record<'success' | 'error' | 'info' | 'warning', Mock>;

  /**
   * Property organization
   *
   * @description
   * The workspace organization, switchable.
   *
   * @type {WritableSignal<WorkspaceOrganization>}
   * @readonly
   */
  readonly organization: WritableSignal<WorkspaceOrganization>;
  // #endregion
}

/**
 * Function render
 *
 * @description
 * Renders the page for a role and waits for its reads.
 *
 * @param {WorkspaceRole} role - The person's role.
 * @param {Partial<Record<'page' | 'all' | 'changeRole' | 'remove', Mock>>} [overrides] - Fakes.
 * @returns {Promise<[ComponentFixture<MembersPage>, Fakes]>} The page and its fakes.
 */
async function render(
  role: WorkspaceRole,
  overrides: Partial<Record<'page' | 'all' | 'changeRole' | 'remove', Mock>> = {},
): Promise<[ComponentFixture<MembersPage>, Fakes]> {
  const ranks: readonly WorkspaceRole[] = ['guest', 'member', 'admin', 'owner'];
  const fakes: Fakes = {
    members: {
      page: vi.fn(() => Promise.resolve(members(role !== 'member'))),
      all: vi.fn(() => Promise.resolve(members(role !== 'member'))),
      changeRole: vi.fn(),
      remove: vi.fn(() => Promise.resolve()),
      ...overrides,
    },
    invitations: {
      list: vi.fn(() => Promise.resolve(INVITATIONS)),
      invite: vi.fn(() => Promise.resolve({ invited: 2, skipped: 0 })),
      resend: vi.fn(),
      revoke: vi.fn(),
    },
    toasts: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
    organization: signal<WorkspaceOrganization>({
      id: 'o1',
      slug: 'atelier-nord',
      name: 'Atelier Nord',
      initials: 'AN',
      role,
      plan: 'team',
    }),
  };
  const workspace: WorkspaceContextPort = {
    user: signal({
      id: 'u-cm',
      name: 'Camille Martin',
      firstName: 'Camille',
      displayName: null,
      email: 'cm@ateliernord.fr',
      initials: 'CM',
    }),
    organization: fakes.organization,
    role: signal(role),
    can: (least: WorkspaceRole): boolean => ranks.indexOf(role) >= ranks.indexOf(least),
  };
  TestBed.configureTestingModule({
    imports: [MembersPage],
    providers: [
      provideCadenwayIcons(),
      SubscriptionStore,
      { provide: WORKSPACE_CONTEXT, useValue: workspace },
      {
        provide: BillingApi,
        useValue: {
          subscription: () =>
            Promise.resolve({
              plan: 'team',
              seatsUsed: 18,
              seatsLimit: 25,
              storageUsedBytes: 0,
              storageLimitBytes: 100_000_000_000,
            }),
        },
      },
      { provide: MembersApi, useValue: fakes.members },
      { provide: InvitationsApi, useValue: fakes.invitations },
      { provide: CwToastService, useValue: fakes.toasts },
    ],
  });
  const fixture: ComponentFixture<MembersPage> = TestBed.createComponent(MembersPage);
  await fixture.whenStable();
  return [fixture, fakes];
}

/**
 * Function find
 *
 * @description
 * Finds an element by `data-testid` in the page or the overlays.
 *
 * @param {string} id - The test id.
 * @returns {HTMLElement | null} The element.
 */
function find(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/**
 * Function all
 *
 * @description
 * Finds every element of a `data-testid`.
 *
 * @param {string} id - The test id.
 * @returns {HTMLElement[]} The elements.
 */
function all(id: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
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

describe('MembersPage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows an owner the summary, the editable table, the two-step column and the invitations', async () => {
    const [fixture]: [ComponentFixture<MembersPage>, Fakes] = await render('owner');
    const page: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(text(find('members-summary'))).toBe(
      '3 members and 1 guest · 7 free seats · 2 pending invitations',
    );
    expect(all('member-row')).toHaveLength(4);
    expect(find('member-owner')).not.toBeNull();
    expect(all('member-role')).toHaveLength(3);
    expect(all('member-remove')).toHaveLength(3);
    expect(page.querySelector('th')?.parentElement?.textContent).toContain('Two-step');
    expect(text(find('members-range'))).toBe('1–4 of 4 people');
    expect(text(find('members-online'))).toBe('0 online');
    expect(all('member-status').map(text)).toEqual([
      'Status: Offline',
      'Status: Offline',
      'Status: Offline',
      'Status: Offline',
    ]);
    expect(all('invitation-expiry').map(text)).toEqual(['Expires in 5 days', 'Expired on 2 Nov']);
    expect(find('members-invite')).not.toBeNull();
  });

  it('shows a member a read-only list without invitations', async () => {
    const [fixture, fakes]: [ComponentFixture<MembersPage>, Fakes] = await render('member');
    const page: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(text(find('members-summary'))).toBe('3 members and 1 guest');
    expect(all('member-role')).toHaveLength(0);
    expect(all('member-remove')).toHaveLength(0);
    expect(all('member-role-text').map(text)).toEqual(['Administrator', 'Member', 'Guest']);
    expect(page.textContent).not.toContain('Two-step');
    expect(find('invitations-table')).toBeNull();
    expect(find('members-invite')).toBeNull();
    expect(fakes.invitations.list).not.toHaveBeenCalled();
  });

  it('throws a failed first read to the route error boundary', async () => {
    await expect(
      render('owner', {
        page: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 503 })),
      }),
    ).rejects.toThrow();
  });

  it('keeps a later failure in place, retries it, then tells an empty result apart', async () => {
    const [fixture, fakes]: [ComponentFixture<MembersPage>, Fakes] = await render('owner');
    fakes.members.page.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));

    find('members-search')?.dispatchEvent(new Event('input'));
    (find('members-search') as HTMLInputElement).value = 'zoé';
    find('members-search')?.dispatchEvent(new Event('input'));
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(find('members-failed')).not.toBeNull();
    });
    expect(find('members-empty')).toBeNull();
    fakes.members.page.mockResolvedValueOnce({ ...members(true), items: [], total: 0 });
    find('members-retry')?.click();
    await fixture.whenStable();

    expect(fakes.members.page).toHaveBeenCalledTimes(3);
    expect(find('members-failed')).toBeNull();
    expect(text(find('members-empty'))).toContain('No member matches');
    expect(text(find('members-range'))).toBe('0 people');
    expect(find('members-clear-filters')).not.toBeNull();
  });

  it('keeps the role select focusable and marks it busy while its change is sent', async () => {
    const [fixture, fakes]: [ComponentFixture<MembersPage>, Fakes] = await render('owner', {
      changeRole: vi.fn(() => new Promise<never>(() => undefined)),
    });
    const table: MembersTable = fixture.debugElement.query(By.directive(MembersTable))
      .componentInstance as MembersTable;

    table.roleChanged.emit({ member: table.rows()[2], role: 'admin' });
    await fixture.whenStable();

    const select: HTMLElement = all('member-role')[1];
    expect(fakes.members.changeRole).toHaveBeenCalledWith('tb', 'admin', 1);
    expect(select.getAttribute('aria-busy')).toBe('true');
    expect(select.querySelector('[disabled]')).toBeNull();
  });

  it('removes a member after the confirmation', async () => {
    const [fixture, fakes]: [ComponentFixture<MembersPage>, Fakes] = await render('owner');

    all('member-remove')[1]?.click();
    await fixture.whenStable();
    expect(text(document.querySelector<HTMLElement>('[role="alertdialog"]'))).toContain(
      'Remove Théo Bernard from the organization?',
    );
    const remaining: MemberPage = members(true);
    fakes.members.page.mockResolvedValue({
      ...remaining,
      items: remaining.items.filter((item: OrganizationMember) => item.id !== 'tb'),
      total: 3,
    });
    find('member-remove-confirm')?.click();
    await fixture.whenStable();

    expect(fakes.members.remove).toHaveBeenCalledWith('tb');
    expect(all('member-row')).toHaveLength(3);
    expect(document.activeElement).toBe(all('member-remove')[1]);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Remove Nadia Garnier from the organization',
    );
    expect(fakes.toasts.success).toHaveBeenCalledWith('Théo Bernard removed', {
      description: 'Their tasks stay assigned; a seat is freed.',
    });
  });

  it('closes and empties the invite dialog when the organization changes', async () => {
    const [fixture, fakes]: [ComponentFixture<MembersPage>, Fakes] = await render('owner');
    find('members-invite')?.click();
    await fixture.whenStable();
    const field: HTMLTextAreaElement = find('invite-emails') as HTMLTextAreaElement;
    field.value = 'marc.roux@ateliernord.fr';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fakes.organization.set({ ...fakes.organization(), id: 'o2', slug: 'lumen', name: 'Lumen' });
    await fixture.whenStable();
    expect(find('invite-emails')).toBeNull();
    find('members-invite')?.click();
    await fixture.whenStable();

    expect((find('invite-emails') as HTMLTextAreaElement).value).toBe('');
  });

  it('refuses an invite opened for the previous organization', async () => {
    const [fixture, fakes]: [ComponentFixture<MembersPage>, Fakes] = await render('owner');
    find('members-invite')?.click();
    await fixture.whenStable();
    const dialog: InviteDialog = fixture.debugElement.query(By.directive(InviteDialog))
      .componentInstance as InviteDialog;

    fakes.organization.set({ ...fakes.organization(), id: 'o2', slug: 'lumen', name: 'Lumen' });
    dialog.submitted.emit({ emails: ['marc.roux@ateliernord.fr'], role: 'member' });
    await fixture.whenStable();

    expect(fakes.invitations.invite).not.toHaveBeenCalled();
    expect(find('invite-emails')).toBeNull();
  });

  it('drops the removal confirmation when the organization changes', async () => {
    const [fixture, fakes]: [ComponentFixture<MembersPage>, Fakes] = await render('owner');
    all('member-remove')[1]?.click();
    await fixture.whenStable();
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();

    fakes.organization.set({ ...fakes.organization(), id: 'o2', slug: 'lumen', name: 'Lumen' });
    await fixture.whenStable();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(fakes.members.remove).not.toHaveBeenCalled();
  });

  it('asks for an address, then sends the invitations and closes the dialog', async () => {
    const [fixture, fakes]: [ComponentFixture<MembersPage>, Fakes] = await render('owner');

    find('members-invite')?.click();
    await fixture.whenStable();
    expect(text(find('invite-seats'))).toBe('7 seats available on the Team plan.');
    find('invite-submit')?.click();
    await fixture.whenStable();
    expect(text(find('invite-error'))).toBe('Enter at least one email address.');
    expect(fakes.invitations.invite).not.toHaveBeenCalled();

    const field: HTMLTextAreaElement = find('invite-emails') as HTMLTextAreaElement;
    field.value = 'marc.roux@ateliernord.fr, lucie@example.com';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(text(find('invite-hint'))).toBe('2 valid addresses · 5 seats left afterwards');
    find('invite-submit')?.click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(find('invite-dialog')?.querySelector('form')).toBeFalsy();
    });

    expect(fakes.invitations.invite).toHaveBeenCalledWith(
      ['marc.roux@ateliernord.fr', 'lucie@example.com'],
      'member',
    );
  });
});
