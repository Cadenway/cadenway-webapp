import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  parseSheetValue,
  SheetCellEditor,
  type SheetEditorValue,
} from './sheet-cell-editor.component';

/**
 * Constant loose
 *
 * @description
 * No validation rule.
 *
 * @type {{ required: boolean; nonNegative: boolean }}
 */
const loose: { required: boolean; nonNegative: boolean } = { required: false, nonNegative: false };

describe('parseSheetValue', () => {
  it('reads an estimate in hours for a bare number and clears an empty one', () => {
    expect(parseSheetValue('3', 'duration', loose)).toBe(180);
    expect(parseSheetValue('2,5', 'duration', loose)).toBe(150);
    expect(parseSheetValue('1 h 30', 'duration', loose)).toBe(90);
    expect(parseSheetValue('', 'duration', loose)).toBeNull();
    expect(parseSheetValue('soon', 'duration', loose)).toBeUndefined();
  });

  it('refuses negative points and takes a decimal comma', () => {
    expect(parseSheetValue('-1', 'number', { required: false, nonNegative: true })).toBeUndefined();
    expect(parseSheetValue('-1', 'number', loose)).toBe(-1);
    expect(parseSheetValue('2,5', 'number', loose)).toBe(2.5);
    expect(parseSheetValue('five', 'number', loose)).toBeUndefined();
  });

  it('requires a name and trims texts', () => {
    expect(parseSheetValue('  ', 'text', { required: true, nonNegative: false })).toBeUndefined();
    expect(parseSheetValue('  Atelier Nord ', 'text', loose)).toBe('Atelier Nord');
    expect(parseSheetValue('', 'text', loose)).toBeNull();
    expect(parseSheetValue('2026-11-27', 'date', loose)).toBe('2026-11-27');
  });
});

describe('SheetCellEditor', () => {
  /**
   * Function render
   *
   * @description
   * Renders a `Points` editor of CAD-482.
   *
   * @param {string} value - The draft.
   * @returns {{ fixture: ComponentFixture<SheetCellEditor>; field: HTMLInputElement; committed: Mock<(value?: SheetEditorValue) => void>; cancelled: Mock<(value?: SheetEditorValue) => void> }} The editor.
   */
  function render(value: string): {
    fixture: ComponentFixture<SheetCellEditor>;
    field: HTMLInputElement;
    committed: Mock<(value?: SheetEditorValue) => void>;
    cancelled: Mock<(value?: SheetEditorValue) => void>;
  } {
    const fixture: ComponentFixture<SheetCellEditor> = TestBed.createComponent(SheetCellEditor);
    fixture.componentRef.setInput('label', 'Points of CAD-482');
    fixture.componentRef.setInput('kind', 'number');
    fixture.componentRef.setInput('nonNegative', true);
    fixture.componentRef.setInput('value', value);
    const committed: Mock<(value?: SheetEditorValue) => void> =
      vi.fn<(value?: SheetEditorValue) => void>();
    const cancelled: Mock<(value?: SheetEditorValue) => void> =
      vi.fn<(value?: SheetEditorValue) => void>();
    fixture.componentInstance.committed.subscribe((next: SheetEditorValue): void => {
      committed(next);
    });
    fixture.componentInstance.cancelled.subscribe((): void => {
      cancelled();
    });
    fixture.detectChanges();
    const field: HTMLInputElement | null = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLInputElement>('input[aria-label="Points of CAD-482"]');
    if (!field) throw new Error('The editor has no field named Points of CAD-482.');
    return { fixture, field, committed, cancelled };
  }

  it('keeps an invalid value open with aria-invalid on Enter', () => {
    const editor: ReturnType<typeof render> = render('-2');
    const { fixture, field, committed }: ReturnType<typeof render> = editor;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(committed).not.toHaveBeenCalled();
    field.value = '3';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(field.getAttribute('aria-invalid')).toBeNull();
  });

  it('commits a valid value on Enter and cancels an invalid one on blur', () => {
    const valid: ReturnType<typeof render> = render('5');
    valid.field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(valid.committed).toHaveBeenCalledWith(5);
    const invalid: ReturnType<typeof render> = render('-1');
    invalid.field.dispatchEvent(new FocusEvent('blur'));
    expect(invalid.cancelled).toHaveBeenCalled();
    expect(invalid.committed).not.toHaveBeenCalled();
  });
});
