import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import { CwInput } from '@cadenway/ui/components/input';
import {
  CwMenu,
  CwMenuItem,
  CwMenuItemRadio,
  CwMenuLabel,
  CwMenuRadioGroup,
  CwMenuSeparator,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwPopover, CwPopoverTrigger } from '@cadenway/ui/components/popover';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwToolbar, CwToolbarItem, CwToolbarSpacer } from '@cadenway/ui/components/toolbar';
import { NgIcon } from '@ng-icons/core';

import { PRIORITY_ORDER } from '../../../constants/statuses/statuses.constants';
import {
  filterFieldLabels,
  groupLabels,
  priorityLabels,
  sortLabels,
  subtaskModeLabels,
} from '../../../constants/view-labels/view-labels.constants';
import type {
  FilterField,
  ListGroupBy,
  ListSortField,
  ListViewConfig,
  StatusKey,
  SubtaskMode,
} from '../../../models/list-view-config/list-view-config.interface';
import type { SavedView } from '../../../models/saved-view/saved-view.interface';
import type { FilterChip, ViewOption } from '../../../models/view-option/view-option.interface';
import { SORT_FIELDS } from '../../../utils/list-view-query/list-view-query.util';

/**
 * Interface FilterSection
 *
 * @description
 * A fieldset of the « Filtrer » dialog.
 */
interface FilterSection {
  // #region Properties
  /**
   * Property field
   *
   * @description
   * Filter field.
   *
   * @type {FilterField}
   * @readonly
   */
  readonly field: FilterField;

  /**
   * Property title
   *
   * @description
   * Legend of the fieldset.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property options
   *
   * @description
   * Values offered.
   *
   * @type {readonly ViewOption[]}
   * @readonly
   */
  readonly options: readonly ViewOption[];
  // #endregion
}

/**
 * Constant FIELD_ICONS
 *
 * @description
 * Icon of each filter field in the chips (`FIELD_DEFS`).
 *
 * @type {Readonly<Record<FilterField, string>>}
 */
const FIELD_ICONS: Readonly<Record<FilterField, string>> = {
  status: 'phosphorCircleHalfBold',
  priority: 'phosphorCellSignalHighBold',
  assignee: 'phosphorUserBold',
  label: 'phosphorTagBold',
};

/**
 * Constant FIELDS
 *
 * @description
 * Filter fields, in the dialog's order.
 *
 * @type {readonly FilterField[]}
 */
const FIELDS: readonly FilterField[] = ['status', 'priority', 'assignee', 'label'];

/**
 * Component ViewTools
 *
 * @description
 * The tools of a list view (`App.dc.html` lines 371-483): the « Outils de la vue » toolbar with
 * « Jalons n », « Filtrer » (a dialog of checkboxes by status, priority, assignee — « Moi »,
 * « Non assigné » — and label, with « Tout effacer »), « Trier par » (five criteria and the
 * direction), « Grouper par » (status, priority, assignee, none), the search and « Créer une
 * tâche »; then the « Filtres actifs » row: a chip per field with its removal, « + Filtre » (which
 * opens the same dialog), « Tout effacer » or « Aucun filtre · n tâches », the applied saved view's
 * « Modifiée » with « Rétablir » and « Enregistrer », the subtask display menu and « Enregistrer
 * la vue ». Presentational: it renders the configuration it receives and emits each change;
 * `taskCreated` is left for the task feature's creation dialog.
 */
@Component({
  selector: 'cw-view-tools',
  imports: [
    CwButton,
    CwCheckbox,
    CwInput,
    CwMenu,
    CwMenuItem,
    CwMenuItemRadio,
    CwMenuLabel,
    CwMenuRadioGroup,
    CwMenuSeparator,
    CwMenuTriggerFor,
    CwPopover,
    CwPopoverTrigger,
    CwStatusIcon,
    CwToolbar,
    CwToolbarItem,
    CwToolbarSpacer,
    NgIcon,
  ],
  host: { class: 'flex flex-col gap-2' },
  templateUrl: './view-tools.component.html',
})
export class ViewTools {
  // #region Properties
  /**
   * Property config
   *
   * @description
   * The view's configuration.
   *
   * @type {InputSignal<ListViewConfig>}
   * @readonly
   */
  public readonly config: InputSignal<ListViewConfig> = input.required<ListViewConfig>();

