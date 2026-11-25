import { Component, computed, input, type InputSignal, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwProgress } from '@cadenway/ui/components/progress';
import { NgIcon } from '@ng-icons/core';

import type { ListSummary } from '../../../models/task-list/task-list.interface';
import { listIconName, lookTone } from '../../../utils/look/look.util';

/**
 * Component ListCard
 *
 * @description
 * A list card of the space overview (`App.dc.html` lines 1652-1659): a link to the list with its
 * icon, name, sprint range and task count, « done / live terminées » with the done percentage
 * and its bar, the open tasks and, when any, the late ones in garnet. The percentage leaves the
 * cancelled tasks out. Presentational.
 */
@Component({
  selector: 'cw-list-card',
  imports: [CwProgress, NgIcon, RouterLink],
  host: { class: 'contents' },
  template: `
    <a
      [routerLink]="link()"
      class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      data-testid="list-card"
    >
      <span class="flex min-w-0 items-center gap-2">
        <ng-icon [name]="icon()" class="size-4 shrink-0" [class]="tone()" aria-hidden="true" />
        <span class="min-w-0 truncate text-sm font-medium">{{ summary().list.name }}</span>
        @if (range(); as sprintRange) {
          <span class="shrink-0 text-xs whitespace-nowrap text-muted-foreground">{{
            sprintRange
          }}</span>
        }
        <span
          class="ml-auto shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
          i18n="@@spaces.overview.card-count"
          >{summary().counts.total, plural,
            =1 {1 task}
            other {{{ summary().counts.total }} tasks}
          }</span
        >
      </span>
      <span class="flex flex-col gap-1.5">
        <span class="flex justify-between text-xs text-muted-foreground">
          <span i18n="@@spaces.overview.card-done"
            >{{ summary().counts.done }} / {{ live() }} done</span
          >
          <span class="whitespace-nowrap tabular-nums">{{ percent() }}%</span>
        </span>
        <cw-progress size="sm" [value]="percent()" [ariaLabel]="summary().list.name" />
      </span>
      <span class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="whitespace-nowrap tabular-nums" i18n="@@spaces.overview.card-open"
          >{{ summary().counts.open }} open</span
        >
        @if (summary().counts.late > 0) {
          <span class="flex items-center gap-1 font-medium text-grenat-text">
            <ng-icon
              name="phosphorWarningCircleFill"
              class="size-3.5 text-destructive"
              aria-hidden="true"
            />
            <ng-container i18n="@@spaces.overview.card-late"
              >{{ summary().counts.late }} late</ng-container
            >
          </span>
        }
      </span>
    </a>
  `,
})
export class ListCard {
  // #region Properties
  /**
   * Property summary
   *
   * @description
   * The list and its counts.
   *
   * @type {InputSignal<ListSummary>}
   * @readonly
   */
  public readonly summary: InputSignal<ListSummary> = input.required<ListSummary>();

  /**
   * Property link
   *
   * @description
   * Address of the list.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly link: InputSignal<readonly string[]> = input.required<readonly string[]>();

  /**
   * Property range
   *
   * @description
   * Formatted sprint range (« 3 – 17 nov. »), or null for a plain list.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly range: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property icon
   *
   * @description
   * Icon of the list.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly icon: Signal<string> = computed((): string =>
    listIconName(this.summary().list),
  );

  /**
   * Property tone
   *
   * @description
   * Color class of the icon.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly tone: Signal<string> = computed((): string =>
    lookTone(this.summary().list.color),
  );

  /**
   * Property live
   *
   * @description
   * Tasks that count for the percentage: all but the cancelled ones.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly live: Signal<number> = computed(
    (): number => this.summary().counts.total - this.summary().counts.cancelled,
  );

  /**
   * Property percent
   *
   * @description
   * Rounded done percentage, zero for a list without live task.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly percent: Signal<number> = computed((): number =>
    this.live() > 0 ? Math.round((this.summary().counts.done / this.live()) * 100) : 0,
  );
  // #endregion
}
