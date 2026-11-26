import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { ListAccessApi } from '../../../data-access/services/list-access-api/list-access-api.service';
import type {
  ListAccess,
  ShareDirectoryEntry,
} from '../../../models/list-share/list-share.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
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
 * Constant sprint14Access
 *
 * @description
 * Who has access to `Sprint 14`: Camille Martin owns the space, Léa Petit and the guest Nadia
 * Benali comment.
 *
 * @type {ListAccess}
 */
const sprint14Access: ListAccess = {
  listId: 'l-sprint14',
  canEdit: true,
  organizationAccess: true,
  privateSpace: false,
  ownerId: 'u-camille',
  grants: [
    { userId: 'u-lea', role: 'comment' },
    { userId: 'u-nadia', role: 'comment' },
  ],
};

/**
 * Constant directory
 *
 * @description
 * The members of Atelier Nord; Hugo Dubois has no grant.
 *
 * @type {readonly ShareDirectoryEntry[]}
 */
const directory: readonly ShareDirectoryEntry[] = [
  {
    userId: 'u-camille',
    name: 'Camille Martin',
    email: 'camille.martin@ateliernord.fr',
    guest: false,
  },
  { userId: 'u-lea', name: 'Léa Petit', email: 'lea.petit@ateliernord.fr', guest: false },
  { userId: 'u-hugo', name: 'Hugo Dubois', email: 'hugo.dubois@ateliernord.fr', guest: false },
  { userId: 'u-nadia', name: 'Nadia Benali', email: 'nadia@studio-pixel.fr', guest: true },
];

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

/**
 * Function text
 *
 * @description
 * The text of the document, the overlays included.
 *
 * @returns {string} The text.
 */
function text(): string {
  return document.body.textContent;
}

