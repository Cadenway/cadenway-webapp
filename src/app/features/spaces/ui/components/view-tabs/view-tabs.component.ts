import {
  Component,
  computed,
  input,
  type InputSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import {
  CwMenu,
  CwMenuItem,
  CwMenuLabel,
  CwMenuSeparator,
  CwMenuShortcut,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwTab, CwTabs, CwTabsList } from '@cadenway/ui/components/tabs';
import { NgIcon } from '@ng-icons/core';

import { layoutLabels } from '../../../constants/view-labels/view-labels.constants';
import type { SavedView, ViewLayout } from '../../../models/saved-view/saved-view.interface';
import { layoutIconName, lookIconName } from '../../../utils/look/look.util';

/**
 * Constant SAVED_PREFIX
 *
 * @description
 * Prefix of a saved view's tab value.
 *
 * @type {string}
 */
const SAVED_PREFIX: string = 'saved:';

/**
 * Component ViewTabs
 *
 * @description
 * The view tabs of a list (`App.dc.html` lines 336-368): the standard views (only « Liste » in
 * step 4a), a tab per saved view with « , modifiée » when its settings changed, the options of the
 * applied saved view (« … » and a right click: open, save the changes, revert, rename, duplicate,
 * delete) and the « Vue » menu with « Enregistrer la vue actuelle… ». Presentational: picking a
 * tab emits `layoutPicked` or `savedPicked`; the page navigates.
 */
@Component({
  selector: 'cw-view-tabs',
  imports: [
    CwButton,
    CwContextMenuTriggerFor,
    CwMenu,
    CwMenuItem,
    CwMenuLabel,
    CwMenuSeparator,
    CwMenuShortcut,
    CwMenuTriggerFor,
    CwTab,
    CwTabs,
    CwTabsList,
    NgIcon,
  ],
  templateUrl: './view-tabs.component.html',
})
export class ViewTabs {
  // #region Properties
  /**
   * Property layouts
   *
   * @description
   * Standard views of the list.
   *
   * @type {InputSignal<readonly ViewLayout[]>}
   * @readonly
   */
  public readonly layouts: InputSignal<readonly ViewLayout[]> = input<readonly ViewLayout[]>([
    'list',
  ]);

  /**
   * Property layout
   *
   * @description
   * Layout shown.
   *
   * @type {InputSignal<ViewLayout>}
   * @readonly
   */
  public readonly layout: InputSignal<ViewLayout> = input<ViewLayout>('list');

  /**
   * Property savedViews
   *
   * @description
   * Saved views of the list.
   *
   * @type {InputSignal<readonly SavedView[]>}
   * @readonly
   */
  public readonly savedViews: InputSignal<readonly SavedView[]> = input<readonly SavedView[]>([]);

  /**
   * Property activeViewId
   *
   * @description
   * The applied saved view, or null.
   *
   * @type {InputSignal<string | null>}
   * @readonly
   */
  public readonly activeViewId: InputSignal<string | null> = input<string | null>(null);

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
   * Property canEdit
   *
   * @description
   * Whether the caller may change the saved views.
   *
   * @type {InputSignal<boolean>}
   * @readonly
   */
  public readonly canEdit: InputSignal<boolean> = input(true);

  /**
   * Property layoutPicked
   *
   * @description
   * Emits the standard view picked.
   *
   * @type {OutputEmitterRef<ViewLayout>}
   * @readonly
   */
  public readonly layoutPicked: OutputEmitterRef<ViewLayout> = output<ViewLayout>();

  /**
   * Property savedPicked
   *
   * @description
   * Emits the saved view picked.
   *
   * @type {OutputEmitterRef<SavedView>}
   * @readonly
   */
  public readonly savedPicked: OutputEmitterRef<SavedView> = output<SavedView>();

  /**
   * Property saveRequested
   *
   * @description
   * Emits on « Enregistrer la vue actuelle… ».
   *
   * @type {OutputEmitterRef<void>}
   * @readonly
   */
  public readonly saveRequested: OutputEmitterRef<void> = output();

  /**
   * Property settingsSaved
   *
   * @description
   * Emits on « Enregistrer les modifications ».
   *
   * @type {OutputEmitterRef<SavedView>}
   * @readonly
   */
  public readonly settingsSaved: OutputEmitterRef<SavedView> = output<SavedView>();

  /**
   * Property reverted
   *
   * @description
   * Emits on « Rétablir ».
   *
   * @type {OutputEmitterRef<SavedView>}
   * @readonly
   */
  public readonly reverted: OutputEmitterRef<SavedView> = output<SavedView>();

  /**
   * Property renameRequested
   *
   * @description
   * Emits on « Renommer ».
   *
   * @type {OutputEmitterRef<SavedView>}
   * @readonly
   */
  public readonly renameRequested: OutputEmitterRef<SavedView> = output<SavedView>();

  /**
   * Property duplicated
   *
   * @description
   * Emits on « Dupliquer ».
   *
   * @type {OutputEmitterRef<SavedView>}
   * @readonly
   */
  public readonly duplicated: OutputEmitterRef<SavedView> = output<SavedView>();

  /**
   * Property deleted
   *
   * @description
   * Emits on « Supprimer la vue ».
   *
   * @type {OutputEmitterRef<SavedView>}
   * @readonly
   */
  public readonly deleted: OutputEmitterRef<SavedView> = output<SavedView>();

  /**
   * Property menuView
   *
   * @description
   * The saved view whose options menu is open.
   *
   * @type {WritableSignal<SavedView | null>}
   * @readonly
   */
  protected readonly menuView: WritableSignal<SavedView | null> = signal<SavedView | null>(null);

  /**
   * Property layoutNames
   *
   * @description
   * Names of the layouts.
   *
   * @type {Readonly<Record<ViewLayout, string>>}
   * @readonly
   */
  protected readonly layoutNames: Readonly<Record<ViewLayout, string>> = layoutLabels();

  /**
   * Property value
   *
   * @description
   * Value of the active tab.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly value: Signal<string> = computed((): string => {
    const active: string | null = this.activeViewId();
    return active !== null ? `${SAVED_PREFIX}${active}` : this.layout();
  });

  /**
   * Property activeView
   *
   * @description
   * The applied saved view, or null.
   *
   * @type {Signal<SavedView | null>}
   * @readonly
   */
  protected readonly activeView: Signal<SavedView | null> = computed(
    (): SavedView | null =>
      this.savedViews().find((view: SavedView): boolean => view.id === this.activeViewId()) ?? null,
  );
  // #endregion

  // #region Methods
  /**
   * Method layoutIcon
   *
   * @description
   * Icon of a standard view tab, Fill while active.
   *
   * @param {ViewLayout} layout - Layout.
   * @returns {string} The icon name.
   */
  protected layoutIcon(layout: ViewLayout): string {
    return layoutIconName(layout, this.value() === layout);
  }

  /**
   * Method viewIcon
   *
   * @description
   * Icon of a saved view tab: its own, else its layout's; Fill while active.
   *
   * @param {SavedView} view - The view.
   * @returns {string} The icon name.
   */
  protected viewIcon(view: SavedView): string {
    const active: boolean = view.id === this.activeViewId();
    return view.icon ? lookIconName(view.icon, active) : layoutIconName(view.layout, active);
  }

  /**
   * Method optionsLabel
   *
   * @description
   * Name of a saved view's options button (« Options de la vue Bugs critiques »).
   *
   * @param {SavedView} view - The view.
   * @returns {string} The label.
   */
  protected optionsLabel(view: SavedView): string {
    return $localize`:@@spaces.saved.options:Options of the view ${view.name}:name:`;
  }

  /**
   * Method pick
   *
   * @description
   * Emits the tab picked by its value.
   *
   * @param {string} value - Tab value.
   */
  protected pick(value: string): void {
    if (value === this.value()) return;
    if (value.startsWith(SAVED_PREFIX)) {
      const id: string = value.slice(SAVED_PREFIX.length);
      const view: SavedView | undefined = this.savedViews().find(
        (item: SavedView): boolean => item.id === id,
      );
      if (view) this.savedPicked.emit(view);
      return;
    }
    const layout: ViewLayout | undefined = this.layouts().find(
      (item: ViewLayout): boolean => item === value,
    );
    if (layout) this.layoutPicked.emit(layout);
  }
  // #endregion
}
