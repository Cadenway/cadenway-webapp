import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { GettingStartedItem } from '../../../state/getting-started/getting-started-item.interface';
import { GettingStartedStore } from '../../../state/getting-started/getting-started.store';
import { GettingStartedHost } from './getting-started-host.component';

/**
 * Interface FakeGettingStartedStore
 *
 * @description
 * The store's public API, as signals the test sets and spies.
 */
interface FakeGettingStartedStore {
  // #region Properties
  /**
   * Property visible
   *
   * @description
   * Whether the panel shows.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly visible: WritableSignal<boolean>;

  /**
   * Property expanded
   *
   * @description
   * Whether the list shows.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly expanded: WritableSignal<boolean>;

  /**
   * Property items
   *
   * @description
   * The items.
   *
   * @type {WritableSignal<readonly GettingStartedItem[]>}
   * @readonly
   */
  readonly items: WritableSignal<readonly GettingStartedItem[]>;

  /**
   * Property inviteOpen
   *
   * @description
   * Whether the invite dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly inviteOpen: WritableSignal<boolean>;

  /**
   * Property inviting
   *
   * @description
   * Whether the invitations are being sent.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly inviting: WritableSignal<boolean>;

  /**
   * Property toggle
   *
   * @description
   * Collapse toggle.
   *
   * @type {Mock}
   * @readonly
   */
  readonly toggle: Mock;

  /**
   * Property dismiss
   *
   * @description
   * Dismissal.
   *
   * @type {Mock}
   * @readonly
   */
  readonly dismiss: Mock;

  /**
   * Property start
   *
   * @description
   * Item action.
   *
   * @type {Mock}
   * @readonly
   */
  readonly start: Mock;

  /**
   * Property setInviteOpen
   *
   * @description
   * Invite dialog opening and closing.
   *
   * @type {Mock}
   * @readonly
   */
  readonly setInviteOpen: Mock;

  /**
   * Property invite
   *
   * @description
   * Invitation sending.
   *
   * @type {Mock}
   * @readonly
   */
  readonly invite: Mock;
  // #endregion
}

/**
 * Function find
 *
 * @description
 * Finds an element of the document by `data-testid`.
 *
 * @param {string} id - The test id.
 * @returns {HTMLElement | null} The element.
 */
function find(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

describe('GettingStartedHost', () => {
  let store: FakeGettingStartedStore;

  /**
   * Function render
   *
   * @description
   * Renders the host over the fake store.
   *
   * @returns {Promise<ComponentFixture<GettingStartedHost>>} The host.
   */
  async function render(): Promise<ComponentFixture<GettingStartedHost>> {
    store = {
      visible: signal(false),
      expanded: signal(true),
      items: signal<readonly GettingStartedItem[]>([
        { key: 'task', done: false },
        { key: 'invite', done: false },
        { key: 'board', done: false },
      ]),
      inviteOpen: signal(false),
      inviting: signal(false),
      toggle: vi.fn(),
      dismiss: vi.fn(),
      start: vi.fn(),
      setInviteOpen: vi.fn(),
      invite: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [GettingStartedHost],
      providers: [provideCadenwayIcons()],
    });
    TestBed.overrideComponent(GettingStartedHost, {
      set: { providers: [{ provide: GettingStartedStore, useValue: store }] },
    });
    await TestBed.compileComponents();
    const fixture: ComponentFixture<GettingStartedHost> =
      TestBed.createComponent(GettingStartedHost);
    await fixture.whenStable();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders nothing while the checklist does not show', async () => {
    await render();

    expect(find('getting-started-panel')).toBeNull();
    expect(find('onboarding-invite-dialog')).toBeNull();
  });

  it('renders the panel and hands its events to the store', async () => {
    const fixture: ComponentFixture<GettingStartedHost> = await render();

    store.visible.set(true);
    await fixture.whenStable();
    await fixture.whenStable();
    find('getting-started-toggle')?.click();
    find('getting-started-dismiss')?.click();
    find('getting-started-item-invite')?.click();

    expect(find('getting-started-panel')).not.toBeNull();
    expect(store.toggle).toHaveBeenCalledTimes(1);
    expect(store.dismiss).toHaveBeenCalledTimes(1);
    expect(store.start).toHaveBeenCalledWith('invite');
  });

  it('removes the panel once it no longer shows', async () => {
    const fixture: ComponentFixture<GettingStartedHost> = await render();
    store.visible.set(true);
    await fixture.whenStable();

    store.visible.set(false);
    await fixture.whenStable();

    expect(find('getting-started-panel')).toBeNull();
  });

  it('opens the invite dialog and sends its addresses through the store', async () => {
    const fixture: ComponentFixture<GettingStartedHost> = await render();

    store.inviteOpen.set(true);
    await fixture.whenStable();
    await fixture.whenStable();
    const field: HTMLInputElement = find('onboarding-invite-email') as HTMLInputElement;
    field.value = 'ines.robert@ateliernord.fr';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    find('onboarding-invite-add')?.click();
    await fixture.whenStable();
    find('onboarding-invite-submit')?.click();

    expect(store.invite).toHaveBeenCalledWith(['ines.robert@ateliernord.fr']);
  });
});
