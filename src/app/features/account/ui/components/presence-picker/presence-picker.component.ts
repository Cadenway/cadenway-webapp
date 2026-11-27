import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwRadioGroup, CwRadioGroupItem } from '@cadenway/ui/components/radio-group';

import type { PresenceStatus } from '@core/realtime';

import { PresenceDot } from '../presence-dot/presence-dot.component';

/**
 * Interface PresenceChoice
 *
 * @description
 * A presence card of the picker.
 */
export interface PresenceChoice {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * The presence it sets.
   *
   * @type {PresenceStatus}
   * @readonly
   */
  readonly status: PresenceStatus;

  /**
   * Property label
   *
   * @description
   * Its name (`Active`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property hint
   *
   * @description
   * What it means (`You appear online`).
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;
  // #endregion
}

/**
 * Constant PRESENCE_CHOICES
 *
 * @description
 * The cards of `Status and availability`, in the mockup's order (`USER_STATUSES` without
 * `Offline`, which is never chosen; `Compte.dc.html` lines 855-859).
 *
 * @type {readonly PresenceChoice[]}
 */
export const PRESENCE_CHOICES: readonly PresenceChoice[] = [
  {
    status: 'online',
    label: $localize`:@@account.profile.status-online:Active`,
    hint: $localize`:@@account.profile.status-online-hint:You appear online`,
  },
  {
    status: 'do-not-disturb',
    label: $localize`:@@account.profile.status-dnd:Do not disturb`,
    hint: $localize`:@@account.profile.status-dnd-hint:Notifications paused`,
  },
  {
    status: 'away',
    label: $localize`:@@account.profile.status-away:Away`,
    hint: $localize`:@@account.profile.status-away-hint:You appear away`,
  },
  {
    status: 'invisible',
    label: $localize`:@@account.profile.status-invisible:Invisible`,
    hint: $localize`:@@account.profile.status-invisible-hint:Signed in, but shown offline`,
  },
];

/**
 * Component PresencePicker
 *
 * @description
 * The radio cards of the `Status and availability` card (mockup `Compte.dc.html` lines 218-225):
 * `Active`, `Do not disturb`, `Away` and `Invisible`, each with its presence dot and hint, two
 * columns from `sm`. The group is named `label`.
 *
 * It holds no state: `status` is the confirmed presence (nothing is checked while it is unknown),
 * and picking another card emits `picked` with its choice; the page sets it and the group follows
 * `status`. While `disabled` (realtime is off) every card is disabled.
 */
@Component({
  selector: 'cw-presence-picker',
  imports: [CwRadioGroup, CwRadioGroupItem, PresenceDot],
  template: `
    <cw-radio-group
      class="grid grid-cols-1 gap-3 sm:grid-cols-2"
      data-testid="presence-picker"
      [ariaLabel]="label()"
      [value]="status()"
      [disabled]="disabled()"
      (valueChange)="pick($event)"
    >
      @for (choice of choices; track choice.status) {
        <cw-radio-group-item variant="card" [value]="choice.status">
          <span class="flex min-w-0 items-start gap-2.5">
            <cw-presence-dot class="mt-[5px] size-2.5" [status]="choice.status" />
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="truncate text-sm leading-5 font-medium">{{ choice.label }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ choice.hint }}</span>
            </span>
          </span>
        </cw-radio-group-item>
      }
    </cw-radio-group>
  `,
})
export class PresencePicker {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * The confirmed presence, or null while it is unknown.
   *
   * @type {InputSignal<PresenceStatus | null>}
   * @readonly
   */
  public readonly status: InputSignal<PresenceStatus | null> = input<PresenceStatus | null>(null);

  /**
   * Property disabled
   *
   * @description
   * Whether the presence cannot be set (realtime is off).
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly disabled: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property label
   *
   * @description
   * Accessible name of the group, the card's title.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly label: InputSignal<string> = input.required<string>();

  /**
   * Property picked
   *
   * @description
   * Emits the choice the person picked, when it differs from `status`.
   *
   * @type {OutputEmitterRef<PresenceChoice>}
   * @readonly
   */
  public readonly picked: OutputEmitterRef<PresenceChoice> = output<PresenceChoice>();

  /**
   * Property choices
   *
   * @description
   * The cards, in the mockup's order.
   *
   * @type {readonly PresenceChoice[]}
   * @readonly
   */
  protected readonly choices: readonly PresenceChoice[] = PRESENCE_CHOICES;
  // #endregion

  // #region Methods
  /**
   * Method pick
   *
   * @description
   * Emits the picked choice, unless it is the confirmed one.
   *
   * @param {string | null} value - The radio's value.
   */
  protected pick(value: string | null): void {
    const choice: PresenceChoice | undefined = PRESENCE_CHOICES.find(
      (candidate: PresenceChoice) => candidate.status === value,
    );
    if (choice !== undefined && choice.status !== this.status()) this.picked.emit(choice);
  }
  // #endregion
}
