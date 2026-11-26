import type { Provider } from '@angular/core';
import { provideCwCalendarLabels } from '@cadenway/ui/components/calendar';
import { provideCwDatePickerLabels } from '@cadenway/ui/components/date-picker';
import { provideCwDropzoneLabels } from '@cadenway/ui/components/dropzone';
import { provideCwSelectLabels } from '@cadenway/ui/components/select';

import type {
  IntakeFieldKey,
  IntakePriority,
} from '../../models/intake-form/intake-form.interface';

/**
 * Constant INTAKE_FIELD_KEYS
 *
 * @description
 * The configurable fields in the order the form and its settings show them (`FORM_FIELDS` of
 * `App.dc.html`, after the title).
 *
 * @type {readonly IntakeFieldKey[]}
 */
export const INTAKE_FIELD_KEYS: readonly IntakeFieldKey[] = [
  'description',
  'priority',
  'dueDate',
  'contactEmail',
  'attachments',
];

/**
 * Constant INTAKE_PRIORITIES
 *
 * @description
 * The priorities a requester may choose, from the most to the least urgent.
 *
 * @type {readonly IntakePriority[]}
 */
export const INTAKE_PRIORITIES: readonly IntakePriority[] = [
  'urgente',
  'haute',
  'moyenne',
  'basse',
];

/**
 * Constant INTAKE_MAX_FILE_BYTES
 *
 * @description
 * Largest file the contract accepts: 25 MiB.
 *
 * @type {number}
 */
export const INTAKE_MAX_FILE_BYTES: number = 26_214_400;

/**
 * Constant INTAKE_MAX_FILES
 *
 * @description
 * Most files a request carries (`IntakeSubmission.attachmentIds`).
 *
 * @type {number}
 */
export const INTAKE_MAX_FILES: number = 5;

/**
 * Function intakeFieldLabels
 *
 * @description
 * The name of the title and of each configurable field (`FORM_FIELDS` of `App.dc.html`).
 *
 * @returns {Readonly<Record<IntakeFieldKey | 'title', string>>} The names.
 */
export function intakeFieldLabels(): Readonly<Record<IntakeFieldKey | 'title', string>> {
  return {
    title: $localize`:@@intake.field.title:Title`,
    description: $localize`:@@intake.field.description:Description`,
    priority: $localize`:@@intake.field.priority:Priority`,
    dueDate: $localize`:@@intake.field.due-date:Due date`,
    contactEmail: $localize`:@@intake.field.contact-email:Requester email`,
    attachments: $localize`:@@intake.field.attachments:Attachment`,
  };
}

/**
 * Function intakeFieldIcons
 *
 * @description
 * The Bold Phosphor icon of the title and of each configurable field (`FORM_FIELDS`).
 *
 * @returns {Readonly<Record<IntakeFieldKey | 'title', string>>} The icon names.
 */
export function intakeFieldIcons(): Readonly<Record<IntakeFieldKey | 'title', string>> {
  return {
    title: 'phosphorTextTBold',
    description: 'phosphorTextAlignLeftBold',
    priority: 'phosphorCellSignalHighBold',
    dueDate: 'phosphorCalendarBlankBold',
    contactEmail: 'phosphorEnvelopeSimpleBold',
    attachments: 'phosphorPaperclipBold',
  };
}

/**
 * Function intakePriorityLabels
 *
 * @description
 * The word of each priority (`PRIORITIES` of `App.dc.html`).
 *
 * @returns {Readonly<Record<IntakePriority, string>>} The words.
 */
export function intakePriorityLabels(): Readonly<Record<IntakePriority, string>> {
  return {
    urgente: $localize`:@@intake.priority.urgente:Urgent`,
    haute: $localize`:@@intake.priority.haute:High`,
    moyenne: $localize`:@@intake.priority.moyenne:Medium`,
    basse: $localize`:@@intake.priority.basse:Low`,
  };
}

/**
 * Constant INTAKE_FORM_BRICK_LABELS
 *
 * @description
 * The English texts of the bricks the request form renders (select, date picker and its
 * calendar, dropzone), provided by the form itself so the public page and the Spaces preview
 * share them.
 *
 * @type {Provider[]}
 */
export const INTAKE_FORM_BRICK_LABELS: Provider[] = [
  provideCwSelectLabels(() => ({
    placeholder: $localize`:@@intake.select.placeholder:Choose…`,
    emptyText: $localize`:@@intake.select.empty:No option`,
  })),
  provideCwDatePickerLabels(() => ({
    placeholder: $localize`:@@intake.date.placeholder:Pick a date`,
    dialog: $localize`:@@intake.date.dialog:Pick a date`,
    clear: $localize`:@@intake.date.clear:Clear`,
    addTime: $localize`:@@intake.date.add-time:Add a time`,
    time: $localize`:@@intake.date.time:Time`,
    openCalendar: $localize`:@@intake.date.open-calendar:Open the calendar`,
    inputPlaceholder: $localize`:@@intake.date.input:dd/mm/yyyy`,
  })),
  provideCwCalendarLabels(() => ({
    previousMonth: $localize`:@@intake.calendar.previous-month:Previous month`,
    nextMonth: $localize`:@@intake.calendar.next-month:Next month`,
    monthList: $localize`:@@intake.calendar.month:Month`,
    yearList: $localize`:@@intake.calendar.year:Year`,
    week: $localize`:@@intake.calendar.week:Week`,
    weekShort: $localize`:@@intake.calendar.week-short:W.`,
  })),
  provideCwDropzoneLabels(() => ({
    title: $localize`:@@intake.files.title:Attach files`,
    browse: $localize`:@@intake.files.browse:browse`,
    max: $localize`:@@intake.files.max:max`,
    or: $localize`:@@intake.files.or:or`,
    browseAria: $localize`:@@intake.files.browse-aria:the files`,
    drop: $localize`:@@intake.files.drop:Release to attach the files`,
    reject: $localize`:@@intake.files.reject:Type not accepted`,
    limit: $localize`:@@intake.files.limit:Limit reached`,
    file: $localize`:@@intake.files.file:file`,
    files: $localize`:@@intake.files.files:files`,
  })),
];
