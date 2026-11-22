import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { FederatedSignInForm } from './federated-sign-in-form.component';

describe('FederatedSignInForm', () => {
  it('emits the selected provider with the session preference', async () => {
    TestBed.configureTestingModule({
      imports: [FederatedSignInForm],
      providers: [provideCadenwayIcons()],
    });
    const fixture: ComponentFixture<FederatedSignInForm> =
      TestBed.createComponent(FederatedSignInForm);
    fixture.componentRef.setInput('rememberMe', true);
    const started: Mock = vi.fn();
    fixture.componentInstance.started.subscribe(started);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const buttons: HTMLButtonElement[] = Array.from(host.querySelectorAll('button'));
    buttons.find((button) => button.textContent.includes('GitHub'))?.click();
    expect(started).toHaveBeenCalledWith({ provider: 'github', rememberMe: true });
  });

  it('enables SAML only after a valid work address and sends it once', async () => {
    TestBed.configureTestingModule({
      imports: [FederatedSignInForm],
      providers: [provideCadenwayIcons()],
    });
    const fixture: ComponentFixture<FederatedSignInForm> =
      TestBed.createComponent(FederatedSignInForm);
    const started: Mock = vi.fn();
    fixture.componentInstance.started.subscribe(started);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const ssoButton: HTMLButtonElement | undefined = Array.from(
      host.querySelectorAll('button'),
    ).find((button) => button.textContent.includes("SSO de l'entreprise"));
    ssoButton?.click();
    await fixture.whenStable();
    const input: HTMLInputElement | null = host.querySelector<HTMLInputElement>('#sso-email');
    const submitButton: HTMLButtonElement | null =
      host.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitButton?.disabled).toBe(true);
    expect(input).not.toBeNull();
    if (!input) throw new Error('Expected the SSO email input.');
    input.value = 'camille@example.test';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(submitButton?.disabled).toBe(false);
    host
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(started).toHaveBeenCalledOnce();
    expect(started).toHaveBeenCalledWith({
      provider: 'saml',
      email: 'camille@example.test',
      rememberMe: false,
    });
  });
});
