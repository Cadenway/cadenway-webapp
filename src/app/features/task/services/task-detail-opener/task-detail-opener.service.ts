import { computed, inject, Service, signal, type Signal, type WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type Event, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import type { TaskDetailPreview } from '../../models/task-detail/task-detail.interface';

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
 * Service TaskDetailOpener
 *
 * @description
 * Opens and closes the task detail, a dialog over the current page driven by `?task=<KEY>`
 * (the shareable link stays `/:org/t/<KEY>`). `open` merges the parameter into the current
 * address, keeping the path and the other parameters; `close` removes it the same way. The detail
 * host (`withTaskDetail()`) reads `taskKey`. A screen that already shows the task (a list row)
 * gives a preview, shown in the header while the detail is read. It holds no user or organization
 * data: the preview is forgotten once another task opens.
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
   * Opens a task's detail over the current page: merges `?task=<KEY>` into the address.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskDetailPreview} [preview] - What the opening screen shows of it.
   * @returns {Promise<boolean>} Whether the navigation succeeded.
   */
  public open(taskKey: string, preview?: TaskDetailPreview): Promise<boolean> {
    this.previews.set(preview?.key === taskKey ? preview : null);
    return this.router.navigate([], {
      queryParams: { [TASK_DETAIL_PARAM]: taskKey },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Method close
   *
   * @description
   * Closes the detail: removes `?task=` from the address, keeping the other parameters.
   *
   * @returns {Promise<boolean>} Whether the navigation succeeded.
   */
  public close(): Promise<boolean> {
    this.previews.set(null);
    if (this.readKey() === null) return Promise.resolve(true);
    return this.router.navigate([], {
      queryParams: { [TASK_DETAIL_PARAM]: null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Method readKey
   *
   * @description
   * Reads the parameter from the current address; a blank value opens nothing.
   *
   * @returns {string | null} The key, or null.
   */
  private readKey(): string | null {
    const key: string | null =
      this.router.parseUrl(this.router.url).queryParamMap.get(TASK_DETAIL_PARAM) ?? null;
    return key && key.trim() !== '' ? key.trim() : null;
  }
  // #endregion
}
