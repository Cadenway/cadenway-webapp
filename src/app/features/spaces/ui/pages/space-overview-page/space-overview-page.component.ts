import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { CwToastService } from '@cadenway/ui/components/toast';
import { NgIcon } from '@ng-icons/core';

import type { Milestone } from '../../../models/milestone/milestone.interface';
import type { Space, SpaceDetails } from '../../../models/space/space.interface';
import type { ListSummary, SpaceOverview } from '../../../models/task-list/task-list.interface';
import { SpaceOverviewStore } from '../../../state/space-overview/space-overview.store';
import { SpacesNavigationStore } from '../../../state/spaces-navigation/spaces-navigation.store';
import {
  formatDayMonth,
  formatSprintRange,
  todayIso,
} from '../../../utils/calendar-date/calendar-date.util';
import { lookIconName, lookTone } from '../../../utils/look/look.util';
import { injectOrganizationSlug } from '../../../utils/workspace-route/workspace-route.util';
import { ListCard } from '../../components/list-card/list-card.component';

/**
 * Component SpaceOverviewPage
 *
 * @description
 * The overview of a space at `/:org/spaces/:spaceId` (`App.dc.html` lines 1639-1682): its mark,
 * name, `n lists · m tasks`, description and favorite toggle; a card per list; `No list in this
 * space` when it has none; and the `Milestones` section. The space and its lists are the
 * primary reads: their failure reaches the route's error boundary through the template's read
 * (`Access denied` for a space the gateway does not show). The milestones keep an inline error
 * with `Retry`. `Edit`, `New sprint` and `New list` open the dialogs of
 * step 4b and are not built yet.
 */
@Component({
  selector: 'cw-space-overview-page',
  imports: [
    CwButton,
    CwEmpty,
    CwEmptyContent,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    CwStatusIcon,
    ListCard,
    NgIcon,
    RouterLink,
  ],
  providers: [SpaceOverviewStore],
  host: { class: 'flex min-h-0 flex-1 flex-col overflow-y-auto' },
  templateUrl: './space-overview-page.component.html',
})
export class SpaceOverviewPage {
  // #region Properties
  /**
   * Property retryLabel
   *
   * @description
   * Label for retrying a failed read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = SPACES_RETRY;

  /**
   * Property spaceId
   *
   * @description
   * The space of the route.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly spaceId: InputSignal<string> = input.required<string>();

  /**
   * Property store
   *
   * @description
   * The overview's reads.
   *
   * @type {InstanceType<typeof SpaceOverviewStore>}
   * @readonly
   */
  protected readonly store: InstanceType<typeof SpaceOverviewStore> = inject(SpaceOverviewStore);

  /**
   * Property navigation
   *
   * @description
   * The workspace's navigation, for the space favorite.
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
   * Property locale
   *
   * @description
   * Application locale of the dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property slug
   *
   * @description
   * Organization slug of the route.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly slug: Signal<string> = injectOrganizationSlug();

  /**
   * Property today
   *
   * @description
   * The caller's date when the page opened, for the late milestones.
   *
   * @type {string}
   * @readonly
   */
  private readonly today: string = todayIso();

  /**
   * Property addFavoriteLabel
   *
   * @description
   * Name of the favorite toggle while the space is not a favorite.
   *
   * @type {string}
   * @readonly
   */
  protected readonly addFavoriteLabel: string = $localize`:@@spaces.overview.favorite-add:Add to favorite spaces`;

  /**
   * Property removeFavoriteLabel
   *
   * @description
   * Name of the favorite toggle while the space is a favorite.
   *
   * @type {string}
   * @readonly
   */
  protected readonly removeFavoriteLabel: string = $localize`:@@spaces.overview.favorite-remove:Remove from favorite spaces`;

