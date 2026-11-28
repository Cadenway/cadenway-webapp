import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it } from 'vitest';

import { AuditLogPage } from './audit-log-page.component';

describe('AuditLogPage', () => {
  it('shows the lead of the section and an empty state without inventing entries', () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<AuditLogPage> = TestBed.createComponent(AuditLogPage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h1')?.textContent.trim()).toBe('Audit log');
    expect(host.querySelector('header p')?.textContent).toContain(
      'Sensitive actions of the last 90 days',
    );
    expect(host.querySelector('[data-testid="audit-log-empty"]')?.textContent.trim()).toBe(
      'No action recorded',
    );
    expect(host.querySelector('table, [role="table"]')).toBeNull();
  });
});
