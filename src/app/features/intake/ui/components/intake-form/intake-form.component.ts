import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  type FieldContext,
  type FieldTree,
  form,
  FormField,
  required,
  submit,
  validate,
  type ValidationError,
} from '@angular/forms/signals';
import { CwButton } from '@cadenway/ui/components/button';
import { CwDatePicker } from '@cadenway/ui/components/date-picker';
import { CwDropzone, type CwDropzoneRejection } from '@cadenway/ui/components/dropzone';
import { CwInput } from '@cadenway/ui/components/input';
import { CwPriorityIcon } from '@cadenway/ui/components/priority-icon';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { NgIcon } from '@ng-icons/core';

import {
  INTAKE_FORM_BRICK_LABELS,
  INTAKE_MAX_FILE_BYTES,
  INTAKE_MAX_FILES,
  INTAKE_PRIORITIES,
  intakeFieldLabels,
  intakePriorityLabels,
} from '../../../constants/intake-labels/intake-labels.constants';
import type {
  IntakeFailure,
  IntakeFieldKey,
  IntakeFieldMode,
  IntakeFormSettings,
  IntakeOrganization,
  IntakePriority,
  IntakeRequest,
} from '../../../models/intake-form/intake-form.interface';

/**
 * Interface IntakeFormModel
 *
 * @description
 * The values of the form's text, choice and date fields; the files are kept beside it.
 */
interface IntakeFormModel {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * The request in one sentence.
   *
   * @type {string}
   */
  title: string;

  /**
   * Property description
   *
   * @description
   * Context, steps and expected result.
   *
   * @type {string}
   */
  description: string;

  /**
   * Property priority
   *
   * @description
   * Chosen priority, or null.
   *
   * @type {IntakePriority | null}
   */
  priority: IntakePriority | null;

  /**
   * Property dueDate
   *
   * @description
   * Chosen due date, or null.
   *
   * @type {Date | null}
   */
  dueDate: Date | null;

  /**
   * Property contactEmail
   *
   * @description
   * Requester's address.
   *
   * @type {string}
   */
  contactEmail: string;
  // #endregion
}

/**
 * Constant EMAIL_PATTERN
 *
 * @description
 * The address check of the mockup's form (`fmErrsOf` of `App.dc.html`).
 *
 * @type {RegExp}
 */
const EMAIL_PATTERN: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Function emptyModel
 *
 * @description
 * The values of a new request.
 *
 * @returns {IntakeFormModel} Empty values.
 */
function emptyModel(): IntakeFormModel {
  return { title: '', description: '', priority: null, dueDate: null, contactEmail: '' };
}

/**
 * Function isoDay
 *
 * @description
 * The calendar day of a picked date, in the requester's time zone.
 *
 * @param {Date} date - The picked date.
 * @returns {string} The day as `YYYY-MM-DD`.
 */
