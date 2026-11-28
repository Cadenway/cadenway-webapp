import {
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  type InputSignal,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwCheckbox } from '@cadenway/ui/components/checkbox';
import {
  CwEmpty,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwInput } from '@cadenway/ui/components/input';
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwSwitch } from '@cadenway/ui/components/switch';
import { CwTextarea } from '@cadenway/ui/components/textarea';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import { AppLinkService } from '@core/routing';
import {
  INTAKE_FIELD_KEYS,
  type IntakeFieldKey,
  type IntakeFieldMode,
  IntakeForm,
  intakeFieldIcons,
  intakeFieldLabels,
  type IntakeOrganization,
} from '@features/intake';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import { statusLabels } from '../../../constants/view-labels/view-labels.constants';
import type { IntakeFormDraft } from '../../../models/intake-form/intake-form.interface';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import type { StatusKey } from '../../../models/list-view-config/list-view-config.interface';
import type { Space, SpaceStatusOption } from '../../../models/space/space.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import type { ViewOption } from '../../../models/view-option/view-option.interface';
import {
  FormViewStore,
  type FormViewStoreInstance,
} from '../../../state/form-view/form-view.store';
import { ListPageStore } from '../../../state/list-page/list-page.store';

/**
 * Constant UNASSIGNED
 *
 * @description
 * The assignee choice for nobody (`none` in the mockup).
 *
 * @type {string}
 */
const UNASSIGNED: string = 'none';

/**
 * Interface FieldRow
 *
 * @description
 * A row of the `Fields` settings: a configurable field and its mode.
 */
interface FieldRow {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The field, or the title.
   *
   * @type {IntakeFieldKey | 'title'}
   * @readonly
   */
  readonly key: IntakeFieldKey | 'title';

  /**
   * Property locked
   *
   * @description
   * Whether the row cannot change: the title is always shown and required.
   *
   * @type {boolean}
   * @readonly
   */
  readonly locked: boolean;

  /**
   * Property label
   *
   * @description
   * Its name.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property icon
   *
   * @description
   * Its Bold Phosphor icon.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property shown
   *
   * @description
   * Whether the public page shows it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly shown: boolean;

  /**
   * Property required
   *
   * @description
   * Whether a request must fill it in.
   *
   * @type {boolean}
   * @readonly
   */
  readonly required: boolean;

  /**
   * Property requiredLabel
   *
   * @description
   * Accessible name of its `Required` checkbox (`<field> required`).
   *
   * @type {string}
   * @readonly
   */
  readonly requiredLabel: string;

  /**
   * Property switchLabel
   *
   * @description
   * Accessible name of its switch (`Hide the field <field>` or `Show the field <field>`).
   *
   * @type {string}
   * @readonly
   */
  readonly switchLabel: string;
  // #endregion
}

/**
 * Component FormViewPage
 *
 * @description
 * The `Form` view at `/:org/l/:listId/form` (`App.dc.html` lines 1102-1297), below the list
 * frame, which hides the view tools. On the left, the preview of the public page in a browser
 * frame with its address: Intake's renderer (`cw-intake-form`) with the organization badge, live
 * with the settings and inert (a valid request is not sent; a toast says so). On the right, from
 * 1024 px, the settings: the form's name and description, each field's `Required` checkbox and
 * show switch (the title is always asked), the created task's default status and assignee,
 * `Copy the public link`, `Open the preview` (which hides the settings until `Close the preview`)
 * and the publication, which the mockup does not draw. The form skeleton shows while the
 * settings are read; a failed read renders the route boundary under the list header; a list the
 * caller cannot edit shows an empty state without reading its form.
 */
