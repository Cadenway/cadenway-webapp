import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { InputSignal, ResourceLoaderParams, ResourceRef, Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CwStatusBadge } from '@cadenway/ui/components/badge';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyHeader,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwToastService } from '@cadenway/ui/components/toast';

import { ListNavigation } from '../../../data-access/services/list-navigation/list-navigation.service';
import type {
  SpacesPageData,
  SpacesPageKind,
  SpacesPageRequest,
} from '../../../models/list-navigation/list-navigation.model';
import type {
  BoardLocation,
  BoardPresentation,
} from '../../../models/sprint-board/sprint-board.model';
import { SprintBoardStore } from '../../../state/sprint-board/sprint-board.store';
import { SprintBoard } from '../../components/sprint-board/sprint-board.component';

/**
 * Constant ROUTE_ID
 *
 * @description
 * Accepts UUID route segments before the generated client interpolates them in a Gateway path.
 *
 * @type {RegExp}
 */
const ROUTE_ID: RegExp = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/**
 * Component SpacesPage
 *
 * @description
 * Displays one page of visible spaces, lists or tasks in the current organization.
 */
@Component({
  selector: 'cw-spaces-page',
  imports: [
    RouterLink,
    DatePipe,
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyHeader,
    CwEmptyTitle,
    CwSkeleton,
    CwStatusBadge,
    SprintBoard,
  ],
  templateUrl: './spaces-page.component.html',
  providers: [SprintBoardStore, CwToastService],
})
export class SpacesPage {
  // #region Properties
  /**
   * Property pageKind
   *
   * @description
   * The destination level declared by the feature route.
   *
   * @type {InputSignal<SpacesPageKind>}
   * @readonly
   */
  public readonly pageKind: InputSignal<SpacesPageKind> = input.required<SpacesPageKind>();

  /**
   * Property spaceId
   *
   * @description
   * The UUID of the selected space when present in the route.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly spaceId: InputSignal<string | undefined> = input<string>();

  /**
   * Property listId
   *
   * @description
   * The UUID of the selected list when present in the route.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly listId: InputSignal<string | undefined> = input<string>();

  /**
   * Property cursor
   *
   * @description
   * The optional opaque continuation from the URL.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly cursor: InputSignal<string | undefined> = input<string>();

  /**
   * Property vue
   *
   * @description
   * Selects the board when the current list link uses the Tableau view.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly vue: InputSignal<string | undefined> = input<string>();

  /**
   * Property organizationId
   *
   * @description
   * The organization resolved before the task collection route opens.
   *
   * @type {InputSignal<string | undefined>}
   * @readonly
   */
  public readonly organizationId: InputSignal<string | undefined> = input<string>();

  /**
   * Property navigation
   *
   * @description
   * Loads the records for the current destination.
   *
   * @type {ListNavigation}
   * @readonly
   */
  private readonly navigation: ListNavigation = inject(ListNavigation);

  /**
   * Property board
   *
   * @description
   * Owns the selected list's board reads and versioned card changes.
   *
   * @type {InstanceType<typeof SprintBoardStore>}
   * @readonly
   */
  protected readonly board: InstanceType<typeof SprintBoardStore> = inject(SprintBoardStore);

  /**
   * Property request
   *
   * @description
   * Rejects malformed route segments before requesting any records.
   *
   * @type {Signal<SpacesPageRequest | undefined>}
   * @readonly
   */
  protected readonly request: Signal<SpacesPageRequest | undefined> = computed(() => {
    const kind: SpacesPageKind = this.pageKind();
    const cursor: string | undefined = this.cursor();
    if (kind === 'spaces') return { kind, cursor };

    const spaceId: string | undefined = this.spaceId()?.toLowerCase();
    if (spaceId === undefined || !ROUTE_ID.test(spaceId)) return undefined;
    if (kind === 'lists') return { kind, spaceId, cursor };

    const listId: string | undefined = this.listId()?.toLowerCase();
    if (!this.organizationId() || listId === undefined || !ROUTE_ID.test(listId)) return undefined;
    return { kind, spaceId, listId, cursor, view: this.vue() === 'tableau' ? 'board' : undefined };
  });

  /**
   * Property collection
   *
   * @description
   * Loads only the current destination and cancels the previous read on navigation.
   *
   * @type {ResourceRef<SpacesPageData | undefined>}
   * @readonly
   */
  protected readonly collection: ResourceRef<SpacesPageData | undefined> = rxResource<
    SpacesPageData,
    SpacesPageRequest | undefined
  >({
    params: this.request,
    stream: (loader: ResourceLoaderParams<SpacesPageRequest | undefined>) =>
      this.navigation.load(loader.params),
  });

  /**
   * Property boardLocation
   *
   * @description
   * Mounts the board only after the list's route and session have been verified.
   *
   * @type {Signal<BoardLocation | undefined>}
   * @readonly
   */
  private readonly boardLocation: Signal<BoardLocation | undefined> = computed(() => {
    const organizationId: string | undefined = this.organizationId();
    if (!organizationId || !this.collection.hasValue()) return undefined;
    const data: SpacesPageData = this.collection.value();
    if (data.kind !== 'board') return undefined;
    return {
      organizationId,
      listId: data.listId,
      spaceId: data.spaceId,
      mayEdit: data.mayEdit,
    };
  });

  /**
   * Property boardPresentation
   *
   * @description
   * Supplies the passive board view with the current route's permission and render state.
   *
   * @type {Signal<BoardPresentation | undefined>}
   * @readonly
   */
  protected readonly boardPresentation: Signal<BoardPresentation | undefined> = computed(() => {
    const location: BoardLocation | undefined = this.boardLocation();
    if (!location) return undefined;
    return {
      mayEdit: location.mayEdit,
      columns: this.board.columns(),
      moves: this.board.moves(),
      hasPendingMoves: this.board.hasPendingMoves(),
      loading: this.board.loading(),
      loadError: this.board.loadError(),
      organizationChanged: this.board.organizationChanged(),
      paging: this.board.paging(),
    };
  });

  /**
   * Property heading
   *
   * @description
   * Uses the verified list name when an actual result is available.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly heading: Signal<string> = computed(() => {
    if (this.vue() === 'tableau' && this.board.organizationChanged()) return 'Liste';
    if (this.collection.hasValue()) {
      const result: SpacesPageData = this.collection.value();
      if (result.kind === 'tasks' || result.kind === 'board') return result.listName;
    }
    switch (this.pageKind()) {
      case 'spaces':
        return 'Espaces';
      case 'lists':
        return 'Listes';
      case 'tasks':
        return 'Liste';
    }
  });
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts and clears the page-scoped board as the selected list view changes.
   * @constructor
   */
  public constructor() {
    this.board.connect(this.boardLocation);
  }
  // #endregion
}
