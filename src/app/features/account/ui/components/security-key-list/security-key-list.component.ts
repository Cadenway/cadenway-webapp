import { DatePipe } from '@angular/common';
import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

import type { SecurityKey } from '../../../models/two-step/two-step.interface';

/**
 * Component SecurityKeyList
 *
 * @description
 * The registered security keys under the `Security keys and biometrics` row of the two-step card:
 * each key's name, when it was added and last used (`Never used` before its first challenge),
 * and `Remove`, whose spinner shows while `busyId` names it and which is disabled while another
 * write runs. It renders nothing without keys and only emits `removeRequested` with the key.
 */
@Component({
  selector: 'cw-security-key-list',
  imports: [CwButton, DatePipe, NgIcon],
  template: `
    @if (keys().length > 0) {
      <ul
        class="flex w-full flex-col rounded-lg border border-border"
        aria-label="Security keys"
        i18n-aria-label="@@account.security.keys-list"
      >
        @for (key of keys(); track key.id) {
          <li
            class="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
            data-testid="security-key-row"
          >
            <ng-icon
              name="phosphorKeyBold"
              class="shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm leading-5 font-medium">{{ key.name }}</span>
              @let added = key.createdAt | date: 'mediumDate';
              <span class="text-xs text-muted-foreground">
                @if (key.lastUsedAt; as lastUsed) {
                  @let used = lastUsed | date: 'mediumDate';
                  <ng-container i18n="@@account.security.key-added-used"
                    >Added on {{ added }} · last used on {{ used }}</ng-container
                  >
                } @else {
                  <ng-container i18n="@@account.security.key-added-unused"
                    >Added on {{ added }} · never used</ng-container
                  >
                }
              </span>
            </div>
            <button
              cwButton
              type="button"
              variant="ghost"
              size="sm"
              class="text-destructive"
              [attr.aria-label]="removeLabel(key)"
              [disabled]="disabled() && busyId() !== key.id"
              [loading]="busyId() === key.id"
              data-testid="security-key-remove"
              data-focus="remove-key"
              (click)="removeRequested.emit(key)"
            >
              <ng-container i18n="@@account.security.key-remove">Remove</ng-container>
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class SecurityKeyList {
  // #region Properties
  /**
   * Property keys
   *
   * @description
   * The registered keys, the oldest first.
   *
   * @type {InputSignal<readonly SecurityKey[]>}
   * @readonly
   */
  public readonly keys: InputSignal<readonly SecurityKey[]> =
    input.required<readonly SecurityKey[]>();

  /**
   * Property busyId
   *
   * @description
   * The key being removed, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly busyId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property disabled
   *
   * @description
   * Whether another write of the section runs.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly disabled: InputSignal<boolean> = input<boolean>(false);

  /**
   * Property removeRequested
   *
   * @description
   * Emits the key whose `Remove` was clicked.
   *
   * @type {OutputEmitterRef<SecurityKey>}
   * @readonly
   */
  public readonly removeRequested: OutputEmitterRef<SecurityKey> = output<SecurityKey>();
  // #endregion

  // #region Methods
  /**
   * Method removeLabel
   *
   * @description
   * Accessible name of a key's `Remove`, naming the key.
   *
   * @param {SecurityKey} key - The key.
   * @returns {string} The name.
   */
  protected removeLabel(key: SecurityKey): string {
    return $localize`:@@account.security.key-remove-label:Remove the key “${key.name}:name:”`;
  }
  // #endregion
}
