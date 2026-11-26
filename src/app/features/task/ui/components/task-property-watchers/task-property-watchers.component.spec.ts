import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { personOf } from '../../../utils/person/person.util';
import { TaskPropertyWatchers } from './task-property-watchers.component';

/**
 * Function trigger
 *
 * @description
 * The row's trigger.
 *
 * @returns {HTMLButtonElement} The trigger.
 */
function trigger(): HTMLButtonElement {
  const found: HTMLButtonElement | null = document.querySelector<HTMLButtonElement>(
    '[data-testid="task-property-watchers"]',
  );
  if (!found) throw new Error('No trigger');
  return found;
}

describe('TaskPropertyWatchers', () => {
  let fixture: ComponentFixture<TaskPropertyWatchers>;
  let toggled: string[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(TaskPropertyWatchers);
    toggled = [];
    fixture.componentInstance.toggled.subscribe((id: string) => toggled.push(id));
    fixture.componentRef.setInput('people', [
      personOf('u1', 'Camille Martin'),
      personOf('u2', 'Inès Robert'),
      personOf('u3', 'Hugo Durand'),
    ]);
    fixture.componentRef.setInput('currentUserId', 'u1');
    fixture.componentRef.setInput('watcherIds', ['u1', 'u2']);
    await fixture.whenStable();
  });

  it('draws the followers’ initials', () => {
    expect(trigger().textContent).toContain('CM');
    expect(trigger().textContent).toContain('IR');
    expect(trigger().textContent).toContain('Camille Martin, Inès Robert');
  });

  it('opens the people with the hint and emits a toggle', async () => {
    trigger().click();
    await fixture.whenStable();
    const items: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'),
    );

    expect(document.body.textContent).toContain('Notified of every change');
    expect(items[0].textContent).toContain('Camille Martin (me)');
    expect(items.map((item: HTMLElement) => item.getAttribute('aria-checked'))).toEqual([
      'true',
      'true',
      'false',
    ]);
    items[2].click();
    expect(toggled).toEqual(['u3']);
  });

  it('is read-only when disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(trigger().disabled).toBe(true);
  });
});
