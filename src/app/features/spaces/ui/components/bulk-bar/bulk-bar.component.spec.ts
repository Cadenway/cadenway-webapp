import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { BulkBar } from './bulk-bar.component';

/**
 * Function render
 *
 * @description
 * Renders the bar for two selected tasks, Inès Robert assigned to both.
 *
 * @returns {Promise<ComponentFixture<BulkBar>>} The rendered bar.
 */
async function render(): Promise<ComponentFixture<BulkBar>> {
  TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
  const fixture: ComponentFixture<BulkBar> = TestBed.createComponent(BulkBar);
  fixture.componentRef.setInput('count', 2);
  fixture.componentRef.setInput('people', [
    { id: 'u-ines', name: 'Inès Robert', initials: 'IR', assigned: true },
    { id: 'u-hugo', name: 'Hugo Durand', initials: 'HD', assigned: false },
  ]);
  fixture.componentRef.setInput('targets', [
    {
      listId: 'l-bugs',
      name: 'Bugs',
      spaceName: 'Product',
      icon: 'phosphorListBulletsBold',
      tone: 'text-muted-foreground',
    },
  ]);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('BulkBar', () => {
  it('renders nothing without a selection', () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<BulkBar> = TestBed.createComponent(BulkBar);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="bulk-bar"]'),
    ).toBeNull();
  });

  it('emits its actions', async () => {
    const fixture: ComponentFixture<BulkBar> = await render();
    const done: Mock<() => void> = vi.fn();
    const cleared: Mock<() => void> = vi.fn();
    fixture.componentInstance.doneMarked.subscribe(() => {
      done();
    });
    fixture.componentInstance.cleared.subscribe(() => {
      cleared();
    });
    const bar: HTMLElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="bulk-bar"]',
    );

    expect(bar?.getAttribute('aria-label')).toBe('Actions on the selection');
    expect(bar?.textContent).toContain('2 selected');
    bar?.querySelector<HTMLButtonElement>('button')?.click();
    bar?.querySelector<HTMLButtonElement>('[aria-label="Cancel the selection"]')?.click();
    expect(done).toHaveBeenCalledTimes(1);
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('ticks the people every selected task has and emits the picked person', async () => {
    const fixture: ComponentFixture<BulkBar> = await render();
    const assigned: Mock<(id: string) => void> = vi.fn();
    fixture.componentInstance.assigned.subscribe((id: string) => {
      assigned(id);
    });
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const trigger: HTMLButtonElement | undefined = [
      ...host.querySelectorAll<HTMLButtonElement>('[data-testid="bulk-bar"] button'),
    ].find((button: HTMLButtonElement) => button.textContent.includes('Assign'));
    trigger?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items: HTMLButtonElement[] = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]'),
    ];

    expect(items.map((item: HTMLButtonElement) => item.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
    ]);
    items[0].click();
    expect(assigned).toHaveBeenCalledWith('u-ines');
  });
});
