/**
 * Type ArchiveCheck
 *
 * @description
 * What a read of one item by its id or key says after an unknown restore outcome: `archived`
 * (still archived), `restored` (live again) or `gone` (the caller no longer sees it, deleted
 * included).
 *
 * @type {'archived' | 'restored' | 'gone'}
 */
export type ArchiveCheck = 'archived' | 'restored' | 'gone';
