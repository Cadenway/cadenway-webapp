import { Component, signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ListDraft } from '../../../models/task-list/task-list.interface';
import { todayIso } from '../../../utils/calendar-date/calendar-date.util';
import { addDays, ListDialog } from './list-dialog.component';

/**
 * Component ListDialogHost
 *
 * @description
 * Opens the dialog with the values a test sets and records what it submits.
 */
@Component({
  selector: 'cw-list-dialog-host',
  imports: [ListDialog],
  template: `
    <cw-list-dialog
      [(open)]="open"
      [mode]="mode()"
      [initial]="initial()"
      (submitted)="drafts.push($event)"
    />
  `,
})
class ListDialogHost {
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
   * Property mode
   *
   * @description
   * Create or edit.
   *
   * @type {WritableSignal<'create' | 'edit'>}
   * @readonly
   */
  public readonly mode: WritableSignal<'create' | 'edit'> = signal<'create' | 'edit'>('create');

  /**
   * Property initial
   *
   * @description
   * The values the dialog opens with.
   *
   * @type {WritableSignal<ListDraft>}
   * @readonly
   */
  public readonly initial: WritableSignal<ListDraft> = signal<ListDraft>({
    name: '',
    icon: null,
    color: 'gris',
    sprint: null,
  });

  /**
   * Property drafts
   *
   * @description
   * The drafts submitted.
   *
   * @type {ListDraft[]}
   * @readonly
   */
  public readonly drafts: ListDraft[] = [];
  // #endregion
}

describe('ListDialog', () => {
  let fixture: ComponentFixture<ListDialogHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(ListDialogHost);
    fixture.detectChanges();
  });

  /**
   * Function element
   *
   * @description
   * An element of the open dialog by test id.
   *
   * @param {string} id - Test id.
   * @returns {HTMLElement} The element.
   */
  function element(id: string): HTMLElement {
    const found: HTMLElement | null = document.querySelector(`[data-testid="${id}"]`);
    if (!found) throw new Error(`No ${id}`);
    return found;
  }

  it('moves a calendar date by whole days', () => {
    expect(addDays('2026-11-17', 1)).toBe('2026-11-18');
    expect(addDays('2026-11-18', 13)).toBe('2026-12-01');
  });

  it('creates a list from its name and look', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(document.body.textContent).toContain('Créer une liste');
    const submit: HTMLButtonElement = element('list-dialog-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const name: HTMLInputElement = element('list-dialog-name') as HTMLInputElement;
    name.value = '  Feuille de route ';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    submit.click();

    expect(fixture.componentInstance.drafts).toEqual([
      { name: 'Feuille de route', icon: null, color: 'gris', sprint: null },
    ]);
  });

  it('turns a list into a sprint of 14 days from today, with the lightning', () => {
    fixture.componentInstance.initial.set({
      name: 'Sprint 15',
      icon: null,
      color: 'violet',
      sprint: null,
    });
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    element('list-dialog-sprint').querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    expect(document.body.textContent).toContain('Créer un sprint');
    expect(element('list-dialog-dates').textContent).toContain('14 jours · 2 semaines');
    element('list-dialog-submit').click();

    const today: string = todayIso();
    expect(fixture.componentInstance.drafts).toEqual([
      {
        name: 'Sprint 15',
        icon: 'lightning',
        color: 'violet',
        sprint: { startDate: today, endDate: addDays(today, 13), goal: null },
      },
    ]);
  });

  it('refuses a sprint that ends before it starts', () => {
    fixture.componentInstance.mode.set('edit');
    fixture.componentInstance.initial.set({
      name: 'Sprint 14',
      icon: 'lightning',
      color: 'violet',
      sprint: { startDate: '2026-11-17', endDate: '2026-11-03', goal: 'Livrer la connexion SSO' },
    });
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Modifier le sprint');
    expect(element('list-dialog-dates').textContent).toContain('La fin doit suivre le début.');
    expect((element('list-dialog-submit') as HTMLButtonElement).disabled).toBe(true);
  });
});
