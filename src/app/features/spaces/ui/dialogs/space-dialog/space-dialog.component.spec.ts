import { Component, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SpaceDetails, SpaceDraft } from '../../../models/space/space.interface';
import { prefixFromName, SpaceDialog } from './space-dialog.component';

/**
 * Component SpaceDialogHost
 *
 * @description
 * Opens the dialog with the inputs a test sets and records what it submits.
 */
@Component({
  selector: 'cw-space-dialog-host',
  imports: [SpaceDialog],
  template: `
    <cw-space-dialog
      [(open)]="open"
      [space]="space()"
      organizationName="Atelier Nord"
      [takenPrefixes]="['DES']"
      (submitted)="drafts.push($event)"
    />
  `,
})
class SpaceDialogHost {
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
   * The space edited, or null.
   *
   * @type {WritableSignal<SpaceDetails | null>}
   * @readonly
   */
  public readonly space: WritableSignal<SpaceDetails | null> = signal<SpaceDetails | null>(null);

  /**
   * Property drafts
   *
   * @description
   * The drafts submitted.
   *
   * @type {SpaceDraft[]}
   * @readonly
   */
  public readonly drafts: SpaceDraft[] = [];
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
  canManage: false,
  version: 3,
  description: 'The product team',
  icon: 'rocket',
  color: 'violet',
  private: false,
  statuses: [],
};

describe('SpaceDialog', () => {
  let fixture: ComponentFixture<SpaceDialogHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(SpaceDialogHost);
    fixture.detectChanges();
  });

  /**
   * Function field
   *
   * @description
   * A field of the open dialog by test id.
   *
   * @param {string} id - Test id.
   * @returns {HTMLInputElement} The field.
   */
  function field(id: string): HTMLInputElement {
    const element: HTMLInputElement | null = document.querySelector(`[data-testid="${id}"]`);
    if (!element) throw new Error(`No ${id}`);
    return element;
  }

  /**
   * Function type
   *
   * @description
   * Types a value in a field.
   *
   * @param {string} id - Test id of the field.
   * @param {string} value - The value.
   */
  function type(id: string, value: string): void {
    const input: HTMLInputElement = field(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('proposes the prefix from the name, as the mockup does', () => {
    expect(prefixFromName('Human resources')).toBe('HUM');
    expect(prefixFromName('Na\u00efve')).toBe('NAI');
    expect(prefixFromName('Q')).toBe('QXX');
    expect(prefixFromName('  ')).toBe('');
  });

  it('creates a space with the proposed prefix until it is typed', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(document.body.textContent).toContain('Create a space');
    expect(field('space-dialog-submit').disabled).toBe(true);

    type('space-dialog-name', 'Human resources');
    expect(field('space-dialog-prefix').value).toBe('HUM');
    expect(field('space-dialog-prefix-hint').textContent).toContain(
      'Tasks will be numbered HUM-1, HUM-2…',
    );
    type('space-dialog-prefix', 'hr');
    type('space-dialog-name', 'People');
    expect(field('space-dialog-prefix').value).toBe('HR');
    expect(document.body.textContent).toContain('All of Atelier Nord');
    field('space-dialog-submit').click();

    expect(fixture.componentInstance.drafts).toEqual([
      {
        name: 'People',
        prefix: 'HR',
        description: null,
        icon: null,
        color: 'gris',
        private: false,
      },
    ]);
  });

  it('refuses a prefix another space uses or that is not 2 to 5 letters', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    type('space-dialog-name', 'Design');
    type('space-dialog-prefix', 'DES');

    expect(field('space-dialog-prefix-hint').textContent).toContain(
      'This prefix is already used by another space.',
    );
    expect(field('space-dialog-submit').disabled).toBe(true);
    type('space-dialog-prefix', 'D');
    expect(field('space-dialog-prefix-hint').textContent).toContain(
      'From 2 to 5 letters, without accents.',
    );
  });

  it('edits a space from its settings and keeps its prefix', () => {
    fixture.componentInstance.space.set(product);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Edit the space');
    expect(document.body.textContent).not.toContain('Confidentiality');
    type('space-dialog-name', 'Product and design');
    expect(field('space-dialog-prefix').value).toBe('CAD');
    field('space-dialog-submit').click();

    expect(fixture.componentInstance.drafts[0]).toEqual({
      name: 'Product and design',
      prefix: 'CAD',
      description: 'The product team',
      icon: 'rocket',
      color: 'violet',
      private: false,
    });
  });
});
