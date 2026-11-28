/**
 * Interface InviteBatch
 *
 * @description
 * One `inviteMembers` call: its addresses, exactly as sent, and the `Idempotency-Key` of that body.
 */
export interface InviteBatch {
  // #region Properties
  /**
   * Property emails
   *
   * @description
   * The addresses of the batch, in the order sent; 50 at most.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly emails: readonly string[];

  /**
   * Property key
   *
   * @description
   * The `Idempotency-Key` sent with this body.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;
  // #endregion
}

/**
 * Interface UnresolvedInviteBatch
 *
 * @description
 * A batch sent whose outcome is unknown, or which a `429` refused, kept with the organization it
 * was sent to so the next send of the same body replays it under the same key.
 */
export interface UnresolvedInviteBatch {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * Organization the batch was sent to.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property batch
   *
   * @description
   * The batch, its body and key exactly as sent.
   *
   * @type {InviteBatch}
   * @readonly
   */
  readonly batch: InviteBatch;
  // #endregion
}

/**
 * Function planInviteBatches
 *
 * @description
 * Cuts the addresses to send into `inviteMembers` batches. Each unresolved batch (one sent before
 * whose outcome is unknown, or which a `429` refused, so nothing was stored) whose addresses are
 * all still to send is sent again first, unchanged and under its own key, so the gateway replays
 * its first answer whatever became of the other addresses. An unresolved batch one of whose
 * addresses is no longer to send (edited, removed or settled since) has another body: it is not
 * replayed, and its remaining addresses join the others. Those are cut, in their order, into
 * batches of `size` under new keys from `newKey`.
 *
 * @param {readonly string[]} pending - The addresses still to send, in order.
 * @param {readonly InviteBatch[]} unresolved - Batches of the same organization sent before whose
 * key is kept.
 * @param {number} size - Most addresses per batch.
 * @param {() => string} newKey - Gives the key of a new batch body.
 * @returns {InviteBatch[]} The batches to send, the replayed ones first.
 */
export function planInviteBatches(
  pending: readonly string[],
  unresolved: readonly InviteBatch[],
  size: number,
  newKey: () => string,
): InviteBatch[] {
  const left: Set<string> = new Set<string>(pending);
  const batches: InviteBatch[] = [];
  for (const batch of unresolved) {
    if (batch.emails.length === 0 || !batch.emails.every((email: string) => left.has(email))) {
      continue;
    }
    for (const email of batch.emails) left.delete(email);
    batches.push(batch);
  }
  const rest: readonly string[] = pending.filter((email: string): boolean => left.has(email));
  for (let start: number = 0; start < rest.length; start += size) {
    batches.push({ emails: rest.slice(start, start + size), key: newKey() });
  }
  return batches;
}
