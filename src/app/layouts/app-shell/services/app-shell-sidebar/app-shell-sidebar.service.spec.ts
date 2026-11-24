import {
  DestroyRef,
  Injector,
  createEnvironmentInjector,
  type EnvironmentInjector,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AppShellSidebar } from './app-shell-sidebar.service';

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
