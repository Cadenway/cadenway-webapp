import {
  Component,
  input,
  type InputSignal,
  resource,
  type ResourceRef,
  signal,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  withComponentInputBinding,
  withErrorBoundaries,
  withRouterConfig,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { isRouteError, UnavailableRouteError } from '@shared/route-errors';

import { IntakeFormApi } from '../../../data-access/services/intake-form-api/intake-form-api.service';
import type {
  IntakeFormConfiguration,
  IntakeFormDraft,
} from '../../../models/intake-form/intake-form.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import { FormViewStore } from '../../../state/form-view/form-view.store';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { FormViewPage } from './form-view-page.component';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the error boundary: shows the kind of the typed route error it receives.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="error">{{ kindOf(error()) }}</p>',
})
class FakeBoundary {
  // #region Properties
  /**
   * Property error
   *
   * @description
   * The error the router caught.
   *
   * @type {InputSignal<unknown>}
   * @readonly
   */
  public readonly error: InputSignal<unknown> = input<unknown>();
  // #endregion

  // #region Methods
  /**
   * Method kindOf
   *
   * @description
   * The kind of a typed route error, following the `cause` chain; `other` for any other error.
   *
   * @param {unknown} error - The caught error.
   * @returns {string} The kind.
   */
  protected kindOf(error: unknown): string {
    let current: unknown = error;
    while (current instanceof Error) {
      if (isRouteError(current)) return current.kind;
      current = current.cause;
    }
    return 'other';
  }
  // #endregion
}

/**
 * Constant settings
 *
 * @description
 * The saved Sprint 14 form settings, with the mockup's defaults.
 *
 * @type {IntakeFormDraft}
 */
const settings: IntakeFormDraft = {
  title: 'Request for “Sprint 14”',
  description: 'Describe your need.',
  fields: {
    description: 'optional',
    priority: 'optional',
    dueDate: 'optional',
    contactEmail: 'required',
    attachments: 'optional',
  },
  defaultStatus: 'triage',
  defaultAssigneeId: null,
};

/**
 * Function sprint14
 *
 * @description
 * The Sprint 14 list.
 *
 * @param {boolean} canEdit - Whether the caller can edit it.
 * @returns {TaskList} The list.
 */
function sprint14(canEdit: boolean): TaskList {
  return {
    id: 'list-sprint-14',
    spaceId: 'product',
    name: 'Sprint 14',
    icon: null,
    color: 'gris',
    sprint: null,
    archived: false,
    canEdit,
    version: 2,
  };
}

/**
 * Function valueResource
 *
 * @description
 * A resource that answers a value at once.
 *
 * @param {T} value - The value.
 * @returns {ResourceRef<T | undefined>} The resource.
 */
function valueResource<T>(value: T): ResourceRef<T | undefined> {
  return resource({ loader: (): Promise<T> => Promise.resolve(value) });
}

