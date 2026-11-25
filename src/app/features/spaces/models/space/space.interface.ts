import type { LookColor, LookIcon } from '../look/look.type';
import type { StatusKey } from '../list-view-config/list-view-config.interface';

/**
 * Interface SpaceStatusOption
 *
 * @description
 * One status of a space as its settings show it: a renamed label or the default one, and whether
 * the space hides it.
 */
export interface SpaceStatusOption {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Fixed status key.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly key: StatusKey;

  /**
   * Property name
   *
   * @description
   * Label the space gives the status, or null for the default label.
   *
   * @type {string | null}
   * @readonly
   */
  readonly name: string | null;

  /**
   * Property hidden
   *
   * @description
   * Whether the space hides the status from its pickers and filters.
   *
   * @type {boolean}
   * @readonly
   */
  readonly hidden: boolean;
  // #endregion
}

/**
 * Interface Space
 *
 * @description
 * A space the caller sees, as the sidebar, the breadcrumb and the overview show it.
 */
export interface Space {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Space identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Space name (« Produit »).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property description
   *
   * @description
   * Description shown under the overview title, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly description: string | null;

  /**
   * Property icon
   *
   * @description
   * Icon key, or null for the initial.
   *
   * @type {LookIcon}
   * @readonly
   */
  readonly icon: LookIcon;

  /**
   * Property color
   *
   * @description
   * Hue of the icon or the initial.
   *
   * @type {LookColor}
   * @readonly
   */
  readonly color: LookColor;

  /**
   * Property private
   *
   * @description
   * Whether only its owner and the people it is shared with see it (« Espace privé »).
   *
   * @type {boolean}
   * @readonly
   */
  readonly private: boolean;

  /**
   * Property statuses
   *
   * @description
   * The ten statuses in workflow order, with the space's labels and hidden flags.
   *
   * @type {readonly SpaceStatusOption[]}
   * @readonly
   */
  readonly statuses: readonly SpaceStatusOption[];
  // #endregion
}

/**
 * Interface SpaceDetails
 *
 * @description
 * A space as the sidebar reads it, with what its dialog and its menu need: the task key prefix
 * and the caller's rights on the space itself.
 */
export interface SpaceDetails extends Space {
  // #region Properties
  /**
   * Property prefix
   *
   * @description
   * Prefix of its task keys (« CAD »), 2 to 5 unaccented capital letters.
   *
   * @type {string}
   * @readonly
   */
  readonly prefix: string;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may change its settings and create lists in it (`edit` on the space).
   *
   * @type {boolean}
   * @readonly
   */
  readonly canEdit: boolean;

  /**
   * Property canManage
   *
   * @description
   * Whether the caller may change its visibility and delete it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly canManage: boolean;
  // #endregion
}

/**
 * Interface SpaceDraft
 *
 * @description
 * What the space dialog submits, trimmed: « Créer l’espace » or « Enregistrer ».
 */
export interface SpaceDraft {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * « Nom de l’espace », 1 to 80 characters.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property prefix
   *
   * @description
   * « Préfixe », 2 to 5 unaccented capital letters.
   *
   * @type {string}
   * @readonly
   */
  readonly prefix: string;

  /**
   * Property description
   *
   * @description
   * « Description », or null when empty.
   *
   * @type {string | null}
   * @readonly
   */
  readonly description: string | null;

  /**
   * Property icon
   *
   * @description
   * « Icône », or null for the initial.
   *
   * @type {LookIcon}
   * @readonly
   */
  readonly icon: LookIcon;

  /**
   * Property color
   *
   * @description
   * « Couleur ».
   *
   * @type {LookColor}
   * @readonly
   */
  readonly color: LookColor;

  /**
   * Property private
   *
   * @description
   * « Privé » rather than the whole organization.
   *
   * @type {boolean}
   * @readonly
   */
  readonly private: boolean;
  // #endregion
}
