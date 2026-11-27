import type { GetHomeClientResult } from '@cadenway/api-client';

import type {
  HomeList,
  HomeSnapshot,
  HomeSprint,
} from '../../../models/home-read/home-read.interface';
import { type HomeTaskDto, toHomeTask } from '../task-summary/task-summary.adapter';

/**
 * Type ListSummaryDto
 *
 * @description
 * One list of `getHome`'s `sprints` or `lists`, with the counts of its top-level tasks.
 *
 * @type {GetHomeClientResult['lists'][number]}
 */
export type ListSummaryDto = GetHomeClientResult['lists'][number];

/**
 * Function toHomeSprint
 *
 * @description
 * Maps a current sprint to the sprint card: its live count leaves the cancelled tasks out, as the
 * mockup's `liveCount` does. A list without sprint dates (never sent among `sprints`) maps to null.
 *
 * @param {ListSummaryDto} summary - The sprint the gateway returned.
 * @returns {HomeSprint | null} The card's model.
 */
export function toHomeSprint(summary: ListSummaryDto): HomeSprint | null {
  const sprint: ListSummaryDto['list']['sprint'] = summary.list.sprint;
  if (sprint === null) return null;
  return {
    listId: summary.list.id,
    name: summary.list.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    done: summary.counts.done,
    live: Math.max(summary.counts.total - summary.counts.cancelled, 0),
  };
}

/**
 * Function toHomeList
 *
 * @description
 * Maps a list of the sidebar to a row of `Lists`.
 *
 * @param {ListSummaryDto} summary - The list the gateway returned.
 * @returns {HomeList} The row's model.
 */
export function toHomeList(summary: ListSummaryDto): HomeList {
  return {
    id: summary.list.id,
    name: summary.list.name,
    spaceId: summary.list.spaceId,
    open: summary.counts.open,
  };
}

/**
 * Function toHomeSnapshot
 *
 * @description
 * Maps a `getHome` answer: the counters, the priorities, the first current sprint (the card shows
 * one, `sprints[0]`) and the lists.
 *
 * @param {GetHomeClientResult} home - The answer.
 * @returns {HomeSnapshot} The display models.
 */
export function toHomeSnapshot(home: GetHomeClientResult): HomeSnapshot {
  const first: ListSummaryDto | undefined = home.sprints.at(0);
  return {
    stats: {
      assigned: home.stats.assigned,
      late: home.stats.late,
      dueToday: home.stats.dueToday,
      done: home.stats.done,
    },
    priorities: home.priorities.map((task: HomeTaskDto) => toHomeTask(task)),
    sprint: first ? toHomeSprint(first) : null,
    lists: home.lists.map((list: ListSummaryDto): HomeList => toHomeList(list)),
  };
}
