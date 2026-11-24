import { Service, signal, type Signal, type WritableSignal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Service OrganizationPin
 *
 * @description
 * Holds the organization expected by workspace requests and reports a rejected context.
 */
@Service()
export class OrganizationPin {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The active workspace organization, or null outside a workspace.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  private readonly value: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property changes
   *
   * @description
   * Notifications of gateway context mismatches.
   *
   * @type {Subject<void>}
   * @readonly
   */
  private readonly changes: Subject<void> = new Subject<void>();

  /**
   * Property current
   *
   * @description
   * Organization to attach to supported requests, or null when unpinned.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  public readonly current: Signal<string | null> = this.value.asReadonly();

  /**
   * Property contextChanged
   *
   * @description
   * Emits when the gateway rejects an expected organization.
   *
   * @type {Observable<void>}
   * @readonly
   */
  public readonly contextChanged: Observable<void> = this.changes.asObservable();
  // #endregion

  // #region Methods
  /**
   * Method set
   *
   * @description
   * Replaces the active workspace pin.
   *
   * @param {string | null} organizationId - Expected organization, or null to clear it.
   */
  public set(organizationId: string | null): void {
    this.value.set(organizationId);
  }

  /**
   * Method notifyContextChanged
   *
   * @description
   * Reports a gateway rejection to workspace recovery listeners.
   */
  public notifyContextChanged(): void {
    this.changes.next();
  }
  // #endregion
}
