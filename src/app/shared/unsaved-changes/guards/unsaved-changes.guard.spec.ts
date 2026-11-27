import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UnsavedChanges } from '../models/unsaved-changes.interface';
import { unsavedChangesGuard } from './unsaved-changes.guard';

/**
 * Component FormPage
 *
 * @description
 * A settings page whose dirty state and confirmation answer each test sets.
 */
@Component({ selector: 'cw-form-page', template: '<p>form</p>' })
class FormPage implements UnsavedChanges {
  // #region Properties
  /**
   * Property dirty
   *
   * @description
   * Whether the page holds unsaved changes.
   *
   * @type {boolean}
   */
  public static dirty: boolean = false;

  /**
   * Property answer
   *
   * @description
   * Answer of the confirmation, faked per test.
   *
   * @type {ReturnType<typeof vi.fn<() => Promise<boolean>>>}
   */
  public static answer: ReturnType<typeof vi.fn<() => Promise<boolean>>> = vi.fn();
  // #endregion

  // #region Methods
  /**
   * Method hasUnsavedChanges
   *
   * @description
   * Reads the dirty flag of the test.
   *
   * @returns {boolean} The flag.
   */
  public hasUnsavedChanges(): boolean {
    return FormPage.dirty;
  }

  /**
   * Method confirmDiscard
   *
   * @description
   * Returns the faked answer.
   *
   * @returns {Promise<boolean>} The answer.
   */
  public confirmDiscard(): Promise<boolean> {
    return FormPage.answer();
  }
  // #endregion
}

/**
 * Component OtherPage
 *
 * @description
 * The page the navigation leaves to.
 */
@Component({ selector: 'cw-other-page', template: '<p>other</p>' })
class OtherPage {}

describe('unsavedChangesGuard', () => {
  beforeEach(() => {
    FormPage.dirty = false;
    FormPage.answer = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'profile', component: FormPage, canDeactivate: [unsavedChangesGuard] },
          { path: 'security', component: OtherPage },
        ]),
      ],
    });
  });

  it('leaves a clean page without asking', async () => {
    const harness: RouterTestingHarness = await RouterTestingHarness.create('/profile');

    await harness.navigateByUrl('/security');

    expect(TestBed.inject(Router).url).toBe('/security');
    expect(FormPage.answer).not.toHaveBeenCalled();
  });

  it('keeps a dirty page when the person keeps editing', async () => {
    FormPage.dirty = true;
    FormPage.answer.mockResolvedValue(false);
    await RouterTestingHarness.create('/profile');

    expect(await TestBed.inject(Router).navigateByUrl('/security')).toBe(false);

    expect(TestBed.inject(Router).url).toBe('/profile');
    expect(FormPage.answer).toHaveBeenCalledOnce();
  });

  it('leaves a dirty page once the person discards the changes', async () => {
    FormPage.dirty = true;
    await RouterTestingHarness.create('/profile');

    expect(await TestBed.inject(Router).navigateByUrl('/security')).toBe(true);

    expect(TestBed.inject(Router).url).toBe('/security');
  });
});
