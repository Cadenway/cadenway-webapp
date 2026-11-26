/**
 * Type ViewTool
 *
 * @description
 * A tool of the list frame's `View tools` toolbar and its `Active filters` row: `milestones`,
 * `filter` (the dialog, the chips and `+ Filter`), `sort`, `group` (`Group by`), `columns` (the
 * board's `Columns`, which replaces `Group by`), `search`, `subtasks` (the subtask display),
 * `create` (`Create a task`) and `save` (`Save the view`). Each layout lists the tools it shows
 * (`LAYOUT_TOOLS`).
 *
 * @type {'milestones' | 'filter' | 'sort' | 'group' | 'columns' | 'search' | 'subtasks' | 'create' | 'save'}
 */
export type ViewTool =
  | 'milestones'
  | 'filter'
  | 'sort'
  | 'group'
  | 'columns'
  | 'search'
  | 'subtasks'
  | 'create'
  | 'save';
