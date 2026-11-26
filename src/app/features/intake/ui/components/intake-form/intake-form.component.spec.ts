import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideCadenwayIcons } from '@cadenway/icons';
import { CwDropzone } from '@cadenway/ui/components/dropzone';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  IntakeFormSettings,
  IntakeRequest,
} from '../../../models/intake-form/intake-form.interface';
import { IntakeForm } from './intake-form.component';

/**
 * Constant form
 *
 * @description
 * The Sprint 14 form with the mockup's defaults (`FORM_DEFAULT_FIELDS`), the due date hidden.
 *
 * @type {IntakeFormSettings}
 */
const form: IntakeFormSettings = {
  title: 'Request for “Sprint 14”',
  description: 'Describe your need: the team receives it as a task.',
  fields: {
    description: 'optional',
    priority: 'optional',
    dueDate: 'disabled',
    contactEmail: 'required',
    attachments: 'optional',
  },
};

/**
 * Function type
 *
 * @description
 * Types a value into a text field.
 *
 * @param {HTMLElement} host - The form.
 * @param {string} label - The field's label.
 * @param {string} value - The value.
 */
function type(host: HTMLElement, label: string, value: string): void {
  const field: HTMLInputElement | HTMLTextAreaElement | null = fieldOf(host, label);
  if (!field) throw new Error(`Expected the field ${label}.`);
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

/**
 * Function fieldOf
 *
 * @description
 * Finds a text field by the start of its label.
 *
 * @param {HTMLElement} host - The form.
 * @param {string} label - The label.
 * @returns {HTMLInputElement | HTMLTextAreaElement | null} The field.
 */
function fieldOf(host: HTMLElement, label: string): HTMLInputElement | HTMLTextAreaElement | null {
  const element: HTMLLabelElement | undefined = Array.from(
    host.querySelectorAll<HTMLLabelElement>('label'),
  ).find((candidate: HTMLLabelElement) => candidate.textContent.trim().startsWith(label));
  return element ? host.querySelector(`#${element.htmlFor}`) : null;
}

describe('IntakeForm', () => {
  let fixture: ComponentFixture<IntakeForm>;
  let host: HTMLElement;
  let submitted: IntakeRequest[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [IntakeForm],
      providers: [provideCadenwayIcons()],
    });
    fixture = TestBed.createComponent(IntakeForm);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('organization', { name: 'Atelier Nord', initials: 'AN' });
    submitted = [];
    fixture.componentInstance.submitted.subscribe((request: IntakeRequest) =>
      submitted.push(request),
    );
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('shows the badge, the heading and the shown fields, marking the optional ones', () => {
    expect(host.querySelector('[data-testid="intake-organization"]')?.textContent).toContain(
      'Atelier Nord',
    );
    expect(host.querySelector('h2')?.textContent).toBe('Request for “Sprint 14”');
    const labels: string[] = Array.from(host.querySelectorAll('label')).map(
      (label: HTMLLabelElement) => label.textContent.replace(/\s+/gu, ' ').trim(),
    );
    expect(labels).toEqual([
      'Title',
      'Description (optional)',
      'Priority (optional)',
      'Requester email',
    ]);
    expect(host.textContent).toContain('Attachment (optional)');
    expect(host.textContent).not.toContain('Due date');
  });

  it('shows the errors of an invalid send and focuses the first invalid field', async () => {
    type(host, 'Requester email', 'camille.martin');
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      '2 fields to fix before sending.',
    );
    expect(host.textContent).toContain('Enter a title.');
    expect(host.textContent).toContain(
      'Invalid email address, for example firstname.lastname@example.com.',
    );
    expect(document.activeElement).toBe(fieldOf(host, 'Title'));
    expect(submitted).toEqual([]);
  });

  it('emits a valid request, trimmed, without its hidden fields', async () => {
    type(host, 'Title', '  Export the invoices as CSV ');
    type(host, 'Requester email', ' camille.martin@ateliernord.fr ');
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(submitted).toEqual([
      {
        title: 'Export the invoices as CSV',
        description: '',
        priority: null,
        dueDate: null,
        contactEmail: 'camille.martin@ateliernord.fr',
        files: [],
      },
    ]);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('requires a file when the form requires attachments', async () => {
    fixture.componentRef.setInput('form', {
      ...form,
      fields: { ...form.fields, attachments: 'required' },
    });
    type(host, 'Title', 'Export the invoices as CSV');
    type(host, 'Requester email', 'camille.martin@ateliernord.fr');
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(host.textContent).toContain('Attach at least one file.');
    expect(host.textContent).toContain('1 field to fix before sending.');
    expect(submitted).toEqual([]);
  });

  it('shows the failure, then the confirmation and empties the form on another request', async () => {
    fixture.componentRef.setInput('failure', 'closed');
    await fixture.whenStable();
    expect(host.querySelector('[data-testid="intake-failure"]')?.textContent).toContain(
      'This form no longer accepts requests.',
    );

    type(host, 'Title', 'Export the invoices as CSV');
    fixture.componentRef.setInput('failure', null);
    fixture.componentRef.setInput('sent', 'Export the invoices as CSV');
    await fixture.whenStable();
    expect(host.querySelector('[data-testid="intake-sent"]')?.textContent).toContain(
      'Your request “Export the invoices as CSV” has been sent to the team.',
    );

    const restarted: () => void = vi.fn();
    fixture.componentInstance.restarted.subscribe(restarted);
    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('Send another request'))
      ?.click();
    fixture.componentRef.setInput('sent', null);
    await fixture.whenStable();

    expect(restarted).toHaveBeenCalledTimes(1);
    expect(fieldOf(host, 'Title')?.value).toBe('');
  });

  it('says a request could not be confirmed and offers to send it again', async () => {
    const resent: () => void = vi.fn();
    fixture.componentInstance.resent.subscribe(resent);
    fixture.componentRef.setInput('unconfirmed', 'Export the invoices as CSV');
    await fixture.whenStable();

    expect(host.querySelector('[data-testid="intake-unconfirmed"]')?.textContent).toContain(
      'Your request “Export the invoices as CSV” was sent, but its receipt could not be confirmed.',
    );
    Array.from(host.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent.includes('Send it again'))
      ?.click();
    expect(resent).toHaveBeenCalledTimes(1);
  });

  it('reports a removed file and a file replaced by one of the same name', async () => {
    const removed: File[] = [];
    fixture.componentInstance.fileRemoved.subscribe((file: File) => removed.push(file));
    const dropzone: CwDropzone = fixture.debugElement
      .query(By.directive(CwDropzone))
      .injector.get(CwDropzone);
    const first: File = new File(['log'], 'error.log', { lastModified: 1 });
    const twin: File = new File(['log'], 'error.log', { lastModified: 1 });

    dropzone.filesAdded.emit([first]);
    dropzone.filesAdded.emit([twin]);
    await fixture.whenStable();
    expect(removed).toEqual([first]);
    expect(host.querySelectorAll('[data-testid="intake-files"] li')).toHaveLength(1);

    host.querySelector<HTMLButtonElement>('button[aria-label="Remove error.log"]')?.click();
    await fixture.whenStable();
    expect(removed).toEqual([first, twin]);
  });
});
