import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { CodeForm } from './code-form.component';

/**
 * Function render
 *
 * @description
 * Renders the code form for `/login/code`.
 *
 * @returns {Promise<ComponentFixture<CodeForm>>} The fixture.
 */
async function render(): Promise<ComponentFixture<CodeForm>> {
  TestBed.configureTestingModule({
    imports: [CodeForm],
    providers: [provideRouter([]), provideCadenwayIcons()],
  });
  const fixture: ComponentFixture<CodeForm> = TestBed.createComponent(CodeForm);
  fixture.componentRef.setInput('submitLabel', 'Se connecter');
  fixture.componentRef.setInput('backLink', '/login');
  await fixture.whenStable();
  return fixture;
}

describe('CodeForm', () => {
  it('enables the submit button with six digits, emits the code and marks a refused one', async () => {
    const fixture: ComponentFixture<CodeForm> = await render();
    const submitted: Mock = vi.fn();
    fixture.componentInstance.codeSubmitted.subscribe(submitted);
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const submit: HTMLButtonElement | null = host.querySelector('button[type="submit"]');
    const input: HTMLInputElement | null = host.querySelector('#code-input');

    expect(submit?.disabled).toBe(true);
    if (input === null) throw new Error('Expected the code input.');
    input.value = '123456';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(submit?.disabled).toBe(false);
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(submitted).toHaveBeenCalledWith('123456');

    fixture.componentRef.setInput(
      'error',
      'Code incorrect ou expiré : vérifiez le dernier e-mail reçu.',
    );
    await fixture.whenStable();
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('code-help');
  });

  it('shows the countdown, the refusal and the resent status', async () => {
    const fixture: ComponentFixture<CodeForm> = await render();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const resend: Mock = vi.fn();
    fixture.componentInstance.resendRequested.subscribe(resend);

    fixture.componentRef.setInput('resendIn', '0:29');
    await fixture.whenStable();
    const button: HTMLButtonElement | undefined = Array.from(host.querySelectorAll('button')).find(
      (item: HTMLButtonElement) => item.textContent.includes('Renvoyer'),
    );
    expect(button?.textContent.trim()).toBe('Renvoyer le code dans 0:29');
    expect(button?.disabled).toBe(true);

    fixture.componentRef.setInput('resendIn', null);
    fixture.componentRef.setInput('resent', true);
    fixture.componentRef.setInput(
      'error',
      'Code incorrect ou expiré : vérifiez le dernier e-mail reçu.',
    );
    await fixture.whenStable();
    button?.click();
    expect(resend).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Code incorrect ou expiré');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Nouveau code envoyé');
  });
});
