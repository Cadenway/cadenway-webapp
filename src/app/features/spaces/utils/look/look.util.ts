import type { LookColor, LookIcon } from '../../models/look/look.type';
import type { ViewLayout } from '../../models/saved-view/saved-view.interface';
import type { TaskList } from '../../models/task-list/task-list.interface';

/**
 * Type SidebarSpaceColor
 *
 * @description
 * The hues `cw-sidebar-space` accepts.
 *
 * @type {'neutral' | 'amethyste' | 'indigo' | 'azur' | 'lagon' | 'jade' | 'olive' | 'balise' | 'cornaline' | 'grenat' | 'rose' | 'fuchsia' | 'ardoise'}
 */
export type SidebarSpaceColor =
  | 'neutral'
  | 'amethyste'
  | 'indigo'
  | 'azur'
  | 'lagon'
  | 'jade'
  | 'olive'
  | 'balise'
  | 'cornaline'
  | 'grenat'
  | 'rose'
  | 'fuchsia'
  | 'ardoise';

/**
 * Constant ICON_NAMES
 *
 * @description
 * Bold and Fill icon names of each look icon (`LOOK_ICONS` of `App.dc.html`).
 *
 * @type {Readonly<Record<Exclude<LookIcon, null>, readonly [string, string]>>}
 */
const ICON_NAMES: Readonly<Record<Exclude<LookIcon, null>, readonly [string, string]>> = {
  rocket: ['phosphorRocketBold', 'phosphorRocketFill'],
  paint: ['phosphorPaintBrushBold', 'phosphorPaintBrushFill'],
  megaphone: ['phosphorMegaphoneBold', 'phosphorMegaphoneFill'],
  gear: ['phosphorGearBold', 'phosphorGearFill'],
  code: ['phosphorCodeBold', 'phosphorCodeFill'],
  bug: ['phosphorBugBold', 'phosphorBugFill'],
  lightning: ['phosphorLightningBold', 'phosphorLightningFill'],
  target: ['phosphorTargetBold', 'phosphorTargetFill'],
  flag: ['phosphorFlagBold', 'phosphorFlagFill'],
  briefcase: ['phosphorBriefcaseBold', 'phosphorBriefcaseFill'],
  chart: ['phosphorChartLineBold', 'phosphorChartLineFill'],
  users: ['phosphorUsersThreeBold', 'phosphorUsersThreeFill'],
  book: ['phosphorBookOpenBold', 'phosphorBookOpenFill'],
  cube: ['phosphorCubeBold', 'phosphorCubeFill'],
  headset: ['phosphorHeadsetBold', 'phosphorHeadsetFill'],
  globe: ['phosphorGlobeBold', 'phosphorGlobeFill'],
  star: ['phosphorStarBold', 'phosphorStarFill'],
};

/**
 * Constant LOOK_ICON_KEYS
 *
 * @description
 * The icon choices of the « Enregistrer la vue » dialog, after the layout's own icon.
 *
 * @type {readonly Exclude<LookIcon, null>[]}
 */
export const LOOK_ICON_KEYS: readonly Exclude<LookIcon, null>[] = Object.keys(
  ICON_NAMES,
) as Exclude<LookIcon, null>[];

/**
 * Constant LAYOUT_ICONS
 *
 * @description
 * Bold and Fill icon names of each view layout (`VIEW_DEFS`).
 *
 * @type {Readonly<Record<ViewLayout, readonly [string, string]>>}
 */
const LAYOUT_ICONS: Readonly<Record<ViewLayout, readonly [string, string]>> = {
  list: ['phosphorListBulletsBold', 'phosphorListBulletsFill'],
  board: ['phosphorKanbanBold', 'phosphorKanbanFill'],
  calendar: ['phosphorCalendarBlankBold', 'phosphorCalendarBlankFill'],
  gantt: ['phosphorChartBarHorizontalBold', 'phosphorChartBarHorizontalFill'],
  workload: ['phosphorUsersThreeBold', 'phosphorUsersThreeFill'],
  table: ['phosphorTableBold', 'phosphorTableFill'],
  form: ['phosphorClipboardTextBold', 'phosphorClipboardTextFill'],
  activity: ['phosphorPulseBold', 'phosphorPulseFill'],
  timesheet: ['phosphorClockCountdownBold', 'phosphorClockCountdownFill'],
};

