import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCadenwayIcons } from '@cadenway/icons';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { CommandPalette } from '../../../services/command-palette/command-palette.service';
import { SearchRailItem } from './search-rail-item.component';

describe('SearchRailItem', () => {
  let setOpen: Mock<(open: boolean) => void>;
  let item: HTMLButtonElement;

  beforeEach(async () => {
    setOpen = vi.fn();
    TestBed.configureTestingModule({
      imports: [SearchRailItem],
      providers: [provideCadenwayIcons(), { provide: CommandPalette, useValue: { setOpen } }],
    });
    const fixture: ComponentFixture<SearchRailItem> = TestBed.createComponent(SearchRailItem);
    await fixture.whenStable();
    fixture.detectChanges();
    const button: HTMLButtonElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="search-rail-item"]',
    );
    if (!button) throw new Error('No search item');
    item = button;
  });

  it('is named `Search (Ctrl K)` and described by `Search · Ctrl K`', () => {
    expect(item.getAttribute('aria-label')).toBe('Search (Ctrl K)');
    expect(item.getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K');
    const description: string | null = item.getAttribute('aria-describedby');
    expect(description && document.getElementById(description)?.textContent.trim()).toBe(
      'Search · Ctrl K',
    );
  });

  it('opens the command palette', () => {
    item.click();

    expect(setOpen).toHaveBeenCalledWith(true);
  });
});
