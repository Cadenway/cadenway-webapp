import {
  type ComponentFixture,
  DeferBlockBehavior,
  type DeferBlockFixture,
  DeferBlockState,
  TestBed,
} from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { ErrorRecovery } from '../../../data-access/services/error-recovery/error-recovery.service';
import { RouteErrorBoundary } from './route-error-boundary.component';

/**
 * Function render
 *
 * @description
 * Renders the boundary with its deferred view under manual control.
 *
 * @returns {Promise<{ fixture: ComponentFixture<RouteErrorBoundary>; block: DeferBlockFixture; navigate: Mock }>}
 * The boundary, its deferred block and the navigation spy.
 */
async function render(): Promise<{
  fixture: ComponentFixture<RouteErrorBoundary>;
  block: DeferBlockFixture;
  navigate: Mock;
}> {
  TestBed.configureTestingModule({
    imports: [RouteErrorBoundary],
    providers: [provideRouter([]), { provide: ErrorRecovery, useValue: {} }],
    deferBlockBehavior: DeferBlockBehavior.Manual,
  });
  const navigate: Mock = vi
    .spyOn(TestBed.inject(Router), 'navigateByUrl')
    .mockResolvedValue(true) as Mock;
  const fixture: ComponentFixture<RouteErrorBoundary> = TestBed.createComponent(RouteErrorBoundary);
  await fixture.whenStable();
  const block: DeferBlockFixture | undefined = (await fixture.getDeferBlocks()).at(0);
  if (block === undefined) throw new Error('Expected the deferred error view.');
  return { fixture, block, navigate };
}

describe('RouteErrorBoundary', () => {
  it('says the page is loading while its view loads', async () => {
    const { fixture, block }: Awaited<ReturnType<typeof render>> = await render();

    await block.render(DeferBlockState.Placeholder);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent,
    ).toContain('Chargement…');
  });

  it('keeps an inline Retry when its view cannot load', async () => {
    const { fixture, block, navigate }: Awaited<ReturnType<typeof render>> = await render();

    await block.render(DeferBlockState.Error);
    const alert: HTMLElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="alert"]',
    );
    expect(alert?.textContent).toContain('Impossible de charger cette page');
    alert?.querySelector('button')?.click();

    expect(navigate).toHaveBeenCalledWith('/', { onSameUrlNavigation: 'reload' });
  });
});
