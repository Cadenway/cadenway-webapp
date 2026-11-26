import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { NgIcon } from '@ng-icons/core';

import type { AccessDeniedRouteError, KnownRouteError } from '@shared/route-errors';

import type {
  AccessRequestStatus,
  RestoreStatus,
} from '../../../models/error-recovery/error-recovery.type';
import { AccessRequestForm } from '../../forms/access-request-form/access-request-form.component';

/**
 * Component RouteErrorState
 *
 * @description
 * Renders one state of the route error page (mockup `App.dc.html` lines 487-500 and 1499-1522,
 * `ERR_PAGES`), from the values the page derived and the progress of its writes:
 * - `not-found`: `Error 404`, `Page not found` and `Back to home` to `/home`;
 * - `access-denied`: the private space and its owner when known, the access request form, then
 *   `Request sent`;
 * - `deleted-task`: the task, `Restore the task` (`Already restored` once the entry is gone) and
 *   `Open the trash` when a trash link is given;
 * - `unavailable`: `Could not load this page`, `Retry` and the `Error <status> ·
 *   ref. <requestId>` line when known.
 *
 * Each state's heading is the route focus target. The component only emits; the page sends.
 */
@Component({
  selector: 'cw-route-error-state',
  imports: [
    AccessRequestForm,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    NgIcon,
    RouterLink,
  ],
  host: { class: 'contents' },
  templateUrl: './route-error-state.component.html',
})
export class RouteErrorState {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * State to render.
   *
   * @type {InputSignal<KnownRouteError['kind']>}
   * @readonly
   */
  public readonly kind: InputSignal<KnownRouteError['kind']> =
    input.required<KnownRouteError['kind']>();

  /**
   * Property resource
   *
   * @description
   * Inaccessible space or list of the access-denied state.
   *
   * @type {InputSignal<AccessDeniedRouteError['resource'] | null>}
   * @readonly
   */
  public readonly resource: InputSignal<AccessDeniedRouteError['resource'] | null> = input<
    AccessDeniedRouteError['resource'] | null
  >(null);

  /**
   * Property task
   *
   * @description
   * Deleted task of the deleted-task state.
   *
   * @type {InputSignal<{ readonly key: string; readonly name: string } | null>}
   * @readonly
   */
  public readonly task: InputSignal<{ readonly key: string; readonly name: string } | null> =
    input<{ readonly key: string; readonly name: string } | null>(null);

  /**
   * Property status
   *
   * @description
   * HTTP status of an unavailable read, or null.
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly status: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property requestId
   *
   * @description
   * Gateway request reference of an unavailable read, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly requestId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property unavailableTitle
   *
   * @description
   * Title of the unavailable state the failing route gives, or null for `Could not load
   * this page`.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly unavailableTitle: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property statusUrl
   *
   * @description
   * Status page `Service status` opens in a new tab, or null to leave the link out.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly statusUrl: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property trashLink
   *
   * @description
   * Trash of the current workspace, or null outside a workspace.
   *
   * @type {InputSignal<readonly string[] | null>}
   * @readonly
   */
  public readonly trashLink: InputSignal<readonly string[] | null> = input<
    readonly string[] | null
  >(null);

  /**
   * Property accessRequest
   *
   * @description
   * Progress of the access request.
   *
   * @type {InputSignal<AccessRequestStatus>}
   * @readonly
   */
  public readonly accessRequest: InputSignal<AccessRequestStatus> =
    input<AccessRequestStatus>('idle');

  /**
   * Property restore
   *
   * @description
   * Progress of the restore.
   *
   * @type {InputSignal<RestoreStatus>}
   * @readonly
   */
  public readonly restore: InputSignal<RestoreStatus> = input<RestoreStatus>('idle');

  /**
   * Property retried
   *
   * @description
   * Emitted when the person asks to load the page again.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property accessRequested
   *
   * @description
   * Message the person sends with their access request.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly accessRequested: OutputEmitterRef<string> = output<string>();

  /**
   * Property restoreRequested
   *
   * @description
   * Emitted when the person asks to restore the deleted task.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly restoreRequested: OutputEmitterRef<void> = output();

  /**
   * Property ownerFirstName
   *
   * @description
   * First name of the owner of the inaccessible resource, for the message label.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly ownerFirstName: Signal<string | null> = computed((): string | null => {
    const owner: string | undefined = this.resource()?.ownerName?.trim();
    return owner ? (owner.split(/\s+/u)[0] ?? null) : null;
  });
  // #endregion
}
