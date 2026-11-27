import { Component, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { STATUS_ORDER } from '../../../constants/statuses/statuses.constants';
import type { StatusKey } from '../../../models/list-view-config/list-view-config.interface';
import type { SpaceDetails, SpaceStatusOption } from '../../../models/space/space.interface';
import { SpaceStatusesStore } from '../../../state/space-statuses/space-statuses.store';
import { SpaceStatusesDialog } from './space-statuses-dialog.component';

/**
 * Component SpaceStatusesDialogHost
 *
 * @description
 * Opens the dialog on a space a test sets.
 */
@Component({
  selector: 'cw-space-statuses-dialog-host',
  imports: [SpaceStatusesDialog],
  template: `<cw-space-statuses-dialog [(open)]="open" [space]="space()" />`,
})
class SpaceStatusesDialogHost {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog shows.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  public readonly open: WritableSignal<boolean> = signal(false);

  /**
   * Property space
   *
   * @description
   * The space bound, or null.
   *
   * @type {WritableSignal<SpaceDetails | null>}
   * @readonly
   */
  public readonly space: WritableSignal<SpaceDetails | null> = signal<SpaceDetails | null>(null);
  // #endregion
}

/**
 * Constant product
 *
 * @description
 * The `Product` space of Atelier Nord.
 *
 * @type {SpaceDetails}
 */
const product: SpaceDetails = {
  id: 'sp-product',
  name: 'Product',
  prefix: 'CAD',
  canEdit: true,
  callerRole: 'edit',
  canManage: true,
  version: 7,
  description: null,
  icon: 'rocket',
  color: 'violet',
  private: false,
  statuses: [],
};

describe('SpaceStatusesDialog', () => {
  let fixture: ComponentFixture<SpaceStatusesDialogHost>;
  let statuses: WritableSignal<readonly SpaceStatusOption[]>;
  let spaceId: WritableSignal<string | null>;
  let canEdit: WritableSignal<boolean>;
  let store: Record<string, unknown>;
  let error: Mock;
  let dismiss: Mock;

  beforeEach(() => {
    statuses = signal<readonly SpaceStatusOption[]>(
      STATUS_ORDER.map((key: StatusKey): SpaceStatusOption => ({
        key,
        name: key === 'review' ? 'Code review' : null,
        hidden: key === 'testing',
      })),
    );
    spaceId = signal<string | null>(null);
    canEdit = signal(true);
    store = {
      spaceId,
      canEdit,
      statuses,
      usedCount: signal(9),
      saving: signal(false),
      follow: vi.fn(),
      rename: vi.fn(() => Promise.resolve('saved')),
      setUsed: vi.fn(() => Promise.resolve('saved')),
      reset: vi.fn(() => Promise.resolve('saved')),
    };
    error = vi.fn(() => 'toast-1');
    dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideCadenwayIcons(),
        { provide: CwToastService, useValue: { error, dismiss } },
      ],
    });
    TestBed.overrideComponent(SpaceStatusesDialog, {
      set: { providers: [{ provide: SpaceStatusesStore, useFactory: () => store }] },
    });
    fixture = TestBed.createComponent(SpaceStatusesDialogHost);
    fixture.detectChanges();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node: Element) => {
      node.remove();
    });
  });

  /**
   * Function bind
   *
   * @description
   * Binds the space and lets the store show its statuses.
   *
   * @param {SpaceDetails} space - The space.
   */
  function bind(space: SpaceDetails): void {
    fixture.componentInstance.space.set(space);
    spaceId.set(space.id);
    fixture.detectChanges();
  }

  /**
   * Function byLabel
   *
   * @description
   * A control of the open dialog by accessible name.
   *
   * @param {string} label - Its accessible name.
   * @returns {HTMLElement} The control.
   */
  function byLabel(label: string): HTMLElement {
    const element: HTMLElement | null =
      document.querySelector<HTMLElement>(`[aria-label="${label}"]`) ??
      Array.from(document.querySelectorAll('label')).find(
        (item: HTMLLabelElement): boolean => item.textContent.trim() === label,
      )?.control ??
      null;
    if (!element) throw new Error(`No ${label}`);
    return element;
  }

  /**
   * Function byTestId
   *
   * @description
   * An element of the open dialog by test id.
   *
   * @param {string} id - Test id.
   * @returns {HTMLElement} The element.
   */
  function byTestId(id: string): HTMLElement {
    const element: HTMLElement | null = document.querySelector(`[data-testid="${id}"]`);
    if (!element) throw new Error(`No ${id}`);
    return element;
  }

  it('follows the bound space and shows skeleton rows until its statuses are shown', () => {
    expect(store['follow']).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('Statuses of “”');
    expect(document.querySelector('[data-testid="space-status-todo"]')).toBeNull();

    bind(product);

    expect(document.body.textContent).toContain('Statuses of “Product”');
    expect(byTestId('space-statuses-description').textContent).toContain(
      'The categories do not change: the counts stay accurate. 9 statuses used out of 10.',
    );
  });

  it('lists the statuses by category with their names, default labels and switches', () => {
    bind(product);

    const text: string = document.body.textContent;
    expect(text).toContain('Not started');
    expect(text).toContain('Active');
    expect(text).toContain('Closed');
    const review: HTMLInputElement = byLabel('Status name In review') as HTMLInputElement;
    expect(review.value).toBe('Code review');
    expect(review.placeholder).toBe('In review');
    expect((byLabel('Status name To do') as HTMLInputElement).value).toBe('');
    expect(byLabel('Use In validation').getAttribute('aria-checked')).toBe('false');
    expect(byLabel('Stop using In review').getAttribute('aria-checked')).toBe('true');
    expect(byLabel('Stop using To do (required)')).toHaveProperty('disabled', true);
    expect(byLabel('Stop using Done (required)')).toHaveProperty('disabled', true);
  });

  it('records a name once the field changes and shows it as the store holds it', () => {
    bind(product);
    const field: HTMLInputElement = byLabel('Status name In progress') as HTMLInputElement;

    field.value = '  Doing  ';
    field.dispatchEvent(new Event('change'));

    expect(store['rename']).toHaveBeenCalledWith('progress', '  Doing  ');
    expect(field.value).toBe('');
  });

  it('uses a status again or stops using it from its switch, and resets every default', () => {
    bind(product);

    byLabel('Use In validation').click();
    byLabel('Stop using Blocked').click();
    byTestId('space-statuses-reset').click();

    expect(store['setUsed']).toHaveBeenNthCalledWith(1, 'testing', true);
    expect(store['setUsed']).toHaveBeenNthCalledWith(2, 'blocked', false);
    expect(store['reset']).toHaveBeenCalledTimes(1);
  });

  it('shows one failure toast at a time, telling a refusal from an unknown outcome', async () => {
    bind(product);
    (store['setUsed'] as Mock).mockResolvedValueOnce('refused').mockResolvedValueOnce('unknown');

    byLabel('Stop using Blocked').click();
    await Promise.resolve();
    byLabel('Stop using Waiting').click();
    await Promise.resolve();

    expect(error).toHaveBeenNthCalledWith(1, 'The statuses could not be saved');
    expect(error).toHaveBeenNthCalledWith(
      2,
      'The change could not be confirmed. Check the statuses once the connection is back.',
    );
    expect(dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('writes the recorded name back into the field when a rename is refused before a render', async () => {
    bind(product);
    const named: (key: StatusKey, name: string | null) => void = (
      key: StatusKey,
      name: string | null,
    ): void => {
      statuses.update((items: readonly SpaceStatusOption[]) =>
        items.map((item: SpaceStatusOption) => (item.key === key ? { ...item, name } : item)),
      );
    };
    (store['rename'] as Mock).mockImplementationOnce(
      async (key: StatusKey, name: string): Promise<string> => {
        named(key, name);
        await Promise.resolve();
        named(key, 'Code review');
        return 'refused';
      },
    );
    const field: HTMLInputElement = byLabel('Status name In review') as HTMLInputElement;

    field.value = 'QA';
    field.dispatchEvent(new Event('change'));
    expect(field.value).toBe('QA');
    await Promise.resolve();
    await Promise.resolve();

    expect(field.value).toBe('Code review');
    expect(error).toHaveBeenCalledWith('The statuses could not be saved');
  });

  it('sets the switch back when a change ends unsaved before a render', async () => {
    bind(product);
    (store['setUsed'] as Mock).mockResolvedValueOnce('unknown');
    const control: HTMLElement = byLabel('Stop using Blocked');

    control.click();
    fixture.detectChanges();
    expect(control.getAttribute('aria-checked')).toBe('false');
    await Promise.resolve();
    fixture.detectChanges();

    expect(control.getAttribute('aria-checked')).toBe('true');
  });

  it('disables every control for a caller who may not edit the space', () => {
    canEdit.set(false);
    bind({ ...product, canEdit: false });

    expect(byLabel('Status name In review')).toHaveProperty('disabled', true);
    expect(byLabel('Stop using In review')).toHaveProperty('disabled', true);
    expect(byTestId('space-statuses-reset')).toHaveProperty('disabled', true);
  });

  it('closes on Done', () => {
    bind(product);

    byTestId('space-statuses-done').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.open()).toBe(false);
  });
});
