import { _IdGenerator } from '@angular/cdk/a11y';
import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwProgress } from '@cadenway/ui/components/progress';
import { NgIcon } from '@ng-icons/core';

import type {
  GettingStartedItem,
  GettingStartedItemKey,
} from '../../../models/getting-started/getting-started-item.interface';

/**
 * Component GettingStartedPanel
 *
 * @description
 * The floating `Getting started` checklist (`App.dc.html` lines 2712-2727): a `section` named
 * `Getting started`, fixed at the bottom right (above the tab bar under 768 px), whose header holds
 * the rocket tile, the title, the progress bar with `{done} of {total}`, the collapse toggle
 * (`aria-expanded`, named `Collapse the list` in both states as in the mockup, caret down when
 * expanded and up when collapsed) and `Hide “Getting started”`. Expanded, it lists one button per
 * item: a done item shows a jade check and its label struck through (and is named `… (done)` for
 * assistive technology), an item to do a circle and a trailing arrow. Once every item is done, a footer says
 * `All set. You can hide this list.`
 *
 * Presentational: it takes the items and the presentation and emits `toggled`, `dismissed` and
 * `picked` (the item pressed, done or not, as in the mockup); the host saves and acts.
 */
@Component({
  selector: 'cw-getting-started-panel',
  imports: [CwButton, CwProgress, NgIcon],
  templateUrl: './getting-started-panel.component.html',
})
export class GettingStartedPanel {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The items, in display order.
   *
   * @type {InputSignal<readonly GettingStartedItem[]>}
   * @readonly
   */
  public readonly items: InputSignal<readonly GettingStartedItem[]> =
    input.required<readonly GettingStartedItem[]>();

  /**
   * Property expanded
   *
   * @description
   * Whether the items show below the header.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly expanded: InputSignal<boolean> = input<boolean>(true);

  /**
   * Property toggled
   *
   * @description
   * Emits when the collapse toggle is pressed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly toggled: OutputEmitterRef<void> = output();

  /**
   * Property dismissed
   *
   * @description
   * Emits when `Hide “Getting started”` is pressed.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly dismissed: OutputEmitterRef<void> = output();

  /**
   * Property picked
   *
   * @description
   * Emits the item pressed.
   *
   * @type {OutputEmitterRef<GettingStartedItemKey>}
   * @readonly
   */
  public readonly picked: OutputEmitterRef<GettingStartedItemKey> = output<GettingStartedItemKey>();

  /**
   * Property listId
   *
   * @description
   * Id of the item list, which the toggle controls.
   *
   * @type {string}
   * @readonly
   */
  protected readonly listId: string = inject(_IdGenerator).getId('cw-getting-started-');

  /**
   * Property doneCount
   *
   * @description
   * Number of items done.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly doneCount: Signal<number> = computed(
    (): number => this.items().filter((item: GettingStartedItem): boolean => item.done).length,
  );

  /**
   * Property allDone
   *
   * @description
   * Whether every item is done, which shows the footer line.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly allDone: Signal<boolean> = computed(
    (): boolean => this.items().length > 0 && this.doneCount() === this.items().length,
  );

  /**
   * Property counter
   *
   * @description
   * The counter under the title, also the progress bar's value text: `1 of 3`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly counter: Signal<string> = computed(
    (): string =>
      $localize`:@@onboarding.getting-started.counter:${this.doneCount()}:done: of ${this.items().length}:total:`,
  );
  // #endregion

  // #region Methods
  /**
   * Method label
   *
   * @description
   * The label of an item (`App.dc.html` lines 5304-5306).
   *
   * @param {GettingStartedItemKey} key - The item.
   * @returns {string} Its label.
   */
  protected label(key: GettingStartedItemKey): string {
    switch (key) {
      case 'task':
        return $localize`:@@onboarding.getting-started.item-task:Create your first task`;
      case 'invite':
        return $localize`:@@onboarding.getting-started.item-invite:Invite a team member`;
      case 'board':
        return $localize`:@@onboarding.getting-started.item-board:Try the Board view`;
    }
  }

  /**
   * Method doneLabel
   *
   * @description
   * The accessible name of a done item, which the strike-through alone does not tell: `Create your
   * first task (done)`.
   *
   * @param {GettingStartedItemKey} key - The item.
   * @returns {string} Its name.
   */
  protected doneLabel(key: GettingStartedItemKey): string {
    return $localize`:@@onboarding.getting-started.item-done:${this.label(key)}:item: (done)`;
  }
  // #endregion
}
