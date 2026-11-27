import { inject, Service, type Signal, signal, type WritableSignal } from '@angular/core';
import { Router } from '@angular/router';

import { type ApiProblem, readProblem } from '@core/api';

import { ReauthenticationApi } from '../data-access/services/reauthentication-api/reauthentication-api.service';
import type {
  ReauthenticationAnswer,
  ReauthenticationFailure,
  ReauthenticationMethod,
  ReauthenticationPrompt,
} from '../models/reauthentication/reauthentication.interface';
import { ReauthenticationCancelledError } from './reauthentication-cancelled.error';

/**
 * Constant REQUIRED_CODE
 *
 * @description
 * Problem code of a guarded operation outside the 10-minute window of recent authentication.
 *
 * @type {string}
 */
const REQUIRED_CODE: string = 'auth.reauthentication-required';

/**
 * Constant CAUSE_DEPTH
 *
 * @description
 * How many `cause` links to follow to find the gateway's response inside a wrapped error (a
 * resource error wraps its loader's rejection).
 *
 * @type {number}
 */
const CAUSE_DEPTH: number = 3;

/**
 * Interface Waiting
 *
 * @description
 * The confirmation every operation refused at the same time waits for.
 */
interface Waiting {
  // #region Properties
  /**
   * Property promise
   *
   * @description
   * Settles when the person confirms or cancels.
   *
   * @type {Promise<void>}
   * @readonly
   */
  readonly promise: Promise<void>;

  /**
   * Property resolve
   *
   * @description
   * Settles the promise once the window is open.
   *
   * @type {() => void}
   * @readonly
   */
  readonly resolve: () => void;

  /**
   * Property reject
   *
   * @description
   * Settles the promise when the person cancels.
   *
   * @type {(error: Error) => void}
   * @readonly
   */
  readonly reject: (error: Error) => void;
  // #endregion
}

/**
 * Function problemOf
 *
 * @description
 * Reads the gateway problem of an error, following its `cause` chain.
 *
 * @param {unknown} error - What an operation rejected with.
 * @returns {ApiProblem | null} The problem, or null for an error without an HTTP response.
 */
