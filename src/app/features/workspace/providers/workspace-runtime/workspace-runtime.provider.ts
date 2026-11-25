import { DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
  type EnvironmentProviders,
  inject,
  provideEnvironmentInitializer,
  type Provider,
  type Signal,
} from '@angular/core';
import { type ActivatedRouteSnapshot, Router } from '@angular/router';
import { type Subscription } from 'rxjs';

import { OrganizationPin } from '@core/api';
import {
  provideRealtime,
  REALTIME_ORGANIZATION,
  REALTIME_TERMINAL_FAILURE,
  REALTIME_TICKET_SOURCE,
} from '@core/realtime';

import { WorkspaceRealtime } from '../../data-access/services/workspace-realtime/workspace-realtime.service';
import type { WorkspaceContextPort } from '../../ports/workspace-context/workspace-context-port.interface';
import {
  organizationChoiceRedirect,
  signInRedirect,
} from '../../navigation/access-redirect/access-redirect.util';
import { WORKSPACE_CONTEXT } from '../../ports/workspace-context/workspace-context.token';
import { WorkspaceRevalidation } from './workspace-revalidation.service';

/**
 * Function shouldRevalidateWorkspace
 *
 * @description
 * Reruns guards on organization changes or a requested recovery, but not query-only navigation.
 * Angular invokes this predicate in the future route's injection context.
 *
 * @param {ActivatedRouteSnapshot} from - Previous workspace route.
 * @param {ActivatedRouteSnapshot} to - Future workspace route.
 * @returns {boolean} Whether guards and resolvers should run.
 */
export function shouldRevalidateWorkspace(
  from: ActivatedRouteSnapshot,
  to: ActivatedRouteSnapshot,
): boolean {
  const requested: boolean = inject(WorkspaceRevalidation).consume();
  return requested || from.paramMap.get('org') !== to.paramMap.get('org');
}

/**
 * Function provideWorkspaceRuntime
 *
 * @description
 * Provides realtime credentials and context-change recovery for the workspace route. The resolver
 * commits the pin after verification; this initializer clears it with the route injector.
 *
 * @returns {(Provider | EnvironmentProviders)[]} Workspace-scoped runtime providers.
 */
export function provideWorkspaceRuntime(): (Provider | EnvironmentProviders)[] {
  return [
    ...provideRealtime(),
    WorkspaceRevalidation,
    {
      provide: REALTIME_TICKET_SOURCE,
      useFactory: (): (() => Promise<string>) => {
        const service: WorkspaceRealtime = inject(WorkspaceRealtime);
        return () => service.issueTicket();
      },
    },
    {
      provide: REALTIME_ORGANIZATION,
      useFactory: (): Signal<string | null> => {
        const context: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
        return computed(() => context.organization().id);
      },
    },
    {
      provide: REALTIME_TERMINAL_FAILURE,
      useFactory: (): ((status: 401 | 403) => void) => {
        const router: Router = inject(Router);
        return (status: 401 | 403): void => {
          void router.navigateByUrl(
            status === 401
              ? signInRedirect(router, router.url)
              : organizationChoiceRedirect(router),
          );
        };
      },
    },
    provideEnvironmentInitializer(() => {
      const pin: OrganizationPin = inject(OrganizationPin);
      const router: Router = inject(Router);
      const revalidation: WorkspaceRevalidation = inject(WorkspaceRevalidation);
      let recovering: boolean = false;
      const document: Document = inject(DOCUMENT);
      const recover: () => void = () => {
        if (recovering || router.currentNavigation()) return;
        recovering = true;
        revalidation.request();
        void router.navigateByUrl(router.url, { onSameUrlNavigation: 'reload' }).finally(() => {
          recovering = false;
        });
      };
      const subscription: Subscription = pin.contextChanged.subscribe(recover);
      const foreground: () => void = () => {
        if (pin.stale() && document.visibilityState === 'visible' && document.hasFocus()) recover();
      };
      document.addEventListener('visibilitychange', foreground);
      document.defaultView?.addEventListener('focus', foreground);
      inject(DestroyRef).onDestroy(() => {
        document.removeEventListener('visibilitychange', foreground);
        document.defaultView?.removeEventListener('focus', foreground);
        subscription.unsubscribe();
        pin.set(null);
      });
    }),
  ];
}