  /**
   * Property statuses
   *
   * @description
   * Statuses the space shows, with its labels.
   *
   * @type {InputSignal<readonly ViewOption<StatusKey>[]>}
   * @readonly
   */
  public readonly statuses: InputSignal<readonly ViewOption<StatusKey>[]> =
    input.required<readonly ViewOption<StatusKey>[]>();

  /**
   * Property labels
   *
   * @description
   * Labels offered by the « Étiquette » filter.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly labels: InputSignal<readonly string[]> = input<readonly string[]>([]);

  /**
   * Property people
   *
   * @description
   * Organization members available for assignee filters.
   *
   * @type {InputSignal<readonly ViewOption[]>}
   * @readonly
   */
  public readonly people: InputSignal<readonly ViewOption[]> = input<readonly ViewOption[]>([]);

  /**
   * Property search
   *
   * @description
   * Search text.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly search: InputSignal<string> = input('');

  /**
   * Property milestonesOnly
   *
   * @description
   * Whether « Jalons » is pressed.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly milestonesOnly: InputSignal<boolean> = input(false);

  /**
   * Property milestoneCount
   *
   * @description
   * Milestones of the list, or null before they are counted.
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly milestoneCount: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property taskTotal
   *
   * @description
   * Top-level tasks of the list, for « Aucun filtre · n tâches », or null.
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly taskTotal: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property visibleCount
   *
   * @description
   * Tasks the view shows with its filters, for « n sur m tâches » in the filter dialog, or null
   * when unknown (the footer then shows « Tout effacer » alone).
   *
   * @type {InputSignal<number | null>}
   * @readonly
   */
  public readonly visibleCount: InputSignal<number | null> = input<number | null>(null);

  /**
   * Property hasSubtasks
   *
   * @description
   * Whether the list has subtasks; « Sous-tâches : … » shows only then (`listHasKids` of
   * `App.dc.html`). True by default, so the display stays reachable while it is unknown.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly hasSubtasks: InputSignal<boolean> = input(true);

  /**
   * Property userId
   *
   * @description
   * The signed-in member, offered once as « Moi » in the assignee filter rather than by name.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly userId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property savedView
   *
   * @description
   * The applied saved view, or null.
   *
   * @type {InputSignal<SavedView | null>}
   * @readonly
   */
  public readonly savedView: InputSignal<SavedView | null> = input<SavedView | null>(null);

  /**
   * Property modified
   *
   * @description
   * Whether the applied saved view differs from what it saved.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly modified: InputSignal<boolean> = input(false);

  /**
   * Property canSave
   *
   * @description
   * Whether « Enregistrer la vue » shows.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canSave: InputSignal<boolean> = input(false);

  /**
   * Property saveDisabled
   *
   * @description
   * Whether saving a new view is unavailable while its collection is unresolved.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly saveDisabled: InputSignal<boolean> = input(false);

  /**
   * Property milestonesToggled
   *
   * @description
   * Emits when « Jalons » is pressed or released.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly milestonesToggled: OutputEmitterRef<void> = output();

  /**
   * Property filterToggled
   *
   * @description
   * Emits a value checked or unchecked in « Filtrer ».
   *
   * @type {OutputEmitterRef<{ field: FilterField; value: string }>}
   * @readonly
   */
  public readonly filterToggled: OutputEmitterRef<{ field: FilterField; value: string }> = output<{
    field: FilterField;
    value: string;
  }>();

  /**
   * Property filterCleared
   *
   * @description
   * Emits the field of a removed chip.
   *
   * @type {OutputEmitterRef<FilterField>}
   * @readonly
   */
  public readonly filterCleared: OutputEmitterRef<FilterField> = output<FilterField>();

