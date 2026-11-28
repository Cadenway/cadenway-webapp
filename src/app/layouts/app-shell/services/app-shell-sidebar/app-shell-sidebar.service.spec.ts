import {
  DestroyRef,
  Injector,
  createEnvironmentInjector,
  type EnvironmentInjector,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShellSidebar } from './app-shell-sidebar.service';

/**
 * Interface FakeWidth
 *
 * @description
 * A stand-in for the window's `(width >= 64rem)` query that a test resizes.
 */
interface FakeWidth {
  // #region Methods
  /**
   * Method resize
   *
   * @description
   * Moves the window to a desktop width or below it and notifies the query's listeners.
   *
   * @param {boolean} desktop - Whether the new width is a desktop one.
   */
  resize(desktop: boolean): void;
  // #endregion
}

/**
 * Function fakeWidth
 *
 * @description
 * Replaces `window.matchMedia` with a query whose `matches` the test controls.
 *
 * @param {boolean} desktop - Whether the window starts at a desktop width.
 * @returns {FakeWidth} The control of the fake width.
 */
function fakeWidth(desktop: boolean): FakeWidth {
  const listeners: Set<(event: MediaQueryListEvent) => void> = new Set<
    (event: MediaQueryListEvent) => void
  >();
  const query: { matches: boolean } & Pick<
    MediaQueryList,
    'addEventListener' | 'removeEventListener'
  > = {
    matches: desktop,
    addEventListener: (_type: string, listener: unknown): void => {
      listeners.add(listener as (event: MediaQueryListEvent) => void);
    },
    removeEventListener: (_type: string, listener: unknown): void => {
      listeners.delete(listener as (event: MediaQueryListEvent) => void);
    },
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    resize: (next: boolean): void => {
      query.matches = next;
      for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent);
    },
  };
}

/**
 * Function setup
 *
 * @description
 * Provides the layout-scoped service and returns it.
 *
 * @returns {AppShellSidebar} The service under test.
 */
function setup(): AppShellSidebar {
  TestBed.configureTestingModule({ providers: [AppShellSidebar] });
  return TestBed.inject(AppShellSidebar);
}

describe('AppShellSidebar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens again at a desktop width after the phone drawer closed it', () => {
    const width: FakeWidth = fakeWidth(false);
    const sidebar: AppShellSidebar = setup();

    sidebar.sync('collapsed');
    expect(sidebar.expanded()).toBe(false);

    width.resize(true);
    expect(sidebar.expanded()).toBe(true);
  });

  it('keeps a desktop collapse across a visit to a phone width', () => {
    const width: FakeWidth = fakeWidth(true);
    const sidebar: AppShellSidebar = setup();

    sidebar.toggle();
    width.resize(false);
    sidebar.toggle();
    expect(sidebar.expanded()).toBe(true);

    width.resize(true);
    expect(sidebar.state()).toBe('collapsed');
  });
  it('toggles the state and requests focus once per opening it makes', () => {
    const sidebar: AppShellSidebar = setup();
    const opener: HTMLButtonElement = document.body.appendChild(document.createElement('button'));

    expect(sidebar.expanded()).toBe(true);
    sidebar.toggle();
    expect(sidebar.state()).toBe('collapsed');
    expect(sidebar.takeFocusRequest()).toBe(false);

    opener.focus();
    sidebar.toggle();
    expect(sidebar.expanded()).toBe(true);
    expect(sidebar.takeFocusRequest()).toBe(true);
    expect(sidebar.takeFocusRequest()).toBe(false);
    expect(sidebar.returnTarget()).toBe(opener);

    opener.remove();
    expect(sidebar.returnTarget()).toBeNull();
  });

  it('mirrors the state cw-sidebar reports and drops a pending focus request on collapse', () => {
    const sidebar: AppShellSidebar = setup();
    sidebar.toggle();
    sidebar.toggle();

    sidebar.sync('collapsed');

    expect(sidebar.expanded()).toBe(false);
    expect(sidebar.takeFocusRequest()).toBe(false);
  });

  it('keeps the toggle claimed while a claiming scope lives', () => {
    const sidebar: AppShellSidebar = setup();
    const screen: EnvironmentInjector = createEnvironmentInjector(
      [],
      TestBed.inject(Injector) as EnvironmentInjector,
    );

    sidebar.claimToggle(screen.get(DestroyRef));
    expect(sidebar.toggleClaimed()).toBe(true);

    screen.destroy();
    expect(sidebar.toggleClaimed()).toBe(false);
  });
});