describe('FormViewPage', () => {
  let list: WritableSignal<TaskList>;
  let api: { configuration: Mock; update: Mock; publish: Mock; disable: Mock };
  let toasts: { show: Mock; error: Mock };
  let writeText: Mock;

  beforeEach(() => {
    list = signal(sprint14(true));
    api = {
      configuration: vi.fn((): Promise<IntakeFormConfiguration> =>
        Promise.resolve({ settings, publicKey: null, version: 3 }),
      ),
      update: vi.fn(),
      publish: vi.fn((): Promise<IntakeFormConfiguration> =>
        Promise.resolve({ settings, publicKey: 'k'.repeat(43), version: 4 }),
      ),
      disable: vi.fn(),
    };
    toasts = { show: vi.fn(), error: vi.fn() };
    writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal(
      'navigator',
      Object.assign(Object.create(navigator) as Navigator, { clipboard: { writeText } }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        provideRouter(
          [
            {
              path: 'l/:listId/form',
              providers: [
                FormViewStore,
                {
                  provide: ListPageStore,
                  useFactory: () => ({
                    list: { hasValue: () => true, value: list },
                    space: valueResource(null),
                    organizationMembers: valueResource([
                      { userId: 'u-cm', name: 'Camille Martin' },
                    ]),
                  }),
                },
              ],
              component: FormViewPage,
            },
          ],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        { provide: IntakeFormApi, useValue: api },
        { provide: CwToastService, useValue: toasts },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization: signal({ name: 'Atelier Nord', initials: 'AN' }) },
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Function open
   *
   * @description
   * Opens the `Form` view of Sprint 14 and waits until its settings or its failure show.
   *
   * @returns {Promise<RouterTestingHarness>} The harness.
   */
  async function open(): Promise<RouterTestingHarness> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/l/list-sprint-14/form');
    await settle(harness);
    return harness;
  }

  /**
   * Function settle
   *
   * @description
   * Waits until the view no longer shows its skeleton.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(harness: RouterTestingHarness): Promise<void> {
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[aria-busy="true"]') ?? null;
      })
      .toBeNull();
  }

  /**
   * Function hostOf
   *
   * @description
   * The element of the routed view.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @returns {HTMLElement} The view.
   */
  function hostOf(harness: RouterTestingHarness): HTMLElement {
    const host: HTMLElement | null = harness.routeNativeElement;
    if (!host) throw new Error('Expected the routed view.');
    return host;
  }

  /**
   * Function button
   *
   * @description
   * Finds a button by its text.
   *
   * @param {RouterTestingHarness} harness - The harness.
   * @param {string} text - Part of its text.
   * @returns {HTMLButtonElement | undefined} The button.
   */
  function button(harness: RouterTestingHarness, text: string): HTMLButtonElement | undefined {
    return Array.from(
      harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    ).find((candidate: HTMLButtonElement) => candidate.textContent.includes(text));
  }

  it('shows the preview with the badge and the settings of an unpublished form', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);

    expect(api.configuration).toHaveBeenCalledWith('list-sprint-14', expect.any(AbortSignal));
    expect(host.querySelector('h2')?.textContent).toBe('Request for “Sprint 14”');
    expect(host.textContent).toContain('Atelier Nord');
    expect(host.querySelector('[data-testid="form-view-address"]')?.textContent).toContain(
      'Not published',
    );
    expect(host.querySelector<HTMLInputElement>('#form-view-title')?.value).toBe(
      'Request for “Sprint 14”',
    );
    expect(host.querySelector('[data-testid="form-view-destination"]')?.textContent).toContain(
      'Each request becomes a task of “Sprint 14”.',
    );
    expect(button(harness, 'Copy the public link')?.disabled).toBe(true);
    const switches: string[] = Array.from(host.querySelectorAll('[role="switch"]')).map(
      (element: Element) => element.getAttribute('aria-label') ?? '',
    );
    expect(switches).toContain('Hide the field Due date');
  });

  it('changes the preview at once when a field is hidden', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);
    const dueSwitch: HTMLElement | undefined = Array.from(
      host.querySelectorAll<HTMLElement>('[role="switch"]'),
    ).find(
      (element: HTMLElement) => element.getAttribute('aria-label') === 'Hide the field Due date',
    );

    dueSwitch?.click();
    harness.detectChanges();

    expect(host.querySelector('form')?.textContent).not.toContain('Due date');
  });

  it('never sends from the preview, and says so', async () => {
    const harness: RouterTestingHarness = await open();
    const host: HTMLElement = hostOf(harness);
    const title: HTMLInputElement | null = host.querySelector('form input');
    if (!title) throw new Error('Expected the preview title.');
    title.value = 'Export the invoices as CSV';
    title.dispatchEvent(new Event('input'));
    const email: HTMLInputElement | null = host.querySelector('form input[type="email"]');
    if (!email) throw new Error('Expected the preview address.');
    email.value = 'camille.martin@ateliernord.fr';
    email.dispatchEvent(new Event('input'));
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();

    expect(toasts.show).toHaveBeenCalledWith('Preview only: the request was not sent', {
      description: 'Requests are sent from the public page.',
    });
  });

  it('publishes the form, then copies its public link', async () => {
    const harness: RouterTestingHarness = await open();

    button(harness, 'Publish the form')?.click();
    await expect.poll(() => button(harness, 'Unpublish the form')).toBeDefined();
    harness.detectChanges();
    const link: string = `${location.origin}/f/${'k'.repeat(43)}`;
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="form-view-address"]')?.textContent,
    ).toContain(link.replace(/^https?:\/\//u, ''));

    button(harness, 'Copy the public link')?.click();
    await expect.poll(() => toasts.show.mock.calls.length).toBe(1);
    expect(writeText).toHaveBeenCalledWith(link);
    expect(toasts.show).toHaveBeenCalledWith('Public link copied', { description: link });
  });

  it('hides the settings in the preview until it is closed', async () => {
    const harness: RouterTestingHarness = await open();

    button(harness, 'Open the preview')?.click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('aside')).toBeNull();

    button(harness, 'Close the preview')?.click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('aside')).not.toBeNull();
  });

  it('shows an empty state and reads nothing for a list the caller cannot edit', async () => {
    list.set(sprint14(false));

    const harness: RouterTestingHarness = await open();

    expect(
      harness.routeNativeElement?.querySelector('[data-testid="form-view-read-only"]')?.textContent,
    ).toContain('Only the list’s editors can set up its request form.');
    expect(api.configuration).not.toHaveBeenCalled();
  });

  it('renders the route boundary on a failed read, and reads again on Retry', async () => {
    api.configuration.mockRejectedValueOnce(new UnavailableRouteError(503, 'req-7'));

    const harness: RouterTestingHarness = await open();
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.textContent.trim();
      })
      .toBe('unavailable');

    await harness.navigateByUrl('/l/list-sprint-14/form');
    await settle(harness);
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('h2')?.textContent;
      })
      .toBe('Request for “Sprint 14”');
    expect(api.configuration).toHaveBeenCalledTimes(2);
  });
});
