import type { Signal, Type } from '@angular/core';
import type { CwTimelineRange, CwTimelineScale } from '@cadenway/ui/components/timeline';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import type {
  GanttGrouping,
  GanttZoomStep,
} from '../../models/gantt-timeline/gantt-timeline.interface';
import {
  addDays,
  daysBetween,
  GANTT_ZOOM_LADDER,
  ganttWindow,
  shiftGanttWindow,
  zoomIndexOf,
} from '../../utils/gantt-timeline/gantt-timeline.util';

/**
 * Interface GanttViewState
 *
 * @description
 * The period, scale and folded groups of the Gantt, kept while the view lives and not saved
 * (as in the mockup).
 */
interface GanttViewState {
  // #region Properties
  /**
   * Property scale
   *
   * @description
   * The column unit.
   *
   * @type {CwTimelineScale}
   * @readonly
   */
  readonly scale: CwTimelineScale;

  /**
   * Property zoom
   *
   * @description
   * The width factor of the columns.
   *
   * @type {number}
   * @readonly
   */
  readonly zoom: number;

  /**
   * Property range
   *
   * @description
   * The period shown, null for the scale's period around today.
   *
   * @type {CwTimelineRange | null}
   * @readonly
   */
  readonly range: CwTimelineRange | null;

  /**
   * Property _collapsed
   *
   * @description
   * The folded groups of each grouping, once the user folded or unfolded one.
   *
   * @type {Readonly<Partial<Record<GanttGrouping, readonly string[]>>>}
   * @readonly
   */
  readonly _collapsed: Readonly<Partial<Record<GanttGrouping, readonly string[]>>>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Days, at the base width, around today, with the default folded groups.
 *
 * @type {GanttViewState}
 */
const initialState: GanttViewState = {
  scale: 'day',
  zoom: 1,
  range: null,
  _collapsed: {},
};

/**
 * Constant DEFAULT_COLLAPSED
 *
 * @description
 * Groups folded until the user unfolds them: `Cancelled` by status, as in the `List` view.
 *
 * @type {Readonly<Record<GanttGrouping, readonly string[]>>}
 */
const DEFAULT_COLLAPSED: Readonly<Record<GanttGrouping, readonly string[]>> = {
  status: ['cancelled'],
  priority: [],
  assignee: [],
  all: [],
};

/**
 * Interface GanttViewStoreInstance
 *
 * @description
 * Public API of `GanttViewStore`.
 */
export interface GanttViewStoreInstance {
  // #region Properties
  /**
   * Property scale
   *
   * @description
   * The column unit.
   *
   * @type {Signal<CwTimelineScale>}
   * @readonly
   */
  readonly scale: Signal<CwTimelineScale>;

  /**
   * Property zoom
   *
   * @description
   * The width factor of the columns.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly zoom: Signal<number>;

  /**
   * Property range
   *
   * @description
   * The period set, null for the scale's period around today.
   *
   * @type {Signal<CwTimelineRange | null>}
   * @readonly
   */
  readonly range: Signal<CwTimelineRange | null>;

  /**
   * Property window
   *
   * @description
   * The period shown, both days included.
   *
   * @type {Signal<CwTimelineRange>}
   * @readonly
   */
  readonly window: Signal<CwTimelineRange>;

  /**
   * Property canZoomIn
   *
   * @description
   * Whether a narrower step of the zoom ladder remains.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canZoomIn: Signal<boolean>;

  /**
   * Property canZoomOut
   *
   * @description
   * Whether a wider step of the zoom ladder remains.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canZoomOut: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method followScale
   *
   * @description
   * Records the scale `cw-timeline` set (J, S, M, Ctrl + wheel, `Fit`).
   *
   * @param {CwTimelineScale} scale - The scale.
   */
  followScale(scale: CwTimelineScale): void;

  /**
   * Method followZoom
   *
   * @description
   * Records the zoom `cw-timeline` set.
   *
   * @param {number} zoom - The width factor.
   */
  followZoom(zoom: number): void;

  /**
   * Method followRange
   *
   * @description
   * Records the period `cw-timeline` set (T, Page Up, Page Down, an off-window chip, `Fit`).
   *
   * @param {CwTimelineRange | null} range - The period.
   */
  followRange(range: CwTimelineRange | null): void;

  /**
   * Method pickScale
   *
   * @description
   * The scale radios and the menu's `Scale`: the scale at its base width, around today.
   *
   * @param {CwTimelineScale} scale - The scale.
   */
  pickScale(scale: CwTimelineScale): void;

