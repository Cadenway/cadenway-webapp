/**
 * Type RestoreOutcome
 *
 * @description
 * How an unarchive ended for the page: `restored` (the gateway confirmed it, the page shows its
 * toast), `refused` (a definite refusal, the page reports it), `unknown` (no answer, a timeout or a
 * server failure: the archives are read again and nothing is reported), `stale` (the organization
 * changed meanwhile or a restore of that item already runs: nothing is shown).
 *
 * @type {'restored' | 'refused' | 'unknown' | 'stale'}
 */
export type RestoreOutcome = 'restored' | 'refused' | 'unknown' | 'stale';
