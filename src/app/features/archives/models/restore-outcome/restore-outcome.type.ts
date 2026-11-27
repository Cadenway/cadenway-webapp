/**
 * Type RestoreOutcome
 *
 * @description
 * How an unarchive ended for the page:
 * - `restored`: the gateway confirmed it, directly or by a later read of the item after an
 *   unknown outcome; the page shows its toast;
 * - `unconfirmed`: the outcome stayed unknown after every confirmation read; the page shows a
 *   neutral notice;
 * - `forbidden`: refused with `403 access.role-insufficient` (no `edit` on the list);
 * - `refused`: any other definite refusal;
 * - `stale`: nothing to show, because the organization changed, the page left, the workspace was
 *   switching organization when the write was sent, or a restore of that item already runs.
 *
 * @type {'restored' | 'unconfirmed' | 'forbidden' | 'refused' | 'stale'}
 */
export type RestoreOutcome = 'restored' | 'unconfirmed' | 'forbidden' | 'refused' | 'stale';