describe('ShareDialog', () => {
  let api: Record<string, Mock>;
  let toasts: { show: Mock; error: Mock };
  let fixture: ComponentFixture<ShareDialog>;

  /**
   * Function settle
   *
   * @description
   * Renders the dialog once its reads and writes are done.
   *
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

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
    await settle();
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
    await settle();
  }

  /**
   * Function askRemoval
   *
   * @description
   * Opens the removal confirmation of a person.
   *
   * @param {string} name - The person's name.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function askRemoval(name: string): Promise<void> {
    buttonNamed(`Remove ${name}'s access`)?.click();
    await settle();
  }

  /**
   * Function pickRole
   *
   * @description
   * Picks a role in a person's select.
   *
   * @param {string} name - The person's name.
   * @param {string} role - The role's word.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function pickRole(name: string, role: string): Promise<void> {
    document
      .querySelector<HTMLElement>(`[role="combobox"][aria-label="Access for ${name}"]`)
      ?.click();
    await settle();
    [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((option: HTMLElement): boolean => option.textContent.trim() === role)
      ?.click();
    await settle();
  }

  beforeEach(() => {
    api = {
      read: vi.fn(() => Promise.resolve(sprint14Access)),
      directory: vi.fn(() => Promise.resolve(directory)),
      setRole: vi.fn(() => Promise.resolve({ version: 5 })),
      removeRole: vi.fn(() => Promise.resolve({ version: 6 })),
      setOrganizationAccess: vi.fn(() => Promise.resolve({ version: 7 })),
    };
    toasts = { show: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        { provide: ListAccessApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        {
          provide: ListPageStore,
          useValue: {
            list: { hasValue: () => true, value: () => sprint14 },
            followListEdits: vi.fn(),
            members: { reload: vi.fn() },
          },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: signal({ name: 'Atelier Nord', slug: 'atelier-nord' }) },
        },
      ],
    });
  });

  it('shows the people with access, the owner, the guests and the organization switch', async () => {
    await render();

    expect(api['read']).toHaveBeenCalledWith('l-sprint14', 'sp-product', expect.any(AbortSignal));
    expect(text()).toContain('Share “Sprint 14”');
    expect(text()).toContain('Invite people from the organization or external guests.');
    expect(document.querySelectorAll('[data-testid="share-person"]')).toHaveLength(3);
    expect(text()).toContain('Owner');
    expect(text()).toContain('Guest');
    expect(text()).toContain('lea.petit@ateliernord.fr');
    expect(byTestId('share-guests')?.textContent).toContain(
      '1 external guest: they only see this list and do not count as seats.',
    );
    expect(text()).toContain('All members of Atelier Nord can see this list');
    expect(buttonNamed("Remove Léa Petit's access")).toBeDefined();
    expect(buttonNamed("Remove Camille Martin's access")).toBeUndefined();
  });

  it('counts several guests in the plural', async () => {
    api['read'].mockResolvedValueOnce({
      ...sprint14Access,
      grants: [...sprint14Access.grants, { userId: 'u-hugo', role: 'view' }],
    });
    api['directory'].mockResolvedValueOnce(
      directory.map((entry: ShareDirectoryEntry) => ({
        ...entry,
        guest: entry.userId !== 'u-camille',
      })),
    );
    await render();

    expect(byTestId('share-guests')?.textContent).toContain(
      '3 external guests: they only see this list and do not count as seats.',
    );
  });

  it('shows the skeleton while reading, then a failed read with Retry', async () => {
    api['read'].mockReturnValueOnce(new Promise<ListAccess>((): void => undefined));
    fixture = TestBed.createComponent(ShareDialog);
    fixture.componentRef.setInput('list', sprint14);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await expect.poll(() => byTestId('share-loading')).not.toBeNull();
    fixture.componentRef.setInput('open', false);
    await settle();

    api['read'].mockRejectedValueOnce(new Error('offline'));
    fixture.componentRef.setInput('open', true);
    await settle();
    expect(byTestId('share-failed')?.textContent).toContain(
      'The people with access could not be loaded.',
    );

    buttonNamed('Retry')?.click();
    await settle();
    expect(document.querySelectorAll('[data-testid="share-person"]')).toHaveLength(3);
  });

  it('shows a failed directory read with its own Retry, the people still listed', async () => {
    api['directory'].mockRejectedValueOnce(new Error('offline'));
    await render();

    expect(byTestId('share-directory-failed')?.textContent).toContain(
      'The members could not be loaded.',
    );
    expect(document.querySelectorAll('[data-testid="share-person"]')).toHaveLength(3);
    expect(emailField()).toBeNull();

    byTestId('share-directory-retry')?.click();
    await settle();
    expect(byTestId('share-directory-failed')).toBeNull();
    expect(emailField()).not.toBeNull();
  });

  it('marks an incomplete address and sends nothing', async () => {
    await render();

    await typeEmail('lea.petit@ateliernord');

    expect(text()).toContain('Incomplete address: add the domain.');
    expect(api['setRole']).not.toHaveBeenCalled();
  });

  it('notes an address outside the organization or the owner, then invites a member', async () => {
    await render();

    await typeEmail('someone@elsewhere.com');
    expect(text()).toContain('This person is not in the organization: invite them first.');
    await typeEmail('camille.martin@ateliernord.fr');
    expect(text()).toContain('This person owns the space and already has access to the list.');
    expect(api['setRole']).not.toHaveBeenCalled();

    await typeEmail('hugo.dubois@ateliernord.fr');
    expect(api['setRole']).toHaveBeenCalledWith('l-sprint14', 'u-hugo', 'edit');
    expect(emailField()?.value).toBe('');
    expect(text()).not.toContain('This person');
    expect(document.querySelectorAll('[data-testid="share-person"]')).toHaveLength(4);
  });

  it('confirms a removal, saying a member keeps the organization access', async () => {
    await render();

    await askRemoval('Léa Petit');
    expect(text()).toContain("Remove Léa Petit's access?");
    expect(text()).toContain(
      'Léa Petit will no longer see this list or its tasks. You can invite them again.',
    );
    expect(text()).toContain('They can still see it through the organization access.');
    expect(api['removeRole']).not.toHaveBeenCalled();

    byTestId('share-remove-confirm')?.click();
    await settle();
    expect(api['removeRole']).toHaveBeenCalledWith('l-sprint14', 'u-lea');
  });

  it('says nothing of the organization access for a guest or with the switch off', async () => {
    api['read'].mockResolvedValue({ ...sprint14Access, organizationAccess: false });
    await render();

    await askRemoval('Nadia Benali');
    expect(text()).toContain("Remove Nadia Benali's access?");
    expect(text()).not.toContain('through the organization access');
    byTestId('share-remove-cancel')?.click();
    await settle();

    await askRemoval('Léa Petit');
    expect(text()).toContain("Remove Léa Petit's access?");
    expect(text()).not.toContain('through the organization access');
  });

  it('sends the role picked in a row, and nothing for the same role', async () => {
    await render();

    await pickRole('Léa Petit', 'Can comment');
    expect(api['setRole']).not.toHaveBeenCalled();

    await pickRole('Léa Petit', 'View only');
    expect(api['setRole']).toHaveBeenCalledWith('l-sprint14', 'u-lea', 'view');
  });

  it('turns the organization access', async () => {
    await render();

    byTestId('share-organization')?.querySelector<HTMLButtonElement>('button')?.click();
    await settle();
    expect(api['setOrganizationAccess']).toHaveBeenCalledWith('l-sprint14', false);
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

  it('shows the failure toast when the link cannot be copied', async () => {
    const writeText: Mock = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await render();

    buttonNamed('Copy the link')?.click();
    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);

    expect(toasts.error).toHaveBeenCalledWith('The link could not be copied', {
      description: `${location.origin}/atelier-nord/l/l-sprint14`,
    });
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('shows the roles as words and no invitation to a caller without edit', async () => {
    api['read'].mockResolvedValueOnce({ ...sprint14Access, canEdit: false, privateSpace: true });
    api['directory'].mockResolvedValueOnce(null);
    await render();

    expect(emailField()).toBeNull();
    expect(byTestId('share-organization')).toBeNull();
    expect(text()).toContain('Can comment');
    expect(text()).toContain('Unknown user');
    expect(buttonNamed("Remove Léa Petit's access")).toBeUndefined();
  });
});