function problemOf(error: unknown): ApiProblem | null {
  let current: unknown = error;
  for (let depth: number = 0; depth <= CAUSE_DEPTH && current !== undefined; depth++) {
    const problem: ApiProblem | null = readProblem(current);
    if (problem !== null) return problem;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}

/**
 * Function methodFrom
 *
 * @description
 * The method `details.methods` of a `403 auth.reauthentication-required` asks for: the code when
 * it lists `authenticator-app`, the password when it lists `password`; a method the application
 * does not know is ignored, as the contract asks.
 *
 * @param {ApiProblem | null} problem - The gateway problem.
 * @returns {ReauthenticationMethod | null} The method, or null when this is no such refusal.
 */
function methodFrom(problem: ApiProblem | null): ReauthenticationMethod | null {
  if (problem?.status !== 403 || problem.code !== REQUIRED_CODE) return null;
  const methods: unknown = problem.details?.['methods'];
  if (!Array.isArray(methods)) return null;
  if (methods.includes('authenticator-app')) return 'code';
  return methods.includes('password') ? 'password' : null;
}

/**
 * Function failureFrom
 *
 * @description
 * Why `reauthenticate` refused the answer.
 *
 * @param {ApiProblem | null} problem - The gateway problem.
 * @returns {ReauthenticationFailure} The failure to show.
 */
function failureFrom(problem: ApiProblem | null): ReauthenticationFailure {
  switch (problem?.code) {
    case 'auth.password-incorrect':
      return 'password-incorrect';
    case 'auth.two-step-code-invalid':
      return 'code-incorrect';
    case 'auth.account-locked':
    case 'auth.two-step-locked':
      return 'locked';
    default:
      return 'unavailable';
  }
}

/**
 * Function remainingAttemptsFrom
 *
 * @description
 * Attempts left before the lockout, from `details.remainingAttempts`.
 *
 * @param {ApiProblem | null} problem - The gateway problem.
 * @returns {number | null} The count, or null when the gateway gives none.
 */
function remainingAttemptsFrom(problem: ApiProblem | null): number | null {
  const remaining: unknown = problem?.details?.['remainingAttempts'];
  return typeof remaining === 'number' && Number.isFinite(remaining) ? remaining : null;
}

/**
 * Service ReauthenticationService
 *
 * @description
 * Repeats an operation the gateway refused for want of a recent authentication. `run(operation)`
 * calls it; when it rejects with `403 auth.reauthentication-required`, the service shows the
 * reauthentication dialog asking for what `details.methods` lists (the authenticator code for an
 * account with two-step verification, otherwise the password), calls `reauthenticate`, then
 * calls the operation once more and returns or rejects with that second result. Any other
 * rejection passes through untouched. Closing the dialog rejects with
 * `ReauthenticationCancelledError`. Operations refused while the dialog is open wait for the same
 * confirmation. A refused answer keeps the dialog open with the reason (wrong password or code,
 * lockout, gateway unavailable); `403` with other methods (a password sent for an account with
 * two-step verification) or `409 auth.two-step-not-enabled` switches what it asks for. A `401`
 * (the session ended) closes the dialog, rejects the waiting operations with
 * `ReauthenticationCancelledError` and opens `/login?next=<current address>`. It is not
 * provided automatically: `provideReauthentication()` gives it to a settings route together with
 * the dialog contribution of its shell's `overlays`.
 */
@Service({ autoProvided: false })
export class ReauthenticationService {
  // #region Properties
  /**
   * Property api
   *
   * @description
   * Data access of `reauthenticate`.
   *
   * @type {ReauthenticationApi}
   * @readonly
   */
  private readonly api: ReauthenticationApi = inject(ReauthenticationApi);

  /**
   * Property router
   *
   * @description
   * Router sending an expired session to sign-in.
   *
   * @type {Router}
   * @readonly
   */
  private readonly router: Router = inject(Router);

  /**
   * Property question
   *
   * @description
   * The question the dialog shows, or null while it is closed.
   *
   * @type {WritableSignal<ReauthenticationPrompt | null>}
   * @readonly
   */
  private readonly question: WritableSignal<ReauthenticationPrompt | null> = signal(null);

  /**
   * Property waiting
   *
   * @description
   * The confirmation the refused operations wait for, or null while none is asked.
   *
   * @type {WritableSignal<Waiting | null>}
   * @readonly
   */
  private readonly waiting: WritableSignal<Waiting | null> = signal(null);

  /**
   * Property prompt
   *
   * @description
   * The question the reauthentication dialog shows, or null while it is closed.
   *
   * @type {Signal<ReauthenticationPrompt | null>}
   * @readonly
   */
  public readonly prompt: Signal<ReauthenticationPrompt | null> = this.question.asReadonly();
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Calls the operation, and once more after a confirmed reauthentication when the gateway asked
   * for one.
   *
   * @template T
   * @param {() => Promise<T>} operation - The guarded request, safe to send twice.
   * @returns {Promise<T>} The operation's result.
   * @throws {ReauthenticationCancelledError} When the person closes the dialog.
   */
  public async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      const method: ReauthenticationMethod | null = methodFrom(problemOf(error));
      if (method === null) throw error;
      await this.confirmIdentity(method);
      return operation();
    }
  }

  /**
   * Method answer
   *
   * @description
   * Sends what the person typed. On success the dialog closes and the waiting operations run
   * again; on a refusal the dialog stays open with the reason, or asks for the other method; on a
   * `401` the waiting operations are cancelled and the person goes to sign-in.
   *
   * @param {ReauthenticationAnswer} answer - The password or the code.
   * @returns {Promise<void>} Resolves once the gateway answered.
   */
  public async answer(answer: ReauthenticationAnswer): Promise<void> {
    const prompt: ReauthenticationPrompt | null = this.question();
    const waiting: Waiting | null = this.waiting();
    if (prompt === null || waiting === null || prompt.pending) return;
    this.question.set({ ...prompt, pending: true });
    try {
      await this.api.reauthenticate(answer);
    } catch (error: unknown) {
      const problem: ApiProblem | null = readProblem(error);
      if (problem?.status === 401) {
        this.question.set(null);
        this.waiting.set(null);
        waiting.reject(new ReauthenticationCancelledError());
        void this.router.navigate(['/login'], { queryParams: { next: this.router.url } });
        return;
      }
      const switched: ReauthenticationMethod | null =
        problem?.code === 'auth.two-step-not-enabled' ? 'password' : methodFrom(problem);
      this.question.set(
        switched !== null && switched !== prompt.method
          ? { method: switched, pending: false, failure: null, remainingAttempts: null }
          : {
              method: prompt.method,
              pending: false,
              failure: failureFrom(problem),
              remainingAttempts: remainingAttemptsFrom(problem),
            },
      );
      return;
    }
    this.question.set(null);
    this.waiting.set(null);
    waiting.resolve();
  }

  /**
   * Method cancel
   *
   * @description
   * Closes the dialog; the waiting operations reject with `ReauthenticationCancelledError`.
   * Ignored while an answer is being checked.
   */
  public cancel(): void {
    const waiting: Waiting | null = this.waiting();
    if (waiting === null || this.question()?.pending === true) return;
    this.question.set(null);
    this.waiting.set(null);
    waiting.reject(new ReauthenticationCancelledError());
  }

  /**
   * Method confirmIdentity
   *
   * @description
   * Opens the dialog, or joins the question already open.
   *
   * @param {ReauthenticationMethod} method - What to ask for.
   * @returns {Promise<void>} Settles when the person confirms or cancels.
   */
  private confirmIdentity(method: ReauthenticationMethod): Promise<void> {
    const open: Waiting | null = this.waiting();
    if (open !== null) return open.promise;
    let resolve: () => void = (): void => undefined;
    let reject: (error: Error) => void = (): void => undefined;
    const promise: Promise<void> = new Promise<void>(
      (done: () => void, fail: (error: Error) => void): void => {
        resolve = done;
        reject = fail;
      },
    );
    this.waiting.set({ promise, resolve, reject });
    this.question.set({ method, pending: false, failure: null, remainingAttempts: null });
    return promise;
  }
  // #endregion
}