  /**
   * Method zoomIn
   *
   * @description
   * One step narrower on the zoom ladder; a new scale keeps the middle of the period in view.
   */
  zoomIn(): void;

  /**
   * Method zoomOut
   *
   * @description
   * One step wider on the zoom ladder; a new scale keeps the middle of the period in view.
   */
  zoomOut(): void;

  /**
   * Method goToday
   *
   * @description
   * The scale's period around today.
   */
  goToday(): void;

  /**
   * Method shift
   *
   * @description
   * The period before or after the one shown.
   *
   * @param {number} steps - Periods to move, negative to go back.
   */
  shift(steps: number): void;

  /**
   * Method collapsedOf
   *
   * @description
   * The folded groups of a grouping.
   *
   * @param {GanttGrouping} grouping - The grouping.
   * @returns {readonly string[]} The folded group values.
   */
  collapsedOf(grouping: GanttGrouping): readonly string[];

  /**
   * Method setCollapsed
   *
   * @description
   * Records the folded groups of a grouping.
   *
   * @param {GanttGrouping} grouping - The grouping.
   * @param {readonly string[]} values - The folded group values.
   */
  setCollapsed(grouping: GanttGrouping, values: readonly string[]): void;
  // #endregion
}

/**
 * Function createGanttViewStore
 *
 * @description
 * Creates the `Gantt` view's store.
 *
 * @returns {Type<GanttViewStoreInstance>} Injectable store constructor.
 */
function createGanttViewStore(): Type<GanttViewStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => {
      const now: Date = new Date();
      return { _today: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
    }),
    withComputed((store) => ({
      window: (): CwTimelineRange => store.range() ?? ganttWindow(store.scale(), store._today),
      canZoomIn: (): boolean =>
        zoomIndexOf(store.scale(), store.zoom()) < GANTT_ZOOM_LADDER.length - 1,
      canZoomOut: (): boolean => zoomIndexOf(store.scale(), store.zoom()) > 0,
    })),
    withMethods((store) => {
      const zoomBy: (step: number) => void = (step: number): void => {
        const index: number = zoomIndexOf(store.scale(), store.zoom());
        const next: number = Math.max(0, Math.min(GANTT_ZOOM_LADDER.length - 1, index + step));
        if (next === index) return;
        const target: GanttZoomStep = GANTT_ZOOM_LADDER[next];
        if (target.scale === store.scale()) {
          patchState(store, { zoom: target.zoom });
          return;
        }
        const shown: CwTimelineRange = store.window();
        const middle: Date = addDays(
          shown.start,
          Math.floor(daysBetween(shown.start, shown.end) / 2),
        );
        patchState(store, {
          scale: target.scale,
          zoom: target.zoom,
          range: ganttWindow(target.scale, middle),
        });
      };
      return {
        followScale(scale: CwTimelineScale): void {
          patchState(store, { scale });
        },
        followZoom(zoom: number): void {
          patchState(store, { zoom });
        },
        followRange(range: CwTimelineRange | null): void {
          patchState(store, { range });
        },
        pickScale(scale: CwTimelineScale): void {
          patchState(store, { scale, zoom: 1, range: null });
        },
        zoomIn(): void {
          zoomBy(1);
        },
        zoomOut(): void {
          zoomBy(-1);
        },
        goToday(): void {
          patchState(store, { range: null });
        },
        shift(steps: number): void {
          patchState(store, { range: shiftGanttWindow(store.window(), store.scale(), steps) });
        },
        collapsedOf(grouping: GanttGrouping): readonly string[] {
          return store._collapsed()[grouping] ?? DEFAULT_COLLAPSED[grouping];
        },
        setCollapsed(grouping: GanttGrouping, values: readonly string[]): void {
          patchState(store, { _collapsed: { ...store._collapsed(), [grouping]: values } });
        },
      };
    }),
  );
}

/**
 * Constant GanttViewStore
 *
 * @description
 * The presentation of the `Gantt` view (`l/:listId/gantt`), route-scoped through
 * `GANTT_VIEW_PROVIDERS`: the scale, the zoom on the ladder of `GANTT_ZOOM_LADDER`, the period
 * shown (null for the scale's period around today, as `cw-timeline` draws it) and the folded
 * groups of each grouping (`Cancelled` by status until the user unfolds it). Nothing is saved:
 * leaving the view forgets it, as in the mockup. The tasks come from `ListTasksStore`.
 *
 * @type {Type<GanttViewStoreInstance>}
 */
export const GanttViewStore: Type<GanttViewStoreInstance> = createGanttViewStore();
