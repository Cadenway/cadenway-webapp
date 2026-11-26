/**
 * Interface ShortcutEntry
 *
 * @description
 * One line of the keyboard shortcuts dialog: its keys and what they do.
 */
export interface ShortcutEntry {
  // #region Properties
  /**
   * Property keys
   *
   * @description
   * The keys, one `kbd` each, in the order they are pressed together.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly keys: readonly string[];

  /**
   * Property label
   *
   * @description
   * What the shortcut does.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Interface ShortcutGroup
 *
 * @description
 * A titled section of the keyboard shortcuts dialog.
 */
export interface ShortcutGroup {
  // #region Properties
  /**
   * Property title
   *
   * @description
   * Section title (`Everywhere`).
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property entries
   *
   * @description
   * The section's shortcuts.
   *
   * @type {readonly ShortcutEntry[]}
   * @readonly
   */
  readonly entries: readonly ShortcutEntry[];
  // #endregion
}

/**
 * Constant CTRL
 *
 * @description
 * Name of the Control key.
 *
 * @type {string}
 */
const CTRL: string = $localize`:@@workspace.shortcuts.key-ctrl:Ctrl`;

/**
 * Constant ENTER
 *
 * @description
 * Name of the Enter key.
 *
 * @type {string}
 */
const ENTER: string = $localize`:@@workspace.shortcuts.key-enter:Enter`;

/**
 * Constant SHORTCUT_GROUPS
 *
 * @description
 * The sections of the keyboard shortcuts dialog, from `SHORTCUTS` of mockup `App.dc.html`.
 *
 * @type {readonly ShortcutGroup[]}
 */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: $localize`:@@workspace.shortcuts.everywhere:Everywhere`,
    entries: [
      {
        keys: [CTRL, 'K'],
        label: $localize`:@@workspace.shortcuts.palette:Command palette and search`,
      },
      { keys: ['N'], label: $localize`:@@workspace.shortcuts.create-task:Create a task` },
      { keys: ['?'], label: $localize`:@@workspace.shortcuts.help:Show this help` },
      {
        keys: [$localize`:@@workspace.shortcuts.key-escape:Esc`],
        label: $localize`:@@workspace.shortcuts.close:Close a menu or a window`,
      },
    ],
  },
  {
    title: $localize`:@@workspace.shortcuts.lists-and-tasks:Lists and tasks`,
    entries: [
      {
        keys: [$localize`:@@workspace.shortcuts.key-right-click:Right click`],
        label: $localize`:@@workspace.shortcuts.row-menu:Context menu of a row`,
      },
      {
        keys: [$localize`:@@workspace.shortcuts.key-shift:Shift`, 'F10'],
        label: $localize`:@@workspace.shortcuts.keyboard-menu:Context menu from the keyboard`,
      },
      {
        keys: [$localize`:@@workspace.shortcuts.key-arrows:Arrows`],
        label: $localize`:@@workspace.shortcuts.sheet-move:Move around the Sheet`,
      },
      {
        keys: [ENTER],
        label: $localize`:@@workspace.shortcuts.sheet-edit:Edit the Sheet cell`,
      },
    ],
  },
  {
    title: $localize`:@@workspace.shortcuts.editing:Editing`,
    entries: [
      { keys: [CTRL, 'B'], label: $localize`:@@workspace.shortcuts.bold:Bold` },
      { keys: [CTRL, 'I'], label: $localize`:@@workspace.shortcuts.italic:Italic` },
      { keys: [CTRL, 'U'], label: $localize`:@@workspace.shortcuts.underline:Underline` },
      {
        keys: [CTRL, ENTER],
        label: $localize`:@@workspace.shortcuts.send-comment:Send the comment`,
      },
      {
        keys: ['/'],
        label: $localize`:@@workspace.shortcuts.insert-block:Insert a block (documents, description)`,
      },
    ],
  },
];
