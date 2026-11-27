import { DOCUMENT, inject, InjectionToken } from '@angular/core';

/**
 * Type CheckoutRedirect
 *
 * @description
 * Leaves the application for the hosted Checkout.
 *
 * @type {(url: string) => void}
 */
export type CheckoutRedirect = (url: string) => void;

/**
 * Constant CHECKOUT_REDIRECT
 *
 * @description
 * How the billing section opens the Stripe Checkout address it was given: the document's
 * `location.assign`, in the same tab, so Stripe's return lands back in the session. Specs
 * replace it so that no real Stripe page opens.
 *
 * @type {InjectionToken<CheckoutRedirect>}
 */
export const CHECKOUT_REDIRECT: InjectionToken<CheckoutRedirect> =
  new InjectionToken<CheckoutRedirect>('CHECKOUT_REDIRECT', {
    providedIn: 'root',
    factory: (): CheckoutRedirect => {
      const document: Document = inject(DOCUMENT);
      return (url: string): void => {
        document.location.assign(url);
      };
    },
  });
