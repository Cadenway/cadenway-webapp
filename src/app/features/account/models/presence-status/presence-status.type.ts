/**
 * Type PresenceStatus
 *
 * @description
 * Presence the signed-in person chooses in the account menu (« Statut »): `online` (« Actif »),
 * `do-not-disturb` (« Ne pas déranger »), `away` (« Absent ») or `invisible` (« Invisible »). It
 * mirrors `PresenceStatus` of `@core/realtime`; « Hors ligne » is never chosen, it follows a
 * disconnection.
 *
 * @type {'online' | 'away' | 'do-not-disturb' | 'invisible'}
 */
export type PresenceStatus = 'online' | 'away' | 'do-not-disturb' | 'invisible';
