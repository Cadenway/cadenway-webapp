import { describe, expect, it } from 'vitest';

import {
  fileSize,
  firstName,
  isPreviewableImage,
  mentionSpans,
  plainText,
  relativeInstant,
} from './task-detail-sections.util';

describe('mentionSpans', () => {
  it('gives each @[Name](id) token by code-point offsets into the unchanged text', () => {
    const text: string = 'Hi 👋 @[Hugo Dubois](u2), see @[Inès Robert](u3)';

    expect(mentionSpans(text)).toEqual([
      { userId: 'u2', start: 5, end: 23 },
      { userId: 'u3', start: 29, end: 47 },
    ]);
  });

  it('finds nothing in plain text and keeps 20 spans at most', () => {
    expect(mentionSpans('@Hugo is not a mention')).toEqual([]);
    expect(mentionSpans('@[A](a) '.repeat(25))).toHaveLength(20);
  });
});

describe('plainText', () => {
  it('drops marks and links and writes mentions as @Name', () => {
    expect(plainText('**Done**, see [the doc](https://x.test) @[Hugo Dubois](u2)')).toBe(
      'Done, see the doc @Hugo Dubois',
    );
  });
});

describe('firstName', () => {
  it('keeps the first word', () => {
    expect(firstName(' Camille Martin ')).toBe('Camille');
  });
});

describe('relativeInstant', () => {
  const now: Date = new Date('2026-11-06T15:00:00');

  it('says just now, minutes, hours, then the short date', () => {
    expect(relativeInstant('2026-11-06T14:59:30', now, 'en-US')).toBe('just now');
    expect(relativeInstant('2026-11-06T14:48:00', now, 'en-US')).toBe('12 min ago');
    expect(relativeInstant('2026-11-06T13:00:00', now, 'en-US')).toBe('2 h ago');
    expect(relativeInstant('2026-10-28T09:00:00', now, 'en-US')).toBe('28 Oct');
  });
});

describe('fileSize', () => {
  it('writes kilobytes under a megabyte and megabytes with one decimal above', () => {
    expect(fileSize(200, 'en-US')).toBe('1 KB');
    expect(fileSize(312 * 1024, 'en-US')).toBe('312 KB');
    expect(fileSize(2.4 * 1024 * 1024, 'en-US')).toBe('2.4 MB');
  });
});

describe('isPreviewableImage', () => {
  it('previews raster images, never an SVG', () => {
    expect(isPreviewableImage('image/png')).toBe(true);
    expect(isPreviewableImage('image/svg+xml')).toBe(false);
    expect(isPreviewableImage('application/pdf')).toBe(false);
  });
});
