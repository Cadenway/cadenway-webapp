import {
  Component,
  computed,
  inject,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwToastService } from '@cadenway/ui/components/toast';

import type { BulkAction, BulkSelection } from '../../../models/bulk-action/bulk-action.interface';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import type { Space } from '../../../models/space/space.interface';
import type { ListSummary, SpaceOverview } from '../../../models/task-list/task-list.interface';
import type { ViewOption } from '../../../models/view-option/view-option.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import { BulkBar, type MoveTarget } from '../../components/bulk-bar/bulk-bar.component';

/**
 * Component ListViewPage
 *
 * @description
 * The « Liste » view of a list (`/:org/l/:listId/list`). In this pass it holds a bounded
 * placeholder region where the rows pass renders the grouped task rows, and the selection bar
 * wired to `executeBulkTaskAction` (mark done, assign, move, delete after a confirmation). The
 * rows pass supplies the selection through `selection`; the counts are read again after each
 * action. It reads the view configuration of the route's `ListViewStore` through the list page.
 */
@Component({
  selector: 'cw-list-view-page',
  imports: [
    BulkBar,
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './list-view-page.component.html',
})
export class ListViewPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The open list.
   *
   * @type {InstanceType<typeof ListPageStore>}
   * @readonly
   */
  private readonly store: InstanceType<typeof ListPageStore> = inject(ListPageStore);

  /**
   * Property navigation
   *
   * @description
   * The workspace's navigation, for the destinations of a move.
   *
   * @type {InstanceType<typeof SpacesNavigationStore>}
   * @readonly
   */
  private readonly navigation: InstanceType<typeof SpacesNavigationStore> =
    inject(SpacesNavigationStore);

  /**
   * Property toasts
   *
   * @description
   * The shell's toaster.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property selection
   *
   * @description
   * Selected tasks; the rows pass fills it.
   *
   * @type {WritableSignal<readonly BulkSelection[]>}
   * @readonly
   */
  protected readonly selection: WritableSignal<readonly BulkSelection[]> = signal<
    readonly BulkSelection[]
  >([]);

  /**
   * Property pending
   *
   * @description
   * Whether a bulk action is being recorded.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly pending: WritableSignal<boolean> = signal(false);

  /**
   * Property confirmDelete
   *
   * @description
   * Whether the deletion of the selection is being confirmed.
   *
   * @type {WritableSignal<boolean>}
   * @readonly
   */
  protected readonly confirmDelete: WritableSignal<boolean> = signal(false);

  /**
   * Property people
   *
   * @description
   * People of the list the selection may be assigned to.
   *
   * @type {Signal<readonly ViewOption[]>}
   * @readonly
   */
  protected readonly people: Signal<readonly ViewOption[]> = computed((): readonly ViewOption[] =>
    this.store.members.hasValue()
      ? this.store.members
          .value()
          .items.filter((member: ListMember): boolean => member.name !== null)
          .map((member: ListMember): ViewOption => ({
            value: member.userId,
            label: member.name ?? '',
          }))
      : [],
  );

  /**
   * Property targets
   *
   * @description
   * The other lists of the sidebar, with their space.
   *
   * @type {Signal<readonly MoveTarget[]>}
   * @readonly
   */
  protected readonly targets: Signal<readonly MoveTarget[]> = computed(
    (): readonly MoveTarget[] => {
      if (!this.navigation.spaces.hasValue() || !this.navigation.overviews.hasValue()) return [];
      const overviews: Readonly<Record<string, SpaceOverview>> = this.navigation.overviews.value();
      const current: string | null = this.store.listId();
      return this.navigation.spaces.value().flatMap((space: Space): MoveTarget[] =>
        space.id in overviews
          ? overviews[space.id].lists
              .filter((summary: ListSummary): boolean => summary.list.id !== current)
              .map((summary: ListSummary): MoveTarget => ({
                listId: summary.list.id,
                name: summary.list.name,
                spaceName: space.name,
              }))
          : [],
      );
    },
  );
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs a bulk action on the selection; success clears it and shows the toast, a refusal changes
   * nothing and shows the failure toast.
   *
   * @param {BulkAction} action - The action.
   * @param {(count: number) => { title: string; description: string }} toast - The success toast.
   */
  protected async run(
    action: BulkAction,
    toast: (count: number) => { title: string; description: string },
  ): Promise<void> {
    const selected: readonly BulkSelection[] = this.selection();
    if (selected.length === 0 || this.pending()) return;
    this.pending.set(true);
    const affected: number | null = await this.store.bulk(selected, action);
    this.pending.set(false);
    this.confirmDelete.set(false);
    if (affected === null) {
      this.toasts.error($localize`:@@spaces.bulk.failed:The selection could not be changed`);
      return;
    }
    this.selection.set([]);
    const message: { title: string; description: string } = toast(selected.length);
    this.toasts.show(message.title, { description: message.description });
  }

  /**
   * Method markDone
   *
   * @description
   * Marks the selection done.
   */
  protected markDone(): void {
    void this.run({ type: 'done' }, (count: number) => ({
      title: $localize`:@@spaces.bulk.done-toast:${count}:count: tasks done`,
      description: $localize`:@@spaces.bulk.done-toast-text:Status: Done.`,
    }));
  }

  /**
   * Method assign
   *
   * @description
   * Assigns the selection to a person.
   *
   * @param {string} userId - The person.
   */
  protected assign(userId: string): void {
    const name: string =
      this.people().find((person: ViewOption): boolean => person.value === userId)?.label ?? '';
    void this.run({ type: 'assign', userId }, (count: number) => ({
      title: $localize`:@@spaces.bulk.assigned:${name}:name: assigned`,
      description: $localize`:@@spaces.bulk.updated:${count}:count: tasks updated.`,
    }));
  }

  /**
   * Method move
   *
   * @description
   * Moves the selection to another list.
   *
   * @param {string} listId - The destination.
   */
  protected move(listId: string): void {
    const name: string =
      this.targets().find((target: MoveTarget): boolean => target.listId === listId)?.name ?? '';
    void this.run({ type: 'move', listId }, (count: number) => ({
      title: $localize`:@@spaces.bulk.moved:${count}:count: tasks moved`,
      description: $localize`:@@spaces.bulk.moved-text:To ${name}:name:.`,
    }));
  }

  /**
   * Method trash
   *
   * @description
   * Moves the confirmed selection to the trash.
   */
  protected trash(): void {
    void this.run({ type: 'trash' }, (count: number) => ({
      title: $localize`:@@spaces.bulk.deleted:${count}:count: tasks deleted`,
      description: $localize`:@@spaces.bulk.deleted-text:Kept 30 days in the trash.`,
    }));
  }

  /**
   * Method deleteTitle
   *
   * @description
   * Question of the deletion of the selection.
   *
   * @returns {string} The title.
   */
  protected deleteTitle(): string {
    const count: number = this.selection().length;
    return count > 1
      ? $localize`:@@spaces.bulk.delete-title:Delete ${count}:count: tasks?`
      : $localize`:@@spaces.bulk.delete-title-one:Delete this task?`;
  }

  /**
   * Method deleteAction
   *
   * @description
   * Action of the deletion of the selection.
   *
   * @returns {string} The label.
   */
  protected deleteAction(): string {
    const count: number = this.selection().length;
    return count > 1
      ? $localize`:@@spaces.bulk.delete-action:Delete ${count}:count: tasks`
      : $localize`:@@spaces.bulk.delete-action-one:Delete the task`;
  }

  /**
   * Method selectedItems
   *
   * @description
   * Keys of the selected tasks, listed by the confirmation.
   *
   * @returns {readonly string[]} The keys.
   */
  protected selectedItems(): readonly string[] {
    return this.selection().map((item: BulkSelection): string => item.taskKey);
  }
  // #endregion
}
