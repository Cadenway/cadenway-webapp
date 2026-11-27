import { Component, input, type InputSignal } from '@angular/core';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';

/**
 * Constant ROW_WIDTHS
 *
 * @description
 * Widths of the six skeleton rows' titles, varied as the mockup's `skw` varies them.
 *
 * @type {readonly string[]}
 */
const ROW_WIDTHS: readonly string[] = ['w-48', 'w-36', 'w-56', 'w-40', 'w-52', 'w-32'];

/**
 * Component DocsSkeleton
 *
 * @description
 * The page skeleton of the documents (`App.dc.html` lines 1524-1569, `SK_PAGES.Docs`): the header,
 * then one group of six rows without a label, announced as `Loading the documents` (line 4798).
 * `width` follows the page it stands for: `catalog` (`max-w-5xl`) or `document` (`max-w-3xl`).
 */
@Component({
  selector: 'cw-docs-skeleton',
  imports: [CwSkeleton],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-hidden' },
  template: `
    <div
      class="min-h-0 flex-1 overflow-hidden"
      role="status"
      aria-busy="true"
      aria-label="Loading the documents"
      i18n-aria-label="@@docs.loading"
      data-testid="docs-loading"
    >
      <div
        class="mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6"
        [class.max-w-5xl]="width() === 'catalog'"
        [class.max-w-3xl]="width() === 'document'"
        aria-hidden="true"
      >
        <div class="flex items-end gap-3">
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div cwSkeleton class="h-3 w-40"></div>
            <div cwSkeleton class="h-7 w-64 max-w-full"></div>
          </div>
          <div cwSkeleton class="h-8 w-32 rounded-lg"></div>
        </div>
        <section class="flex flex-col gap-2">
          <ul class="flex flex-col overflow-hidden rounded-lg border border-border">
            @for (rowWidth of rowWidths; track $index) {
              <li class="flex h-11 items-center gap-3 border-b border-border px-3 last:border-b-0">
                <div cwSkeleton class="size-4 rounded-full"></div>
                <div cwSkeleton class="h-2.5 w-14"></div>
                <div cwSkeleton class="h-3 max-w-[40%]" [class]="rowWidth"></div>
                <div cwSkeleton class="ml-auto h-5 w-16 rounded-full"></div>
                <div cwSkeleton class="size-6 rounded-full"></div>
              </li>
            }
          </ul>
        </section>
      </div>
    </div>
  `,
})
export class DocsSkeleton {
  // #region Properties
  /**
   * Property width
   *
   * @description
   * The page the skeleton stands for, which sets its width.
   *
   * @type {InputSignal<'catalog' | 'document'>}
   * @readonly
   */
  public readonly width: InputSignal<'catalog' | 'document'> = input<'catalog' | 'document'>(
    'catalog',
  );

  /**
   * Property rowWidths
   *
   * @description
   * Widths of the rows' titles.
   *
   * @type {readonly string[]}
   * @readonly
   */
  protected readonly rowWidths: readonly string[] = ROW_WIDTHS;
  // #endregion
}