  /**
   * Property filtersCleared
   *
   * @description
   * Emits on « Tout effacer ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly filtersCleared: OutputEmitterRef<void> = output();

  /**
   * Property sortChanged
   *
   * @description
   * Emits the chosen sort criterion.
   *
   * @type {OutputEmitterRef<ListSortField>}
   * @readonly
   */
  public readonly sortChanged: OutputEmitterRef<ListSortField> = output<ListSortField>();

  /**
   * Property sortDirectionToggled
   *
   * @description
   * Emits on « Ordre ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly sortDirectionToggled: OutputEmitterRef<void> = output();

  /**
   * Property groupChanged
   *
   * @description
   * Emits the chosen grouping.
   *
   * @type {OutputEmitterRef<ListGroupBy>}
   * @readonly
   */
  public readonly groupChanged: OutputEmitterRef<ListGroupBy> = output<ListGroupBy>();

  /**
   * Property subtasksChanged
   *
   * @description
   * Emits the chosen subtask display.
   *
   * @type {OutputEmitterRef<SubtaskMode>}
   * @readonly
   */
  public readonly subtasksChanged: OutputEmitterRef<SubtaskMode> = output<SubtaskMode>();

  /**
   * Property searchChanged
   *
   * @description
   * Emits the typed search.
   *
   * @type {OutputEmitterRef<string>}
   * @readonly
   */
  public readonly searchChanged: OutputEmitterRef<string> = output<string>();

  /**
   * Property taskCreated
   *
   * @description
   * Emits on « Créer une tâche »; the task feature's creation dialog answers it in the next pass.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly taskCreated: OutputEmitterRef<void> = output();

  /**
   * Property saveRequested
   *
   * @description
   * Emits on « Enregistrer la vue ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly saveRequested: OutputEmitterRef<void> = output();

  /**
   * Property savedReverted
   *
   * @description
   * Emits on « Rétablir ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly savedReverted: OutputEmitterRef<void> = output();

  /**
   * Property savedUpdated
   *
   * @description
   * Emits on « Enregistrer » of a modified saved view.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly savedUpdated: OutputEmitterRef<void> = output();

  /**
   * Property filterOpen
   *
   * @description
   * Whether the « Filtrer » dialog is open; « + Filtre » opens it too.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly filterOpen: WritableSignal<boolean> = signal(false);

  /**
   * Property locale
   *
   * @description
   * Application locale, for the lower case of the button labels.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property fieldLabels
   *
   * @description
   * Names of the filter fields.
   *
   * @type {Readonly<Record<FilterField, string>>}
   * @readonly
   */
  private readonly fieldLabels: Readonly<Record<FilterField, string>> = filterFieldLabels();

  /**
   * Property sortOptions
   *
   * @description
   * Criteria of « Trier par ».
   *
   * @type {readonly ViewOption<ListSortField>[]}
   * @readonly
   */
  protected readonly sortOptions: readonly ViewOption<ListSortField>[] = SORT_FIELDS.map(
    (value: ListSortField): ViewOption<ListSortField> => ({ value, label: sortLabels()[value] }),
  );

  /**
   * Property groupOptions
   *
   * @description
   * Choices of « Grouper par », « Aucun » valued `none`.
   *
   * @type {readonly ViewOption[]}
   * @readonly
   */
  protected readonly groupOptions: readonly ViewOption[] = (
    ['status', 'priority', 'assignee', 'none'] as const
  ).map((value: 'status' | 'priority' | 'assignee' | 'none'): ViewOption => ({
    value,
    label: groupLabels()[value],
  }));

  /**
   * Property subtaskModes
   *
   * @description
   * Choices of the subtask display.
   *
   * @type {readonly (ViewOption<SubtaskMode> & { hint: string; icon: string })[]}
   * @readonly
   */
  protected readonly subtaskModes: readonly (ViewOption<SubtaskMode> & {
    hint: string;
    icon: string;
  })[] = (['nested', 'expanded', 'separate'] as const).map((value: SubtaskMode) => ({
    value,
    label: subtaskModeLabels()[value].label,
    hint: subtaskModeLabels()[value].hint,
    icon: subtaskModeLabels()[value].icon,
  }));

