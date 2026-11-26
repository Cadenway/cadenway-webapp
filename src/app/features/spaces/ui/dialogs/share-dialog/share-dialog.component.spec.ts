import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import type { SharePerson } from '../../../models/list-share/list-share.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import { ListShareStore } from '../../../state/list-share/list-share.store';
import { ShareDialog } from './share-dialog.component';

/**
 * Constant sprint14
 *
 * @description
 * The mockup's `Sprint 14`.
 *
 * @type {TaskList}
 */
const sprint14: TaskList = {
  id: 'l-sprint14',
  spaceId: 'sp-product',
  name: 'Sprint 14',
  icon: 'lightning',
  color: 'violet',
  sprint: null,
  archived: false,
  canEdit: true,
  version: 4,
};

/**
 * Constant people
 *
 * @description
 * `People with access` of `Sprint 14`.
 *
 * @type {readonly SharePerson[]}
 */
const people: readonly SharePerson[] = [
  {
    userId: 'u-camille',
    name: 'Camille Martin',
    email: 'camille.martin@ateliernord.fr',
    guest: false,
    role: 'owner',
  },
  {
    userId: 'u-lea',
    name: 'Léa Petit',
    email: 'lea.petit@ateliernord.fr',
    guest: false,
    role: 'comment',
  },
  {
    userId: 'u-nadia',
    name: 'Nadia Benali',
    email: 'nadia@studio-pixel.fr',
    guest: true,
    role: 'comment',
  },
];

/**
 * Interface StoreFake
 *
 * @description
 * The signals and methods of `ListShareStore` the dialog reads.
 */
interface StoreFake {
  // #region Properties
  /**
   * Property access
   *
   * @description
   * The read: its error, value and reload.
   *
   * @type {{ error: WritableSignal<unknown>; hasValue: WritableSignal<boolean>; reload: Mock }}
   * @readonly
   */
  readonly access: {
    error: WritableSignal<unknown>;
    hasValue: WritableSignal<boolean>;
    reload: Mock;
  };

  /**
   * Property people
   *
   * @description
   * The rows.
   *
   * @type {WritableSignal<readonly SharePerson[]>}
   * @readonly
   */
  readonly people: WritableSignal<readonly SharePerson[]>;

  /**
   * Property guestCount
   *
   * @description
   * Guests among the rows.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  readonly guestCount: WritableSignal<number>;

  /**
   * Property organizationAccess
   *
   * @description
   * The switch.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly organizationAccess: WritableSignal<boolean>;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may share.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly canEdit: WritableSignal<boolean>;

  /**
   * Property canInvite
   *
   * @description
   * Whether `Invite by email` shows.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly canInvite: WritableSignal<boolean>;

  /**
   * Property privateSpace
   *
   * @description
   * Whether the space is private.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly privateSpace: WritableSignal<boolean>;

  /**
   * Property follow
   *
   * @description
   * `follow` spy.
   *
   * @type {Mock}
   * @readonly
   */
  readonly follow: Mock;

  /**
   * Property changeRole
   *
   * @description
   * `changeRole` spy.
   *
   * @type {Mock}
   * @readonly
   */
  readonly changeRole: Mock;

  /**
   * Property remove
   *
   * @description
   * `remove` spy.
   *
   * @type {Mock}
   * @readonly
   */
  readonly remove: Mock;

  /**
   * Property invite
   *
   * @description
   * `invite` spy.
   *
   * @type {Mock}
   * @readonly
   */
  readonly invite: Mock;

  /**
   * Property setOrganizationAccess
   *
   * @description
   * `setOrganizationAccess` spy.
   *
   * @type {Mock}
   * @readonly
   */
  readonly setOrganizationAccess: Mock;
  // #endregion
}

/**
 * Function byTestId
 *
 * @description
 * An element of the dialog, rendered in the overlay.
 *
 * @param {string} id - Its `data-testid`.
 * @returns {HTMLElement | null} The element.
 */
function byTestId(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/**
 * Function emailField
 *
 * @description
 * The `Invite by email` address field.
 *
 * @returns {HTMLInputElement | null} The field.
 */
function emailField(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('[data-testid="share-email"]');
}

/**
 * Function buttonNamed
 *
 * @description
 * A button of the document by its accessible name or text.
 *
 * @param {string} name - The name.
 * @returns {HTMLButtonElement | undefined} The button.
 */
function buttonNamed(name: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button: HTMLButtonElement): boolean =>
      button.getAttribute('aria-label') === name || button.textContent.trim() === name,
  );
}

