import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TaskDetailOpener } from '@features/task';

import type { InboxNotification } from '../../../models/inbox-notification/inbox-notification.interface';
import { InboxDigestStore } from '../../../state/inbox-digest/inbox-digest.store';
import { InboxDigest } from './inbox-digest.component';

/**
 * Constant mention
 *
 * @description
 * Inès Robert's unread mention on CAD-482, from the mockup, twelve minutes old.
 *
 * @type {InboxNotification}
 */
const mention: InboxNotification = {
  id: 'n1',
  kind: 'mention',
  actorName: 'Inès Robert',
  actorInitials: 'IR',
  taskKey: 'CAD-482',
  taskName: 'Review of the SSO flow',
  excerpt: null,
  status: null,
  createdAt: new Date(2026, 10, 9, 11, 47, 30).toISOString(),
  read: false,
};

/**
 * Interface DigestStoreFake
 *
 * @description
 * The store's public signals and methods, set by each test.
 */
interface DigestStoreFake {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The rows shown.
   *
   * @type {WritableSignal<readonly InboxNotification[]>}
   * @readonly
   */
  readonly items: WritableSignal<readonly InboxNotification[]>;

  /**
   * Property loading
   *
   * @description
   * Whether the first read runs.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly loading: WritableSignal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the read failed.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly failed: WritableSignal<boolean>;

  /**
   * Property empty
   *
   * @description
   * Whether the page holds no notification.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly empty: WritableSignal<boolean>;

  /**
   * Property retrying
   *
   * @description
   * Whether a read sent after a failure runs.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  readonly retrying: WritableSignal<boolean>;

  /**
   * Property retry
   *
   * @description
   * Fake of `retry`.
   *
   * @type {Mock<() => void>}
   * @readonly
   */
  readonly retry: Mock<() => void>;

  /**
   * Property markRead
   *
   * @description
   * Fake of `markRead`.
   *
   * @type {Mock<(notification: InboxNotification) => Promise<boolean>>}
   * @readonly
   */
  readonly markRead: Mock<(notification: InboxNotification) => Promise<boolean>>;
  // #endregion
}

