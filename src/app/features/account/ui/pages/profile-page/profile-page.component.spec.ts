import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withErrorBoundaries } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  type MockInstance,
  vi,
} from 'vitest';

import { RuntimeConfigStore } from '@core/config';
import type { PresenceStatus } from '@core/realtime';
import { SignOut } from '@features/auth';
import { RouteErrorBoundary } from '@features/errors/ui/components/route-error-boundary/route-error-boundary.component';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { WORKSPACE_REFRESH } from '@features/workspace/ports/workspace-refresh';
import { unsavedChangesGuard } from '@shared/unsaved-changes';

import { ProfileApi } from '../../../data-access/services/profile-api/profile-api.service';
import type { AccountProfile, ProfileChange } from '../../../models/profile/profile.interface';
import { PRESENCE } from '../../../ports/presence/presence.token';
import { ReauthenticationService } from '../../../reauthentication/reauthentication.service';
import { ProfilePage } from './profile-page.component';

/**
 * Constant CAMILLE
 *
 * @description
 * Camille Martin without a photo, version 3.
 *
 * @type {AccountProfile}
 */
const CAMILLE: AccountProfile = {
  id: 'u-camille',
  name: 'Camille Martin',
  displayName: 'camille',
  jobTitle: 'Product lead',
  email: 'camille.martin@ateliernord.fr',
  timeZone: 'Europe/Paris',
  avatarId: null,
  initials: 'CM',
  version: 3,
};

/**
 * Component OtherSection
 *
 * @description
 * Another settings section to leave the page for.
 */
@Component({ selector: 'cw-other-section', template: '<p>Security</p>' })
class OtherSection {}

/**
 * Function problem
 *
 * @description
 * A refused call of the gateway.
 *
 * @param {number} status - HTTP status.
 * @param {string} code - Problem code.
 * @param {Record<string, unknown>} [details] - Problem details.
 * @returns {HttpErrorResponse} The error.
 */
function problem(
  status: number,
  code: string,
  details?: Record<string, unknown>,
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: { type: 'about:blank', title: '', status, code, details },
  });
}

/**
 * Function byTestId
 *
 * @description
 * An element of the document by its test id.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {string} id - Test id.
 * @returns {HTMLElement | null} The element, when rendered.
 */
