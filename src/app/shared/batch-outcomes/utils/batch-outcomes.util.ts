/**
 * Interface BatchEntry
 *
 * @description
 * One per-address result of a batch answer: the address and what became of it.
 */
export interface BatchEntry {
  // #region Properties
  /**
   * Property email
   *
   * @description
   * The address the result is about, as the answer spells it.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property outcome
   *
   * @description
   * What became of the address.
   *
   * @type {string}
   * @readonly
   */
  readonly outcome: string;
  // #endregion
}

/**
 * Interface BatchOutcomes
 *
 * @description
 * The results of a batch matched to the addresses sent.
 */
export interface BatchOutcomes {
  // #region Properties
  /**
   * Property settled
   *
   * @description
   * Each address sent that the answer gives one outcome, in the order sent and spelled as sent,
   * once per address regardless of case.
   *
   * @type {readonly BatchEntry[]}
   * @readonly
   */
  readonly settled: readonly BatchEntry[];

  /**
   * Property unknown
   *
   * @description
   * The addresses sent, spelled as sent and once each, that the answer gives no result or
   * conflicting results: their outcome is unknown.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly unknown: readonly string[];
  // #endregion
}

/**
 * Function matchBatchOutcomes
 *
 * @description
 * Matches the per-address results of a batch answer to the addresses sent, comparing addresses
 * without regard to case. A batch answer is no proof for an address it does not mention: such an
 * address, and one the answer gives two different outcomes, has an unknown outcome. The same
 * result repeated counts once. Results for addresses that were not sent are ignored.
 *
 * @param {readonly string[]} sent - The addresses sent.
 * @param {readonly BatchEntry[]} entries - The per-address results answered.
 * @returns {BatchOutcomes} The settled addresses and those of unknown outcome.
 */
export function matchBatchOutcomes(
  sent: readonly string[],
  entries: readonly BatchEntry[],
): BatchOutcomes {
  const answered: Map<string, Set<string>> = new Map<string, Set<string>>();
  for (const entry of entries) {
    const address: string = entry.email.toLowerCase();
    const outcomes: Set<string> = answered.get(address) ?? new Set<string>();
    outcomes.add(entry.outcome);
    answered.set(address, outcomes);
  }
  const seen: Set<string> = new Set<string>();
  const settled: BatchEntry[] = [];
  const unknown: string[] = [];
  for (const email of sent) {
    const address: string = email.toLowerCase();
    if (seen.has(address)) continue;
    seen.add(address);
    const outcomes: ReadonlySet<string> | undefined = answered.get(address);
    if (outcomes?.size === 1) {
      const [outcome]: string[] = [...outcomes];
      settled.push({ email, outcome });
    } else {
      unknown.push(email);
    }
  }
  return { settled, unknown };
}
