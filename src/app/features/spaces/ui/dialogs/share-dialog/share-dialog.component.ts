import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  type InputSignal,
  model,
  type ModelSignal,
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
  validate,
} from '@angular/forms/signals';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogMedia,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwAvatar } from '@cadenway/ui/components/avatar';
import { CwBadge } from '@cadenway/ui/components/badge';
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
import { CwSelect, CwSelectOption } from '@cadenway/ui/components/select';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwSwitch } from '@cadenway/ui/components/switch';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import { AppLinkService } from '@core/routing';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import type {
  ShareInviteOutcome,
  SharePerson,
  ShareRole,
} from '../../../models/list-share/list-share.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import {
  SHARE_EMAIL_PATTERN,
  ListShareStore,
  type ListShareStoreInstance,
  type ShareTarget,
} from '../../../state/list-share/list-share.store';

/**
 * Interface InviteModel
 *
 * @description
 * The `Invite by email` fields.
 */
interface InviteModel {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * Typed address.
   *
   * @type {string}
   */
  email: string;

  /**
   * Property role
   *
   * @description
   * Role given with the invitation (`Can edit` by default, as in the mockup).
   *
   * @type {ShareRole}
   */
  role: ShareRole;
  // #endregion
}

/**
 * Interface InviteNote
 *
 * @description
 * Why the last `Invite` gave no access, shown while the field keeps that address.
 */
interface InviteNote {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address the note is about.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property outcome
   *
   * @description
   * `unknown` (not in the organization) or `owner` (already has access).
   *
   * @type {'unknown' | 'owner'}
   * @readonly
   */
  readonly outcome: 'unknown' | 'owner';
  // #endregion
}

/**
 * Interface RoleOption
 *
 * @description
 * A choice of the role selects.
 */
interface RoleOption {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The role.
   *
   * @type {ShareRole}
   * @readonly
   */
  readonly value: ShareRole;

  /**
   * Property label
   *
   * @description
   * Its word (`Can edit`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Component ShareDialog
 *
 * @description
 * `Share` (`App.dc.html` lines 2980-3016, 8830-8855), hosted by the list page beside the header's
 * `…` menu, with `open` (two-way; the dialog sets it to false when it closes, on `Done`, Escape
 * or the backdrop) and `list`. It provides its own `ListShareStore`, which reads who has access
 * each time it opens on a list (a skeleton meanwhile; a failed read is an inline error with
 * `Retry`).
 *
 * - `Invite by email` (with the role select, `Can edit` by default, and `Invite`) gives the role to
 *   the member or guest of the organization who has the address, at once, then `Invitation sent`.
 *   The contract has no invitation by email that carries a list role (G10), and no feature
 *   publishes an organization invitation entry: an address outside the organization gets a note
 *   and nothing is sent. An address without a domain shows `Incomplete address: add the domain.`
 *   once touched or submitted. The block shows only to a caller with `edit` who reads the
 *   member directory.
 * - `People with access`: the space's owner (`Owner`), then each grant with its role select and
 *   its remove button, which asks `Remove X's access?` in a `cw-alert-dialog` first (adding that
 *   a member still sees the list through the organization access when the switch gives it);
 *   guests carry `Guest` and the guest sum follows the list. A caller without `edit` reads the
 *   roles as words. A failed read of the member directory is its own inline error with `Retry`;
 *   a refused one (`403`) leaves the names unknown and hides `Invite by email`.
 * - `Organization access` switches whether every member of the organization sees the list; it is
 *   hidden in a private space, where it changes nothing.
 * - `Copy the link` copies `/<slug>/l/<listId>` with the toast `List link copied`.
 */
@Component({
  selector: 'cw-share-dialog',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogMedia,
    CwAlertDialogTitle,
    CwAvatar,
    CwBadge,
    CwButton,
    CwDialog,
    CwDialogClose,
    CwDialogDescription,
    CwDialogFooter,
    CwDialogHeader,
    CwDialogTitle,
    CwInput,
    CwSelect,
    CwSelectOption,
    CwSkeleton,
    CwSwitch,
    FormField,
    NgIcon,
  ],
  providers: [ListShareStore],
  templateUrl: './share-dialog.component.html',
})
export class ShareDialog {
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
   * Property list
   *
   * @description
   * The list the dialog is about, or null while it is read.
   *
   * @type {InputSignal<TaskList | null>}
   * @readonly
   */
  public readonly list: InputSignal<TaskList | null> = input<TaskList | null>(null);

  /**
   * Property store
   *
   * @description
   * Who has access and the writes.
   *
   * @type {ListShareStoreInstance}
   * @readonly
   */
  protected readonly store: ListShareStoreInstance = inject(ListShareStore);

