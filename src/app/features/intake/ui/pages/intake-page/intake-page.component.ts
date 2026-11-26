import { Component, inject, input, type InputSignal } from '@angular/core';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';

import type { IntakeRequest } from '../../../models/intake-form/intake-form.interface';
import {
  PublicIntakeStore,
  type PublicIntakeStoreInstance,
} from '../../../state/public-intake/public-intake.store';
import { IntakeForm } from '../../components/intake-form/intake-form.component';

/**
 * Component IntakePage
 *
 * @description
 * The public request form of a list at `/f/:publicKey`, reached without a session: the form card
 * on the canvas, as the Form view's preview draws it (`App.dc.html` lines 1112-1224). The form
 * skeleton shows while the publication is read (lines 596-604); an unknown, disabled or archived
 * form renders the route boundary's not-found state, and any other failure its unavailable state
 * with `Retry`. A request is sent through `PublicIntakeStore`, page-scoped, then `Request sent`
 * shows until `Send another request`.
 */
@Component({
  selector: 'cw-intake-page',
  imports: [CwSkeleton, IntakeForm],
  providers: [PublicIntakeStore],
  host: { class: 'flex min-h-dvh flex-col bg-canvas' },
  templateUrl: './intake-page.component.html',
})
export class IntakePage {
  // #region Properties
  /**
   * Property publicKey
   *
   * @description
   * Key of the publication, from the address.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly publicKey: InputSignal<string> = input.required<string>();

  /**
   * Property store
   *
   * @description
   * The published form and its sending.
   *
   * @type {PublicIntakeStoreInstance}
   * @readonly
   */
  protected readonly store: PublicIntakeStoreInstance = inject(PublicIntakeStore);

  /**
   * Property skeletonFields
   *
   * @description
   * Widths and heights of the skeleton's fields (`skFields` of `App.dc.html`).
   *
   * @type {readonly { label: string; field: string }[]}
   * @readonly
   */
  protected readonly skeletonFields: readonly { label: string; field: string }[] = [
    { label: 'w-16', field: 'h-8' },
    { label: 'w-24', field: 'h-24' },
    { label: 'w-20', field: 'h-8' },
    { label: 'w-28', field: 'h-8' },
    { label: 'w-24', field: 'h-16' },
  ];
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Follows the key of the address.
   *
   * @constructor
   */
  public constructor() {
    this.store.load(this.publicKey);
  }
  // #endregion

  // #region Methods
  /**
   * Method send
   *
   * @description
   * Sends a valid request.
   *
   * @param {IntakeRequest} request - The request.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async send(request: IntakeRequest): Promise<void> {
    await this.store.submit(request);
  }
  // #endregion
}
