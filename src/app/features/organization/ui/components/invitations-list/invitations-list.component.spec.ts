import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it } from 'vitest';

import { InvitationsList } from './invitations-list.component';

describe('InvitationsList', () => {
  it('separates the heading from the pending count with a space', () => {
    TestBed.configureTestingModule({ providers: [provideCadenwayIcons()] });
    const fixture: ComponentFixture<InvitationsList> = TestBed.createComponent(InvitationsList);
    fixture.componentRef.setInput('invitations', []);
    fixture.componentRef.setInput('total', 0);
    fixture.detectChanges();
    const heading: HTMLElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      '#members-invitations',
    );

    expect(heading?.textContent.replace(/\s+/gu, ' ').trim()).toBe('Pending invitations 0');
  });
});