describe('InboxDigest', () => {
  let store: DigestStoreFake;
  let openTask: Mock<(taskKey: string) => Promise<boolean>>;
  let error: Mock;
  let fixture: ComponentFixture<InboxDigest>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 9, 12, 0, 0));
    store = {
      items: signal<readonly InboxNotification[]>([mention]),
      loading: signal(false),
      failed: signal(false),
      empty: signal(false),
      retrying: signal(false),
      retry: vi.fn(),
      markRead: vi.fn(() => Promise.resolve(true)),
    };
    openTask = vi.fn(() => Promise.resolve(true));
    error = vi.fn();
    TestBed.configureTestingModule({
      imports: [InboxDigest],
      providers: [
        { provide: TaskDetailOpener, useValue: { open: openTask } },
        { provide: CwToastService, useValue: { error } },
        provideCadenwayIcons(),
      ],
    });
    TestBed.overrideComponent(InboxDigest, {
      set: { providers: [{ provide: InboxDigestStore, useValue: store }] },
    });
    fixture = TestBed.createComponent(InboxDigest);
    await fixture.whenStable();
  });

  afterEach(() => {
    host().remove();
    vi.useRealTimers();
  });

  /**
   * Function host
   *
   * @description
   * The rendered digest.
   *
   * @returns {HTMLElement} Its host element.
   */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * Function button
   *
   * @description
   * A button of the digest by its visible text.
   *
   * @param {string} text - The button's text.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(text: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(
      (candidate: HTMLButtonElement) => candidate.textContent.trim() === text,
    );
  }

  it('lists the notifications in their rows', () => {
    const rows: NodeListOf<HTMLElement> = host().querySelectorAll(
      '[data-testid="inbox-digest"] [data-testid="notification-row"]',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Inès Robert');
    expect(rows[0].textContent).toContain('mentioned you');
    expect(rows[0].textContent).toContain('CAD-482');
    expect(rows[0].textContent).toContain('12 min');
    expect(rows[0].querySelector('[role="img"][aria-label="Unread"]')).not.toBeNull();
  });

  it('shows a labelled skeleton during the first read', async () => {
    store.loading.set(true);
    store.items.set([]);
    await fixture.whenStable();

    const loading: HTMLElement | null = host().querySelector('[role="status"]');
    expect(loading?.getAttribute('aria-busy')).toBe('true');
    expect(loading?.getAttribute('aria-label')).toBe('Loading the notifications');
    expect(host().querySelector('[data-testid="notification-row"]')).toBeNull();
  });

  it('tells an empty page from a failed read, whose Retry reads again', async () => {
    store.items.set([]);
    store.empty.set(true);
    await fixture.whenStable();
    expect(host().textContent).toContain('No notifications');
    expect(button('Retry')).toBeUndefined();

    store.empty.set(false);
    store.failed.set(true);
    await fixture.whenStable();
    expect(host().textContent).toContain('The notifications could not be loaded');
    expect(host().textContent).not.toContain('No notifications');

    button('Retry')?.click();
    expect(store.retry).toHaveBeenCalledTimes(1);
  });

  it('marks an opened notification read and opens its task over the page', async () => {
    host().querySelector<HTMLButtonElement>('[data-testid="notification-row"]')?.click();
    await fixture.whenStable();

    expect(store.markRead).toHaveBeenCalledWith(mention);
    expect(openTask).toHaveBeenCalledWith('CAD-482');
    expect(error).not.toHaveBeenCalled();
  });

  it('reports a refused read of an opened notification', async () => {
    store.markRead.mockResolvedValueOnce(false);

    host().querySelector<HTMLButtonElement>('[data-testid="notification-row"]')?.click();

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        'The notification could not be marked as read',
        expect.anything(),
      );
    });
    expect(openTask).toHaveBeenCalledWith('CAD-482');
  });

  it('only marks read a notification without a visible task', async () => {
    store.items.set([{ ...mention, taskKey: null, taskName: null }]);
    await fixture.whenStable();

    host().querySelector<HTMLButtonElement>('[data-testid="notification-row"]')?.click();
    await fixture.whenStable();

    expect(store.markRead).toHaveBeenCalledTimes(1);
    expect(openTask).not.toHaveBeenCalled();
  });

  /**
   * Function failRead
   *
   * @description
   * Attaches the digest to the document, shows a failed read and focuses its `Retry`.
   *
   * @returns {Promise<HTMLButtonElement>} The focused `Retry`.
   */
  async function failRead(): Promise<HTMLButtonElement> {
    document.body.append(host());
    store.items.set([]);
    store.failed.set(true);
    await fixture.whenStable();
    const retry: HTMLButtonElement | undefined = button('Retry');
    if (!retry) throw new Error('No Retry');
    retry.focus();
    return retry;
  }

  it('announces a failed read as an alert', async () => {
    await failRead();

    expect(host().querySelector('[role="alert"]')?.textContent).toContain(
      'The notifications could not be loaded',
    );
  });

  it('keeps the error and focus on a busy Retry while it reads, then focuses the digest', async () => {
    const retry: HTMLButtonElement = await failRead();
    store.retry.mockImplementation(() => {
      store.retrying.set(true);
    });

    retry.click();
    await fixture.whenStable();
    expect(store.retry).toHaveBeenCalledTimes(1);
    expect(button('Retry')).toBe(retry);
    expect(retry.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(retry);

    store.retrying.set(false);
    store.failed.set(false);
    store.items.set([mention]);
    await fixture.whenStable();

    expect(host().querySelector('[data-testid="notification-row"]')).not.toBeNull();
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
    expect(host().contains(document.activeElement)).toBe(true);
  });

  it('keeps focus on Retry when the read fails again', async () => {
    const retry: HTMLButtonElement = await failRead();
    store.retry.mockImplementation(() => {
      store.retrying.set(true);
    });

    retry.click();
    await fixture.whenStable();
    store.retrying.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(retry);
    expect(retry.getAttribute('aria-busy')).toBeNull();
  });
});