  /**
   * Property sections
   *
   * @description
   * The fieldsets of « Filtrer ».
   *
   * @type {Signal<readonly FilterSection[]>}
   * @readonly
   */
  protected readonly sections: Signal<readonly FilterSection[]> = computed(
    (): readonly FilterSection[] => {
      const priorities: Readonly<Record<string, string>> = priorityLabels();
      return [
        { field: 'status', title: this.fieldLabels.status, options: this.statuses() },
        {
          field: 'priority',
          title: this.fieldLabels.priority,
          options: PRIORITY_ORDER.map((value: string): ViewOption => ({
            value,
            label: priorities[value] ?? value,
          })),
        },
        {
          field: 'assignee',
          title: this.fieldLabels.assignee,
          options: [
            { value: 'me', label: $localize`:@@spaces.filter.me:Me` },
            ...this.people().filter(
              (person: ViewOption): boolean => person.value !== this.userId(),
            ),
            { value: 'none', label: $localize`:@@spaces.filter.unassigned:Unassigned` },
          ],
        },
        {
          field: 'label',
          title: this.fieldLabels.label,
          options: this.labels().map((value: string): ViewOption => ({ value, label: value })),
        },
      ];
    },
  );

  /**
   * Property chips
   *
   * @description
   * The active filters, a chip per field. An assignee id names its member, the signed-in one
   * included (a saved view may name them).
   *
   * @type {Signal<readonly FilterChip[]>}
   * @readonly
   */
  protected readonly chips: Signal<readonly FilterChip[]> = computed((): readonly FilterChip[] => {
    const sections: readonly FilterSection[] = this.sections();
    return FIELDS.flatMap((field: FilterField): FilterChip[] => {
      const values: readonly string[] = this.config().filters[field];
      if (values.length === 0) return [];
      const options: readonly ViewOption[] = [
        ...(sections.find((section: FilterSection): boolean => section.field === field)?.options ??
          []),
        ...(field === 'assignee' ? this.people() : []),
      ];
      return [
        {
          field,
          icon: FIELD_ICONS[field],
          name: this.fieldLabels[field],
          operator:
            values.length > 1
              ? $localize`:@@spaces.chips.one-of:is one of`
              : $localize`:@@spaces.chips.is:is`,
          values: values
            .map(
              (value: string): string =>
                options.find((option: ViewOption): boolean => option.value === value)?.label ??
                value,
            )
            .join(', '),
        },
      ];
    });
  });

  /**
   * Property filterCount
   *
   * @description
   * Number on « Filtrer »: fields that filter something.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly filterCount: Signal<number> = computed((): number => this.chips().length);

  /**
   * Property sortLabel
   *
   * @description
   * « Trier », or « Tri : échéance ».
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly sortLabel: Signal<string> = computed((): string => {
    const field: ListSortField = this.config().sort.field;
    if (field === 'manual') return $localize`:@@spaces.sort.button:Sort`;
    const criterion: string = sortLabels()[field].toLocaleLowerCase(this.locale);
    return $localize`:@@spaces.sort.button-active:Sort: ${criterion}:criterion:`;
  });

  /**
   * Property groupLabel
   *
   * @description
   * « Grouper : statut ».
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly groupLabel: Signal<string> = computed((): string => {
    const group: string = groupLabels()[this.config().groupBy ?? 'none'].toLocaleLowerCase(
      this.locale,
    );
    return $localize`:@@spaces.group.button:Group: ${group}:group:`;
  });

  /**
   * Property groupValue
   *
   * @description
   * The chosen grouping as a menu value, `none` for none.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly groupValue: Signal<string> = computed(
    (): string => this.config().groupBy ?? 'none',
  );

  /**
   * Property subtaskShort
   *
   * @description
   * Short form of the subtask display on its button.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly subtaskShort: Signal<string> = computed(
    (): string => subtaskModeLabels()[this.config().subtasks].short,
  );
  // #endregion

  // #region Methods
  /**
   * Method isChecked
   *
   * @description
   * Whether a filter value is kept.
   *
   * @param {FilterField} field - Field.
   * @param {string} value - Value.
   * @returns {boolean} Whether it is checked.
   */
  protected isChecked(field: FilterField, value: string): boolean {
    const values: readonly string[] = this.config().filters[field];
    return values.includes(value);
  }

