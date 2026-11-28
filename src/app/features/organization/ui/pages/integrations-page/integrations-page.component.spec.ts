import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it } from 'vitest';

import { IntegrationsPage } from './integrations-page.component';

describe('IntegrationsPage', () => {
  it('shows the lead of the section and an unavailable state, never an empty list', () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<IntegrationsPage> = TestBed.createComponent(IntegrationsPage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Integrations');
    expect(host.querySelector('header p')?.textContent).toContain(
      'the branches, commits and pull requests that mention an identifier',
    );
    expect(host.querySelector('[data-testid="integrations-empty"]')?.textContent.trim()).toBe(
      'Integrations are not available yet',
    );
    expect(host.querySelectorAll('section')).toHaveLength(0);
  });
});
