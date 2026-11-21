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

import { ListNavigation } from '../../../data-access/services/list-navigation/list-navigation.service';
import type {
  SpacesPageData,
  SpacesPageKind,
  SpacesPageRequest,
} from '../../../models/list-navigation/list-navigation.model';

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
  ],
  templateUrl: './spaces-page.component.html',
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
    if (listId === undefined || !ROUTE_ID.test(listId)) return undefined;
    return { kind, spaceId, listId, cursor };
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
   * Property heading
   *
   * @description
   * Uses the verified list name when an actual result is available.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly heading: Signal<string> = computed(() => {
    if (this.collection.hasValue()) {
      const result: SpacesPageData = this.collection.value();
      if (result.kind === 'tasks') return result.listName;
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
}
