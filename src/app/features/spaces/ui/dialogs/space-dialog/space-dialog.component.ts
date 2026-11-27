import {
  Component,
  computed,
  effect,
  input,
  type InputSignal,
  model,
  type ModelSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwDialog,
  CwDialogClose,
  CwDialogDescription,
  CwDialogFooter,
  CwDialogHeader,
  CwDialogTitle,
  provideCwDialogLabels,
} from '@cadenway/ui/components/dialog';
import { CwInput } from '@cadenway/ui/components/input';
import { CwRadioGroup, CwRadioGroupItem } from '@cadenway/ui/components/radio-group';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { NgIcon } from '@ng-icons/core';

import type { LookColor, LookIcon } from '../../../models/look/look.type';
import type { SpaceDetails, SpaceDraft } from '../../../models/space/space.interface';
import { lookIconName, lookTone } from '../../../utils/look/look.util';
import { prefixFromName } from '../../../utils/space-look/space-look.util';
import { LookPicker } from '../look-picker/look-picker.component';

/**
 * Constant PREFIX_PATTERN
 *
 * @description
 * A valid prefix: 2 to 5 unaccented letters, compared in capitals.
 *
 * @type {RegExp}
 */
const PREFIX_PATTERN: RegExp = /^[A-Z]{2,5}$/u;

/**
 * Interface SpaceFormModel
 *
 * @description
 * The text fields of the space dialog.
 */
interface SpaceFormModel {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * `Space name`.
   *
   * @type {string}
   */
  name: string;

  /**
   * Property prefix
   *
   * @description
   * `Prefix`, shown in capitals.
   *
   * @type {string}
   */
  prefix: string;

  /**
   * Property description
   *
   * @description
   * `Description`.
   *
   * @type {string}
   */
  description: string;
  // #endregion
}

/**
 * Component SpaceDialog
 *
 * @description
 * `Create a space` and `Edit the space` (`App.dc.html`, `dlgSpace`): the name with a
 * preview of the space's mark, the prefix of its task keys (proposed from the name until edited,
 * kept as is when editing), the description, the icon, the color and the confidentiality
 * (`All of {organization}` or `Private`). The confidentiality is offered only to the people who
 * manage the space. The submit button stays disabled while the name or the prefix is invalid,
 * and a prefix used by another known space, or refused by the gateway (`prefixTaken`), shows
 * its error. Presentational: it emits the trimmed draft; the host records it and closes.
 */
