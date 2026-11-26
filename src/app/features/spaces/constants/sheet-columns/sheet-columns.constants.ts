import type { SheetColumn } from '../../models/list-view-config/list-view-config.interface';

/**
 * Constant SHEET_COLUMNS
 *
 * @description
 * The `Sheet` view's built-in columns in the mockup's order (`TBL_COLS` of `App.dc.html` lines
 * 3768-3782), keyed as the contract's `SavedViewSheetColumn`.
 *
 * @type {readonly SheetColumn[]}
 */
export const SHEET_COLUMNS: readonly SheetColumn[] = [
  'name',
  'status',
  'priority',
  'people',
  'due',
  'estimate',
  'spent',
  'labels',
  'list',
  'points',
  'client',
];
