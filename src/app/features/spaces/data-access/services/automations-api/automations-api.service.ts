import { HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import {
  type AutomationRule as AutomationRuleDto,
  type AutomationRulePage,
  AutomationsService,
  type ListRecentAutomationRunsClientResult,
} from '@cadenway/api-client';
import { firstValueFrom } from 'rxjs';

import { hasProblemCode } from '@core/api';

import type {
  AutomationDraft,
  AutomationRule,
  AutomationRun,
} from '../../../models/automation-rule/automation-rule.interface';
import {
  toAutomationRule,
  toAutomationRuleCreate,
  toAutomationRun,
} from '../../adapters/automation-rule/automation-rule.adapter';
import { abortableRead } from '../../utils/abortable-read/abortable-read.util';

/**
 * Constant RULE_PAGE_LIMIT
 *
 * @description
 * Page size asked of the gateway when the rules are read, its maximum.
 *
 * @type {number}
 */
const RULE_PAGE_LIMIT: number = 100;

/**
 * Constant RULE_NOT_FOUND
 *
 * @description
 * Problem code of a rule that is unknown, deleted or in another organization.
 *
 * @type {string}
 */
const RULE_NOT_FOUND: string = 'automation.rule-not-found';

/**
 * Function ifMatch
 *
 * @description
 * The `If-Match` header of a rule version.
 *
 * @param {number} version - Version the change was made from.
 * @returns {Record<string, string>} The header.
 */
function ifMatch(version: number): Record<string, string> {
  return { 'If-Match': `"${String(version)}"` };
}

/**
 * Function isStaleAutomationRule
 *
 * @description
 * Whether a refused write means the shown rules are out of date: the rule changed since it was
 * read (`412 request.version-mismatch`) or no longer exists (`404 automation.rule-not-found`).
 * The caller reads the rules again.
 *
 * @param {unknown} error - The failed write.
 * @returns {boolean} Whether the rules should be read again.
 */
export function isStaleAutomationRule(error: unknown): boolean {
  return (
    hasProblemCode(error, 'request.version-mismatch') ||
    hasProblemCode(error, RULE_NOT_FOUND) ||
    (error instanceof HttpErrorResponse && error.status === 412)
  );
}

/**
 * Function isUncertainAutomationWrite
 *
 * @description
 * Whether a failed write may still have been applied: no answer (network failure, abort), a
 * timeout (`408`) or a server failure (`5xx`). Any other `4xx` is a definite refusal.
 *
 * @param {unknown} error - The failed write.
 * @returns {boolean} Whether the outcome is unknown.
 */
export function isUncertainAutomationWrite(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return true;
  return error.status === 0 || error.status === 408 || error.status >= 500;
}

/**
 * Service AutomationsApi
 *
 * @description
 * The `Automations` dialog's access to the gateway's `automations` operations, mapped to display
 * models: the organization's rules (every page), their creation, enabling and deletion, and the
 * recent executions. The rules belong to the organization, not to a space; the gateway accepts
 * them from an owner or admin with a browser session. Every call carries `If-Organization-Match`
 * through the organization pin.
 */
@Service()
export class AutomationsApi {
  // #region Properties
  /**
   * Property automations
   *
   * @description
   * Generated automation operations.
   *
   * @type {AutomationsService}
   * @readonly
   */
  private readonly automations: AutomationsService = inject(AutomationsService);
  // #endregion

  // #region Methods
  /**
   * Method rules
   *
   * @description
   * Reads every rule of the organization, oldest first.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly AutomationRule[]>} The rules.
   */
  public async rules(signal?: AbortSignal): Promise<readonly AutomationRule[]> {
    const items: AutomationRule[] = [];
    let cursor: string | undefined;
    do {
      const page: AutomationRulePage = await abortableRead(
        this.automations.listAutomationRules({
          limit: RULE_PAGE_LIMIT,
          ...(cursor ? { cursor } : {}),
        }),
        signal,
      );
      items.push(...page.items.map(toAutomationRule));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }

  /**
   * Method create
   *
   * @description
   * Creates an enabled rule. The key makes a retry of the same draft replay the first answer.
   *
   * @param {AutomationDraft} draft - The rule to create.
   * @param {string} idempotencyKey - Key of this draft, reused by its retries.
   * @returns {Promise<AutomationRule>} The created rule.
   */
  public async create(draft: AutomationDraft, idempotencyKey: string): Promise<AutomationRule> {
    const rule: AutomationRuleDto = await firstValueFrom(
      this.automations.createAutomationRule(toAutomationRuleCreate(draft), {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    );
    return toAutomationRule(rule);
  }

  /**
   * Method setEnabled
   *
   * @description
   * Enables or disables a rule from the version it was read at.
   *
   * @param {AutomationRule} rule - The rule, at its confirmed version.
   * @param {boolean} enabled - The wanted state.
   * @returns {Promise<AutomationRule>} The rule as the gateway recorded it.
   */
  public async setEnabled(rule: AutomationRule, enabled: boolean): Promise<AutomationRule> {
    const updated: AutomationRuleDto = await firstValueFrom(
      this.automations.updateAutomationRule(
        rule.id,
        { enabled },
        { headers: ifMatch(rule.version) },
      ),
    );
    return toAutomationRule(updated);
  }

  /**
   * Method delete
   *
   * @description
   * Deletes a rule from the version it was read at. A rule already gone
   * (`404 automation.rule-not-found`) counts as deleted.
   *
   * @param {AutomationRule} rule - The rule, at its confirmed version.
   * @returns {Promise<void>} Resolves once the rule is gone.
   */
  public async delete(rule: AutomationRule): Promise<void> {
    try {
      await firstValueFrom(
        this.automations.deleteAutomationRule(rule.id, { headers: ifMatch(rule.version) }),
        { defaultValue: undefined },
      );
    } catch (error: unknown) {
      if (!hasProblemCode(error, RULE_NOT_FOUND)) throw error;
    }
  }

  /**
   * Method runs
   *
   * @description
   * Reads the eight most recent executions the caller may see, newest first.
   *
   * @param {AbortSignal | undefined} signal - Cancels a superseded read.
   * @returns {Promise<readonly AutomationRun[]>} The executions.
   */
  public async runs(signal?: AbortSignal): Promise<readonly AutomationRun[]> {
    const page: ListRecentAutomationRunsClientResult = await abortableRead(
      this.automations.listRecentAutomationRuns(),
      signal,
    );
    return page.items.map(toAutomationRun);
  }
  // #endregion
}