  /**
   * Property favorite
   *
   * @description
   * Whether the space is a favorite.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly favorite: Signal<boolean> = computed(
    (): boolean => this.navigation.favoriteOf('space', this.spaceId()) !== undefined,
  );

  /**
   * Property details
   *
   * @description
   * The space as the sidebar read it, with what its dialogs need, or undefined before that read;
   * `Edit`, `New sprint` and `New list` wait for it and need `edit`.
   *
   * @type {Signal<SpaceDetails | undefined>}
   * @readonly
   */
  protected readonly details: Signal<SpaceDetails | undefined> = computed(
    (): SpaceDetails | undefined => this.navigation.spaceById(this.spaceId()),
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Follows the space of the route, and the organization in the navigation for the favorite;
   * reads the space again once its dialog recorded a change.
   *
   * @constructor
   */
  public constructor() {
    this.store.load(this.spaceId);
    this.navigation.spaceEdited.pipe(takeUntilDestroyed()).subscribe((space: SpaceDetails) => {
      if (space.id === this.spaceId()) this.store.space.reload();
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method spaceIcon
   *
   * @description
   * Icon name of the space, or null for its initial.
   *
   * @param {Space} space - The space.
   * @returns {string | null} The icon name.
   */
  protected spaceIcon(space: Space): string | null {
    return space.icon ? lookIconName(space.icon) : null;
  }

  /**
   * Method spaceTone
   *
   * @description
   * Color class of the space's mark.
   *
   * @param {Space} space - The space.
   * @returns {string} The class.
   */
  protected spaceTone(space: Space): string {
    return space.color === 'gris' ? 'text-foreground' : lookTone(space.color);
  }

  /**
   * Method range
   *
   * @description
   * Sprint range of a list card, or null.
   *
   * @param {ListSummary} summary - The list.
   * @returns {string | null} The range.
   */
  protected range(summary: ListSummary): string | null {
    const sprint: ListSummary['list']['sprint'] = summary.list.sprint;
    return sprint ? formatSprintRange(sprint.startDate, sprint.endDate, this.locale) : null;
  }

  /**
   * Method listName
   *
   * @description
   * Name of a milestone's list, from the overview.
   *
   * @param {SpaceOverview} overview - The overview.
   * @param {Milestone} milestone - The milestone.
   * @returns {string} The list name, empty when unknown.
   */
  protected listName(overview: SpaceOverview, milestone: Milestone): string {
    return (
      overview.lists.find((summary: ListSummary): boolean => summary.list.id === milestone.listId)
        ?.list.name ?? ''
    );
  }

  /**
   * Method isLate
   *
   * @description
   * Whether a milestone is past its date and neither reached nor cancelled.
   *
   * @param {Milestone} milestone - The milestone.
   * @returns {boolean} Whether it is late.
   */
  protected isLate(milestone: Milestone): boolean {
    return (
      milestone.dueDate !== null &&
      milestone.dueDate < this.today &&
      milestone.status !== 'done' &&
      milestone.status !== 'cancelled'
    );
  }

  /**
   * Method milestoneDate
   *
   * @description
   * Date of a milestone (`Nov 20` in English), or a dash.
   *
   * @param {Milestone} milestone - The milestone.
   * @returns {string} The date.
   */
  protected milestoneDate(milestone: Milestone): string {
    return milestone.dueDate ? formatDayMonth(milestone.dueDate, this.locale) : '—';
  }

  /**
   * Method toggleFavorite
   *
   * @description
   * Adds the space to the favorites or removes it; a refusal shows the failure toast.
   *
   * @param {Space} space - The space.
   */
  protected async toggleFavorite(space: Space): Promise<void> {
    const on: boolean = !this.favorite();
    const recorded: boolean = await this.navigation.setFavorite('space', space.id, space.name, on);
    if (!recorded) {
      this.toasts.error($localize`:@@spaces.favorite.failed:The favorites could not be changed`);
      return;
    }
    this.toasts.show(
      on
        ? $localize`:@@spaces.favorite.space-added:Added to favorite spaces`
        : $localize`:@@spaces.favorite.space-removed:Removed from favorite spaces`,
      { description: space.name },
    );
  }

  /**
   * Method editSpace
   *
   * @description
   * `Edit`: opens the space dialog, which the sidebar hosts.
   *
   * @param {SpaceDetails} space - The space.
   */
  protected editSpace(space: SpaceDetails): void {
    this.navigation.openDialog({ kind: 'space', space });
  }

  /**
   * Method newList
   *
   * @description
   * `New list` or `New sprint` in the space.
   *
   * @param {SpaceDetails} space - The space.
   * @param {boolean} sprint - Whether the next sprint is proposed.
   */
  protected newList(space: SpaceDetails, sprint: boolean): void {
    this.navigation.openDialog({ kind: 'list', spaceId: space.id, list: null, sprint });
  }
  // #endregion
}
