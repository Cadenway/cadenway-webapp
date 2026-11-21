import type { CwStatusKey } from '@cadenway/ui/components/status-icon';

/**
 * Type SpacesPageKind
 *
 * @description
 * The route's level in the space and list navigator.
 *
 * @type {'spaces' | 'lists' | 'tasks'}
 */
export type SpacesPageKind = 'spaces' | 'lists' | 'tasks';

/**
 * Type SpacesPageRequest
 *
 * @description
 * Route selection and opaque cursor for one page of visible records.
 *
 * @type {object}
 */
export type SpacesPageRequest =
  | { readonly kind: 'spaces'; readonly cursor?: string }
  | { readonly kind: 'lists'; readonly spaceId: string; readonly cursor?: string }
  | {
      readonly kind: 'tasks';
      readonly spaceId: string;
      readonly listId: string;
      readonly cursor?: string;
    };

/**
 * Type Destination
 *
 * @description
 * A visible space or list reached through its persistent identifier.
 *
 * @type {Readonly<{ id: string; name: string }>}
 */
type Destination = Readonly<{
  readonly id: string;
  readonly name: string;
}>;

/**
 * Type Sprint
 *
 * @description
 * Calendar dates and the optional objective displayed below a sprint's name.
 *
 * @type {Readonly<{ startDate: string; endDate: string; goal: string | null }>}
 */
type Sprint = Readonly<{
  readonly startDate: string;
  readonly endDate: string;
  readonly goal: string | null;
}>;

/**
 * Type TaskRow
 *
 * @description
 * The task fields displayed in the list, with assignees counted from their references.
 *
 * @type {object}
 */
type TaskRow = Readonly<{
  readonly key: string;
  readonly name: string;
  readonly status: CwStatusKey;
  readonly assigneeCount: number;
  readonly dueDate: string | null;
}>;

/**
 * Type Page
 *
 * @description
 * A bounded page of records and the API continuation when a further page exists.
 *
 * @type {object}
 */
type Page<Item> = Readonly<{
  readonly items: readonly Item[];
  readonly nextCursor: string | null;
}>;

/**
 * Type SpacesPageData
 *
 * @description
 * DTO-free display data for the route, discriminated by the collection it shows.
 *
 * @type {object}
 */
export type SpacesPageData =
  | { readonly kind: 'spaces'; readonly page: Page<Destination> }
  | { readonly kind: 'lists'; readonly spaceId: string; readonly page: Page<Destination> }
  | {
      readonly kind: 'tasks';
      readonly listName: string;
      readonly sprint: Sprint | null;
      readonly page: Page<TaskRow>;
    };
