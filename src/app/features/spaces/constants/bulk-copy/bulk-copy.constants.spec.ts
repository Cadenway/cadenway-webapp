import { describe, expect, it } from 'vitest';

import {
  bulkDeletedText,
  bulkDoneText,
  bulkMovedText,
  bulkPartialText,
  bulkUpdatedText,
} from './bulk-copy.constants';

describe('bulk toast copy', () => {
  it('uses the French singular forms for one task', () => {
    expect(bulkDoneText(1)).toBe('1 tâche terminée');
    expect(bulkMovedText(1)).toBe('1 tâche déplacée');
    expect(bulkDeletedText(1)).toBe('1 tâche supprimée');
    expect(bulkUpdatedText(1)).toBe('1 tâche mise à jour.');
    expect(bulkPartialText(1, 3)).toBe('1 tâche sur 3 n’a pas pu être modifiée');
  });

  it('uses the French plural forms for two tasks', () => {
    expect(bulkDoneText(2)).toBe('2 tâches terminées');
    expect(bulkMovedText(2)).toBe('2 tâches déplacées');
    expect(bulkDeletedText(2)).toBe('2 tâches supprimées');
    expect(bulkUpdatedText(2)).toBe('2 tâches mises à jour.');
    expect(bulkPartialText(2, 3)).toBe('2 tâches sur 3 n’ont pas pu être modifiées');
  });
});
