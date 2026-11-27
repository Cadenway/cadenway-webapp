import {
  computed,
  inject,
  resource,
  type ResourceRef,
  type Signal,
  type Type,
} from '@angular/core';
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

import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { BillingApi } from '../../data-access/services/billing-api/billing-api.service';
import type { InvoicePage, OrganizationInvoice } from '../../models/invoice/invoice.interface';

/**
 * Constant INVOICES_PAGE_SIZE
 *
 * @description
 * Invoices per page.
 *
 * @type {number}
 */
export const INVOICES_PAGE_SIZE: number = 10;

/**
 * Interface InvoicesRead
 *
 * @description
 * What one read asks for: a page of an organization.
 */
interface InvoicesRead {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization the page belongs to.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property cursor
   *
   * @description
   * Cursor of the page, null for the first.
   *
   * @type {string | null}
   * @readonly
   */
  readonly cursor: string | null;

  /**
   * Property index
   *
   * @description
   * Zero-based position of the page.
   *
   * @type {number}
   * @readonly
   */
  readonly index: number;
  // #endregion
}

/**
 * Interface InvoicesSnapshot
 *
 * @description
 * A page answered for a read.
 */
interface InvoicesSnapshot {
  // #region Properties
  /**
   * Property read
   *
   * @description
   * The read it answers.
   *
   * @type {InvoicesRead}
   * @readonly
   */
  readonly read: InvoicesRead;

  /**
   * Property page
   *
   * @description
   * The page.
   *
   * @type {InvoicePage}
   * @readonly
   */
  readonly page: InvoicePage;
  // #endregion
}

/**
 * Interface InvoicesState
 *
 * @description
 * Pages reached and the organization they belong to.
 */
interface InvoicesState {
  // #region Properties
  /**
   * Property _organizationId
   *
   * @description
   * Organization whose pages `_cursors` holds; null before any page change.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _organizationId: string | null;

  /**
   * Property _cursors
   *
   * @description
   * Cursor of each page reached, the first one's null; the last is the page shown.
   *
   * @type {readonly (string | null)[]}
   * @readonly
   */
  readonly _cursors: readonly (string | null)[];

  /**
   * Property _answeredFor
   *
   * @description
   * Organization of which a page was answered, which ends the section skeleton.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _answeredFor: string | null;

  /**
   * Property _paged
   *
   * @description
   * Whether the person moved between pages of the organization, which keeps the pagination shown
   * while a page is read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _paged: boolean;
  // #endregion
}

/**
 * Interface InvoicesStoreInstance
 *
 * @description
 * The organization's invoices, page by page.
 */
interface InvoicesStoreInstance {
  // #region Properties
  /**
   * Property invoices
   *
   * @description
   * The read of the page shown. Its first read for an organization is the page's primary read:
   * reading its value after a failure throws into the route's error boundary.
   *
   * @type {ResourceRef<InvoicesSnapshot | undefined>}
   * @readonly
   */
  readonly invoices: ResourceRef<InvoicesSnapshot | undefined>;

  /**
   * Property shown
   *
   * @description
   * Whether a page of the workspace organization was answered; false again after a switch.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly shown: Signal<boolean>;

  /**
   * Property rows
   *
   * @description
   * Invoices of the page shown; empty while it is read or when its read failed.
   *
   * @type {Signal<readonly OrganizationInvoice[]>}
   * @readonly
   */
  readonly rows: Signal<readonly OrganizationInvoice[]>;

  /**
   * Property loading
   *
   * @description
   * Whether the page shown is being read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property failed
   *
   * @description
   * Whether a read after the first one failed; the page then shows an inline error with `Retry`.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly failed: Signal<boolean>;

  /**
   * Property pageIndex
   *
   * @description
   * Zero-based position of the page shown.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly pageIndex: Signal<number>;

  /**
   * Property hasPrevious
   *
   * @description
   * Whether a page comes before the page shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasPrevious: Signal<boolean>;

  /**
   * Property hasNext
   *
   * @description
   * Whether the page shown has a next page.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasNext: Signal<boolean>;

  /**
   * Property paged
   *
   * @description
   * Whether the pagination shows: a page comes after, or the person moved between pages. It stays
   * true while the page opened is read, so its buttons keep their place.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly paged: Signal<boolean>;
  // #endregion

  // #region Methods
  /**
   * Method next
   *
   * @description
   * Opens the next page, when the page shown has one.
   */
  next(): void;

  /**
   * Method previous
   *
   * @description
   * Opens the previous page, read again.
   */
  previous(): void;

