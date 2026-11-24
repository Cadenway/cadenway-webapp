/**
 * Type LoggedOutReason
 *
 * @description
 * Why the signed-out screen is shown, read from its `?reason=` query parameter: a sign-out by the
 * person (`signed-out`, the default), a session closed by the inactivity policy (`expired`), or
 * every session of the account closed (`all-devices`).
 *
 * @type {'signed-out' | 'expired' | 'all-devices'}
 */
export type LoggedOutReason = 'signed-out' | 'expired' | 'all-devices';
