import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { SsoPage } from './sso-page.component';

describe('SsoPage', () => {
  it('shows the format error on submit, then says when no SSO is set up for the domain', async () => {
    const startSso: Mock = vi.fn(() => Promise.resolve({ kind: 'no-sso' }));
    TestBed.configureTestingModule({
      imports: [SsoPage],
      providers: [
        provideRouter([]),
        provideCadenwayIcons(),
        { provide: AuthFlowStore, useValue: { email: signal(''), setEmail: vi.fn(), startSso } },
      ],
    });
    const fixture: ComponentFixture<SsoPage> = TestBed.createComponent(SsoPage);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;
    const input: HTMLInputElement | null = host.querySelector('#sso-email');
    if (input === null) throw new Error('Expected the work address.');

    expect(input.getAttribute('aria-describedby')).toBe('sso-email-help');
    expect(host.querySelector('#sso-email-help')?.textContent).toContain(
      'Saisissez votre adresse professionnelle, par exemple prenom.nom@ateliernord.fr.',
    );
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(host.querySelector('#sso-email-help')?.getAttribute('role')).toBe('alert');
    expect(document.activeElement).toBe(input);
    expect(startSso).not.toHaveBeenCalled();

    input.value = 'camille@gmail.com';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    host.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(startSso).toHaveBeenCalledWith('camille@gmail.com');
    expect(host.querySelector('#sso-email-help')?.textContent).toContain(
      'Aucun SSO n’est configuré pour « gmail.com » : utilisez une autre méthode de connexion.',
    );
  });
});
