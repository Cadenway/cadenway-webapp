import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CodeHelp } from './code-help.component';

describe('CodeHelp', () => {
  it('links the administrator request to the help page, or keeps it plain without one', async () => {
    TestBed.configureTestingModule({ imports: [CodeHelp] });
    const fixture: ComponentFixture<CodeHelp> = TestBed.createComponent(CodeHelp);
    fixture.componentRef.setInput('siteUrl', 'https://cadenway.example');
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain("Le code n'arrive pas ?");
    expect(host.querySelector('a')?.getAttribute('href')).toBe('https://cadenway.example/help');
    expect(host.querySelector('a')?.textContent).toContain("demandez à l'administrateur");

    fixture.componentRef.setInput('siteUrl', null);
    await fixture.whenStable();
    expect(host.querySelector('a')).toBeNull();
    expect(host.textContent).toContain("demandez à l'administrateur");
  });
});
