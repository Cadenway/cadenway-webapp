import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { BulkBar } from './bulk-bar.component';

describe('BulkBar', () => {
  it('renders nothing without a selection, then emits its actions', async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<BulkBar> = TestBed.createComponent(BulkBar);
    const done: Mock<() => void> = vi.fn();
    const cleared: Mock<() => void> = vi.fn();
    fixture.componentInstance.doneMarked.subscribe(() => {
      done();
    });
    fixture.componentInstance.cleared.subscribe(() => {
      cleared();
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="bulk-bar"]')).toBeNull();

    fixture.componentRef.setInput('count', 2);
    fixture.componentRef.setInput('people', [{ value: 'u1', label: 'Inès Robert' }]);
    fixture.componentRef.setInput('targets', [
      { listId: 'l-bugs', name: 'Bugs', spaceName: 'Produit' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const bar: HTMLElement | null = host.querySelector('[data-testid="bulk-bar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Actions sur la sélection');
    expect(bar?.textContent).toContain('2 sélectionnées');
    bar?.querySelector<HTMLButtonElement>('button')?.click();
    bar?.querySelector<HTMLButtonElement>('[aria-label="Annuler la sélection"]')?.click();
    expect(done).toHaveBeenCalledTimes(1);
    expect(cleared).toHaveBeenCalledTimes(1);
  });
});
