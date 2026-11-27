import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { describe, expect, it } from 'vitest';

import { HomeLists } from './home-lists.component';

describe('HomeLists', () => {
  it('links each list with its space and its open tasks, read with their words', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideCadenwayIcons()] });
    const fixture: ComponentFixture<HomeLists> = TestBed.createComponent(HomeLists);
    fixture.componentRef.setInput('rows', [
      {
        id: 'l-sprint-14',
        name: 'Sprint 14',
        spaceName: 'Product',
        open: 14,
        link: '/atelier-nord/l/l-sprint-14',
      },
      {
        id: 'l-research',
        name: 'Research',
        spaceName: '',
        open: 1,
        link: '/atelier-nord/l/l-research',
      },
    ]);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h2')?.textContent.trim()).toBe('Lists');
    const links: readonly HTMLAnchorElement[] = Array.from(
      host.querySelectorAll<HTMLAnchorElement>('[data-testid="home-list"]'),
    );
    expect(
      links.map((link: HTMLAnchorElement) =>
        link.textContent.replace(/\s+/gu, ' ').replace(/ ,/gu, ',').trim(),
      ),
    ).toEqual(['Sprint 14, Product, 14 open tasks', 'Research, 1 open task']);
    expect(links[0].getAttribute('href')).toBe('/atelier-nord/l/l-sprint-14');
  });
});
