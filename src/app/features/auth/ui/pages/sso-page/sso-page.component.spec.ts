import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { AuthFlowStore } from '../../../state/auth-flow/auth-flow.store';
import { SsoPage } from './sso-page.component';

describe('SsoPage', () => {
  it('says when no SSO is set up for the domain of the work address', async () => {
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

    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
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
