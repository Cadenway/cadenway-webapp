import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { CwBadge } from '@cadenway/ui/components/badge';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCard, CwCardAction, CwCardHeader } from '@cadenway/ui/components/card';
import { NgIcon } from '@ng-icons/core';

import {
  describeActivity,
  describeTimeout,
} from '../../../utils/session-activity/session-activity.util';
import type {
  AccountSession,
  SessionActivity,
  SessionTimeout,
} from '../../../models/session/session.interface';

/**
 * Component SessionsList
 *
 * @description
 * The `Active sessions` card of the `Security and sign-in` section (`Compte.dc.html` lines
 * 329-352): the inactivity rule of the current session (hidden when the gateway does not give
 * it), `Sign out the others` (disabled when no other session is open, or while `disabled`), then
 * one row per session: the device's icon and label (`Unknown device` when unreadable), the
 * `This device` badge, the address (the contract derives no place), the last activity and, for
 * the other sessions, `Revoke`, whose spinner shows while `busyId` names it. The rows wrap below
 * 768 px. It only emits: `revokeRequested` with the session, `revokeOthersRequested`.
 */
@Component({
  selector: 'cw-sessions-list',
  imports: [CwBadge, CwButton, CwCard, CwCardAction, CwCardHeader, DatePipe, NgIcon],
  templateUrl: './sessions-list.component.html',
})
export class SessionsList {
  // #region Properties
  /**
   * Property sessions
   *
   * @description
   * The open sessions, the current one first.
   *
   * @type {InputSignal<readonly AccountSession[]>}
   * @readonly
   */
  public readonly sessions: InputSignal<readonly AccountSession[]> =
    input.required<readonly AccountSession[]>();

  /**
   * Property busyId
   *
   * @description
   * The session being revoked, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly busyId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property revokingOthers
   *
   * @description
   * Whether the other sessions are being closed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly revokingOthers: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property disabled
   *
   * @description
   * Whether another write of the section runs, which disables the buttons.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly disabled: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property revokeRequested
   *
   * @description
   * Emits the session whose `Revoke` was clicked.
   *
   * @type {OutputEmitterRef<AccountSession>}
   * @readonly
   */
  public readonly revokeRequested: OutputEmitterRef<AccountSession> = output<AccountSession>();

  /**
   * Property revokeOthersRequested
   *
   * @description
   * Emits on `Sign out the others`.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly revokeOthersRequested: OutputEmitterRef<void> = output();

  /**
   * Property hasOthers
   *
   * @description
   * Whether a session other than this browser's is open.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly hasOthers: Signal<boolean> = computed((): boolean =>
    this.sessions().some((session: AccountSession): boolean => !session.current),
  );

  /**
   * Property timeout
   *
   * @description
   * The inactivity timeout of the current session, or null when unknown.
   *
   * @type {Signal<SessionTimeout | null>}
   * @readonly
   */
  protected readonly timeout: Signal<SessionTimeout | null> = computed(
    (): SessionTimeout | null => {
      const minutes: number | null =
        this.sessions().find((session: AccountSession): boolean => session.current)
          ?.inactivityTimeoutMinutes ?? null;
      return minutes === null ? null : describeTimeout(minutes);
    },
  );
  // #endregion

  // #region Methods
  /**
   * Method activityOf
   *
   * @description
   * How a session's last activity reads now.
   *
   * @param {AccountSession} session - The session.
   * @returns {SessionActivity} The wording.
   */
  protected activityOf(session: AccountSession): SessionActivity {
    return describeActivity(session, new Date());
  }

  /**
   * Method countOf
   *
   * @description
   * The count of an activity worded in minutes, hours or days; 0 otherwise.
   *
   * @param {SessionActivity} activity - The activity.
   * @returns {number} The count.
   */
  protected countOf(activity: SessionActivity): number {
    return 'count' in activity ? activity.count : 0;
  }

  /**
   * Method dateOf
   *
   * @description
   * The moment of an activity worded as a day; null otherwise.
   *
   * @param {SessionActivity} activity - The activity.
   * @returns {Date | null} The moment.
   */
  protected dateOf(activity: SessionActivity): Date | null {
    return 'at' in activity ? activity.at : null;
  }

  /**
   * Method iconOf
   *
   * @description
   * The icon of a session's device.
   *
   * @param {AccountSession} session - The session.
   * @returns {string} The icon name.
   */
  protected iconOf(session: AccountSession): string {
    switch (session.deviceType) {
      case 'desktop':
        return 'phosphorDesktopBold';
      case 'mobile':
      case 'tablet':
        return 'phosphorDeviceMobileBold';
      default:
        return 'phosphorDevicesBold';
    }
  }

  /**
   * Method revokeLabel
   *
   * @description
   * Accessible name of a row's `Revoke`, naming the device.
   *
   * @param {AccountSession} session - The session.
   * @returns {string} The name.
   */
  protected revokeLabel(session: AccountSession): string {
    const device: string = session.device ?? this.unknownDevice();
    return $localize`:@@account.security.session-revoke-label:Revoke the session of ${device}:device:`;
  }

  /**
   * Method unknownDevice
   *
   * @description
   * The label of a device the gateway could not read.
   *
   * @returns {string} The label.
   */
  protected unknownDevice(): string {
    return $localize`:@@account.security.session-unknown-device:Unknown device`;
  }
  // #endregion
}
