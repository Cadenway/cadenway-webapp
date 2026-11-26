import { formatDate } from '@angular/common';

import type { TaskMentionSpan } from '../../models/task-detail-sections/task-detail-sections.interface';

/**
 * Constant ATTACHMENT_MAX_BYTES
 *
 * @description
 * Largest file a task takes, 25 MiB (`startTaskAttachmentUpload` refuses more with
 * `422 attachment.file-too-large`).
 *
 * @type {number}
 */
export const ATTACHMENT_MAX_BYTES: number = 26_214_400;

/**
 * Constant COMMENT_MAX_LENGTH
 *
 * @description
 * Longest comment the contract accepts, in Unicode code points (the composer's `n / 5,000`).
 *
 * @type {number}
 */
export const COMMENT_MAX_LENGTH: number = 5000;

/**
 * Constant MENTION_TOKEN
 *
 * @description
 * A mention as `cw-block-editor` writes it and `cw-markdown` reads it: `@[Full Name](userId)`.
 *
 * @type {RegExp}
 */
const MENTION_TOKEN: RegExp = /@\[([^\]\n]+)\]\(([^)\s]+)\)/gu;

/**
 * Constant MINUTE_MS
 *
 * @description
 * One minute, in milliseconds.
 *
 * @type {number}
 */
const MINUTE_MS: number = 60_000;

/**
 * Function codePointLength
 *
 * @description
 * Length of a text in Unicode code points, the unit of the contracts' mention offsets.
 *
 * @param {string} text - The text.
 * @returns {number} Its length in code points.
 */
export function codePointLength(text: string): number {
  return Array.from(text).length;
}

/**
 * Function mentionSpans
 *
 * @description
 * The mention spans of a Markdown text: one per `@[Name](id)` token, by code-point offsets into
 * the unchanged text, in order, 20 at most (the contracts' limit; the rest stay plain text).
 *
 * @param {string} markdown - The text as the editor serialized it.
 * @returns {readonly TaskMentionSpan[]} The spans.
 */
export function mentionSpans(markdown: string): readonly TaskMentionSpan[] {
  const spans: TaskMentionSpan[] = [];
  for (const match of markdown.matchAll(MENTION_TOKEN)) {
    if (spans.length === 20) break;
    const start: number = codePointLength(markdown.slice(0, match.index));
    spans.push({ userId: match[2], start, end: start + codePointLength(match[0]) });
  }
  return spans;
}

/**
 * Function plainText
 *
 * @description
 * The text of a Markdown body without its marks, mentions written `@Name`: what `Copy the text`
 * puts on the clipboard.
 *
 * @param {string} markdown - The body.
 * @returns {string} Its plain text.
 */
export function plainText(markdown: string): string {
  return markdown
    .replace(MENTION_TOKEN, '@$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/(\*\*|__|~~|`)/gu, '')
    .trim();
}

/**
 * Function firstName
 *
 * @description
 * The first word of a full name, as `Reply` and the attachment line write it.
 *
 * @param {string} name - The full name.
 * @returns {string} Its first word.
 */
export function firstName(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? '';
}

/**
 * Function relativeInstant
 *
 * @description
 * When something happened, as the detail writes it: just now under a minute, minutes then hours
 * the same day, otherwise the short date (`28 Oct`).
 *
 * @param {string} instant - The instant (ISO 8601).
 * @param {Date} now - The current instant.
 * @param {string} locale - The active locale.
 * @returns {string} The words.
 */
export function relativeInstant(instant: string, now: Date, locale: string): string {
  const moment: Date = new Date(instant);
  const elapsed: number = now.getTime() - moment.getTime();
  const sameDay: boolean = moment.toDateString() === now.toDateString();
  if (elapsed < MINUTE_MS) return $localize`:@@task.sections.time.now:just now`;
  if (elapsed < 60 * MINUTE_MS) {
    const minutes: number = Math.floor(elapsed / MINUTE_MS);
    return $localize`:@@task.sections.time.minutes:${minutes}:count: min ago`;
  }
  if (sameDay) {
    const hours: number = Math.floor(elapsed / (60 * MINUTE_MS));
    return $localize`:@@task.sections.time.hours:${hours}:count: h ago`;
  }
  return formatDate(moment, 'd MMM', locale);
}

/**
 * Function fileSize
 *
 * @description
 * A file size in the units the mockup writes: whole kilobytes under a megabyte (1 at least),
 * megabytes with one decimal above, in the active locale's number format.
 *
 * @param {number} bytes - The size in bytes.
 * @param {string} locale - The active locale.
 * @returns {string} The size with its unit.
 */
export function fileSize(bytes: number, locale: string): string {
  if (bytes < 1024 * 1024) {
    const kilobytes: string = new Intl.NumberFormat(locale).format(
      Math.max(1, Math.round(bytes / 1024)),
    );
    return $localize`:@@task.sections.size.kb:${kilobytes}:size: KB`;
  }
  const megabytes: string = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    bytes / (1024 * 1024),
  );
  return $localize`:@@task.sections.size.mb:${megabytes}:size: MB`;
}

/**
 * Function isPreviewableImage
 *
 * @description
 * Whether the preview may draw the file itself: raster images only; the storage contract never
 * renders HTML or SVG inline, so an SVG is downloaded like any other file.
 *
 * @param {string} contentType - Media type of the file.
 * @returns {boolean} Whether the preview shows the image.
 */
export function isPreviewableImage(contentType: string): boolean {
  return /^image\/(png|jpe?g|gif|webp|avif|bmp)$/iu.test(contentType);
}
