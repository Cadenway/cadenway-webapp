import { describe, expect, it } from 'vitest';

import {
  bulkDeletedText,
  bulkDoneText,
  bulkMovedText,
  bulkPartialText,
  bulkUpdatedText,
  undoConflictText,
  undoConflictTitle,
} from './bulk-copy.constants';

describe('bulk toast copy', () => {
  it('uses the singular forms for one task', () => {
    expect(bulkDoneText(1)).toBe('1 task done');
    expect(bulkMovedText(1)).toBe('1 task moved');
    expect(bulkDeletedText(1)).toBe('1 task deleted');
    expect(bulkUpdatedText(1)).toBe('1 task updated.');
    expect(bulkPartialText(1, 3)).toBe('1 of 3 tasks could not be changed');
    expect(undoConflictTitle(['CAD-482'])).toBe('CAD-482 changed since');
    expect(undoConflictText(1)).toBe('Undo skipped it: its latest values are shown.');
  });

  it('uses the plural forms for two tasks', () => {
    expect(bulkDoneText(2)).toBe('2 tasks done');
    expect(bulkMovedText(2)).toBe('2 tasks moved');
    expect(bulkDeletedText(2)).toBe('2 tasks deleted');
    expect(bulkUpdatedText(2)).toBe('2 tasks updated.');
    expect(bulkPartialText(2, 3)).toBe('2 of 3 tasks could not be changed');
    expect(undoConflictTitle(['CAD-482', 'CAD-483'])).toBe('2 tasks changed since');
    expect(undoConflictText(2)).toBe('Undo skipped them: their latest values are shown.');
  });
});