  /**
   * Method retry
   *
   * @description
   * Reads the page shown again after a failure.
   */
  retry(): void;
  // #endregion
}

/**
 * Function createInvoicesStore
 *
 * @description
 * Creates the invoices store.
 *
 * @returns {Type<InvoicesStoreInstance>} Injectable store constructor.
 */
function createInvoicesStore(): Type<InvoicesStoreInstance> {
  return signalStore(
    withState<InvoicesState>({
      _organizationId: null,
      _cursors: [null],
      _answeredFor: null,
      _paged: false,
    }),
    withProps((store) => {
      const api: BillingApi = inject(BillingApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      // The pages reached belong to their organization: another organization starts at its first
      // page, before the reset below even runs, so no cursor of one is ever sent for another.
      const cursors: Signal<readonly (string | null)[]> = computed(
        (): readonly (string | null)[] =>
          store._organizationId() === workspace.organization().id ? store._cursors() : [null],
      );
      const read: Signal<InvoicesRead> = computed(
        (): InvoicesRead => ({
          organizationId: workspace.organization().id,
          cursor: cursors().at(-1) ?? null,
          index: cursors().length - 1,
        }),
        {
          equal: (a: InvoicesRead, b: InvoicesRead): boolean =>
            a.organizationId === b.organizationId && a.cursor === b.cursor && a.index === b.index,
        },
      );
      return {
        _workspace: workspace,
        _pages: cursors,
        _read: read,
        invoices: resource({
          params: (): InvoicesRead => read(),
          loader: async ({
            params,
            abortSignal,
          }: {
            params: InvoicesRead;
            abortSignal: AbortSignal;
          }): Promise<InvoicesSnapshot> => ({
            read: params,
            page: await api.invoices(params.cursor, INVOICES_PAGE_SIZE, abortSignal),
          }),
        }),
      };
    }),
    withComputed((store) => {
      const current: Signal<InvoicesSnapshot | null> = computed((): InvoicesSnapshot | null => {
        if (!store.invoices.hasValue()) return null;
        const snapshot: InvoicesSnapshot = store.invoices.value();
        const read: InvoicesRead = store._read();
        return snapshot.read.organizationId === read.organizationId &&
          snapshot.read.index === read.index &&
          snapshot.read.cursor === read.cursor
          ? snapshot
          : null;
      });
      const shown: Signal<boolean> = computed(
        (): boolean => store._answeredFor() === store._workspace.organization().id,
      );
      return {
        _current: current,
        shown,
        rows: (): readonly OrganizationInvoice[] => current()?.page.items ?? [],
        loading: (): boolean => store.invoices.isLoading(),
        failed: (): boolean => shown() && store.invoices.status() === 'error',
        pageIndex: (): number => store._pages().length - 1,
        hasPrevious: (): boolean => store._pages().length > 1,
        hasNext: (): boolean => (current()?.page.nextCursor ?? null) !== null,
        paged: (): boolean =>
          store._pages().length > 1 ||
          (current()?.page.nextCursor ?? null) !== null ||
          (store._paged() && store._organizationId() === store._workspace.organization().id),
      };
    }),
    withMethods((store) => {
      // The organization last followed: every switch starts the next one over, its first read
      // being again the primary read (skeleton, then the error boundary), even back to an
      // organization answered before.
      let followed: string | null = null;
      return {
        _remember: signalMethod<InvoicesSnapshot | null>(
          (snapshot: InvoicesSnapshot | null): void => {
            if (snapshot !== null && store._answeredFor() !== snapshot.read.organizationId) {
              patchState(store, { _answeredFor: snapshot.read.organizationId });
            }
          },
        ),

        _follow: signalMethod<string>((organizationId: string): void => {
          if (followed !== null && followed !== organizationId) {
            patchState(store, {
              _organizationId: null,
              _cursors: [null],
              _paged: false,
              _answeredFor: store._answeredFor() === organizationId ? organizationId : null,
            });
          }
          followed = organizationId;
        }),

        next(): void {
          const cursor: string | null = store._current()?.page.nextCursor ?? null;
          if (cursor === null) return;
          patchState(store, {
            _organizationId: store._read().organizationId,
            _cursors: [...store._pages(), cursor],
            _paged: true,
          });
        },

        previous(): void {
          const pages: readonly (string | null)[] = store._pages();
          if (pages.length < 2) return;
          patchState(store, {
            _organizationId: store._read().organizationId,
            _cursors: pages.slice(0, -1),
            _paged: true,
          });
        },

        retry(): void {
          store.invoices.reload();
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._remember(store._current);
        store._follow(computed((): string => store._workspace.organization().id));
      },
    }),
  );
}

/**
 * Constant InvoicesStore
 *
 * @description
 * The issued invoices of the workspace organization for the `Billing` section, provided by its
 * page, newest first, `INVOICES_PAGE_SIZE` per page by cursor; it keeps the cursor of each page
 * reached for `Previous`. The reads are keyed by the organization: a page the router reuses for
 * another organization starts again at that one's first page, whose read is again the primary
 * read (the section skeleton, then the route's error boundary on a failure). A later failed read
 * is `failed`, with `retry()`.
 *
 * @type {ReturnType<typeof createInvoicesStore>}
 */
export const InvoicesStore: ReturnType<typeof createInvoicesStore> = createInvoicesStore();
