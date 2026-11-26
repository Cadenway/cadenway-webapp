import { DOCUMENT } from '@angular/common';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it } from 'vitest';

import { HostName } from './host-name.component';

describe('HostName', () => {
  it('shows the host the page was opened from', async () => {
    TestBed.configureTestingModule({ imports: [HostName], providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<HostName> = TestBed.createComponent(HostName);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.textContent.trim()).toBe(TestBed.inject(DOCUMENT).location.host);
    expect(host.querySelector('ng-icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
