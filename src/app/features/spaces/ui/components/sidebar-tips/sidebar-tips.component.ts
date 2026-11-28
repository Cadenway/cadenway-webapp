import { Component, input, type InputSignal, output, type OutputEmitterRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

import type { SidebarTip } from '../../../constants/sidebar-tips/sidebar-tips.constants';

/**
 * Component SidebarTips
 *
 * @description
 * The suggestion carousel of the sidebar (`App.dc.html` lines 238-258): a `section` described as
 * a carousel, the tip's icon, title (announced politely as it changes), text, its call to action
 * as a link to `link`, `position / count` and, with several tips, previous and next buttons.
 * The cross emits `dismissed` (`Hide the suggestions`). Presentational: the container owns
 * the position and the dismissal.
 */
@Component({
  selector: 'cw-sidebar-tips',
  imports: [CwButton, NgIcon, RouterLink],
  template: `
    <section
      aria-label="Suggestion"
      i18n-aria-label="@@spaces.tips.region"
      aria-roledescription="carousel"
      i18n-aria-roledescription="@@spaces.tips.roledescription"
      class="flex flex-col gap-2 rounded-lg border border-sidebar-border bg-background p-3 animate-pop-in motion-reduce:animate-none"
      data-testid="sidebar-tips"
    >
      <div class="flex items-center gap-2">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background"
          aria-hidden="true"
          ><ng-icon size="1rem" [name]="tip().icon" [class]="tip().tone"
        /></span>
        <p class="min-w-0 flex-1 truncate text-sm font-medium" aria-live="polite">
          {{ tip().title }}
        </p>
        <button
          cwButton
          type="button"
          variant="ghost"
          size="icon-xs"
          class="-mr-1"
          aria-label="Hide the suggestions"
          i18n-aria-label="@@spaces.tips.dismiss"
          title="Hide the suggestions"
          i18n-title="@@spaces.tips.dismiss"
          (click)="dismissed.emit()"
        >
          <ng-icon name="phosphorXBold" aria-hidden="true" />
        </button>
      </div>
      <p class="text-xs leading-5 text-pretty text-muted-foreground">{{ tip().text }}</p>
      <div class="flex items-center gap-1">
        <a cwButton size="xs" [routerLink]="link()">{{ tip().cta }}</a>
        <span class="ml-auto pr-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
          >{{ position() }} / {{ count() }}</span
        >
        @if (count() > 1) {
          <button
            cwButton
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Previous suggestion"
            i18n-aria-label="@@spaces.tips.previous"
            (click)="previous.emit()"
          >
            <ng-icon name="phosphorCaretLeftBold" aria-hidden="true" />
          </button>
          <button
            cwButton
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Next suggestion"
            i18n-aria-label="@@spaces.tips.next"
            (click)="next.emit()"
          >
            <ng-icon name="phosphorCaretRightBold" aria-hidden="true" />
          </button>
        }
      </div>
    </section>
  `,
})
export class SidebarTips {
  // #region Properties
  /**
   * Property tip
   *
   * @description
   * The suggestion shown.
   *
   * @type {InputSignal<SidebarTip>}
   * @readonly
   */
  public readonly tip: InputSignal<SidebarTip> = input.required<SidebarTip>();

  /**
   * Property link
   *
   * @description
   * Address its call to action opens.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly link: InputSignal<readonly string[]> = input.required<readonly string[]>();

  /**
   * Property position
   *
   * @description
   * One-based position of the tip.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly position: InputSignal<number> = input.required<number>();

  /**
   * Property count
   *
   * @description
   * Number of tips.
   *
   * @type {InputSignal<number>}
   * @readonly
   */
  public readonly count: InputSignal<number> = input.required<number>();

  /**
   * Property previous
   *
   * @description
   * Emits when the previous tip is asked for.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly previous: OutputEmitterRef<void> = output();

  /**
   * Property next
   *
   * @description
   * Emits when the next tip is asked for.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly next: OutputEmitterRef<void> = output();

  /**
   * Property dismissed
   *
   * @description
   * Emits when the suggestions are hidden.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly dismissed: OutputEmitterRef<void> = output();
  // #endregion
}
