import {
  booleanAttribute,
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwPopover, CwPopoverTrigger } from '@cadenway/ui/components/popover';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwToggleGroup, CwToggleGroupItem } from '@cadenway/ui/components/toggle-group';
import { NgIcon } from '@ng-icons/core';

import type {
  TaskDependency,
  TaskDependencyDirection,
  TaskDependencyTask,
} from '../../../models/task-property/task-property.interface';
import { isClosedStatus } from '../../../utils/task-status/task-status.util';
import { localDay, shortDayLabel } from '../../../utils/task-property/task-property.util';

/**
 * Interface DependencyAnchor
 *
 * @description
 * The dates of the open task the date warning compares.
 */
export interface DependencyAnchor {
  // #region Properties
  /**
   * Property start
   *
   * @description
   * Start date, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly start: string | null;

  /**
   * Property due
   *
   * @description
   * Due date, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly due: string | null;
  // #endregion
}

/**
 * Interface DependencySearch
 *
 * @description
 * What the add dialog asks for.
 */
export interface DependencySearch {
  // #region Properties
  /**
   * Property direction
   *
   * @description
   * Direction of the link.
   *
   * @type {TaskDependencyDirection}
   * @readonly
   */
  readonly direction: TaskDependencyDirection;

  /**
   * Property text
   *
   * @description
   * Typed text.
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property delay
   *
   * @description
   * Whether it follows typing (debounced).
   *
   * @type {boolean}
   * @readonly
   */
  readonly delay: boolean;
  // #endregion
}

/**
 * Interface DependencyLink
 *
 * @description
 * A dependency to create.
 */
export interface DependencyLink {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The other task.
   *
   * @type {TaskDependencyTask}
   * @readonly
   */
  readonly task: TaskDependencyTask;

