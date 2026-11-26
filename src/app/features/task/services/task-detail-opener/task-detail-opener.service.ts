import { computed, inject, Service, signal, type Signal, type WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type Event, NavigationEnd, Router } from '@angular/router';
import { filter, map, type Observable, Subject, tap } from 'rxjs';

import type {
  TaskDetailOpenOptions,
  TaskDetailPreview,
  TaskDetailTab,
} from '../../models/task-detail/task-detail.interface';

/**
 * Constant TASK_DETAIL_PARAM
 *
 * @description
 * The query parameter that opens a task's detail over the current page (`?task=CAD-482`).
 *
 * @type {string}
 */
export const TASK_DETAIL_PARAM: string = 'task';

/**
 * Constant TASK_KEY_PATTERN
 *
 * @description
 * A task key as the contracts define it (`TaskKey` in `@cadenway/contracts`: a 2 to 5 letter
 * prefix, a dash and a number from 1): the only values of `?task=` the detail opens.
 *
 * @type {RegExp}
 */
const TASK_KEY_PATTERN: RegExp = /^[A-Z]{2,5}-[1-9][0-9]{0,8}$/u;

/**
 * Service TaskDetailOpener
 *
 * @description
 * Opens and closes the task detail, a dialog over the current page driven by `?task=<KEY>`
 * (the shareable link stays `/:org/t/<KEY>`). `open` merges the parameter into the current
 * address, keeping the path and the other parameters; `close` removes it the same way. The detail
 * host (`withTaskDetail()`) reads `taskKey`. A screen that already shows the task (a list row)
 * gives a preview, shown in the header while the detail is read, and may ask for a tab
 * (`{ tab: 'subtasks' }`), which the column takes once; neither goes into the address. It holds
 * no user or organization data: the preview and the tab are forgotten once another task opens.
 * `closed` names each task whose detail closed or gave way to another, for the view under it.
 */
@Service()
export class TaskDetailOpener {
  // #region Properties
  /**
   * Property router
   *
   * @description
   * Router whose address carries the parameter.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property previews
   *
   * @description
   * What the screen that opened the task gave of it, or null.
   *
   * @type {WritableSignal<TaskDetailPreview | null>}
   * @readonly
   */
  private readonly previews: WritableSignal<TaskDetailPreview | null> =
    signal<TaskDetailPreview | null>(null);

  /**
   * Property tabRequest
   *
   * @description
   * The tab the last `open` asked for, with the key it was asked for, until the column takes it.
   *
   * @type {{ readonly key: string; readonly tab: TaskDetailTab } | null}
   */
  private tabRequest: { readonly key: string; readonly tab: TaskDetailTab } | null = null;

  /**
   * Property shownKey
   *
   * @description
   * The task the address opened after the last navigation, to tell when its detail goes away.
   *
   * @type {string | null}
   */
  private shownKey: string | null = this.readKey();

  /**
   * Property departures
   *
   * @description
   * Keys of the tasks whose detail closed or gave way to another task.
   *
   * @type {Subject<string>}
   * @readonly
   */
  private readonly departures: Subject<string> = new Subject<string>();

  /**
   * Property closed
   *
   * @description
   * Emits the key of a task whose detail closed (`close`, Back, an archive or a deletion) or gave
   * way to another task, so the view under it reads its rows again: the detail's writes (status,
   * fields, moves, archive, trash) reach the view without realtime this way.
   *
   * @type {Observable<string>}
   * @readonly
   */
  public readonly closed: Observable<string> = this.departures.asObservable();

  /**
   * Property taskKey
   *
   * @description
   * Key of the task the address opens (`?task=`), or null; updated after each navigation.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  public readonly taskKey: Signal<string | null> = toSignal(
    this.router.events.pipe(
      filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd),
      map((): string | null => this.readKey()),
      tap((key: string | null): void => {
        const left: string | null = this.shownKey;
        this.shownKey = key;
        if (left !== null && left !== key) this.departures.next(left);
      }),
    ),
    { initialValue: this.readKey() },
  );

  /**
   * Property isOpen
   *
   * @description
   * Whether a task detail is open (the `N` shortcut does not create while it is).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  public readonly isOpen: Signal<boolean> = computed((): boolean => this.taskKey() !== null);

  /**
   * Property preview
   *
   * @description
   * The preview of the open task, when the screen that opened it gave one for that key.
   *
   * @type {Signal<TaskDetailPreview | null>}
   * @readonly
   */
  public readonly preview: Signal<TaskDetailPreview | null> = computed(
    (): TaskDetailPreview | null => {
      const preview: TaskDetailPreview | null = this.previews();
      return preview?.key === this.taskKey() ? preview : null;
    },
  );
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens a task's detail over the current page: merges `?task=<KEY>` into the address. A
   * requested tab stays out of the address; the column takes it once (`takeTab`).
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskDetailPreview} [preview] - What the opening screen shows of it.
   * @param {TaskDetailOpenOptions} [options] - The tab to open on.
   * @returns {Promise<boolean>} Whether the navigation succeeded.
   */
  public open(
    taskKey: string,
    preview?: TaskDetailPreview,
    options?: TaskDetailOpenOptions,
  ): Promise<boolean> {
    this.previews.set(preview?.key === taskKey ? preview : null);
    this.tabRequest = options?.tab ? { key: taskKey, tab: options.tab } : null;
    return this.router.navigate([], {
      queryParams: { [TASK_DETAIL_PARAM]: taskKey },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Method close
   *
   * @description
   * Closes the detail: removes `?task=` from the address, an invalid value included, keeping the
   * other parameters.
   *
   * @returns {Promise<boolean>} Whether the navigation succeeded.
   */
  public close(): Promise<boolean> {
    this.previews.set(null);
    this.tabRequest = null;
    if (this.readParam() === null) return Promise.resolve(true);
    return this.router.navigate([], {
      queryParams: { [TASK_DETAIL_PARAM]: null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Method takeTab
   *
   * @description
   * The tab the last `open` asked for this task, once: a later rendering of the column (another
   * opening, Back to the same address) starts on `Details` again.
   *
   * @param {string} taskKey - Key of the task the column shows.
   * @returns {TaskDetailTab | null} The requested tab, or null.
   */
  public takeTab(taskKey: string): TaskDetailTab | null {
    const request: { readonly key: string; readonly tab: TaskDetailTab } | null = this.tabRequest;
    if (request?.key !== taskKey) return null;
    this.tabRequest = null;
    return request.tab;
  }

  /**
   * Method readKey
   *
   * @description
   * Reads the task key from the current address; a blank value or one that is not a task key
   * (`TASK_KEY_PATTERN`) opens nothing.
   *
   * @returns {string | null} The key, or null.
   */
  private readKey(): string | null {
    const key: string | undefined = this.readParam()?.trim();
    return key !== undefined && TASK_KEY_PATTERN.test(key) ? key : null;
  }

  /**
   * Method readParam
   *
   * @description
   * Reads the raw `?task=` value of the current address.
   *
   * @returns {string | null} The value, or null without the parameter.
   */
  private readParam(): string | null {
    return this.router.parseUrl(this.router.url).queryParamMap.get(TASK_DETAIL_PARAM) ?? null;
  }
  // #endregion
}
