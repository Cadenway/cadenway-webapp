import { Component, computed, inject, type Signal } from '@angular/core';
import { CwProgress } from '@cadenway/ui/components/progress';

import type { ListSummary } from '../../../models/task-list/task-list.interface';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';

/**
 * Interface SprintProgressView
 *
 * @description
 * What the footer shows of the current sprint.
 */
interface SprintProgressView {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Sprint name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property done
   *
   * @description
   * Done tasks.
   *
   * @type {number}
   * @readonly
   */
  readonly done: number;

  /**
   * Property live
   *
   * @description
   * Tasks that count: every task but the cancelled ones, at least one.
   *
   * @type {number}
   * @readonly
   */
  readonly live: number;

  /**
   * Property percent
   *
   * @description
   * Rounded done percentage.
   *
   * @type {number}
   * @readonly
   */
  readonly percent: number;
  // #endregion
}

/**
 * Component SprintProgress
 *
 * @description
 * The progress of the current sprint at the top of the sidebar footer (`App.dc.html` lines
 * 262-263): its name, `done / live · pct%` and a jade bar named `Sprint progress`. The
 * current sprint is the first one, in sidebar order, whose dates hold the caller's today; without
 * one, or before the counts are read, nothing renders. A container reading the workspace's
 * `SpacesNavigationStore`.
 */
@Component({
  selector: 'cw-sprint-progress',
  imports: [CwProgress],
  host: { class: 'contents' },
  template: `
    @if (progress(); as sprint) {
      <div class="flex flex-col gap-2 pb-1" data-testid="sprint-progress">
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="min-w-0 truncate font-medium">{{ sprint.name }}</span>
          <span
            class="whitespace-nowrap text-muted-foreground tabular-nums"
            i18n="@@spaces.sprint-progress.count"
            >{{ sprint.done }} / {{ sprint.live }} · {{ sprint.percent }}%</span
          >
        </div>
        <cw-progress
          size="sm"
          variant="success"
          [value]="sprint.percent"
          ariaLabel="Sprint progress"
          i18n-ariaLabel="@@spaces.sprint-progress.label"
        />
      </div>
    }
  `,
})
export class SprintProgress {
  // #region Properties
  /**
   * Property navigation
   *
   * @description
   * The workspace's spaces navigation.
   *
   * @type {InstanceType<typeof SpacesNavigationStore>}
   * @readonly
   */
  private readonly navigation: InstanceType<typeof SpacesNavigationStore> =
    inject(SpacesNavigationStore);

  /**
   * Property progress
   *
   * @description
   * The current sprint's progress, or null.
   *
   * @type {Signal<SprintProgressView | null>}
   * @readonly
   */
  protected readonly progress: Signal<SprintProgressView | null> = computed(
    (): SprintProgressView | null => {
      const sprint: ListSummary | null = this.navigation.currentSprint();
      if (!sprint) return null;
      const live: number = Math.max(1, sprint.counts.total - sprint.counts.cancelled);
      return {
        name: sprint.list.name,
        done: sprint.counts.done,
        live,
        percent: Math.round((sprint.counts.done / live) * 100),
      };
    },
  );
  // #endregion
}