function byTestId(harness: RouterTestingHarness, id: string): HTMLElement | null {
  harness.detectChanges();
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/**
 * Function type
 *
 * @description
 * Types a value into a field, as the person does.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {string} id - Test id of the field.
 * @param {string} value - The new value.
 */
function type(harness: RouterTestingHarness, id: string, value: string): void {
  const field: HTMLInputElement | null = byTestId(harness, id) as HTMLInputElement | null;
  if (field === null) throw new Error(`No field ${id}`);
  field.value = value;
  field.dispatchEvent(new Event('input'));
  field.dispatchEvent(new Event('blur'));
  harness.detectChanges();
}

/**
 * Function pick
 *
 * @description
 * Picks a file in the photo input.
 *
 * @param {RouterTestingHarness} harness - The harness.
 * @param {File} file - The file.
 */
function pick(harness: RouterTestingHarness, file: File): void {
  const input: HTMLInputElement | null = byTestId(
    harness,
    'profile-photo-input',
  ) as HTMLInputElement | null;
  if (input === null) throw new Error('No photo input');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

/**
 * Function presenceCard
 *
 * @description
 * A card of the presence picker by its label.
 *
 * @param {string} label - The card's label.
 * @returns {HTMLElement | undefined} The card.
 */
function presenceCard(label: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('cw-radio-group-item')].find(
    (card: HTMLElement) => card.textContent.includes(label),
  );
}

/**
 * Function open
 *
 * @description
 * Opens the profile section and waits for the account.
 *
 * @returns {Promise<RouterTestingHarness>} The harness.
 */
async function open(): Promise<RouterTestingHarness> {
  const harness: RouterTestingHarness = await RouterTestingHarness.create(
    '/atelier-nord/account/profile',
  );
  await expect
    .poll(() => (byTestId(harness, 'profile-name') as HTMLInputElement | null)?.value)
    .toBe('Camille Martin');
  return harness;
}

/**
 * Constant createObjectURL
 *
 * @description
 * The environment's own `URL.createObjectURL`, restored after each test.
 *
 * @type {typeof URL.createObjectURL}
 */
const createObjectURL: typeof URL.createObjectURL = URL.createObjectURL.bind(URL);

/**
 * Constant revokeObjectURL
 *
 * @description
 * The environment's own `URL.revokeObjectURL`, restored after each test.
 *
 * @type {typeof URL.revokeObjectURL}
 */
const revokeObjectURL: typeof URL.revokeObjectURL = URL.revokeObjectURL.bind(URL);

describe('ProfilePage', () => {
  let api: Record<string, Mock>;
  let toasts: { success: Mock; error: Mock; show: Mock; warning: Mock };
  let refresh: Mock;
  let signOut: { run: Mock };
  let ownStatus: WritableSignal<PresenceStatus | null>;
  let presenceStatus: WritableSignal<'disabled' | 'connected'>;
  let setPresence: Mock;

  beforeEach(() => {
    refresh = vi.fn(() => Promise.resolve());
    signOut = { run: vi.fn(() => Promise.resolve(true)) };
    ownStatus = signal<PresenceStatus | null>('online');
    presenceStatus = signal<'disabled' | 'connected'>('connected');
    setPresence = vi.fn((status: PresenceStatus) => {
      ownStatus.set(status);
    });
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
    api = {
      current: vi.fn(() => Promise.resolve(CAMILLE)),
      update: vi.fn((change: ProfileChange) =>
        Promise.resolve({ ...CAMILLE, ...change, version: 4 }),
      ),
      refusedFields: vi.fn(() => []),
      resendAvailableAt: vi.fn(() => null),
      ownedOrganizationIds: vi.fn(() => ['org-nord']),
      avatar: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
      reserveAvatar: vi.fn(() =>
        Promise.resolve({ uploadId: 'upload-1', url: 'https://files.test', fields: {} }),
      ),
      sendAvatar: vi.fn(() => Promise.resolve()),
      publishAvatar: vi.fn(() => Promise.resolve()),
      removeAvatar: vi.fn(() => Promise.resolve()),
      requestEmailChange: vi.fn(),
      confirmEmailChange: vi.fn(),
      scheduleDeletion: vi.fn(() => Promise.resolve()),
      myOrganizations: vi.fn(() =>
        Promise.resolve([
          { id: 'org-nord', name: 'Atelier Nord', owned: true },
          { id: 'org-lumen', name: 'Lumen', owned: false },
        ]),
      ),
    };
    toasts = { success: vi.fn(), error: vi.fn(), show: vi.fn(), warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: ':org/account/profile',
              component: ProfilePage,
              canDeactivate: [unsavedChangesGuard],
            },
            { path: ':org/account/security', component: OtherSection },
            { path: 'logged-out', component: OtherSection },
          ],
          withErrorBoundaries({ defaultErrorComponent: RouteErrorBoundary }),
        ),
        { provide: ProfileApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        { provide: SignOut, useValue: signOut },
        {
          provide: RuntimeConfigStore,
          useValue: { config: () => ({ apiUrl: 'http://api.test' }) },
        },
        {
          provide: ReauthenticationService,
          useValue: { run: <T>(operation: () => Promise<T>): Promise<T> => operation() },
        },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            user: () => ({ id: 'u-camille', name: 'Camille Martin' }),
            organization: () => ({ id: 'org-nord', slug: 'atelier-nord', name: 'Atelier Nord' }),
          },
        },
        { provide: WORKSPACE_REFRESH, useValue: { refresh } },
        {
          provide: PRESENCE,
          useValue: { ownStatus, status: presenceStatus, setPresence },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    document.body.innerHTML = '';
  });

  it('shows the loading state until the account arrives', async () => {
    let answer: (profile: AccountProfile) => void = (): void => undefined;
    api['current'].mockReturnValue(
      new Promise<AccountProfile>((resolve: (profile: AccountProfile) => void) => {
        answer = resolve;
      }),
    );
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/account/profile',
    );

    const loading: Element | null =
      harness.routeNativeElement?.querySelector('[role="status"]') ?? null;
    expect(loading?.getAttribute('aria-label')).toBe('Loading the section');
    expect(loading?.getAttribute('aria-busy')).toBe('true');

    answer(CAMILLE);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent ?? '';
      })
      .toContain('Personal information');
    expect(harness.routeNativeElement?.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the saved account and only the parts the contract serves', async () => {
    const harness: RouterTestingHarness = await open();
    const text: string = harness.routeNativeElement?.textContent ?? '';

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Profile');
    expect((byTestId(harness, 'profile-email') as HTMLInputElement).value).toBe(
      'camille.martin@ateliernord.fr',
    );
    expect(text).toContain('Verified');
    expect(byTestId(harness, 'profile-display-name-help')?.textContent).toContain(
      'Used for mentions: @camille',
    );
    expect(byTestId(harness, 'profile-time-zone')?.textContent).toContain('Europe/Paris (UTC');
    expect(byTestId(harness, 'profile-photo-tile')?.textContent.trim()).toBe('CM');
    expect(byTestId(harness, 'profile-photo-remove')).toHaveProperty('disabled', true);
    expect(text).toContain('Import a photo');
    expect(byTestId(harness, 'profile-unsaved')).toBeNull();
    expect(byTestId(harness, 'profile-save')).toHaveProperty('disabled', true);
    expect(text).not.toContain('Status message');
    expect(text).not.toContain('Clear after');
    expect(
      presenceCard('Active')?.querySelector('[role="radio"]')?.getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('retries a failed read through the route boundary', async () => {
    api['current'].mockRejectedValueOnce(problem(503, 'upstream.unavailable'));
    const harness: RouterTestingHarness = await RouterTestingHarness.create(
      '/atelier-nord/account/profile',
    );

    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent ?? '';
      })
      .toContain('Retry');
    [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button: HTMLButtonElement) => button.textContent.trim() === 'Retry')
      ?.click();

    await expect
      .poll(() => (byTestId(harness, 'profile-name') as HTMLInputElement | null)?.value)
      .toBe('Camille Martin');
    expect(api['current']).toHaveBeenCalledTimes(2);
  });

  it('shows the unsaved changes, which Cancel drops', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'profile-job-title', 'Head of product');
    expect(byTestId(harness, 'profile-unsaved')?.textContent).toContain('Unsaved changes');

    byTestId(harness, 'profile-cancel')?.click();
    harness.detectChanges();

    expect((byTestId(harness, 'profile-job-title') as HTMLInputElement).value).toBe('Product lead');
    expect(byTestId(harness, 'profile-unsaved')).toBeNull();
  });

  it('saves only what changed, toasts it and asks the workspace to verify the person', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'profile-display-name', ' cam ');
    type(harness, 'profile-job-title', '');
    expect(byTestId(harness, 'profile-display-name-help')?.textContent).toContain('@cam');
    byTestId(harness, 'profile-save')?.click();

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(api['update']).toHaveBeenCalledWith(
      { displayName: 'cam', jobTitle: null },
      3,
      'u-camille',
    );
    expect(toasts.success).toHaveBeenCalledWith('Profile saved', {
      description: 'Your colleagues will see the changes right away.',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(byTestId(harness, 'profile-unsaved')).toBeNull();
  });

  it('shows the errors of an invalid submit and sends nothing', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'profile-name', '   ');
    byTestId(harness, 'profile-save')?.click();

    await expect
      .poll(() => byTestId(harness, 'profile-name-error')?.textContent)
      .toContain('Enter your full name.');
    expect(document.activeElement).toBe(byTestId(harness, 'profile-name'));
    expect(api['update']).not.toHaveBeenCalled();
  });

  it('merges a newer account into the draft after a stale version and toasts the conflict', async () => {
    api['update'].mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api['current']
      .mockResolvedValueOnce(CAMILLE)
      .mockResolvedValueOnce({ ...CAMILLE, jobTitle: 'Designer', name: 'Camille M.', version: 5 });
    const harness: RouterTestingHarness = await open();

    type(harness, 'profile-name', 'Camille Martin-Roux');
    byTestId(harness, 'profile-save')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error.mock.calls[0]?.[0]).toBe('Your profile changed in the meantime');
    expect((byTestId(harness, 'profile-name') as HTMLInputElement).value).toBe(
      'Camille Martin-Roux',
    );
    expect((byTestId(harness, 'profile-job-title') as HTMLInputElement).value).toBe('Designer');
  });

  it('counts a save whose answer was lost as saved when the account holds it', async () => {
    api['update'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api['current']
      .mockResolvedValueOnce(CAMILLE)
      .mockResolvedValueOnce({ ...CAMILLE, jobTitle: 'Head of product', version: 4 });
    const harness: RouterTestingHarness = await open();

    type(harness, 'profile-job-title', 'Head of product');
    byTestId(harness, 'profile-save')?.click();

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(toasts.success.mock.calls[0]?.[0]).toBe('Profile saved');
  });

  it('asks before leaving unsaved edits', async () => {
    const harness: RouterTestingHarness = await open();

    type(harness, 'profile-job-title', 'Head of product');
    void TestBed.inject(Router).navigateByUrl('/atelier-nord/account/security');

    await expect
      .poll(() => document.querySelector('[role="alertdialog"]')?.textContent ?? '')
      .toContain('Discard unsaved changes?');
  });

  it('uploads a photo and toasts it with the file name', async () => {
    api['current']
      .mockResolvedValueOnce(CAMILLE)
      .mockResolvedValueOnce({ ...CAMILLE, avatarId: 'avatar-1', version: 4 });
    const harness: RouterTestingHarness = await open();

    pick(harness, new File(['png'], 'camille.png', { type: 'image/png' }));

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(api['publishAvatar']).toHaveBeenCalledWith('upload-1', 3, 'u-camille');
    expect(toasts.success).toHaveBeenCalledWith('Photo updated', {
      description: 'camille.png is visible to the members of your organizations.',
    });
    await expect
      .poll(() => byTestId(harness, 'profile-photo-tile')?.querySelector('img')?.src)
      .toBe('blob:photo');
  });

  it('refuses another file type before sending anything', async () => {
    const harness: RouterTestingHarness = await open();

    pick(harness, new File(['gif'], 'camille.gif', { type: 'image/gif' }));

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('Unsupported format', {
      description: 'Choose a PNG, JPEG or WebP image.',
    });
    expect(api['reserveAvatar']).not.toHaveBeenCalled();
  });

  it('removes the photo and toasts the initials', async () => {
    api['current']
      .mockResolvedValueOnce({ ...CAMILLE, avatarId: 'avatar-1' })
      .mockResolvedValueOnce(CAMILLE);
    const harness: RouterTestingHarness = await open();

    await expect
      .poll(() => byTestId(harness, 'profile-photo-remove')?.hasAttribute('disabled'))
      .toBe(false);
    byTestId(harness, 'profile-photo-remove')?.click();

    await expect.poll(() => toasts.success.mock.calls.length).toBe(1);
    expect(toasts.success).toHaveBeenCalledWith('Photo removed', {
      description: 'Your initials show instead.',
    });
    expect(api['removeAvatar']).toHaveBeenCalledWith(3, 'u-camille');
  });

  it('sets a picked presence and toasts it', async () => {
    const harness: RouterTestingHarness = await open();

    presenceCard('Away')?.querySelector<HTMLElement>('[role="radio"]')?.click();
    harness.detectChanges();

    expect(setPresence).toHaveBeenCalledWith('away');
    expect(toasts.show).toHaveBeenCalledWith('Status: Away', {
      description: 'You appear away.',
    });
  });

  it('toasts a presence the gateway refused', async () => {
    setPresence.mockImplementation((status: PresenceStatus) => {
      ownStatus.set(status);
    });
    const harness: RouterTestingHarness = await open();

    presenceCard('Invisible')?.querySelector<HTMLElement>('[role="radio"]')?.click();
    harness.detectChanges();
    ownStatus.set('online');
    harness.detectChanges();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error.mock.calls[0]?.[0]).toBe('The status could not be changed');
  });

  it('disables the presence while realtime is off', async () => {
    presenceStatus.set('disabled');
    const harness: RouterTestingHarness = await open();

    expect(byTestId(harness, 'profile-status-unavailable')?.textContent).toContain(
      'The status cannot be changed right now.',
    );
  });

  it('names the organizations to leave and to hand over, then deletes and signs out', async () => {
    const harness: RouterTestingHarness = await open();

    byTestId(harness, 'profile-delete')?.click();
    await expect
      .poll(() => document.querySelector('[role="alertdialog"]')?.textContent ?? '')
      .toContain('Delete the account of Camille Martin?');
    const dialog: Element | null = document.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain('You will leave 2 organizations.');
    expect(dialog?.textContent).toContain('Atelier Nord must first have another owner.');

    const field: HTMLInputElement | null = dialog?.querySelector('input') ?? null;
    if (field === null) throw new Error('No confirmation field');
    field.value = 'Camille Martin';
    field.dispatchEvent(new Event('input'));
    harness.detectChanges();
    document.querySelector<HTMLElement>('[data-testid="account-deletion-confirm"]')?.click();

    await expect.poll(() => signOut.run.mock.calls.length).toBe(1);
    expect(api['scheduleDeletion']).toHaveBeenCalledWith('u-camille');
  });

  it('toasts the organizations still owned when the deletion is refused', async () => {
    api['scheduleDeletion'].mockRejectedValueOnce(
      problem(409, 'account.organization-owner', { organizationIds: ['org-nord'] }),
    );
    const harness: RouterTestingHarness = await open();

    byTestId(harness, 'profile-delete')?.click();
    await expect.poll(() => document.querySelector('[role="alertdialog"] input')).not.toBeNull();
    const field: HTMLInputElement | null = document.querySelector('[role="alertdialog"] input');
    if (field === null) throw new Error('No confirmation field');
    field.value = 'Camille Martin';
    field.dispatchEvent(new Event('input'));
    harness.detectChanges();
    document.querySelector<HTMLElement>('[data-testid="account-deletion-confirm"]')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error).toHaveBeenCalledWith('The account could not be deleted', {
      description: 'Transfer the ownership of Atelier Nord first.',
    });
    expect(signOut.run).not.toHaveBeenCalled();
  });

  it('opens nothing when the organizations cannot be read', async () => {
    api['myOrganizations'].mockRejectedValueOnce(problem(503, 'upstream.unavailable'));
    const harness: RouterTestingHarness = await open();

    byTestId(harness, 'profile-delete')?.click();

    await expect.poll(() => toasts.error.mock.calls.length).toBe(1);
    expect(toasts.error.mock.calls[0]?.[0]).toBe('Your organizations could not be loaded');
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('keeps the draft unsaved with a note when a lost save cannot be confirmed', async () => {
    api['update'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    const harness: RouterTestingHarness = await open();
    vi.useFakeTimers();

    type(harness, 'profile-job-title', 'Head of product');
    byTestId(harness, 'profile-save')?.click();
    await vi.advanceTimersByTimeAsync(15_000);
    vi.useRealTimers();

    await expect
      .poll(() => byTestId(harness, 'profile-save-unconfirmed')?.textContent)
      .toContain('Your change could not be confirmed.');
    expect(byTestId(harness, 'profile-unsaved')).not.toBeNull();
    expect((byTestId(harness, 'profile-job-title') as HTMLInputElement).value).toBe(
      'Head of product',
    );
    expect(toasts.error).not.toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('waits for a photo upload on its way before leaving, so the photo is not dropped', async () => {
    let publish: () => void = (): void => undefined;
    api['publishAvatar'].mockReturnValueOnce(
      new Promise<void>((resolve: () => void) => {
        publish = resolve;
      }),
    );
    api['current']
      .mockResolvedValueOnce(CAMILLE)
      .mockResolvedValueOnce({ ...CAMILLE, avatarId: 'avatar-1', version: 4 });
    const harness: RouterTestingHarness = await open();

    pick(harness, new File(['png'], 'camille.png', { type: 'image/png' }));
    await expect.poll(() => api['publishAvatar'].mock.calls.length).toBe(1);
    const leaving: Promise<boolean> = TestBed.inject(Router).navigateByUrl(
      '/atelier-nord/account/security',
    );
    await new Promise<void>((resolve: () => void) => {
      setTimeout(resolve, 50);
    });
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/account/profile');

    publish();

    expect(await leaving).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/atelier-nord/account/security');
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('offers to read the photo again when it could not be loaded', async () => {
    api['current'].mockResolvedValue({ ...CAMILLE, avatarId: 'avatar-1' });
    api['avatar'].mockRejectedValueOnce(problem(503, 'upstream.unavailable'));
    const harness: RouterTestingHarness = await open();

    await expect
      .poll(() => byTestId(harness, 'profile-photo-failed')?.textContent)
      .toContain('The photo could not be loaded.');
    byTestId(harness, 'profile-photo-retry')?.click();

    await expect
      .poll(() => byTestId(harness, 'profile-photo-tile')?.querySelector('img')?.src)
      .toBe('blob:photo');
    expect(byTestId(harness, 'profile-photo-failed')).toBeNull();
    expect(api['avatar']).toHaveBeenCalledTimes(2);
  });

  it('takes no later presence change for a refusal', async () => {
    const harness: RouterTestingHarness = await open();
    const now: number = Date.now();
    const clock: MockInstance<() => number> = vi.spyOn(Date, 'now').mockReturnValue(now);

    presenceCard('Away')?.querySelector<HTMLElement>('[role="radio"]')?.click();
    harness.detectChanges();
    ownStatus.set('do-not-disturb');
    harness.detectChanges();

    presenceCard('Invisible')?.querySelector<HTMLElement>('[role="radio"]')?.click();
    harness.detectChanges();
    clock.mockReturnValue(now + 11_000);
    ownStatus.set('do-not-disturb');
    harness.detectChanges();

    await new Promise<void>((resolve: () => void) => {
      setTimeout(resolve, 20);
    });
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('tells how to know whether a deletion whose answer was lost was scheduled', async () => {
    api['scheduleDeletion'].mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    const harness: RouterTestingHarness = await open();

    byTestId(harness, 'profile-delete')?.click();
    await expect.poll(() => document.querySelector('[role="alertdialog"] input')).not.toBeNull();
    const field: HTMLInputElement | null = document.querySelector('[role="alertdialog"] input');
    if (field === null) throw new Error('No confirmation field');
    field.value = 'Camille Martin';
    field.dispatchEvent(new Event('input'));
    harness.detectChanges();
    document.querySelector<HTMLElement>('[data-testid="account-deletion-confirm"]')?.click();

    await expect.poll(() => toasts.warning.mock.calls.length).toBe(1);
    expect(toasts.warning).toHaveBeenCalledWith('The deletion could not be confirmed', {
      description:
        'If it was scheduled, this session ends and an email tells you so. Signing in again cancels a scheduled deletion; without that email, try again.',
    });
    expect(signOut.run).not.toHaveBeenCalled();
  });
});
