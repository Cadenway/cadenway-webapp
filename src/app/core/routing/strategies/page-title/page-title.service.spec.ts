import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';

import { provideAppRouting } from '../../providers/routing/routing.provider';

/**
 * Component TitleFixture
 *
 * @description
 * Empty route used to exercise title selection.
 */
@Component({ template: '' })
class TitleFixture {}

describe('PageTitleStrategy', () => {
  it('uses the deepest title and adds the product name once', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'parent',
            title: 'Parent',
            children: [{ path: 'child', title: 'Child', component: TitleFixture }],
          },
          { path: 'empty', component: TitleFixture },
        ]),
        provideAppRouting(),
      ],
    });
    const harness: RouterTestingHarness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/parent/child');
    expect(TestBed.inject(Title).getTitle()).toBe('Child \u2014 Cadenway');
    await harness.navigateByUrl('/empty');
    expect(TestBed.inject(Title).getTitle()).toBe('Cadenway');
  });
});
