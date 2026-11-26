import { inject, resource, type ResourceRef, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { SprintReportApi } from '../../data-access/services/sprint-report-api/sprint-report-api.service';
import type { SprintReport } from '../../models/sprint-report/sprint-report.interface';
import { todayIso } from '../../utils/calendar-date/calendar-date.util';

/**
 * Interface SprintReportRequest
 *
 * @description
 * The report asked for: the sprint, observed on the caller's day in the caller's time zone.
 */
export interface SprintReportRequest {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The sprint.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property today
   *
   * @description
   * The caller's date when the dialog opened, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly today: string;

  /**
   * Property timeZone
   *
   * @description
   * The caller's IANA time zone (`Europe/Paris`).
   *
   * @type {string}
   * @readonly
   */
  readonly timeZone: string;
  // #endregion
}

/**
 * Interface SprintReportState
 *
 * @description
 * The report the open dialog shows.
 */
interface SprintReportState {
  // #region Properties
  /**
   * Property request
   *
   * @description
   * The report asked for at the last opening, or null before the first one.
   *
   * @type {SprintReportRequest | null}
   * @readonly
   */
  readonly request: SprintReportRequest | null;
  // #endregion
}

/**
 * Function callerTimeZone
 *
 * @description
 * The browser's IANA time zone, which the gateway needs to cut the report's days.
 *
 * @returns {string} The time zone.
 */
function callerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Interface SprintReportStoreInstance
 *
 * @description
 * The report of the sprint the open dialog shows.
 */
export interface SprintReportStoreInstance {
  // #region Properties
  /**
   * Property request
   *
   * @description
   * The report asked for at the last opening, or null before the first one.
   *
   * @type {Signal<SprintReportRequest | null>}
   * @readonly
   */
  readonly request: Signal<SprintReportRequest | null>;

  /**
   * Property report
   *
   * @description
   * The read of the report: idle before the first opening; its error stays in the dialog.
   *
   * @type {ResourceRef<SprintReport | undefined>}
   * @readonly
   */
  readonly report: ResourceRef<SprintReport | undefined>;
  // #endregion

  // #region Methods
  /**
   * Method follow
   *
   * @description
   * Follows the sprint of the open dialog: each sprint given (null while the dialog is closed,
   * which keeps the shown report for the closing animation) reads the report again.
   *
   * @param {Signal<string | null> | string | null} listId - The sprint.
   */
  follow(listId: Signal<string | null> | string | null): void;

  /**
   * Method retry
   *
   * @description
   * Reads the report again after a failure (`Retry`).
   */
  retry(): void;
  // #endregion
}

/**
 * Function createSprintReportStore
 *
 * @description
 * Creates the sprint report store.
 *
 * @returns {Type<SprintReportStoreInstance>} Injectable store constructor.
 */
function createSprintReportStore(): Type<SprintReportStoreInstance> {
  return signalStore(
    withState<SprintReportState>({ request: null }),
    withProps((store) => {
      const api: SprintReportApi = inject(SprintReportApi);
      return {
        report: resource({
          params: (): SprintReportRequest | undefined => store.request() ?? undefined,
          loader: ({
            params,
            abortSignal,
          }: {
            params: SprintReportRequest;
            abortSignal: AbortSignal;
          }): Promise<SprintReport> =>
            api.report(params.listId, params.today, params.timeZone, abortSignal),
        }),
      };
    }),
    withMethods((store) => ({
      follow: signalMethod<string | null>((listId: string | null): void => {
        if (listId === null) return;
        patchState(store, { request: { listId, today: todayIso(), timeZone: callerTimeZone() } });
      }),
      retry(): void {
        store.report.reload();
      },
    })),
  );
}

/**
 * Constant SprintReportStore
 *
 * @description
 * Component-scoped on `SprintReportDialog`: the report of the sprint the dialog shows. `follow`
 * takes the sprint while the dialog is open (null while it is closed): each opening reads the
 * report again, from a skeleton, observed on the caller's date and time zone of that moment;
 * closing keeps the shown report until the next opening. `report` is the read (`resource`):
 * loading, its value, or its error, which the dialog shows in place with `Retry` (`retry`).
 *
 * @type {ReturnType<typeof createSprintReportStore>}
 */
export const SprintReportStore: ReturnType<typeof createSprintReportStore> =
  createSprintReportStore();