  /**
   * Property workspace
   *
   * @description
   * The organization, for its name and the link's slug.
   *
   * @type {WorkspaceContextPort}
   * @readonly
   */
  private readonly workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);

  /**
   * Property document
   *
   * @description
   * The document, for the clipboard.
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

  /**
   * Property toasts
   *
   * @description
   * The toasts of `Copy the link`.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property roles
   *
   * @description
   * The role choices, in the mockup's order (`ROLE_OPTS`, `App.dc.html` line 6871).
   *
   * @type {readonly RoleOption[]}
   * @readonly
   */
  protected readonly roles: readonly RoleOption[] = [
    { value: 'edit', label: $localize`:@@spaces.share.role-edit:Can edit` },
    { value: 'comment', label: $localize`:@@spaces.share.role-comment:Can comment` },
    { value: 'view', label: $localize`:@@spaces.share.role-view:View only` },
  ];

  /**
   * Property target
   *
   * @description
   * The list the store follows: the bound list while open, else null.
   *
   * @type {Signal<ShareTarget | null>}
   * @readonly
   */
  private readonly target: Signal<ShareTarget | null> = computed(
    (): ShareTarget | null => {
      const list: TaskList | null = this.list();
      return this.open() && list ? { listId: list.id, spaceId: list.spaceId } : null;
    },
    {
      equal: (a: ShareTarget | null, b: ShareTarget | null): boolean =>
        a?.listId === b?.listId && a?.spaceId === b?.spaceId,
    },
  );

  /**
   * Property title
   *
   * @description
   * `Share “Sprint 14”`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string => {
    const name: string = this.list()?.name ?? '';
    return $localize`:@@spaces.share.title:Share “${name}:name:”`;
  });

  /**
   * Property organizationLabel
   *
   * @description
   * `All members of Atelier Nord can see this list`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly organizationLabel: Signal<string> = computed((): string => {
    const organization: string = this.workspace.organization().name;
    return $localize`:@@spaces.share.organization-text:All members of ${organization}:organization: can see this list`;
  });

  /**
   * Property guestSum
   *
   * @description
   * `2 external guests: they only see this list and do not count as seats.`, empty without guests.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly guestSum: Signal<string> = computed((): string => {
    const count: number = this.store.guestCount();
    if (count === 0) return '';
    return count === 1
      ? $localize`:@@spaces.share.guests-one:${count}:count: external guest: they only see this list and do not count as seats.`
      : $localize`:@@spaces.share.guests:${count}:count: external guests: they only see this list and do not count as seats.`;
  });

  /**
   * Property model
   *
   * @description
   * The `Invite by email` values.
   *
   * @type {WritableSignal<InviteModel>}
   * @readonly
   */
  protected readonly model: WritableSignal<InviteModel> = signal<InviteModel>({
    email: '',
    role: 'edit',
  });

  /**
   * Property inviteForm
   *
   * @description
   * The address and its rule: a typed address needs a domain.
   *
   * @type {FieldTree<InviteModel>}
   * @readonly
   */
  protected readonly inviteForm: FieldTree<InviteModel> = form(this.model, (path) => {
    validate(path.email, (context: FieldContext<string>) => {
      const email: string = context.value().trim();
      return email !== '' && !SHARE_EMAIL_PATTERN.test(email)
        ? {
            kind: 'incomplete',
            message: $localize`:@@spaces.share.email-incomplete:Incomplete address: add the domain.`,
          }
        : undefined;
    });
  });

  /**
   * Property note
   *
   * @description
   * Why the last `Invite` gave no access, or null.
   *
   * @type {WritableSignal<InviteNote | null>}
   * @readonly
   */
  private readonly note: WritableSignal<InviteNote | null> = signal<InviteNote | null>(null);

  /**
   * Property inviteNote
   *
   * @description
   * The note while the field keeps the address it is about, else null.
   *
   * @type {Signal<'unknown' | 'owner' | null>}
   * @readonly
   */
  protected readonly inviteNote: Signal<'unknown' | 'owner' | null> = computed(
    (): 'unknown' | 'owner' | null => {
      const note: InviteNote | null = this.note();
      return note?.email === this.model().email.trim() ? note.outcome : null;
    },
  );

  /**
   * Property removing
   *
   * @description
   * The person whose removal is being confirmed, or null.
   *
   * @type {WritableSignal<SharePerson | null>}
   * @readonly
   */
  protected readonly removing: WritableSignal<SharePerson | null> = signal<SharePerson | null>(
    null,
  );

  /**
   * Property confirmOpen
   *
   * @description
   * Whether the removal confirmation shows; `[(open)]` of the alert dialog.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly confirmOpen: WritableSignal<boolean> = signal(false);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Makes the store follow the open list, and empties the invitation each time the dialog opens
   * on a list.
   *
   * @constructor
   */
  public constructor() {
    this.store.follow(this.target);
    effect((): void => {
      if (this.target() === null) return;
      untracked((): void => {
        this.model.set({ email: '', role: 'edit' });
        this.note.set(null);
        this.inviteForm().reset();
      });
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method nameOf
   *
   * @description
   * The name a row shows: the directory's, else the address, else `Unknown user`.
   *
   * @param {SharePerson} person - The row.
   * @returns {string} The name.
   */
  protected nameOf(person: SharePerson): string {
    return person.name ?? person.email ?? $localize`:@@spaces.labels.avatar-unknown:Unknown user`;
  }

  /**
   * Method roleLabel
   *
   * @description
   * The word of a role, for a caller who may not change it.
   *
   * @param {ShareRole} role - The role.
   * @returns {string} Its word.
   */
  protected roleLabel(role: ShareRole): string {
    return this.roles.find((option: RoleOption): boolean => option.value === role)?.label ?? '';
  }

  /**
   * Method accessLabel
   *
   * @description
   * The accessible name of a row's role select: `Access for Léa Petit`.
   *
   * @param {SharePerson} person - The row.
   * @returns {string} The name.
   */
  protected accessLabel(person: SharePerson): string {
    const name: string = this.nameOf(person);
    return $localize`:@@spaces.share.access-of:Access for ${name}:name:`;
  }

  /**
   * Method removeLabel
   *
   * @description
   * The accessible name of a row's remove button: `Remove Léa Petit's access`.
   *
   * @param {SharePerson} person - The row.
   * @returns {string} The name.
   */
  protected removeLabel(person: SharePerson): string {
    const name: string = this.nameOf(person);
    return $localize`:@@spaces.share.remove-label:Remove ${name}:name:'s access`;
  }

  /**
   * Method removeTitle
   *
   * @description
   * `Remove Léa Petit's access?`.
   *
   * @param {SharePerson} person - The person.
   * @returns {string} The title.
   */
  protected removeTitle(person: SharePerson): string {
    const name: string = this.nameOf(person);
    return $localize`:@@spaces.share.remove-title:Remove ${name}:name:'s access?`;
  }

  /**
   * Method removeText
   *
   * @description
   * `Léa Petit will no longer see this list or its tasks. You can invite them again.`.
   *
   * @param {SharePerson} person - The person.
   * @returns {string} The text.
   */
  protected removeText(person: SharePerson): string {
    const name: string = this.nameOf(person);
    return $localize`:@@spaces.share.remove-text:${name}:name: will no longer see this list or its tasks. You can invite them again.`;
  }

  /**
   * Method keepsAccess
   *
   * @description
   * Whether a member keeps seeing the list after their grant is removed, through the
   * `Organization access` switch (on, outside a private space; never for a guest). A grant of the
   * space, which also opens the list, is not checked.
   *
   * @param {SharePerson} person - The person.
   * @returns {boolean} True when the confirmation adds `They can still see it…`.
   */
  protected keepsAccess(person: SharePerson): boolean {
    return this.store.organizationAccess() && !this.store.privateSpace() && !person.guest;
  }

  /**
   * Method changeRole
   *
   * @description
   * Sends the role a row's select picked, when it changed.
   *
   * @param {SharePerson} person - The row.
   * @param {ShareRole | null} role - The picked role.
   */
  protected changeRole(person: SharePerson, role: ShareRole | null): void {
    if (role === null || role === person.role) return;
    void this.store.changeRole(person.userId, role);
  }

  /**
   * Method askRemove
   *
   * @description
   * Opens the removal confirmation for a row.
   *
   * @param {SharePerson} person - The row.
   */
  protected askRemove(person: SharePerson): void {
    this.removing.set(person);
    this.confirmOpen.set(true);
  }

  /**
   * Method confirmRemove
   *
   * @description
   * `Remove access`: closes the confirmation and removes the person at once.
   */
  protected confirmRemove(): void {
    const person: SharePerson | null = this.removing();
    this.confirmOpen.set(false);
    if (person) void this.store.remove(person.userId);
  }

  /**
   * Method invite
   *
   * @description
   * `Invite`: an incomplete address marks the field and focuses it; an address the organization
   * does not know, or the owner's, leaves a note; a known one gets its access and empties the
   * field.
   *
   * @param {HTMLInputElement} field - The address field.
   */
  protected invite(field: HTMLInputElement): void {
    const { email, role }: InviteModel = this.model();
    if (email.trim() === '' || this.inviteForm.email().invalid()) {
      this.inviteForm.email().markAsTouched();
      field.focus();
      return;
    }
    const outcome: ShareInviteOutcome = this.store.invite(email, role);
    if (outcome === 'unknown' || outcome === 'owner') {
      this.note.set({ email: email.trim(), outcome });
    } else if (outcome === 'sent') {
      this.model.set({ email: '', role });
      this.note.set(null);
      this.inviteForm().reset();
    }
  }

  /**
   * Method copyLink
   *
   * @description
   * `Copy the link`: copies the list's address (`/<slug>/l/<listId>`) with its toast.
   */
  protected async copyLink(): Promise<void> {
    const list: TaskList | null = this.list();
    if (!list) return;
    const view: Window | null = this.document.defaultView;
    const slug: string = this.workspace.organization().slug;
    const link: string = this.links.absolute(`/${slug}/l/${list.id}`);
    try {
      await view?.navigator.clipboard.writeText(link);
      this.toasts.show($localize`:@@spaces.share.link-copied:List link copied`, {
        description: link,
      });
    } catch {
      this.toasts.error($localize`:@@spaces.share.link-failed:The link could not be copied`, {
        description: link,
      });
    }
  }
  // #endregion
}