describe('ShareDialog', () => {
  let store: StoreFake;
  let toasts: { show: Mock; error: Mock };
  let fixture: ComponentFixture<ShareDialog>;

  /**
   * Function render
   *
   * @description
   * Opens the dialog on `Sprint 14`.
   *
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function render(): Promise<void> {
    fixture = TestBed.createComponent(ShareDialog);
    fixture.componentRef.setInput('list', sprint14);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /**
   * Function typeEmail
   *
   * @description
   * Types an address and submits `Invite`.
   *
   * @param {string} email - The address.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function typeEmail(email: string): Promise<void> {
    const field: HTMLInputElement | null = emailField();
    if (field) {
      field.value = email;
      field.dispatchEvent(new Event('input'));
    }
    byTestId('share-invite')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    store = {
      access: { error: signal<unknown>(undefined), hasValue: signal(true), reload: vi.fn() },
      people: signal(people),
      guestCount: signal(1),
      organizationAccess: signal(true),
      canEdit: signal(true),
      canInvite: signal(true),
      privateSpace: signal(false),
      follow: vi.fn(),
      changeRole: vi.fn(() => Promise.resolve(true)),
      remove: vi.fn(() => Promise.resolve(true)),
      invite: vi.fn(() => 'sent'),
      setOrganizationAccess: vi.fn(() => Promise.resolve(true)),
    };
    toasts = { show: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        { provide: CwToastService, useValue: toasts },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: signal({ name: 'Atelier Nord', slug: 'atelier-nord' }) },
        },
      ],
    });
    TestBed.overrideComponent(ShareDialog, {
      set: { providers: [{ provide: ListShareStore, useValue: store }] },
    });
  });

  it('shows the people with access, the owner, the guests and the organization switch', async () => {
    await render();

    const text: string = document.body.textContent;
    expect(text).toContain('Share “Sprint 14”');
    expect(text).toContain('Invite people from the organization or external guests.');
    expect(document.querySelectorAll('[data-testid="share-person"]')).toHaveLength(3);
    expect(text).toContain('Owner');
    expect(text).toContain('Guest');
    expect(byTestId('share-guests')?.textContent).toContain(
      '1 external guest: they only see this list and do not count as seats.',
    );
    expect(text).toContain('All members of Atelier Nord can see this list');
    expect(buttonNamed("Remove Léa Petit's access")).toBeDefined();
    expect(buttonNamed("Remove Camille Martin's access")).toBeUndefined();

    const follow: unknown = store.follow.mock.calls[0]?.[0];
    expect(typeof follow).toBe('function');
    expect((follow as () => unknown)()).toEqual({ listId: 'l-sprint14', spaceId: 'sp-product' });
  });

  it('shows a failed read with Retry, apart from the loading state', async () => {
    store.access.hasValue.set(false);
    await render();
    expect(byTestId('share-loading')).not.toBeNull();

    store.access.error.set(new Error('offline'));
    fixture.detectChanges();
    expect(byTestId('share-failed')?.textContent).toContain(
      'The people with access could not be loaded.',
    );
    buttonNamed('Retry')?.click();
    expect(store.access.reload).toHaveBeenCalled();
  });

  it('marks an incomplete address and sends nothing', async () => {
    await render();

    await typeEmail('lea.petit@ateliernord');

    expect(document.body.textContent).toContain('Incomplete address: add the domain.');
    expect(store.invite).not.toHaveBeenCalled();
  });

  it('notes an address outside the organization, then empties the field once sent', async () => {
    store.invite.mockReturnValueOnce('unknown');
    await render();

    await typeEmail('someone@elsewhere.com');
    expect(store.invite).toHaveBeenCalledWith('someone@elsewhere.com', 'edit');
    expect(document.body.textContent).toContain(
      'This person is not in the organization: invite them first.',
    );

    await typeEmail('hugo.dubois@ateliernord.fr');
    expect(emailField()?.value).toBe('');
    expect(document.body.textContent).not.toContain('This person is not in the organization');
  });

  it('confirms a removal before removing the access', async () => {
    await render();

    buttonNamed("Remove Léa Petit's access")?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.body.textContent).toContain("Remove Léa Petit's access?");
    expect(document.body.textContent).toContain(
      'Léa Petit will no longer see this list or its tasks. You can invite them again.',
    );
    expect(store.remove).not.toHaveBeenCalled();

    byTestId('share-remove-confirm')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(store.remove).toHaveBeenCalledWith('u-lea');
  });

  it('turns the organization access through the store', async () => {
    await render();

    byTestId('share-organization')?.querySelector<HTMLButtonElement>('button')?.click();
    expect(store.setOrganizationAccess).toHaveBeenCalledWith(false);
  });

  it('copies the link of the list with its toast', async () => {
    const writeText: Mock = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await render();

    buttonNamed('Copy the link')?.click();
    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);

    const link: string = `${location.origin}/atelier-nord/l/l-sprint14`;
    expect(writeText).toHaveBeenCalledWith(link);
    expect(toasts.show).toHaveBeenCalledWith('List link copied', { description: link });
  });

  it('shows the roles as words and no invitation to a caller without edit', async () => {
    store.canEdit.set(false);
    store.canInvite.set(false);
    store.privateSpace.set(true);
    await render();

    expect(byTestId('share-email')).toBeNull();
    expect(byTestId('share-organization')).toBeNull();
    expect(document.body.textContent).toContain('Can comment');
    expect(buttonNamed("Remove Léa Petit's access")).toBeUndefined();
  });
});
