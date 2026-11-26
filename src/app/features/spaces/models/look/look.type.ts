/**
 * Type LookColor
 *
 * @description
 * Color of a space, a list or a sprint (`Color`): the keys of `LOOK_COLORS` in
 * `App.dc.html`, `gris` being the default.
 *
 * @type {'gris' | 'violet' | 'indigo' | 'azur' | 'lagon' | 'vert' | 'olive' | 'jaune' | 'orange' | 'rouge' | 'rose' | 'fuchsia' | 'ardoise'}
 */
export type LookColor =
  | 'gris'
  | 'violet'
  | 'indigo'
  | 'azur'
  | 'lagon'
  | 'vert'
  | 'olive'
  | 'jaune'
  | 'orange'
  | 'rouge'
  | 'rose'
  | 'fuchsia'
  | 'ardoise';

/**
 * Type LookIcon
 *
 * @description
 * Icon of a space, a list or a saved view: the keys of `LOOK_ICONS` in `App.dc.html`. `null`
 * shows the initial of a space, the bullets of a list or the icon of a saved view's layout.
 *
 * @type {'rocket' | 'paint' | 'megaphone' | 'gear' | 'code' | 'bug' | 'lightning' | 'target' | 'flag' | 'briefcase' | 'chart' | 'users' | 'book' | 'cube' | 'headset' | 'globe' | 'star' | null}
 */
export type LookIcon =
  | 'rocket'
  | 'paint'
  | 'megaphone'
  | 'gear'
  | 'code'
  | 'bug'
  | 'lightning'
  | 'target'
  | 'flag'
  | 'briefcase'
  | 'chart'
  | 'users'
  | 'book'
  | 'cube'
  | 'headset'
  | 'globe'
  | 'star'
  | null;