  /**
   * Property direction
   *
   * @description
   * Whether the open task is blocked by it or blocks it.
   *
   * @type {TaskDependencyDirection}
   * @readonly
   */
  readonly direction: TaskDependencyDirection;
  // #endregion
}

/**
 * Component TaskPropertyDependencies
 *
 * @description
 * The `Dependencies` row of the task detail's properties (`App.dc.html` lines 2566-2592 and
 * 8464-8496): `Blocked by` then `Blocks` chips with the other task's status icon and
 * `{key} · {name}` (which opens it, `opened`) and a remove button (`Remove the dependency with
 * {key}`, `removed`); the warning `Starts before {key} ends ({date})` when an open blocker is due
 * on or after the task's start (or due date); then `Add a dependency`, a dialog with the
 * `Direction` radio group (`Blocked by`, `Blocks`), the `Search a task` field (`Name or key`) and
 * ten candidates at most, or `No task matches (loops are left out).`. Opening the dialog, a
 * direction or typing emits `searched` (typing debounced by the container); a pick emits `added`
 * and closes it.
 */
@Component({
  selector: 'cw-task-property-dependencies',
  imports: [
    CwButton,
    CwPopover,
    CwPopoverTrigger,
    CwStatusIcon,
    CwToggleGroup,
    CwToggleGroupItem,
    NgIcon,
  ],
  host: { class: 'flex min-w-0 flex-col gap-0.5 py-1' },
  template: `
    @if (failed()) {
      <div class="flex items-center justify-between gap-2 px-2 py-0.5 text-xs">
        <span role="alert" i18n="@@task.create.read-failed">Could not load this information.</span>
        <button cwButton type="button" size="xs" variant="outline" (click)="retried.emit()">
          <ng-container i18n="@@task.retry">Retry</ng-container>
        </button>
      </div>
    }
    @for (dependency of ordered(); track dependency.id) {
      <span
        class="group/dep flex min-w-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs hover:bg-muted"
      >
        <span class="shrink-0 text-muted-foreground">{{ kinds[dependency.direction] }}</span>
        <cw-status-icon
          [status]="dependency.task.status"
          [milestone]="dependency.task.milestone"
          size="3"
        />
        <button
          type="button"
          class="min-w-0 truncate rounded-sm text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          [title]="dependency.task.name"
          (click)="opened.emit(dependency.task)"
        >
          {{ dependency.task.key }} · {{ dependency.task.name }}
        </button>
        @if (!disabled()) {
          <button
            type="button"
            class="ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 group-hover/dep:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            [attr.aria-label]="removeLabel(dependency)"
            (click)="removed.emit(dependency)"
          >
            <ng-icon name="phosphorXBold" size="0.75rem" aria-hidden="true" />
          </button>
        }
      </span>
    }
    @if (conflict(); as text) {
      <p class="flex items-center gap-1.5 px-2 py-0.5 text-xs text-grenat-text">
        <ng-icon
          name="phosphorWarningCircleFill"
          class="shrink-0"
          size="0.875rem"
          aria-hidden="true"
        />
        {{ text }}
      </p>
    }
    @if (!disabled()) {
      <button
        type="button"
        class="flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset aria-expanded:bg-selected"
        [cwPopoverTrigger]="popover"
        data-testid="task-property-dependency-add"
      >
        <ng-icon name="phosphorPlusBold" size="0.75rem" aria-hidden="true" />
        <ng-container i18n="@@task.properties.dependency-add">Add a dependency</ng-container>
      </button>
    }
    <cw-popover
      #popover
      side="top"
      align="end"
      size="lg"
      padding="none"
      ariaLabel="Add a dependency"
      i18n-ariaLabel="@@task.properties.dependency-add"
      [open]="open()"
      (openChange)="openChange($event)"
    >
      <div class="flex flex-col gap-1.5 p-1">
        <cw-toggle-group
          type="single"
          size="sm"
          class="grid grid-cols-2"
          ariaLabel="Direction"
          i18n-ariaLabel="@@task.properties.dependency-direction"
          [value]="direction()"
          (valueChange)="pickDirection($event)"
        >
          <button cwToggleGroupItem type="button" value="blocked-by">
            {{ kinds['blocked-by'] }}
          </button>
          <button cwToggleGroupItem type="button" value="blocks">{{ kinds.blocks }}</button>
        </cw-toggle-group>
        <div
          class="flex h-8 items-center gap-2 rounded-md border border-input px-2 focus-within:border-ring"
        >
          <ng-icon
            name="phosphorMagnifyingGlassBold"
            class="text-muted-foreground"
            size="0.875rem"
            aria-hidden="true"
          />
          <label [for]="searchId" class="sr-only" i18n="@@task.properties.dependency-search"
            >Search a task</label
          >
          <input
            #field
            cdkFocusInitial
            type="text"
            autocomplete="off"
            placeholder="Name or key"
            i18n-placeholder="@@task.properties.dependency-search-placeholder"
            class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            [id]="searchId"
            [value]="text()"
            (input)="type(field.value)"
          />
        </div>
        <div class="flex max-h-56 flex-col overflow-y-auto" aria-live="polite">
          @if (candidatesFailed()) {
            <p class="px-2 py-3 text-sm" role="alert">
              <span i18n="@@task.create.read-failed">Could not load this information.</span>
            </p>
          } @else {
            @for (candidate of candidates(); track candidate.key) {
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-selected focus-visible:outline-none"
                (click)="pick(candidate)"
              >
                <cw-status-icon
                  [status]="candidate.status"
                  [milestone]="candidate.milestone"
                  size="3.5"
                />
                <span class="min-w-0 flex-1 truncate">{{ candidate.name }}</span>
                <span class="shrink-0 font-mono text-xs text-muted-foreground">{{
                  candidate.key
                }}</span>
              </button>
            } @empty {
              @if (!candidatesLoading()) {
                <p
                  class="px-2 py-3 text-sm text-muted-foreground"
                  i18n="@@task.properties.dependency-none"
                >
                  No task matches (loops are left out).
                </p>
              }
            }
          }
        </div>
      </div>
    </cw-popover>
  `,
})
export class TaskPropertyDependencies {
  // #region Properties
  /**
   * Property dependencies
   *
   * @description
   * The dependencies, null while read.
   *
   * @type {InputSignal<readonly TaskDependency[] | null>}
   * @readonly
   */
  public readonly dependencies: InputSignal<readonly TaskDependency[] | null> = input<
    readonly TaskDependency[] | null
  >(null);