function isoDay(date: Date): string {
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/**
 * Constant nextFormId
 *
 * @description
 * Counter that keeps the element ids of each rendered form distinct.
 *
 * @type {{ value: number }}
 */
const nextFormId: { value: number } = { value: 0 };

/**
 * Component IntakeForm
 *
 * @description
 * The public request form (`App.dc.html` lines 1102-1225): the organization badge, the heading
 * and its introduction, the title (always required) and each field the settings show, marked
 * `(optional)` unless required, the footer note and `Send the request`; once sent, `Request
 * sent` with `Send another request`. Presentational: it holds the values being typed in a Signal
 * Form and emits the request; its owner sends it (the Intake page) or not (the Spaces preview).
 * An invalid send shows an error summary, an error under each invalid field, and focuses the
 * first one; the button is disabled only while `pending`. Changing `form` keeps the typed
 * values: a hidden field is neither validated nor emitted.
 */
@Component({
  selector: 'cw-intake-form',
  imports: [
    CwButton,
    CwDatePicker,
    CwDropzone,
    CwInput,
    CwPriorityIcon,
    CwSelect,
    CwSelectOption,
    CwTextarea,
    FormField,
    NgIcon,
  ],
  providers: [INTAKE_FORM_BRICK_LABELS],
  templateUrl: './intake-form.component.html',
})
export class IntakeForm {
  // #region Properties
  /**
   * Property form
   *
   * @description
   * What the form shows: heading, introduction and the mode of each field.
   *
   * @type {InputSignal<IntakeFormSettings>}
   * @readonly
   */
  public readonly form: InputSignal<IntakeFormSettings> = input.required<IntakeFormSettings>();

  /**
   * Property organization
   *
   * @description
   * The badge above the heading, or null to leave it out (the published form does not name its
   * organization).
   *
   * @type {InputSignal<IntakeOrganization | null>}
   * @readonly
   */
  public readonly organization: InputSignal<IntakeOrganization | null> =
    input<IntakeOrganization | null>(null);

  /**
   * Property pending
   *
   * @description
   * Whether the request is being sent: the send button waits.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly pending: InputSignal<boolean> = input(false);

  /**
   * Property sent
   *
   * @description
   * Title of the request just sent, which shows the confirmation, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly sent: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property failure
   *
   * @description
   * Why the last send failed, shown above the send button, or null.
   *
   * @type {InputSignal<IntakeFailure | null>}
   * @readonly
   */
  public readonly failure: InputSignal<IntakeFailure | null> = input<IntakeFailure | null>(null);

  /**
   * Property unconfirmed
   *
   * @description
   * Title of a request sent without a confirmed outcome, which shows a notice with `Send it
   * again`, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly unconfirmed: InputSignal<string | null> = input<string | null>(null);

  /**
   * Property submitted
   *
   * @description
   * A valid request, trimmed, with only the fields the form shows.
   *
   * @type {OutputEmitterRef<IntakeRequest>}
   * @readonly
   */
  public readonly submitted: OutputEmitterRef<IntakeRequest> = output<IntakeRequest>();

  /**
   * Property restarted
   *
   * @description
   * `Send another request`: the form is empty again and its title focused.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly restarted: OutputEmitterRef<void> = output();

  /**
   * Property resent
   *
   * @description
   * `Send it again`: the unconfirmed request is to be sent again unchanged.
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly resent: OutputEmitterRef<void> = output();

  /**
   * Property fileRemoved
   *
   * @description
   * A file removed, or replaced by a file of the same name, whose upload is to be forgotten.
   *
   * @type {OutputEmitterRef<File>}
   * @readonly
   */
  public readonly fileRemoved: OutputEmitterRef<File> = output<File>();

  /**
   * Property ids
   *
   * @description
   * Prefix of this form's element ids.
   *
   * @type {string}
   * @readonly
   */
  protected readonly ids: string = `intake-${String((nextFormId.value += 1))}`;

  /**
   * Property labels
   *
   * @description
   * The name of each field.
   *
   * @type {Readonly<Record<IntakeFieldKey | 'title', string>>}
   * @readonly
   */
  protected readonly labels: Readonly<Record<IntakeFieldKey | 'title', string>> =
    intakeFieldLabels();

  /**
   * Property priorities
   *
   * @description
   * The priority choices with their words.
   *
   * @type {readonly { value: IntakePriority; label: string }[]}
   * @readonly
   */
  protected readonly priorities: readonly { value: IntakePriority; label: string }[] =
    INTAKE_PRIORITIES.map((value: IntakePriority) => ({
      value,
      label: intakePriorityLabels()[value],
    }));

  /**
   * Property maxFileBytes
   *
   * @description
   * Largest file accepted.
   *
   * @type {number}
   * @readonly
   */
  protected readonly maxFileBytes: number = INTAKE_MAX_FILE_BYTES;

  /**
   * Property maxFiles
   *
   * @description
   * Most files accepted.
   *
   * @type {number}
   * @readonly
   */
  protected readonly maxFiles: number = INTAKE_MAX_FILES;

  /**
   * Property model
   *
   * @description
   * The typed values.
   *
   * @type {WritableSignal<IntakeFormModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<IntakeFormModel> = signal(emptyModel());

  /**
   * Property files
   *
   * @description
   * The attached files, in the order they were added.
   *
   * @type {WritableSignal<readonly File[]>}
   * @readonly
   */
  protected readonly files: WritableSignal<readonly File[]> = signal([]);

  /**
   * Property rejected
   *
   * @description
   * Whether the last files offered included some over 25 MB or beyond the fifth.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly rejected: WritableSignal<boolean> = signal(false);

  /**
   * Property tried
   *
   * @description
   * Whether a send was tried since the form was last emptied: the summary and the files error
   * show from then on.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly tried: WritableSignal<boolean> = signal(false);

  /**
   * Property requestForm
   *
   * @description
   * The rules of `fmErrsOf` (`App.dc.html` lines 7733-7746): a title; a description, a priority, a
   * date and an address when required; a well-formed address whenever one is typed.
   *
   * @type {FieldTree<IntakeFormModel>}
   * @readonly
   */
  protected readonly requestForm: FieldTree<IntakeFormModel> = form(this.model, (path) => {
    validate(path.title, (context: FieldContext<string>) =>
      context.value().trim() === ''
        ? { kind: 'required', message: $localize`:@@intake.form.title-required:Enter a title.` }
        : undefined,
    );
    validate(path.description, (context: FieldContext<string>) =>
      this.mode('description') === 'required' && context.value().trim() === ''
        ? {
            kind: 'required',
            message: $localize`:@@intake.form.description-required:Describe the request.`,
          }
        : undefined,
    );
    required(path.priority, {
      when: () => this.mode('priority') === 'required',
      message: $localize`:@@intake.form.priority-required:Choose a priority.`,
    });
    required(path.dueDate, {
      when: () => this.mode('dueDate') === 'required',
      message: $localize`:@@intake.form.due-date-required:Choose a date.`,
    });
    validate(path.contactEmail, (context: FieldContext<string>) => {
      const mode: IntakeFieldMode = this.mode('contactEmail');
      const value: string = context.value().trim();
      if (mode === 'disabled') return undefined;
      if (value === '') {
        return mode === 'required'
          ? {
              kind: 'required',
              message: $localize`:@@intake.form.email-required:Enter your email address.`,
            }
          : undefined;
      }
      return EMAIL_PATTERN.test(value)
        ? undefined
        : {
            kind: 'email',
            message: $localize`:@@intake.form.email-invalid:Invalid email address, for example firstname.lastname@example.com.`,
          };
    });
  });

  /**
   * Property filesError
   *
   * @description
   * The files error once a send was tried: a required attachment is missing.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly filesError: Signal<string | null> = computed((): string | null =>
    this.filesMissing() ? $localize`:@@intake.form.files-required:Attach at least one file.` : null,
  );

  /**
   * Property errorSummary
   *
   * @description
   * `n fields to fix before sending.` after a send was tried with errors, else null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly errorSummary: Signal<string | null> = computed((): string | null => {
    if (!this.tried()) return null;
    const count: number = this.requestForm().errorSummary().length + (this.filesMissing() ? 1 : 0);
    if (count === 0) return null;
    return count === 1
      ? $localize`:@@intake.form.errors-one:1 field to fix before sending.`
      : $localize`:@@intake.form.errors-many:${count}:count: fields to fix before sending.`;
  });

  /**
   * Property sentText
   *
   * @description
   * The confirmation text naming the request sent.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly sentText: Signal<string> = computed((): string => {
    const title: string = this.sent() ?? '';
    return $localize`:@@intake.sent.text:Your request “${title}:title:” has been sent to the team. A confirmation goes to the address you gave.`;
  });

  /**
   * Property unconfirmedText
   *
   * @description
   * The notice of a request sent without a confirmed outcome, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly unconfirmedText: Signal<string | null> = computed((): string | null => {
    const title: string | null = this.unconfirmed();
    return title === null
      ? null
      : $localize`:@@intake.unconfirmed.text:Your request “${title}:title:” was sent, but its receipt could not be confirmed. Send it again to check before sending anything else.`;
  });

  /**
   * Property failureText
   *
   * @description
   * The message of the last failed send, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly failureText: Signal<string | null> = computed((): string | null => {
    switch (this.failure()) {
      case 'closed':
        return $localize`:@@intake.failure.closed:This form no longer accepts requests.`;
      case 'file':
        return $localize`:@@intake.failure.file:A file could not be received. Remove it or try another one.`;
      case 'unavailable':
        return $localize`:@@intake.failure.unavailable:The request could not be sent. Try again.`;
      default:
        return null;
    }
  });

  /**
   * Property host
   *
   * @description
   * The form's element, to focus a field.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Property injector
   *
   * @description
   * Schedules the focus after the next render.
   *
   * @type {Injector}
   * @readonly
   */
  private readonly injector: Injector = inject(Injector);
  // #endregion

  // #region Methods
  /**
   * Method mode
   *
   * @description
   * The mode of a configurable field.
   *
   * @param {IntakeFieldKey} key - The field.
   * @returns {IntakeFieldMode} Its mode.
   */
  protected mode(key: IntakeFieldKey): IntakeFieldMode {
    return this.form().fields[key];
  }

  /**
   * Method shows
   *
   * @description
   * Whether the form shows a configurable field.
   *
   * @param {IntakeFieldKey} key - The field.
   * @returns {boolean} Whether it is shown.
   */
  protected shows(key: IntakeFieldKey): boolean {
    return this.mode(key) !== 'disabled';
  }

  /**
   * Method errorOf
   *
   * @description
   * The message of a field once touched or after a send, or null.
   *
   * @param {FieldTree<unknown>} field - The field.
   * @returns {string | null} Its first error message.
   */
  protected errorOf(field: FieldTree<unknown>): string | null {
    const state: ReturnType<FieldTree<unknown>> = field();
    if (!(state.touched() || this.tried()) || !state.invalid()) return null;
    return state.errors().at(0)?.message ?? null;
  }

  /**
   * Method addFiles
   *
   * @description
   * Adds the files the dropzone accepted; a file of the same name as an attached one replaces
   * it, and the replaced file is emitted as removed.
   *
   * @param {File[]} added - The accepted files.
   */
  protected addFiles(added: File[]): void {
    const files: File[] = [...this.files()];
    for (const file of added) {
      const at: number = files.findIndex((known: File): boolean => known.name === file.name);
      if (at === -1) {
        files.push(file);
        continue;
      }
      const replaced: File | undefined = files.at(at);
      files[at] = file;
      if (replaced) this.fileRemoved.emit(replaced);
    }
    for (const dropped of files.slice(INTAKE_MAX_FILES)) this.fileRemoved.emit(dropped);
    this.files.set(files.slice(0, INTAKE_MAX_FILES));
    this.rejected.set(false);
  }

  /**
   * Method rejectFiles
   *
   * @description
   * Notes files the dropzone refused (size or count).
   *
   * @param {CwDropzoneRejection[]} rejections - The refused files.
   */
  protected rejectFiles(rejections: CwDropzoneRejection[]): void {
    if (rejections.length > 0) this.rejected.set(true);
  }

  /**
   * Method removeFile
   *
   * @description
   * Removes an attached file.
   *
   * @param {number} index - Its position.
   */
  protected removeFile(index: number): void {
    const removed: File | undefined = this.files().at(index);
    this.files.update((files: readonly File[]): File[] =>
      files.filter((_file: File, at: number): boolean => at !== index),
    );
    if (removed) this.fileRemoved.emit(removed);
  }

  /**
   * Method removeLabel
   *
   * @description
   * Accessible name of a file's remove button.
   *
   * @param {File} file - The file.
   * @returns {string} `Remove <name>`.
   */
  protected removeLabel(file: File): string {
    const name: string = file.name;
    return $localize`:@@intake.files.remove:Remove ${name}:name:`;
  }

  /**
   * Method send
   *
   * @description
   * Validates the request. An invalid one shows the errors and focuses the first invalid field
   * (the dropzone's browse button for a missing file); a valid one is emitted.
   *
   * @param {Event} event - The submit event.
   * @returns {Promise<void>} Resolves once handled.
   */
  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pending()) return;
    this.tried.set(true);
    await submit(this.requestForm, {
      action: async (): Promise<undefined> => {
        if (this.filesMissing()) {
          this.focusFiles();
          return undefined;
        }
        this.submitted.emit(this.request());
        return Promise.resolve(undefined);
      },
      onInvalid: (fields: FieldTree<IntakeFormModel>): void => {
        const first: ValidationError.WithFieldTree | undefined = fields().errorSummary().at(0);
        first?.fieldTree().focusBoundControl();
      },
    });
  }

  /**
   * Method restart
   *
   * @description
   * Empties the form, focuses its title and emits `restarted`.
   */
  protected restart(): void {
    this.model.set(emptyModel());
    this.files.set([]);
    this.rejected.set(false);
    this.tried.set(false);
    this.requestForm().reset();
    this.restarted.emit();
    afterNextRender(
      (): void => {
        this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.ids}-title`)?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Method filesMissing
   *
   * @description
   * Whether a send was tried while a required attachment is missing.
   *
   * @returns {boolean} Whether the files are in error.
   */
  private filesMissing(): boolean {
    return this.tried() && this.mode('attachments') === 'required' && this.files().length === 0;
  }

  /**
   * Method focusFiles
   *
   * @description
   * Focuses the dropzone's browse button.
   */
  private focusFiles(): void {
    this.host.nativeElement.querySelector<HTMLButtonElement>(`#${this.ids}-files button`)?.focus();
  }

  /**
   * Method request
   *
   * @description
   * The typed values, trimmed, with the hidden fields emptied.
   *
   * @returns {IntakeRequest} The request.
   */
  private request(): IntakeRequest {
    const value: IntakeFormModel = this.model();
    return {
      title: value.title.trim(),
      description: this.shows('description') ? value.description.trim() : '',
      priority: this.shows('priority') ? value.priority : null,
      dueDate: this.shows('dueDate') && value.dueDate ? isoDay(value.dueDate) : null,
      contactEmail: this.shows('contactEmail') ? value.contactEmail.trim() : '',
      files: this.shows('attachments') ? [...this.files()] : [],
    };
  }
  // #endregion
}
