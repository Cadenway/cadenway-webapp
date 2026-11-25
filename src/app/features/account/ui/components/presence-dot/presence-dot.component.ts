import { Component, input, type InputSignal } from '@angular/core';

import type { PresenceStatus } from '@core/realtime';

/**
 * Component PresenceDot
 *
 * @description
 * The colored dot of a presence (mockup `App.dc.html`, `USER_STATUSES`): jade for `Active`,
 * garnet with a white bar for `Do not disturb`, beacon yellow for `Away`, muted for
 * `Invisible`. It is decorative (`aria-hidden`): the presence word always sits next to it or in
 * the accessible name of its owner. The host sets the size and the ring.
 */
@Component({
  selector: 'cw-presence-dot',
  host: {
    'aria-hidden': 'true',
    class: 'flex shrink-0 items-center justify-center rounded-full',
    '[class.bg-jade]': "status() === 'online'",
    '[class.bg-grenat]': "status() === 'do-not-disturb'",
    '[class.bg-balise]': "status() === 'away'",
    '[class.bg-ink-muted/50]': "status() === 'invisible'",
    '[attr.data-status]': 'status()',
  },
  template: `
    @if (status() === 'do-not-disturb') {
      <span class="h-[1.5px] w-1.5 rounded-full bg-background"></span>
    }
  `,
})
export class PresenceDot {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Presence the dot shows.
   *
   * @type {InputSignal<PresenceStatus>}
   * @readonly
   */
  public readonly status: InputSignal<PresenceStatus> = input.required<PresenceStatus>();
  // #endregion
}
