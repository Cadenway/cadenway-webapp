import {
  Component,
  effect,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import { type FieldTree, form, FormField, maxLength, required } from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogClose,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
} from '@cadenway/ui/components/dialog';
import { CwInput } from '@cadenway/ui/components/input';
import { CwToggleGroup, CwToggleGroupItem } from '@cadenway/ui/components/toggle-group';
import { NgIcon } from '@ng-icons/core';

import { lookIconLabels } from '../../../constants/view-labels/view-labels.constants';
import type { LookIcon } from '../../../models/look/look.type';
import type { SavedViewDraft } from '../../../models/saved-view/saved-view.interface';
import { LOOK_ICON_KEYS, lookIconName } from '../../../utils/look/look.util';

/**
 * Interface SaveViewModel
 *
 * @description
 * The name field of the dialog.
 */
interface SaveViewModel {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Typed name.
   *
   * @type {string}
   */
  name: string;
  // #endregion
}

/**
 * Constant DEFAULT_ICON
 *
 * @description
 * Toggle value of the layout's own icon.
 *
 * @type {string}
 */
const DEFAULT_ICON: string = 'default';

/**
 * Component SaveViewDialog
 *
 * @description
 * « Enregistrer la vue » and « Renommer la vue » (`App.dc.html` lines 3172-3190): the summary of
 * the view, its name (required, 80 characters at most; an empty name keeps « Enregistrer »
 * disabled, and the placeholder suggests one) and its icon among the layout's own and the look
 * icons. Opening resets the fields to `initialName` and `initialIcon`. Submitting a valid form
 * emits `submitted` with the trimmed name; the page closes the dialog once the gateway answers,
 * keeping it `pending` meanwhile.
 */
@Component({
  selector: 'cw-save-view-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogClose,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    CwToggleGroup,
    CwToggleGroupItem,
    FormField,
    NgIcon,
  ],
  templateUrl: './save-view-dialog.component.html',
})
export class SaveViewDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog shows; `[(open)]`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model(false);

  /**
   * Property mode
   *
   * @description
   * `create` saves the current view, `rename` renames a saved one.
   *
   * @type {InputSignal<'create' | 'rename'>}
   * @readonly
   */
  public readonly mode: InputSignal<'create' | 'rename'> = input<'create' | 'rename'>('create');

  /**
   * Property summary
   *
   * @description
   * Description of the view (« Liste · 2 filtres · tri : échéance. »).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly summary: InputSignal<string> = input('');

  /**
   * Property placeholder
   *
   * @description
   * Suggested name (« Liste · filtrée »).
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly placeholder: InputSignal<string> = input('');

  /**
   * Property layoutIcon
   *
   * @description
   * Icon of the view's layout, the first choice.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly layoutIcon: InputSignal<string> = input('phosphorListBulletsBold');

  /**
   * Property layoutName
   *
   * @description
   * Name of the view's layout, for the first choice's label.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly layoutName: InputSignal<string> = input('');

  /**
   * Property initialName
   *
   * @description
   * Name filled in when the dialog opens.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly initialName: InputSignal<string> = input('');

  /**
   * Property initialIcon
   *
   * @description
   * Icon chosen when the dialog opens.
   *
   * @type {InputSignal<LookIcon>}
   * @readonly
   */
  public readonly initialIcon: InputSignal<LookIcon> = input<LookIcon>(null);

  /**
   * Property pending
   *
   * @description
   * Whether the submitted view is being recorded.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input(false);

  /**
   * Property submitted
   *
   * @description
   * Emits the name and icon of a valid submission.
   *
   * @type {OutputEmitterRef<SavedViewDraft>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<SavedViewDraft> = output<SavedViewDraft>();

  /**
   * Property model
   *
   * @description
   * Field values.
   *
   * @type {WritableSignal<SaveViewModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<SaveViewModel> = signal({ name: '' });

  /**
   * Property viewForm
   *
   * @description
   * The name field and its rules.
   *
   * @type {FieldTree<SaveViewModel>}
   * @readonly
   */
  protected readonly viewForm: FieldTree<SaveViewModel> = form(this.model, (path) => {
    required(path.name, {
      message: $localize`:@@spaces.save-view.name-required:Enter a name for the view.`,
    });
    maxLength(path.name, 80);
  });

  /**
   * Property icon
   *
   * @description
   * Chosen icon as a toggle value, `default` for the layout's icon.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly icon: WritableSignal<string> = signal(DEFAULT_ICON);

  /**
   * Property icons
   *
   * @description
   * The look icons offered after the layout's.
   *
   * @type {readonly { value: string; name: string; label: string }[]}
   * @readonly
   */
  protected readonly icons: readonly { value: string; name: string; label: string }[] =
    LOOK_ICON_KEYS.map((key: Exclude<LookIcon, null>) => ({
      value: key,
      name: lookIconName(key),
      label: lookIconLabels()[key],
    }));
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Resets the fields each time the dialog opens.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      if (!this.open()) return;
      untracked((): void => {
        this.model.set({ name: this.initialName() });
        this.icon.set(this.initialIcon() ?? DEFAULT_ICON);
        this.viewForm().reset();
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method pickIcon
   *
   * @description
   * Keeps the icon chosen in the toggle group; a cleared choice goes back to the layout's.
   *
   * @param {string | null | readonly string[]} value - Toggle value.
   */
  protected pickIcon(value: string | null | readonly string[]): void {
    this.icon.set(typeof value === 'string' ? value : DEFAULT_ICON);
  }

  /**
   * Method submit
   *
   * @description
   * Emits a valid submission; an invalid one marks the name touched and focuses it.
   *
   * @param {HTMLInputElement} field - The name field.
   */
  protected submit(field: HTMLInputElement): void {
    const name: string = this.model().name.trim();
    if (this.pending()) return;
    if (!name || this.viewForm().invalid()) {
      this.viewForm.name().markAsTouched();
      field.focus();
      return;
    }
    const icon: string = this.icon();
    this.submitted.emit({
      name,
      icon: icon === DEFAULT_ICON ? null : (icon as Exclude<LookIcon, null>),
    });
  }
  // #endregion
}
