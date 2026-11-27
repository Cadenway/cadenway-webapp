import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  type Signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import { CwProgress } from '@cadenway/ui/components/progress';

import type { HomeSprint } from '../../../models/home-read/home-read.interface';
import { formatSprintRange } from '../../../utils/home-dates/home-dates.util';

/**
 * Component HomeSprintCard
 *
 * @description
 * The sprint card of the home screen's aside (`App.dc.html` lines 1717-1724): the sprint's name as
 * a heading, its date range in the application locale, `Progress` with `done / live · percent`
 * (the live tasks leave the cancelled ones out, the mockup's line 8314) over a jade bar, and
 * `Open the sprint`, a link to `link`. The bar is a `cw-progress` named `Progress`, read as its
 * text. Presentational: inputs only.
 */
@Component({
  selector: 'cw-home-sprint-card',
  imports: [CwButton, CwProgress, RouterLink],
  host: { class: 'block' },
  template: `
    @let shown = sprint();
    <section
      class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      aria-labelledby="home-sprint"
      data-testid="home-sprint"
    >
      <div class="flex items-center justify-between gap-3">
        <h2 id="home-sprint" class="truncate text-base font-semibold">{{ shown.name }}</h2>
        <span class="shrink-0 text-xs whitespace-nowrap text-muted-foreground">{{ range() }}</span>
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex justify-between gap-3 text-sm">
          <span class="font-medium">{{ progressLabel }}</span>
          <span
            class="whitespace-nowrap text-muted-foreground tabular-nums"
            data-testid="home-sprint-done"
            >{{ doneLabel() }}</span
          >
        </div>
        <cw-progress
          variant="success"
          [value]="percent()"
          [max]="100"
          [ariaLabel]="progressLabel"
          [valueText]="doneLabel()"
        />
      </div>
      <a cwButton variant="outline" class="w-full" [routerLink]="link()" i18n="@@home.sprint.open"
        >Open the sprint</a
      >
    </section>
  `,
})
export class HomeSprintCard {
  // #region Properties
  /**
   * Property sprint
   *
   * @description
   * The sprint.
   *
   * @type {InputSignal<HomeSprint>}
   * @readonly
   */
  public readonly sprint: InputSignal<HomeSprint> = input.required<HomeSprint>();

  /**
   * Property link
   *
   * @description
   * The address of the sprint's list (`/<slug>/l/<listId>`).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly link: InputSignal<string> = input.required<string>();

  /**
   * Property progressLabel
   *
   * @description
   * Accessible name of the bar, the label above it.
   *
   * @type {string}
   * @readonly
   */
  protected readonly progressLabel: string = $localize`:@@home.sprint.progress:Progress`;

  /**
   * Property locale
   *
   * @description
   * Application locale, for the date range.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property range
   *
   * @description
   * The sprint's first and last days.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly range: Signal<string> = computed((): string =>
    formatSprintRange(this.sprint().startDate, this.sprint().endDate, this.locale),
  );

  /**
   * Property percent
   *
   * @description
   * The done tasks out of the live ones, rounded, 0 when none is live.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly percent: Signal<number> = computed((): number => {
    const { done, live }: HomeSprint = this.sprint();
    return live > 0 ? Math.round((Math.min(done, live) / live) * 100) : 0;
  });

  /**
   * Property doneLabel
   *
   * @description
   * `done / live · percent`, as the mockup's `doneLabel`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly doneLabel: Signal<string> = computed((): string => {
    const done: number = this.sprint().done;
    const live: number = this.sprint().live;
    const percent: number = this.percent();
    return $localize`:@@home.sprint.done:${done}:done: / ${live}:live: · ${percent}:percent:%`;
  });
  // #endregion
}
