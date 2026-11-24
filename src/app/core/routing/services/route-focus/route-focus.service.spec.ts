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
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/one');
    expect(TestBed.inject(Title).getTitle()).toBe('One \u2014 Cadenway');
    const focus: MockInstance = vi.spyOn(HTMLElement.prototype, 'focus');
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
});
