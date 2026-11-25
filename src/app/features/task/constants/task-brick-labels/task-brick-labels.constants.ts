import type { Provider } from '@angular/core';
import { provideCwComboboxLabels } from '@cadenway/ui/components/combobox';

/**
 * Constant TASK_COMBOBOX_LABELS
 *
 * @description
 * English source texts of the combobox brick for the people and label pickers, replacing its
 * French defaults; each picker overrides its own placeholder.
 *
 * @type {Provider}
 */
export const TASK_COMBOBOX_LABELS: Provider = provideCwComboboxLabels(() => ({
  placeholder: $localize`:@@task.combobox.placeholder:Choose…`,
  searchPlaceholder: $localize`:@@task.combobox.search:Search…`,
  emptyText: $localize`:@@task.combobox.empty:No results`,
  createLabel: (query: string): string =>
    $localize`:@@task.combobox.create:Create “${query}:query:”`,
  loadingText: $localize`:@@task.combobox.loading:Searching…`,
  summary: (count: number): string => $localize`:@@task.combobox.summary:${count}:count: selected`,
  resultsLabel: (count: number): string =>
    count === 1
      ? $localize`:@@task.combobox.results-one:1 result`
      : $localize`:@@task.combobox.results-many:${count}:count: results`,
  disabledLabel: $localize`:@@task.combobox.disabled:Disabled`,
}));
