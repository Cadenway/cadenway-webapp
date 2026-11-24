import { computed, inject, type Signal, type Type } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, timer } from 'rxjs';

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { SearchApi } from '../../data-access/services/search-api/search-api.service';
import type {
  ListSearchResult,
  SearchResult,
  TaskSearchResult,
} from '../../models/search-result/search-result.interface';

/**
 * Constant DEBOUNCE_MS
 *
 * @description
 * Pause in typing after which the palette searches, in milliseconds.
 *
 * @type {number}
 */
export const DEBOUNCE_MS: number = 250;

/**
 * Interface SearchRequest
 *
 * @description
 * A search the palette asked for, with the organization it belongs to.
 */
interface SearchRequest {
  // #region Properties
  /**
   * Property query
   *
   * @description
   * Trimmed text; empty cancels any search.
   *
   * @type {string}
   * @readonly
   */
  readonly query: string;

  /**
   * Property organizationId
   *
   * @description
   * Organization the search runs for; an answer for another one is dropped.
   *
   * @type {string | null}
   * @readonly
   */
  readonly organizationId: string | null;
  // #endregion
}

/**
 * Interface CommandPaletteState
 *
 * @description
 * The text searched, the organization it was searched in, and what the gateway answered.
 */
interface CommandPaletteState {
  // #region Properties
  /**
   * Property query
   *
   * @description
   * Trimmed text of the palette's field.
   *
   * @type {string}
   * @readonly
   */
  readonly query: string;

  /**
   * Property results
   *
   * @description
   * Matches of `query`; emptied as soon as the text changes.
   *
   * @type {readonly SearchResult[]}
   * @readonly
   */
  readonly results: readonly SearchResult[];

  /**
   * Property loading
   *
   * @description
   * Whether a search for `query` is waiting or running.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loading: boolean;

  /**
   * Property failed
   *
   * @description
   * Whether the search for `query` failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly failed: boolean;

  /**
   * Property _organizationId
   *
   * @description
   * Organization of the workspace the results belong to.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;
  // #endregion
}

/**
 * Interface CommandPaletteStoreInstance
 *
 * @description
 * The palette's server search: debounced, the latest text winning, with loading and failure
 * flags and a retry, scoped to the current organization.
 */
interface CommandPaletteStoreInstance {
  // #region Properties
  /**
   * Property query
   *
   * @description
   * Trimmed text searched.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly query: Signal<string>;

  /**
   * Property loading
   *
   * @description
   * Whether a search is waiting or running.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether the last search failed; its results are then empty, not stale.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property tasks
   *
   * @description
   * Tasks found.
   *
   * @type {Signal<readonly TaskSearchResult[]>}
   * @readonly
   */
  readonly tasks: Signal<readonly TaskSearchResult[]>;

  /**
   * Property lists
   *
   * @description
   * Lists found.
   *
   * @type {Signal<readonly ListSearchResult[]>}
   * @readonly
   */
  readonly lists: Signal<readonly ListSearchResult[]>;
  // #endregion

  // #region Methods
  /**
   * Method search
   *
   * @description
   * Searches a text after a 250 ms pause. A new text cancels the previous search at once, even a
   * request already sent, and empties the results; a blank text cancels without searching. The
   * same text again does nothing.
   *
   * @param {string} text - Text of the palette's field.
   */
  search(text: string): void;

  /**
   * Method retry
   *
   * @description
   * Searches the current text again after a failure.
   */
  retry(): void;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing searched.
 *
 * @type {CommandPaletteState}
 */
const initialState: CommandPaletteState = {
  query: '',
  results: [],
  loading: false,
  failed: false,
  _organizationId: null,
};

/**
 * Function createCommandPaletteStore
 *
 * @description
 * Creates the palette's search store.
 *
 * @returns {Type<CommandPaletteStoreInstance>} Injectable store constructor.
 */
function createCommandPaletteStore(): Type<CommandPaletteStoreInstance> {
  return signalStore(
    withState(initialState),
    withComputed(({ results }: { results: Signal<readonly SearchResult[]> }) => ({
      tasks: (): readonly TaskSearchResult[] =>
        results().filter((result: SearchResult) => result.kind === 'task'),
      lists: (): readonly ListSearchResult[] =>
        results().filter((result: SearchResult) => result.kind === 'list'),
    })),
    withProps(() => {
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      return { _workspace: workspace };
    }),
    withMethods((store, api: SearchApi = inject(SearchApi)) => {
      const current: (request: SearchRequest) => boolean = (request: SearchRequest): boolean =>
        request.query === store.query() && request.organizationId === store._organizationId();
      const run: (request: SearchRequest) => void = rxMethod<SearchRequest>(
        pipe(
          tap((request: SearchRequest) => {
            patchState(store, { results: [], failed: false, loading: request.query !== '' });
          }),
          switchMap((request: SearchRequest) =>
            request.query === ''
              ? EMPTY
              : timer(DEBOUNCE_MS).pipe(
                  switchMap(() =>
                    api.search(request.query).pipe(
                      tapResponse({
                        next: (results: readonly SearchResult[]): void => {
                          if (current(request)) patchState(store, { results, loading: false });
                        },
                        error: (): void => {
                          if (current(request)) {
                            patchState(store, { results: [], loading: false, failed: true });
                          }
                        },
                      }),
                    ),
                  ),
                ),
          ),
        ),
      );
      return {
        search(text: string): void {
          const query: string = text.trim();
          if (query === store.query()) return;
          patchState(store, { query });
          run({ query, organizationId: store._organizationId() });
        },
        retry(): void {
          if (store.query() === '') return;
          run({ query: store.query(), organizationId: store._organizationId() });
        },
        _followOrganization: signalMethod<string>((organizationId: string): void => {
          if (organizationId === store._organizationId()) return;
          patchState(store, { _organizationId: organizationId, query: '' });
          run({ query: '', organizationId });
        }),
      };
    }),
    withHooks({
      onInit(store): void {
        store._followOrganization(computed((): string => store._workspace.organization().id));
      },
    }),
  );
}

/**
 * Constant CommandPaletteStore
 *
 * @description
 * The command palette's server search, provided by the palette so it dies with the shell. A
 * committed organization switch cancels the pending request and clears the text and the
 * results; an answer only applies to the text and the organization it was asked for. A failure
 * is a flag with a retry, never an empty answer.
 *
 * @type {ReturnType<typeof createCommandPaletteStore>}
 */
export const CommandPaletteStore: ReturnType<typeof createCommandPaletteStore> =
  createCommandPaletteStore();