@Component({
  selector: 'cw-space-dialog',
  imports: [
    CwButton,
    CwDialog,
    CwDialogClose,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    CwRadioGroup,
    CwRadioGroupItem,
    CwTextarea,
    FormField,
    LookPicker,
    NgIcon,
  ],
  providers: [provideCwDialogLabels(() => ({ close: $localize`:@@spaces.labels.close:Close` }))],
  templateUrl: './space-dialog.component.html',
})
export class SpaceDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog shows; opening it starts over from `space`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model(false);

  /**
   * Property space
   *
   * @description
   * The space edited, or null to create one.
   *
   * @type {InputSignal<SpaceDetails | null>}
   * @readonly
   */
  public readonly space: InputSignal<SpaceDetails | null> = input<SpaceDetails | null>(null);

  /**
   * Property organizationName
   *
   * @description
   * Name of the organization, in `All of Atelier Nord`.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly organizationName: InputSignal<string> = input('');

  /**
   * Property takenPrefixes
   *
   * @description
   * Prefixes of the other spaces the caller sees.
   *
   * @type {InputSignal<readonly string[]>}
   * @readonly
   */
  public readonly takenPrefixes: InputSignal<readonly string[]> = input<readonly string[]>([]);

  /**
   * Property prefixTaken
   *
   * @description
   * The prefix the gateway refused as used (`space.prefix-taken`), or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly prefixTaken: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property pending
   *
   * @description
   * Whether the draft is being recorded.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input(false);

  /**
   * Property submitted
   *
   * @description
   * Emits the trimmed draft on `Create the space` or `Save`.
   *
   * @type {OutputEmitterRef<SpaceDraft>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<SpaceDraft> = output<SpaceDraft>();

  /**
   * Property model
   *
   * @description
   * The text fields.
   *
   * @type {WritableSignal<SpaceFormModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<SpaceFormModel> = signal({
    name: '',
    prefix: '',
    description: '',
  });

  /**
   * Property icon
   *
   * @description
   * The icon chosen, or null for the initial.
   *
   * @type {WritableSignal<LookIcon>}
   * @readonly
   */
  protected readonly icon: WritableSignal<LookIcon> = signal<LookIcon>(null);

  /**
   * Property color
   *
   * @description
   * The color chosen.
   *
   * @type {WritableSignal<LookColor>}
   * @readonly
   */
  protected readonly color: WritableSignal<LookColor> = signal<LookColor>('gris');

  /**
   * Property visibility
   *
   * @description
   * `organization` or `private`.
   *
   * @type {WritableSignal<string>}
   * @readonly
   */
  protected readonly visibility: WritableSignal<string> = signal('organization');

  /**
   * Property prefixEdited
   *
   * @description
   * Whether the prefix was typed, which stops proposing it from the name.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  private readonly prefixEdited: WritableSignal<boolean> = signal(false);

  /**
   * Property spaceForm
   *
   * @description
   * The validated fields: a name, a prefix of 2 to 5 letters no other space uses, and a
   * description of 500 characters at most.
   *
   * @type {FieldTree<SpaceFormModel>}
   * @readonly
   */
  protected readonly spaceForm: FieldTree<SpaceFormModel> = form(this.model, (path) => {
    required(path.name, {
      message: $localize`:@@spaces.space-dialog.name-required:Enter the name of the space.`,
    });
    maxLength(path.name, 80);
    maxLength(path.description, 500);
    validate(path.prefix, (context: FieldContext<string>) => {
      const prefix: string = context.value().toUpperCase();
      if (!PREFIX_PATTERN.test(prefix)) {
        return {
          kind: 'prefix',
          message: $localize`:@@spaces.space-dialog.prefix-invalid:From 2 to 5 letters, without accents.`,
        };
      }
      return this.takenPrefixes().includes(prefix) || this.prefixTaken() === prefix
        ? {
            kind: 'prefix-taken',
            message: $localize`:@@spaces.space-dialog.prefix-taken:This prefix is already used by another space.`,
          }
        : undefined;
    });
  });

  /**
   * Property editing
   *
   * @description
   * Whether a space is edited rather than created.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly editing: Signal<boolean> = computed((): boolean => this.space() !== null);

  /**
   * Property canChangeVisibility
   *
   * @description
   * Whether the confidentiality is offered: always on creation, to its managers when editing.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly canChangeVisibility: Signal<boolean> = computed(
    (): boolean => this.space()?.canManage ?? true,
  );

  /**
   * Property initial
   *
   * @description
   * The initial of the name, `?` while it is empty.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly initial: Signal<string> = computed((): string =>
    (this.model().name.trim().charAt(0) || '?').toUpperCase(),
  );

  /**
   * Property markIcon
   *
   * @description
   * Fill glyph of the preview, or null for the initial.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly markIcon: Signal<string | null> = computed((): string | null => {
    const icon: LookIcon = this.icon();
    return icon ? lookIconName(icon, true) : null;
  });

  /**
   * Property markTone
   *
   * @description
   * Text color of the preview.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly markTone: Signal<string> = computed((): string =>
    this.color() === 'gris' ? 'text-foreground' : lookTone(this.color()),
  );

  /**
   * Property prefixHint
   *
   * @description
   * The hint under the prefix while it is valid: how the tasks will be numbered.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly prefixHint: Signal<string> = computed((): string => {
    const prefix: string = this.model().prefix.toUpperCase() || '…';
    return this.editing()
      ? $localize`:@@spaces.space-dialog.prefix-hint-edit:New tasks will be numbered ${prefix}:prefix:-1, ${prefix}:prefixAgain:-2…; existing tasks keep their key.`
      : $localize`:@@spaces.space-dialog.prefix-hint:Tasks will be numbered ${prefix}:prefix:-1, ${prefix}:prefixAgain:-2…`;
  });

  /**
   * Property title
   *
   * @description
   * `Create a space` or `Edit the space`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string =>
    this.editing()
      ? $localize`:@@spaces.space-dialog.edit-title:Edit the space`
      : $localize`:@@spaces.space-dialog.create-title:Create a space`,
  );

  /**
   * Property organizationLabel
   *
   * @description
   * `All of Atelier Nord`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly organizationLabel: Signal<string> = computed((): string => {
    const name: string = this.organizationName();
    return $localize`:@@spaces.space-dialog.organization:All of ${name}:name:`;
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the fields over from the space, or empty, each time the dialog opens.
   *
   * @constructor
   */
  public constructor() {
    effect((): void => {
      if (!this.open()) return;
      untracked((): void => {
        const space: SpaceDetails | null = this.space();
        this.model.set({
          name: space?.name ?? '',
          prefix: space?.prefix ?? '',
          description: space?.description ?? '',
        });
        this.icon.set(space?.icon ?? null);
        this.color.set(space?.color ?? 'gris');
        this.visibility.set(space?.private ? 'private' : 'organization');
        this.prefixEdited.set(space !== null);
        this.spaceForm().reset();
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method nameTyped
   *
   * @description
   * Proposes the prefix from the name while creating, until the prefix is typed.
   */
  protected nameTyped(): void {
    if (this.prefixEdited()) return;
    this.model.update((current: SpaceFormModel): SpaceFormModel => ({
      ...current,
      prefix: prefixFromName(current.name),
    }));
  }

  /**
   * Method prefixTyped
   *
   * @description
   * Keeps the prefix typed in capitals, five letters at most, and stops proposing it.
   */
  protected prefixTyped(): void {
    this.prefixEdited.set(true);
    this.model.update((current: SpaceFormModel): SpaceFormModel => ({
      ...current,
      prefix: current.prefix.toUpperCase().slice(0, 5),
    }));
  }

  /**
   * Method pickVisibility
   *
   * @description
   * Takes the confidentiality chosen.
   *
   * @param {string | null} value - `organization` or `private`.
   */
  protected pickVisibility(value: string | null): void {
    if (value === 'organization' || value === 'private') this.visibility.set(value);
  }

  /**
   * Method submit
   *
   * @description
   * Emits the trimmed draft, or focuses the first invalid field.
   *
   * @param {HTMLInputElement} nameField - The name field.
   * @param {HTMLInputElement} prefixField - The prefix field.
   */
  protected submit(nameField: HTMLInputElement, prefixField: HTMLInputElement): void {
    if (this.pending()) return;
    if (this.spaceForm.name().invalid()) {
      this.spaceForm.name().markAsTouched();
      nameField.focus();
      return;
    }
    if (this.spaceForm.prefix().invalid()) {
      this.spaceForm.prefix().markAsTouched();
      prefixField.focus();
      return;
    }
    const value: SpaceFormModel = this.model();
    this.submitted.emit({
      name: value.name.trim(),
      prefix: value.prefix.toUpperCase(),
      description: value.description.trim() || null,
      icon: this.icon(),
      color: this.color(),
      private: this.visibility() === 'private',
    });
  }
  // #endregion
}
