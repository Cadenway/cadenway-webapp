import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { IntakeFormSettings } from '../../../models/intake-form/intake-form.interface';
import { PublicIntakeStore } from '../../../state/public-intake/public-intake.store';
import { IntakePage } from './intake-page.component';

/**
 * Constant form
 *
 * @description
 * The published Sprint 14 form, the title only.
 *
 * @type {IntakeFormSettings}
 */
const form: IntakeFormSettings = {
  title: 'Request for “Sprint 14”',
  description: null,
  fields: {
    description: 'disabled',
    priority: 'disabled',
    dueDate: 'disabled',
    contactEmail: 'disabled',
    attachments: 'disabled',
  },
};

describe('IntakePage', () => {
  let value: WritableSignal<IntakeFormSettings | undefined>;
  let sent: WritableSignal<string | null>;
  let store: { load: Mock; submit: Mock; restart: Mock };
  let fixture: ComponentFixture<IntakePage>;

  beforeEach(async () => {
    value = signal<IntakeFormSettings | undefined>(undefined);
    sent = signal<string | null>(null);
    store = {
      load: vi.fn(),
      submit: vi.fn(() => {
        sent.set('Export the invoices as CSV');
        return Promise.resolve(true);
      }),
      restart: vi.fn(() => {
        sent.set(null);
      }),
    };
    TestBed.overrideComponent(IntakePage, {
      set: {
        providers: [
          {
            provide: PublicIntakeStore,
            useValue: {
              ...store,
              form: { value },
              pending: signal(false),
              sent,
              failure: signal(null),
              unconfirmed: signal(null),
              resend: vi.fn(),
              forget: vi.fn(),
            },
          },
        ],
      },
    });
    TestBed.configureTestingModule({ imports: [IntakePage], providers: [provideCadenwayIcons()] });
    fixture = TestBed.createComponent(IntakePage);
    fixture.componentRef.setInput('publicKey', 'key');
    await fixture.whenStable();
  });

  it('shows the form skeleton while the form is read, then the form', async () => {
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
      'Loading the form',
    );
    expect(store.load).toHaveBeenCalledTimes(1);

    value.set(form);
    await fixture.whenStable();

    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
    expect(host.querySelector('h2')?.textContent).toBe('Request for “Sprint 14”');
  });

  it('sends a valid request, confirms it and offers another one', async () => {
    value.set(form);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const title: HTMLInputElement | null = host.querySelector('input');
    if (!title) throw new Error('Expected the title.');
    title.value = 'Export the invoices as CSV';
    title.dispatchEvent(new Event('input'));
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(store.submit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Export the invoices as CSV' }),
    );
    expect(host.querySelector('[data-testid="intake-sent"]')).not.toBeNull();

    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('Send another request'))
      ?.click();
    await fixture.whenStable();
    expect(store.restart).toHaveBeenCalledTimes(1);
    expect(host.querySelector('form')).not.toBeNull();
  });
});
