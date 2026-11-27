import { Component } from '@angular/core';

/**
 * Component GettingStartedHost
 *
 * @description
 * Host of the `Getting started` checklist in the application shell's `overlays` slot (order 40).
 * The checklist floats over the shell once the assistant provisioned the first space, while its
 * presentation is not dismissed and the assistant is closed; a failed read shows nothing. It
 * renders nothing yet: the checklist comes with the getting-started package of step 9.
 */
@Component({
  selector: 'cw-getting-started-host',
  host: { 'data-testid': 'getting-started-host' },
  template: '',
})
export class GettingStartedHost {}