@Component({
  selector: 'cw-form-view-page',
  imports: [
    CwButton,
    CwCheckbox,
    CwEmpty,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwInput,
    CwSelect,
    CwSelectOption,
    CwSkeleton,
    CwStatusIcon,
    CwSwitch,
    CwTextarea,
    IntakeForm,
    NgIcon,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './form-view-page.component.html',
})
export class FormViewPage {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list of the route.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly listId: InputSignal<string> = input.required<string>();

  /**
   * Property store
   *
   * @description
   * The list's request form.
   *
   * @type {FormViewStoreInstance}
   * @readonly
   */
  protected readonly store: FormViewStoreInstance = inject(FormViewStore);

  /**
   * Property listStore
   *
   * @description
   * The open list, its space and the organization's members.
   *
   * @type {InstanceType<typeof ListPageStore>}
   * @readonly
   */
  protected readonly listStore: InstanceType<typeof ListPageStore> = inject(ListPageStore);

  /**
   * Property preview
   *
   * @description
   * Whether the settings are hidden to look at the public page alone.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly preview: WritableSignal<boolean> = signal(false);

  /**
   * Property unassigned
   *
   * @description
   * The assignee choice for nobody.
   *
   * @type {string}
   * @readonly
   */
  protected readonly unassigned: string = UNASSIGNED;

  /**
   * Property skeletonFields
   *
   * @description
   * Widths and heights of the skeleton's fields (`skFields` of `App.dc.html`).
   *
   * @type {readonly { label: string; field: string }[]}
   * @readonly
   */
  protected readonly skeletonFields: readonly { label: string; field: string }[] = [
    { label: 'w-16', field: 'h-8' },
    { label: 'w-24', field: 'h-24' },
    { label: 'w-20', field: 'h-8' },
    { label: 'w-28', field: 'h-8' },
    { label: 'w-24', field: 'h-16' },
  ];

  /**
   * Property list
   *
   * @description
   * The open list, once read.
   *
   * @type {Signal<TaskList | null>}
   * @readonly
   */
  protected readonly list: Signal<TaskList | null> = computed((): TaskList | null =>
    this.listStore.list.hasValue() ? this.listStore.list.value() : null,
  );

  /**
   * Property organization
   *
   * @description
   * The badge of the preview.
   *
   * @type {Signal<IntakeOrganization>}
   * @readonly
   */
  protected readonly organization: Signal<IntakeOrganization> = computed((): IntakeOrganization => {
    const organization: WorkspaceOrganization = this.workspace.organization();
    return { name: organization.name, initials: organization.initials };
  });

  /**
   * Property publicLink
   *
   * @description
   * The public page's address (`https://<host>/<locale>/f/<publicKey>`), or null while unpublished.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly publicLink: Signal<string | null> = computed((): string | null => {
    const key: string | null = this.store.publicKey();
    return key === null ? null : this.links.absolute(`/f/${key}`);
  });

  /**
   * Property address
   *
   * @description
   * The address shown in the preview's frame: the public link without its scheme, or a note while
   * unpublished.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly address: Signal<string> = computed((): string => {
    const link: string | null = this.publicLink();
    return link === null
      ? $localize`:@@spaces.form.unpublished-address:Not published`
      : link.replace(/^https?:\/\//u, '');
  });

  /**
   * Property fieldRows
   *
   * @description
   * The rows of the `Fields` settings: the locked title, then each configurable field.
   *
   * @type {Signal<readonly FieldRow[]>}
   * @readonly
   */
  protected readonly fieldRows: Signal<readonly FieldRow[]> = computed((): readonly FieldRow[] => {
    const settings: IntakeFormDraft | null = this.store.settings();
    const labels: Readonly<Record<IntakeFieldKey | 'title', string>> = intakeFieldLabels();
    const icons: Readonly<Record<IntakeFieldKey | 'title', string>> = intakeFieldIcons();
    const keys: readonly (IntakeFieldKey | 'title')[] = ['title', ...INTAKE_FIELD_KEYS];
    return keys.map((key: IntakeFieldKey | 'title'): FieldRow => {
      const mode: IntakeFieldMode =
        key === 'title' ? 'required' : (settings?.fields[key] ?? 'disabled');
      const label: string = labels[key];
      const shown: boolean = mode !== 'disabled';
      return {
        key,
        locked: key === 'title',
        label,
        icon: icons[key],
        shown,
        required: mode === 'required',
        requiredLabel: $localize`:@@spaces.form.field-required:${label}:field: required`,
        switchLabel: shown
          ? $localize`:@@spaces.form.field-hide:Hide the field ${label}:field:`
          : $localize`:@@spaces.form.field-show:Show the field ${label}:field:`,
      };
    });
  });

  /**
   * Property statuses
   *
   * @description
   * The statuses of the list's space a created task may take, with the space's names; the
   * default words until the space is read. The saved status stays offered even when hidden.
   *
   * @type {Signal<readonly ViewOption<StatusKey>[]>}
   * @readonly
   */
  protected readonly statuses: Signal<readonly ViewOption<StatusKey>[]> = computed(
    (): readonly ViewOption<StatusKey>[] => {
      const defaults: Readonly<Record<StatusKey, string>> = statusLabels();
      const space: Space | null = this.listStore.space.hasValue()
        ? this.listStore.space.value()
        : null;
      const current: StatusKey | undefined = this.store.settings()?.defaultStatus;
      const options: readonly SpaceStatusOption[] =
        space?.statuses ??
        (Object.keys(defaults) as StatusKey[]).map((key: StatusKey): SpaceStatusOption => ({
          key,
          name: null,
          hidden: false,
        }));
      return options
        .filter((status: SpaceStatusOption): boolean => !status.hidden || status.key === current)
        .map((status: SpaceStatusOption): ViewOption<StatusKey> => ({
          value: status.key,
          label: status.name ?? defaults[status.key],
        }));
    },
  );

  /**
   * Property assignees
   *
   * @description
   * The members a created task may be assigned to, after `Unassigned`.
   *
   * @type {Signal<readonly ViewOption[]>}
   * @readonly
   */
  protected readonly assignees: Signal<readonly ViewOption[]> = computed(
    (): readonly ViewOption[] => {
      const members: readonly ListMember[] = this.listStore.organizationMembers.hasValue()
        ? this.listStore.organizationMembers.value()
        : [];
      return members.map((member: ListMember): ViewOption => ({
        value: member.userId,
        label: member.name ?? member.userId,
      }));
    },
  );

  /**
   * Property destinationNote
   *
   * @description
   * Where each request goes.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly destinationNote: Signal<string> = computed((): string => {
    const name: string = this.list()?.name ?? '';
    return $localize`:@@spaces.form.destination:Each request becomes a task of “${name}:list:”.`;
  });

  /**
   * Property workspace
   *
   * @description
   * The open organization, for the preview's badge.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property toasts
   *
   * @description
   * The shell's toasts.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property document
   *
   * @description
   * Document of the clipboard.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property links
   *
   * @description
   * Builds the shareable addresses below the current locale segment.
   *
   * @type {AppLinkService}
   * @readonly
   */
  private readonly links: AppLinkService = inject(AppLinkService);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the form of the route's list once the list says the caller can edit it; a list the
   * caller cannot edit reads none. A failed read is read again when the view is entered again.
   *
   * @constructor
   */
  public constructor() {
    if (this.store.configuration.error()) this.store.configuration.reload();
    this.store.load(computed((): string | null => (this.list()?.canEdit ? this.listId() : null)));
  }
  // #endregion

  // #region Methods
  /**
   * Method editTitle
   *
   * @description
   * Renames the form.
   *
   * @param {Event} event - The input event of the name field.
   */
  protected editTitle(event: Event): void {
    this.store.edit({ title: (event.target as HTMLInputElement).value });
  }

  /**
   * Method editDescription
   *
   * @description
   * Changes the form's introduction.
   *
   * @param {Event} event - The input event of the description field.
   */
  protected editDescription(event: Event): void {
    this.store.edit({ description: (event.target as HTMLTextAreaElement).value });
  }

  /**
   * Method toggleShown
   *
   * @description
   * Shows a hidden field as optional, or hides a shown one.
   *
   * @param {FieldRow} row - The field.
   * @param {boolean} shown - Whether to show it.
   */
  protected toggleShown(row: FieldRow, shown: boolean): void {
    if (row.key === 'title') return;
    this.store.edit({ fields: { [row.key]: shown ? 'optional' : 'disabled' } });
  }

  /**
   * Method toggleRequired
   *
   * @description
   * Makes a shown field required or optional.
   *
   * @param {FieldRow} row - The field.
   * @param {boolean} required - Whether to require it.
   */
  protected toggleRequired(row: FieldRow, required: boolean): void {
    if (row.key === 'title' || !row.shown) return;
    this.store.edit({ fields: { [row.key]: required ? 'required' : 'optional' } });
  }

  /**
   * Method pickStatus
   *
   * @description
   * Changes the created task's status.
   *
   * @param {StatusKey | null} status - The chosen status.
   */
  protected pickStatus(status: StatusKey | null): void {
    if (status !== null) this.store.edit({ defaultStatus: status });
  }

  /**
   * Method pickAssignee
   *
   * @description
   * Changes the created task's assignee.
   *
   * @param {string | null} assignee - The chosen member, or `none`.
   */
  protected pickAssignee(assignee: string | null): void {
    if (assignee === null) return;
    this.store.edit({ defaultAssigneeId: assignee === UNASSIGNED ? null : assignee });
  }

  /**
   * Method copyLink
   *
   * @description
   * Copies the public link (`Public link copied`).
   *
   * @returns {Promise<void>} Resolves once copied or refused.
   */
  protected async copyLink(): Promise<void> {
    const link: string | null = this.publicLink();
    if (link === null) return;
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(link);
      this.toasts.show($localize`:@@spaces.form.link-copied:Public link copied`, {
        description: link,
      });
    } catch {
      this.toasts.error($localize`:@@spaces.form.link-failed:The link could not be copied`, {
        description: link,
      });
    }
  }

  /**
   * Method previewSubmitted
   *
   * @description
   * The preview never sends: a valid request only says so.
   */
  protected previewSubmitted(): void {
    this.toasts.show(
      $localize`:@@spaces.form.preview-only:Preview only: the request was not sent`,
      {
        description: $localize`:@@spaces.form.preview-only-text:Requests are sent from the public page.`,
      },
    );
  }
  // #endregion
}
