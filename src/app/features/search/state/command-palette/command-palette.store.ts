import { inject, type Signal, type Type } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, EMPTY, pipe, switchMap } from 'rxjs';

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
 * Interface CommandPaletteState
 *
 * @description
 * The text searched and what the gateway answered for it.
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
   * Matches of the last answered search; kept while a newer search runs.
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
  // #endregion
}

/**
 * Interface CommandPaletteStoreInstance
 *
 * @description
 * The palette's server search: debounced, the latest text winning, with loading and failure
 * flags and a retry.
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
   * Searches a text after a 250 ms pause, cancelling the previous search; a blank text clears the
   * results and cancels any search. The same text again does nothing.
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
    withMethods((store, api: SearchApi = inject(SearchApi)) => {
      const run: (query: string) => void = rxMethod<string>(
        pipe(
          debounceTime(DEBOUNCE_MS),
          switchMap((query: string) =>
            query === ''
              ? EMPTY
              : api.search(query).pipe(
                  tapResponse({
                    next: (results: readonly SearchResult[]): void => {
                      patchState(store, { results, loading: false });
                    },
                    error: (): void => {
                      patchState(store, { results: [], loading: false, failed: true });
                    },
                  }),
                ),
          ),
        ),
      );
      return {
        search(text: string): void {
          const query: string = text.trim();
          if (query === store.query()) return;
          patchState(store, {
            query,
            failed: false,
            loading: query !== '',
            results: query === '' ? [] : store.results(),
          });
          run(query);
        },
        retry(): void {
          if (store.query() === '') return;
          patchState(store, { failed: false, loading: true });
          run(store.query());
        },
      };
    }),
  );
}

/**
 * Constant CommandPaletteStore
 *
 * @description
 * The command palette's server search, provided by the palette so it dies with the shell. A
 * failure is a flag with a retry, never an empty answer.
 *
 * @type {ReturnType<typeof createCommandPaletteStore>}
 */
export const CommandPaletteStore: ReturnType<typeof createCommandPaletteStore> =
  createCommandPaletteStore();
