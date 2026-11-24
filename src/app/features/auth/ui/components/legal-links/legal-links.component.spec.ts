import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LegalLinks } from './legal-links.component';

describe('LegalLinks', () => {
  it('links Privacy, Terms of use and Help to the public site', async () => {
    const fixture: ComponentFixture<LegalLinks> = TestBed.createComponent(LegalLinks);
    fixture.componentRef.setInput('siteUrl', 'https://cadenway.example');
    await fixture.whenStable();
    const links: HTMLAnchorElement[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('a'),
    );

    expect(
      links.map((link: HTMLAnchorElement) => [link.textContent.trim(), link.getAttribute('href')]),
    ).toEqual([
      ['Confidentialité', 'https://cadenway.example/privacy'],
      ["Conditions d'utilisation", 'https://cadenway.example/terms'],
      ['Aide', 'https://cadenway.example/help'],
    ]);
  });

  it('renders nothing without a site', async () => {
    const fixture: ComponentFixture<LegalLinks> = TestBed.createComponent(LegalLinks);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('a')).toBeNull();
  });
});
