import {
  booleanAttribute,
  Component,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  model,
  type ModelSignal,
} from '@angular/core';
import { CwCombobox, CwComboboxOption } from '@cadenway/ui/components/combobox';

import { TASK_COMBOBOX_LABELS } from '../../../constants/task-brick-labels/task-brick-labels.constants';
import type { Person } from '../../../models/person/person.interface';

/**
 * Component TaskPeoplePicker
 *
 * @description
 * The assignees property (`App.dc.html` near line 2915): a multi-check `cw-combobox` of the
 * organization's people, searchable by name, the current user marked « (moi) ». The trigger reads
 * « Assigner » when nobody is chosen, the person's name for one and « n personnes » for more. The
 * chosen user ids are a two-way `value`.
 */
@Component({
  selector: 'cw-task-people-picker',
  imports: [CwCombobox, CwComboboxOption],
  providers: [TASK_COMBOBOX_LABELS],
  template: `
    <cw-combobox
      multiple
      size="sm"
      [value]="value()"
      (valueChange)="choose($event)"
      [loading]="loading()"
      [disabled]="disabled()"
      [summary]="summary"
      placeholder="Assign"
      i18n-placeholder="@@task.people-picker.placeholder"
      searchPlaceholder="Search for a person…"
      i18n-searchPlaceholder="@@task.people-picker.search"
      ariaLabel="Assignees"
      i18n-ariaLabel="@@task.people-picker.label"
    >
      @for (person of people(); track person.id) {
        <cw-combobox-option [value]="person.id" [keywords]="[person.name]">
          <span
            class="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] leading-none font-semibold text-secondary-foreground"
            aria-hidden="true"
            >{{ person.initials }}</span
          >
          @if (person.id === currentUserId()) {
            <span i18n="@@task.people-picker.me">{{ person.name }} (me)</span>
          } @else {
            <span>{{ person.name }}</span>
          }
        </cw-combobox-option>
      }
    </cw-combobox>
  `,
})
export class TaskPeoplePicker {
  // #region Properties
  /**
   * Property people
   *
   * @description
   * People who can be chosen.
   *
   * @type {InputSignal<readonly Person[]>}
   * @readonly
   */
  public readonly people: InputSignal<readonly Person[]> = input<readonly Person[]>([]);

  /**
   * Property currentUserId
   *
   * @description
   * User id of the person using the app, marked « (moi) ».
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly currentUserId: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property loading
   *
   * @description
   * Whether the people are still being read.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly loading: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property disabled
   *
   * @description
   * Whether the choice cannot be changed.
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly disabled: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property value
   *
   * @description
   * User ids of the chosen people, two-way.
   *
   * @type {ModelSignal<readonly string[]>}
   * @readonly
   */
  public readonly value: ModelSignal<readonly string[]> = model<readonly string[]>([]);

  /**
   * Property summary
   *
   * @description
   * Trigger text for several people (« 3 personnes »).
   *
   * @type {(count: number) => string}
   * @readonly
   */
  protected readonly summary: (count: number) => string = (count: number): string =>
    $localize`:@@task.people-picker.summary:${count}:count: people`;
  // #endregion

  // #region Methods
  /**
   * Method choose
   *
   * @description
   * Takes the combobox's new choice as the value.
   *
   * @param {unknown} value - What the combobox emits: the chosen ids.
   */
  protected choose(value: unknown): void {
    this.value.set(
      Array.isArray(value) ? value.filter((id: unknown) => typeof id === 'string') : [],
    );
  }
  // #endregion
}
