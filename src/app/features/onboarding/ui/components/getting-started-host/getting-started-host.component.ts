import { Component } from '@angular/core';

/**
 * Component GettingStartedHost
 *
 * @description
 * Host of the `Getting started` checklist in the application shell's `overlays` slot (order 40).
 * It renders nothing yet. With step 9's getting-started package, the checklist will float over
 * the shell once the assistant provisioned the first space, while its presentation is not
 * dismissed and the assistant is closed; a failed read will show nothing.
 */
@Component({
  selector: 'cw-getting-started-host',
  host: { 'data-testid': 'getting-started-host' },
  template: '',
})
export class GettingStartedHost {}