  /**
   * Property failed
   *
   * @description
   * Whether reading the dependencies failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly failed: InputSignal<boolean> = input(false);

  /**
   * Property anchor
   *
   * @description
   * The open task's dates.
   *
   * @type {InputSignal<DependencyAnchor>}
   * @readonly
   */
  public readonly anchor: InputSignal<DependencyAnchor> = input<DependencyAnchor>({
    start: null,
    due: null,
  });

  /**
   * Property candidates
   *
   * @description
   * Tasks the dialog offers.
   *
   * @type {InputSignal<readonly TaskDependencyTask[]>}
   * @readonly
   */
  public readonly candidates: InputSignal<readonly TaskDependencyTask[]> = input<
    readonly TaskDependencyTask[]
  >([]);

  /**
   * Property candidatesLoading
   *
   * @description
   * Whether the candidates are being read.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly candidatesLoading: InputSignal<boolean> = input(false);

  /**
   * Property candidatesFailed
   *
   * @description
   * Whether reading the candidates failed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly candidatesFailed: InputSignal<boolean> = input(false);

  /**
   * Property today
   *
   * @description
   * Today (`YYYY-MM-DD`), for the warning's date.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly today: InputSignal<string> = input<string>(localDay(new Date()));

  /**
   * Property disabled
   *
   * @description
   * Read-only: no remove buttons, no `Add a dependency`.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property opened
   *
   * @description
   * The other task of a chip, to open.
   *
   * @type {OutputEmitterRef<TaskDependencyTask>}
   * @readonly
   */
  public readonly opened: OutputEmitterRef<TaskDependencyTask> = output<TaskDependencyTask>();

  /**
   * Property removed
   *
   * @description
   * A dependency to remove.
   *
   * @type {OutputEmitterRef<TaskDependency>}
   * @readonly
   */
  public readonly removed: OutputEmitterRef<TaskDependency> = output<TaskDependency>();

  /**
   * Property added
   *
   * @description
   * A dependency to create.
   *
   * @type {OutputEmitterRef<DependencyLink>}
   * @readonly
   */
  public readonly added: OutputEmitterRef<DependencyLink> = output<DependencyLink>();

  /**
   * Property searched
   *
   * @description
   * Candidates to read.
   *
   * @type {OutputEmitterRef<DependencySearch>}
   * @readonly
   */
  public readonly searched: OutputEmitterRef<DependencySearch> = output<DependencySearch>();

  /**
   * Property retried
   *
   * @description
   * `Retry` after a failed read of the dependencies.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly retried: OutputEmitterRef<void> = output();

  /**
   * Property kinds
   *
   * @description
   * Words of the directions.
   *
   * @type {Readonly<Record<TaskDependencyDirection, string>>}
   * @readonly
   */
  protected readonly kinds: Readonly<Record<TaskDependencyDirection, string>> = {
    'blocked-by': $localize`:@@task.properties.dependency-blocked-by:Blocked by`,
    blocks: $localize`:@@task.properties.dependency-blocks-kind:Blocks`,
  };

  /**
   * Property searchId
   *
   * @description
   * Id of the search field, unique per row.
   *
   * @type {string}
   * @readonly
   */
  protected readonly searchId: string = `task-dependency-${crypto.randomUUID()}`;

