import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { ProviderButtons } from './provider-buttons.component';

describe('ProviderButtons', () => {
  it('emits the chosen provider and disables the buttons while busy', async () => {
    TestBed.configureTestingModule({
      imports: [ProviderButtons],
      providers: [provideCadenwayIcons()],
    });
    const fixture: ComponentFixture<ProviderButtons> = TestBed.createComponent(ProviderButtons);
    const selected: Mock = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    await fixture.whenStable();
    const buttons: HTMLButtonElement[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    );

    expect(buttons.map((button: HTMLButtonElement) => button.textContent.trim())).toEqual([
      'Google',
      'GitHub',
      'Microsoft',
      'GitLab',
    ]);
    buttons[1]?.click();
    expect(selected).toHaveBeenCalledWith('github');

    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();
    expect(buttons.every((button: HTMLButtonElement) => button.disabled)).toBe(true);
  });
});
