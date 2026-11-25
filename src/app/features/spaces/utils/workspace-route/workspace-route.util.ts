import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, type ParamMap } from '@angular/router';
import { map } from 'rxjs';

/**
 * Function injectOrganizationSlug
 *
 * @description
 * The `:org` slug of the workspace route, followed through an in-place organization switch. Call
 * it in the injection context of a component rendered inside `/:org` (a shell contribution or a
 * routed page), whose `ActivatedRoute` sees the parameter.
 *
 * @returns {Signal<string>} The slug, empty outside a workspace.
 */
export function injectOrganizationSlug(): Signal<string> {
  const route: ActivatedRoute = inject(ActivatedRoute);
  return toSignal(route.paramMap.pipe(map((params: ParamMap): string => params.get('org') ?? '')), {
    initialValue: route.snapshot.paramMap.get('org') ?? '',
  });
}
