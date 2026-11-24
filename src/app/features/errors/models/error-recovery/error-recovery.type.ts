/**
 * Type RestoreOutcome
 *
 * @description
 * Result of a restore from the deleted-task state: the task is back, or its trash entry no longer
 * exists for the caller.
 *
 * @type {'restored' | 'already-restored'}
 */
export type RestoreOutcome = 'restored' | 'already-restored';

/**
 * Type AccessRequestStatus
 *
 * @description
 * Progress of the access request of the access-denied state.
 *
 * @type {'idle' | 'sending' | 'sent'}
 */
export type AccessRequestStatus = 'idle' | 'sending' | 'sent';

/**
 * Type RestoreStatus
 *
 * @description
 * Progress of the restore of the deleted-task state.
 *
 * @type {'idle' | 'restoring' | 'restored' | 'already-restored'}
 */
export type RestoreStatus = 'idle' | 'restoring' | 'restored' | 'already-restored';
