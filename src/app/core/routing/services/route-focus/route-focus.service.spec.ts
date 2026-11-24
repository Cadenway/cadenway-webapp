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
