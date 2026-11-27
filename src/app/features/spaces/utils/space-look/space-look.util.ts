import type { LookColorChoice } from '../../models/look/look-color-choice.interface';

/**
 * Function prefixFromName
 *
 * @description
 * The prefix proposed for a space name: its first three unaccented letters in capitals,
 * completed with `X` (`Human resources` gives `HUM`), as the mockup and the contract do.
 *
 * @param {string} name - The name typed.
 * @returns {string} The prefix, empty for an empty name.
 */
export function prefixFromName(name: string): string {
  if (!name.trim()) return '';
  return name
    .normalize('NFD')
    .replace(/[^A-Za-z]/gu, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
}

/**
 * Function lookColorChoices
 *
 * @description
 * The thirteen colors of `LOOK_COLORS`, in the mockup's order, each with its name and the
 * literal background class of its swatch.
 *
 * @returns {readonly LookColorChoice[]} The choices.
 */
export function lookColorChoices(): readonly LookColorChoice[] {
  return [
    { value: 'gris', label: $localize`:@@spaces.look.gris:Gray`, swatch: 'bg-ink-muted' },
    {
      value: 'violet',
      label: $localize`:@@spaces.look.violet:Amethyst`,
      swatch: 'bg-amethyste',
    },
    { value: 'indigo', label: $localize`:@@spaces.look.indigo:Indigo`, swatch: 'bg-indigo' },
    { value: 'azur', label: $localize`:@@spaces.look.azur:Azure`, swatch: 'bg-azur' },
    { value: 'lagon', label: $localize`:@@spaces.look.lagon:Lagoon`, swatch: 'bg-lagon' },
    { value: 'vert', label: $localize`:@@spaces.look.vert:Jade`, swatch: 'bg-jade' },
    { value: 'olive', label: $localize`:@@spaces.look.olive:Olive`, swatch: 'bg-olive' },
    { value: 'jaune', label: $localize`:@@spaces.look.jaune:Beacon`, swatch: 'bg-balise' },
    {
      value: 'orange',
      label: $localize`:@@spaces.look.orange:Carnelian`,
      swatch: 'bg-cornaline',
    },
    { value: 'rouge', label: $localize`:@@spaces.look.rouge:Garnet`, swatch: 'bg-grenat' },
    { value: 'rose', label: $localize`:@@spaces.look.rose:Pink`, swatch: 'bg-rose' },
    { value: 'fuchsia', label: $localize`:@@spaces.look.fuchsia:Fuchsia`, swatch: 'bg-fuchsia' },
    { value: 'ardoise', label: $localize`:@@spaces.look.ardoise:Slate`, swatch: 'bg-ardoise' },
  ];
}
