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
   * Property revisionValue
   *
   * @description
   * Advances on each commit so late failures cannot stale a newer verified context.
   *
   * @type {WritableSignal<number>}
   * @readonly
   */
  private readonly revisionValue: WritableSignal<number> = signal(0);

  /**
   * Property revision
   *
   * @description
   * Current verified context generation for rejecting obsolete passive failures.
   *
   * @type {Signal<number>}
   * @readonly
   */
  public readonly revision: Signal<number> = this.revisionValue.asReadonly();

  /**
   * Property staleValue
   *
   * @description
   * Whether a request discovered that the session context changed.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly staleValue: WritableSignal<boolean> = signal(false);

  /**
   * Property staleTransitions
   *
   * @description
   * Synchronous notifications when the pin first becomes stale.
   *
   * @type {Subject<void>}
   * @readonly
   */
  private readonly staleTransitions: Subject<void> = new Subject<void>();

  /**
   * Property becameStale
   *
   * @description
   * Emits once per stale period, after the stale signal changes.
   *
   * @type {Observable<void>}
   * @readonly
   */
  public readonly becameStale: Observable<void> = this.staleTransitions.asObservable();

  /**
   * Property verifications
   *
   * @description
   * Notifications for every verified workspace commit.
   *
   * @type {Subject<void>}
   * @readonly
   */
  private readonly verifications: Subject<void> = new Subject<void>();

  /**
   * Property stale
   *
   * @description
   * Whether passive requests must wait for workspace verification.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly stale: Signal<boolean> = this.staleValue.asReadonly();

  /**
   * Property organizationVerified
   *
   * @description
   * Emits on every non-null verified commit, including the same organization.
   *
   * @type {Observable<void>}
   * @readonly
   */
  public readonly organizationVerified: Observable<void> = this.verifications.asObservable();

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
    this.revisionValue.update((revision: number) => revision + 1);
    this.switching = false;
    this.staleValue.set(false);
    if (changed) this.commits.next();
    if (organizationId) this.verifications.next();
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
   * Method markStale
   *
   * @description
   * Fences passive requests until a workspace context is verified again.
   */
  public markStale(): void {
    if (this.staleValue()) return;
    this.staleValue.set(true);
    this.staleTransitions.next();
  }

  /**
   * Method notifyContextChanged
   *
   * @description
   * Marks the context stale and reports an active rejection to workspace recovery listeners.
   */
  public notifyContextChanged(): void {
    this.markStale();
    this.changes.next();
  }
  // #endregion
}
