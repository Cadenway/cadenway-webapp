import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, type InputSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding, withErrorBoundaries } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PublicIntakeService } from '@cadenway/api-client';
import { type Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { isRouteError } from '@shared/route-errors';

import { INTAKE_ROUTES } from './intake.routes';

/**
 * Component FakeBoundary
 *
 * @description
 * Stands in for the error boundary: shows the kind of the typed route error it receives.
 */
@Component({
  selector: 'cw-fake-boundary',
  template: '<p data-testid="error">{{ kindOf(error()) }}</p>',
})
class FakeBoundary {
  // #region Properties
  /**
   * Property error
   *
   * @description
   * The error the router caught.
   *
   * @type {InputSignal<unknown>}
   * @readonly
   */
  public readonly error: InputSignal<unknown> = input<unknown>();
  // #endregion

  // #region Methods
  /**
   * Method kindOf
   *
   * @description
   * The kind of a typed route error, following the `cause` chain; `other` for any other error.
   *
   * @param {unknown} error - The caught error.
   * @returns {string} The kind.
   */
  protected kindOf(error: unknown): string {
    let current: unknown = error;
    while (current instanceof Error) {
      if (isRouteError(current)) return current.kind;
      current = current.cause;
    }
    return 'other';
  }
  // #endregion
}

describe('INTAKE_ROUTES', () => {
  let read: Mock<(key: string) => Observable<unknown>>;

  beforeEach(() => {
    read = vi.fn<(key: string) => Observable<unknown>>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'f', children: INTAKE_ROUTES }],
          withComponentInputBinding(),
          withErrorBoundaries({ defaultErrorComponent: FakeBoundary }),
        ),
        { provide: PublicIntakeService, useValue: { getPublicIntakeForm: read } },
      ],
    });
  });

  /**
   * Function open
   *
   * @description
   * Opens the public form of a key and returns its rendered text once read.
   *
   * @returns {Promise<string>} The text of the route.
   */
  async function open(): Promise<string> {
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/f/key-1');
    await expect
      .poll(() => {
        harness.detectChanges();
        return harness.routeNativeElement?.querySelector('[aria-busy="true"]') ?? null;
      })
      .toBeNull();
    return harness.routeNativeElement?.textContent.trim() ?? '';
  }

  it('renders the published form of the key', async () => {
    read.mockReturnValue(
      of({
        title: 'Request for “Sprint 14”',
        description: null,
        fields: {
          description: 'optional',
          priority: 'optional',
          dueDate: 'optional',
          contactEmail: 'required',
        },
      }),
    );

    expect(await open()).toContain('Request for “Sprint 14”');
    expect(read).toHaveBeenCalledWith('key-1');
  });

  it('renders not found for a form that does not accept requests', async () => {
    read.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404, error: {} })));

    expect(await open()).toBe('not-found');
  });

  it('renders the unavailable state, which offers Retry, for another failure', async () => {
    read.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503, error: {} })));

    expect(await open()).toBe('unavailable');
  });
});
