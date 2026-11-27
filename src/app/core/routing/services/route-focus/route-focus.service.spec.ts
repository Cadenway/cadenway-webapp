import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it, vi, type MockInstance } from 'vitest';

import { provideAppRouting } from '../../providers/routing/routing.provider';
import { RouteFocusService } from './route-focus.service';

/**
 * Component RouteFixture
 *
 * @description
 * Provides a route focus target for navigation tests.
 */
@Component({ template: '<h1 data-route-focus>Page</h1>' })
class RouteFixture {}

/**
 * Component EmptyFixture
 *
 * @description
 * Route without an explicit focus target.
 */
@Component({ template: '' })
class EmptyFixture {}

/**
 * Function openModal
 *
 * @description
 * Appends a modal window with a focusable title to the document.
 *
 * @returns {HTMLElement} The modal window.
 */
function openModal(): HTMLElement {
  const modal: HTMLElement = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const title: HTMLElement = document.createElement('h2');
  title.tabIndex = -1;
  modal.append(title);
  document.body.append(modal);
  return modal;
}

/**
 * Function settle
 *
 * @description
 * Lets the mutation observers and the next task run.
 *
 * @returns {Promise<void>} Resolves after the next task.
 */
async function settle(): Promise<void> {
  await new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve);
  });
  await new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve);
  });
}

describe('route infrastructure', () => {
  it('sets titles and focuses only after a path change', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'one', component: RouteFixture, title: 'One' },
          { path: 'two', component: RouteFixture },
        ]),
        provideAppRouting(),
      ],
    });
    TestBed.inject(RouteFocusService);
    const focus: MockInstance = vi.spyOn(HTMLElement.prototype, 'focus');
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/one');
    expect(TestBed.inject(Title).getTitle()).toBe('One \u2014 Cadenway');
    expect(focus).not.toHaveBeenCalled();
    await harness.navigateByUrl('/one?task=1');
    harness.detectChanges();
    TestBed.tick();
    expect(focus).not.toHaveBeenCalled();
    await harness.navigateByUrl('/two');
    harness.detectChanges();
    TestBed.tick();
    expect(TestBed.inject(Title).getTitle()).toBe('Cadenway');
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.querySelector('[data-route-focus]')?.getAttribute('tabindex')).toBe('-1');
    expect(TestBed.inject(Router).url).toBe('/two');
    focus.mockRestore();
  });
  it('moves the focus behind a modal window that holds it only once the window closed', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'one', component: RouteFixture },
          { path: 'two', component: RouteFixture },
        ]),
        provideAppRouting(),
      ],
    });
    TestBed.inject(RouteFocusService);
    const modal: HTMLElement = openModal();
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/one');
    modal.querySelector('h2')?.focus();
    const focus: MockInstance = vi.spyOn(HTMLElement.prototype, 'focus');
    await harness.navigateByUrl('/two');
    harness.detectChanges();
    TestBed.tick();
    await settle();
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(modal.querySelector('h2'));
    modal.remove();
    await settle();
    expect(focus.mock.contexts.at(-1)).toBe(document.querySelector('h1[data-route-focus]'));
    expect(document.activeElement).toBe(document.querySelector('h1[data-route-focus]'));
    focus.mockRestore();
  });
  it('waits for every modal window and stops waiting on the next navigation', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'one', component: RouteFixture },
          { path: 'two', component: RouteFixture },
        ]),
        provideAppRouting(),
      ],
    });
    TestBed.inject(RouteFocusService);
    const modal: HTMLElement = openModal();
    const other: HTMLElement = openModal();
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/one');
    modal.querySelector('h2')?.focus();
    const focus: MockInstance = vi.spyOn(HTMLElement.prototype, 'focus');
    await harness.navigateByUrl('/two');
    harness.detectChanges();
    TestBed.tick();
    modal.remove();
    await settle();
    expect(focus).not.toHaveBeenCalled();
    other.querySelector('h2')?.focus();
    focus.mockClear();
    await harness.navigateByUrl('/one');
    harness.detectChanges();
    TestBed.tick();
    other.remove();
    await settle();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.contexts.at(-1)).toBe(document.querySelector('h1[data-route-focus]'));
    focus.mockRestore();
  });
  it('drops the focus move queued after the modal windows closed once destroyed', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'one', component: RouteFixture },
          { path: 'two', component: RouteFixture },
        ]),
        provideAppRouting(),
      ],
    });
    TestBed.inject(RouteFocusService);
    const modal: HTMLElement = openModal();
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/one');
    modal.querySelector('h2')?.focus();
    const focus: MockInstance = vi.spyOn(HTMLElement.prototype, 'focus');
    await harness.navigateByUrl('/two');
    harness.detectChanges();
    TestBed.tick();
    modal.remove();
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve);
    });
    const main: HTMLElement = document.createElement('main');
    document.body.append(main);
    TestBed.resetTestingModule();
    await settle();
    expect(focus).not.toHaveBeenCalled();
    focus.mockRestore();
    main.remove();
  });
  it('prefers the innermost route target and falls back to main', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'one', component: RouteFixture },
          { path: 'two', component: RouteFixture },
          { path: 'empty', component: EmptyFixture },
        ]),
        provideAppRouting(),
      ],
    });
    TestBed.inject(RouteFocusService);
    const main: HTMLElement = document.createElement('main');
    const layout: HTMLElement = document.createElement('div');
    layout.dataset['routeFocus'] = '';
    document.body.append(main, layout);
    const focus: MockInstance = vi.spyOn(HTMLElement.prototype, 'focus');
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/one');
    await harness.navigateByUrl('/two');
    harness.detectChanges();
    TestBed.tick();
    expect(focus.mock.contexts.at(-1)).toBe(document.querySelector('h1[data-route-focus]'));
    layout.remove();
    await harness.navigateByUrl('/empty');
    harness.detectChanges();
    TestBed.tick();
    expect(focus.mock.contexts.at(-1)).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
    focus.mockRestore();
    main.remove();
  });
});
