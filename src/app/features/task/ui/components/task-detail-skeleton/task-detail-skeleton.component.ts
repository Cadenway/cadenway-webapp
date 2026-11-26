import { Component } from '@angular/core';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';

/**
 * Component TaskDetailSkeleton
 *
 * @description
 * The body of the task detail while it is read (`App.dc.html` lines 2629-2639): a status region
 * (`aria-busy`, `Loading the task`) with four tab bars, six description lines, three checklist
 * rows and, in the aside, eleven property rows. The header stays above it.
 */
@Component({
  selector: 'cw-task-detail-skeleton',
  imports: [CwSkeleton],
  host: {
    class: 'flex min-h-0 flex-1 flex-col md:flex-row',
    role: 'status',
    'aria-busy': 'true',
    '[attr.aria-label]': 'label',
  },
  template: `
    <div class="flex min-w-0 flex-1 flex-col gap-6 px-4 py-4" aria-hidden="true">
      <div class="flex gap-5 border-b border-border pb-3">
        <div cwSkeleton class="h-3 w-14"></div>
        <div cwSkeleton class="h-3 w-20"></div>
        <div cwSkeleton class="h-3 w-24"></div>
        <div cwSkeleton class="h-3 w-16"></div>
      </div>
      <div class="flex flex-col gap-2.5">
        @for (width of description; track $index) {
          <div cwSkeleton class="h-3" [class]="width"></div>
        }
      </div>
      <div class="flex flex-col gap-2.5">
        <div cwSkeleton class="h-3.5 w-28"></div>
        @for (width of checklist; track $index) {
          <div class="flex items-center gap-2">
            <div cwSkeleton class="size-4 rounded-[4px]"></div>
            <div cwSkeleton class="h-3" [class]="width"></div>
          </div>
        }
      </div>
    </div>
    <div
      class="flex shrink-0 flex-col gap-1 border-t border-border bg-popover p-3 md:w-96 md:border-t-0 md:border-l"
      aria-hidden="true"
    >
      @for (width of properties; track $index) {
        <div class="flex h-9 items-center gap-3 px-1">
          <div cwSkeleton class="h-3 w-24"></div>
          <div cwSkeleton class="h-6 rounded-md" [class]="width"></div>
        </div>
      }
    </div>
  `,
})
export class TaskDetailSkeleton {
  // #region Properties
  /**
   * Property label
   *
   * @description
   * Accessible name of the loading region.
   *
   * @type {string}
   * @readonly
   */
  protected readonly label: string = $localize`:@@task.detail.loading:Loading the task`;

  /**
   * Property description
   *
   * @description
   * Widths of the description lines (`skDesc`).
   *
   * @type {readonly string[]}
   * @readonly
   */
  protected readonly description: readonly string[] = [
    'w-full',
    'w-11/12',
    'w-4/5',
    'w-full',
    'w-2/3',
    'w-1/2',
  ];

  /**
   * Property checklist
   *
   * @description
   * Widths of the checklist rows.
   *
   * @type {readonly string[]}
   * @readonly
   */
  protected readonly checklist: readonly string[] = ['w-40', 'w-56', 'w-32'];

  /**
   * Property properties
   *
   * @description
   * Widths of the property values (`skProps`).
   *
   * @type {readonly string[]}
   * @readonly
   */
  protected readonly properties: readonly string[] = [
    'w-28',
    'w-20',
    'w-24',
    'w-16',
    'w-14',
    'w-20',
    'w-32',
    'w-24',
    'w-16',
    'w-20',
    'w-40',
  ];
  // #endregion
}