  /**
   * Property open
   *
   * @description
   * Whether the add dialog is open.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly open: WritableSignal<boolean> = signal<boolean>(false);

  /**
   * Property direction
   *
   * @description
   * Direction of the link to create, `Blocked by` first.
   *
   * @type {WritableSignal<TaskDependencyDirection>}
   * @readonly
   */
  protected readonly direction: WritableSignal<TaskDependencyDirection> =
    signal<TaskDependencyDirection>('blocked-by');

  /**
   * Property text
   *
   * @description
   * Typed text.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly text: WritableSignal<string> = signal<string>('');

  /**
   * Property locale
   *
   * @description
   * Locale of the dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property ordered
   *
   * @description
   * `Blocked by` first, then `Blocks`, each in creation order.
   *
   * @type {Signal<readonly TaskDependency[]>}
   * @readonly
   */
  protected readonly ordered: Signal<readonly TaskDependency[]> = computed(
    (): readonly TaskDependency[] => {
      const all: readonly TaskDependency[] = this.dependencies() ?? [];
      return [
        ...all.filter((edge: TaskDependency): boolean => edge.direction === 'blocked-by'),
        ...all.filter((edge: TaskDependency): boolean => edge.direction === 'blocks'),
      ];
    },
  );

  /**
   * Property conflict
   *
   * @description
   * The date warning: the first open blocker due on or after the task's start (else its due
   * date), or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly conflict: Signal<string | null> = computed((): string | null => {
    const anchor: DependencyAnchor = this.anchor();
    const from: string | null = anchor.start ?? anchor.due;
    if (from === null || anchor.due === null) return null;
    const blocker: TaskDependency | undefined = this.ordered().find(
      (edge: TaskDependency): boolean =>
        edge.direction === 'blocked-by' &&
        edge.task.due !== null &&
        !isClosedStatus(edge.task.status) &&
        edge.task.due.slice(0, 10) >= from.slice(0, 10),
    );
    if (!blocker?.task.due) return null;
    const date: string = shortDayLabel(blocker.task.due, this.today(), this.locale);
    return $localize`:@@task.properties.dependency-conflict:Starts before ${blocker.task.key}:key: ends (${date}:date:)`;
  });
  // #endregion

  // #region Methods
  /**
   * Method openChange
   *
   * @description
   * Starts each opening empty, with `Blocked by`, and reads its candidates.
   *
   * @param {boolean} open - Whether the dialog opens.
   */
  protected openChange(open: boolean): void {
    this.open.set(open);
    if (!open) return;
    this.text.set('');
    this.direction.set('blocked-by');
    this.searched.emit({ direction: 'blocked-by', text: '', delay: false });
  }

  /**
   * Method pickDirection
   *
   * @description
   * Changes the direction and reads its candidates; unselecting the current one keeps it.
   *
   * @param {unknown} value - The toggle group's value.
   */
  protected pickDirection(value: unknown): void {
    if ((value !== 'blocked-by' && value !== 'blocks') || value === this.direction()) return;
    this.direction.set(value);
    this.searched.emit({ direction: value, text: this.text(), delay: false });
  }

  /**
   * Method type
   *
   * @description
   * Follows the typed text.
   *
   * @param {string} value - The text.
   */
  protected type(value: string): void {
    this.text.set(value);
    this.searched.emit({ direction: this.direction(), text: value, delay: true });
  }

  /**
   * Method pick
   *
   * @description
   * Links a candidate and closes the dialog.
   *
   * @param {TaskDependencyTask} task - The candidate.
   */
  protected pick(task: TaskDependencyTask): void {
    this.open.set(false);
    this.added.emit({ task, direction: this.direction() });
  }

  /**
   * Method removeLabel
   *
   * @description
   * Name of a remove button.
   *
   * @param {TaskDependency} dependency - The dependency.
   * @returns {string} The name.
   */
  protected removeLabel(dependency: TaskDependency): string {
    return $localize`:@@task.properties.dependency-remove:Remove the dependency with ${dependency.task.key}:key:`;
  }
  // #endregion
}
