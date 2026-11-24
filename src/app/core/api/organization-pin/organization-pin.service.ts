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
   * Property switching
   *
   * @description
   * Whether the session may be changing organization while old pages remain active.
   *
   * @type {boolean}
   */
  private switching: boolean = false;

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
   * Property commits
   *
   * @description
   * Synchronous notifications after the verified organization is committed.
   *
   * @type {Subject<void>}
   * @readonly
   */
  private readonly commits: Subject<void> = new Subject<void>();

  /**
   * Property organizationChanges
   *
   * @description
   * Emits after a different workspace organization is committed.
   *
   * @type {Observable<void>}
   * @readonly
   */
  public readonly organizationChanges: Observable<void> = this.commits.asObservable();

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
    const changed: boolean = this.value() !== organizationId;
    this.value.set(organizationId);
    this.switching = false;
    if (changed) this.commits.next();
  }

  /**
   * Method beginSwitch
   *
   * @description
   * Fences pinned requests until a verified context is committed or the workspace is destroyed.
   */
  public beginSwitch(): void {
    this.switching = true;
  }

  /**
   * Method isSwitching
   *
   * @description
   * Checks whether a workspace session switch is in progress.
   *
   * @returns {boolean} Whether pinned requests must be refused locally.
   */
  public isSwitching(): boolean {
    return this.switching;
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
