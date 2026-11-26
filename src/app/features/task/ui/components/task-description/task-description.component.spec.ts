import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskDescription } from './task-description.component';

describe('TaskDescription', () => {
  let fixture: ComponentFixture<TaskDescription>;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(TaskDescription);
    fixture.componentRef.setInput('markdown', 'Kept text');
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('shows no notice for the confirmed description', () => {
    expect(host.querySelector('[data-testid="task-description-restored"]')).toBeNull();
  });

  it('says a draft was restored from the device and discards it on request', async () => {
    let discarded: number = 0;
    fixture.componentInstance.discarded.subscribe(() => {
      discarded++;
    });
    fixture.componentRef.setInput('restored', true);
    await fixture.whenStable();
    const notice: HTMLElement | null = host.querySelector(
      '[data-testid="task-description-restored"]',
    );

    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toContain('Unsaved changes restored from this device.');
    const discard: HTMLButtonElement | undefined = Array.from(
      notice?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    ).find((button: HTMLButtonElement) => button.textContent.trim() === 'Discard');
    discard?.click();

    expect(discarded).toBe(1);
  });
});