  /**
   * Method removeLabel
   *
   * @description
   * Name of a chip's removal (« Retirer le filtre Statut »).
   *
   * @param {FilterChip} chip - The chip.
   * @returns {string} The label.
   */
  protected removeLabel(chip: FilterChip): string {
    return $localize`:@@spaces.chips.remove:Remove the ${chip.name}:field: filter`;
  }

  /**
   * Method pickGroup
   *
   * @description
   * Emits a grouping picked in the menu.
   *
   * @param {string | undefined} value - Menu value.
   */
  protected pickGroup(value: string | undefined): void {
    if (value === 'status' || value === 'priority' || value === 'assignee') {
      this.groupChanged.emit(value);
    } else if (value === 'none') {
      this.groupChanged.emit(null);
    }
  }

  /**
   * Method pickSort
   *
   * @description
   * Emits a sort criterion picked in the menu.
   *
   * @param {string | undefined} value - Menu value.
   */
  protected pickSort(value: string | undefined): void {
    const field: ListSortField | undefined = SORT_FIELDS.find(
      (item: ListSortField): boolean => item === value,
    );
    if (field) this.sortChanged.emit(field);
  }

  /**
   * Method pickSubtasks
   *
   * @description
   * Emits a subtask display picked in the menu.
   *
   * @param {string | undefined} value - Menu value.
   */
  protected pickSubtasks(value: string | undefined): void {
    if (value === 'nested' || value === 'expanded' || value === 'separate') {
      this.subtasksChanged.emit(value);
    }
  }

  /**
   * Method onSearch
   *
   * @description
   * Emits the typed search.
   *
   * @param {Event} event - Input event of the field.
   */
  protected onSearch(event: Event): void {
    this.searchChanged.emit((event.target as HTMLInputElement).value);
  }

  /**
   * Method asStatus
   *
   * @description
   * Reads a status option's value as a status key; the status section offers only those.
   *
   * @param {string} value - Option value.
   * @returns {StatusKey} The status.
   */
  protected asStatus(value: string): StatusKey {
    return value as StatusKey;
  }

  /**
   * Method visibleLabel
   *
   * @description
   * Footer of the filter dialog: « 3 sur 12 tâches ».
   *
   * @returns {string} The label.
   */
  protected visibleLabel(): string {
    const shown: number = this.visibleCount() ?? 0;
    const total: number = this.taskTotal() ?? 0;
    return total === 1
      ? $localize`:@@spaces.filter.visible-one:${shown}:shown: of ${total}:total: task`
      : $localize`:@@spaces.filter.visible-many:${shown}:shown: of ${total}:total: tasks`;
  }

  /**
   * Method modifiedHint
   *
   * @description
   * Hint of « Modifiée » (« Différente de « Bugs critiques » enregistrée »).
   *
   * @param {SavedView} view - The applied saved view.
   * @returns {string} The hint.
   */
  protected modifiedHint(view: SavedView): string {
    return $localize`:@@spaces.saved.modified-hint:Different from the saved “${view.name}:name:”`;
  }

  /**
   * Method checkboxId
   *
   * @description
   * Identifier of a filter checkbox, for its label.
   *
   * @param {FilterField} field - Field.
   * @param {number} index - Option index.
   * @returns {string} The identifier.
   */
  protected checkboxId(field: FilterField, index: number): string {
    return `view-filter-${field}-${String(index)}`;
  }
  // #endregion
}