/**
 * Constant TONES
 *
 * @description
 * Text classes of each color; `gris` takes the muted ink. Literal strings, so Tailwind emits them.
 *
 * @type {Readonly<Record<LookColor, string>>}
 */
const TONES: Readonly<Record<LookColor, string>> = {
  gris: 'text-muted-foreground',
  violet: 'text-amethyste',
  indigo: 'text-indigo',
  azur: 'text-azur',
  lagon: 'text-lagon',
  vert: 'text-jade',
  olive: 'text-olive',
  jaune: 'text-balise',
  orange: 'text-cornaline',
  rouge: 'text-grenat',
  rose: 'text-rose',
  fuchsia: 'text-fuchsia',
  ardoise: 'text-ardoise',
};

/**
 * Constant SIDEBAR_COLORS
 *
 * @description
 * The `cw-sidebar-space` hue of each color.
 *
 * @type {Readonly<Record<LookColor, SidebarSpaceColor>>}
 */
const SIDEBAR_COLORS: Readonly<Record<LookColor, SidebarSpaceColor>> = {
  gris: 'neutral',
  violet: 'amethyste',
  indigo: 'indigo',
  azur: 'azur',
  lagon: 'lagon',
  vert: 'jade',
  olive: 'olive',
  jaune: 'balise',
  orange: 'cornaline',
  rouge: 'grenat',
  rose: 'rose',
  fuchsia: 'fuchsia',
  ardoise: 'ardoise',
};

/**
 * Function lookIconName
 *
 * @description
 * Icon name of a look icon, Bold or Fill.
 *
 * @param {Exclude<LookIcon, null>} icon - Look icon.
 * @param {boolean} fill - Whether to take the Fill weight.
 * @returns {string} The icon name.
 */
export function lookIconName(icon: Exclude<LookIcon, null>, fill: boolean = false): string {
  return ICON_NAMES[icon][fill ? 1 : 0];
}

/**
 * Function layoutIconName
 *
 * @description
 * Icon name of a view layout, Bold or Fill.
 *
 * @param {ViewLayout} layout - Layout.
 * @param {boolean} fill - Whether to take the Fill weight.
 * @returns {string} The icon name.
 */
export function layoutIconName(layout: ViewLayout, fill: boolean = false): string {
  return LAYOUT_ICONS[layout][fill ? 1 : 0];
}

/**
 * Function listIconName
 *
 * @description
 * Icon of a list (`listIcon` of `App.dc.html`): its own icon, the lightning of a sprint, or the
 * bullets; Fill for the current list.
 *
 * @param {TaskList} list - The list.
 * @param {boolean} current - Whether it is the page shown.
 * @returns {string} The icon name.
 */
export function listIconName(list: TaskList, current: boolean = false): string {
  const icon: LookIcon = list.icon ?? (list.sprint ? 'lightning' : null);
  return icon
    ? lookIconName(icon, current)
    : current
      ? 'phosphorListBulletsFill'
      : 'phosphorListBulletsBold';
}

/**
 * Function lookTone
 *
 * @description
 * Text class of a color.
 *
 * @param {LookColor} color - Color.
 * @returns {string} The class.
 */
export function lookTone(color: LookColor): string {
  return TONES[color];
}

/**
 * Function sidebarColor
 *
 * @description
 * The `cw-sidebar-space` hue of a color.
 *
 * @param {LookColor} color - Color.
 * @returns {SidebarSpaceColor} The hue.
 */
export function sidebarColor(color: LookColor): SidebarSpaceColor {
  return SIDEBAR_COLORS[color];
}
