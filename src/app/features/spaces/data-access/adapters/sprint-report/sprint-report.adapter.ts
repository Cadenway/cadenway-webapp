import type {
  SprintBurndownDay as SprintBurndownDayDto,
  SprintReport as SprintReportDto,
  SprintReportBreakdown as SprintReportBreakdownDto,
  SprintReportTask as SprintReportTaskDto,
  SprintVelocityPoint,
} from '@cadenway/api-client';

import type {
  SprintBurndownDay,
  SprintReport,
  SprintReportBreakdown,
  SprintReportTask,
  SprintVelocity,
} from '../../../models/sprint-report/sprint-report.interface';

/**
 * Function toSprintReportTask
 *
 * @description
 * Maps a task of the report's preview.
 *
 * @param {SprintReportTaskDto} task - A task as `getSprintReport` answers it.
 * @returns {SprintReportTask} The display model.
 */
function toSprintReportTask(task: SprintReportTaskDto): SprintReportTask {
  return { key: task.taskKey, name: task.name, points: task.points, status: task.status };
}

/**
 * Function toBreakdown
 *
 * @description
 * Maps the delivered or the remaining part of the scope; an unknown part stays null.
 *
 * @param {SprintReportBreakdownDto | null} part - The part as the gateway answers it.
 * @returns {SprintReportBreakdown | null} The display model, or null.
 */
function toBreakdown(part: SprintReportBreakdownDto | null): SprintReportBreakdown | null {
  if (part === null) return null;
  return {
    points: part.points,
    taskCount: part.taskCount,
    tasks: part.items.map(toSprintReportTask),
  };
}

/**
 * Function toBurndownDay
 *
 * @description
 * Maps one day of the burndown, keeping unknown values null.
 *
 * @param {SprintBurndownDayDto} day - The day as the gateway answers it.
 * @returns {SprintBurndownDay} The display model.
 */
export function toBurndownDay(day: SprintBurndownDayDto): SprintBurndownDay {
  return {
    date: day.date,
    actual: day.actualRemainingPoints,
    ideal: day.idealRemainingPoints,
    projected: day.projectedRemainingPoints,
  };
}

/**
 * Function toSprintVelocity
 *
 * @description
 * Maps an earlier sprint of the velocity.
 *
 * @param {SprintVelocityPoint} point - The sprint as the gateway answers it.
 * @returns {SprintVelocity} The display model.
 */
function toSprintVelocity(point: SprintVelocityPoint): SprintVelocity {
  return {
    listId: point.listId,
    name: point.name,
    committed: point.openingPoints,
    delivered: point.deliveredPoints,
  };
}

/**
 * Function toSprintReport
 *
 * @description
 * Maps the first page of a sprint report, with the burndown days of every page read, to the
 * report the dialog shows. The figures outside the burndown come from the first page: the
 * cursor binds the later pages to the same observation.
 *
 * @param {SprintReportDto} first - The first page.
 * @param {readonly SprintBurndownDayDto[]} days - The burndown days of every page, oldest first.
 * @returns {SprintReport} The display model.
 */
export function toSprintReport(
  first: SprintReportDto,
  days: readonly SprintBurndownDayDto[],
): SprintReport {
  return {
    listId: first.listId,
    name: first.name,
    startDate: first.startDate,
    endDate: first.endDate,
    committed: first.openingPoints,
    delivered: toBreakdown(first.delivered),
    remaining: toBreakdown(first.remaining),
    projected: first.projectedRemainingPoints,
    days: days.map(toBurndownDay),
    velocity: first.velocity.map(toSprintVelocity),
  };
}
