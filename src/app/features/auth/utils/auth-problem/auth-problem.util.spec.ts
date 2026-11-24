import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { authProblem } from './auth-problem.util';

describe('authProblem', () => {
  it('keeps the code and the remaining attempts without the gateway wording', () => {
    const error: HttpErrorResponse = new HttpErrorResponse({
      status: 422,
      error: {
        code: 'auth.invalid-credentials',
        title: 'A private detail',
        details: { remainingAttempts: 3, email: 'camille.martin@ateliernord.fr' },
      },
    });

    expect(authProblem(error)).toEqual({
      status: 422,
      code: 'auth.invalid-credentials',
      remainingAttempts: 3,
    });
  });

  it('drops an attempt count that is not a positive whole number', () => {
    for (const remainingAttempts of [0, -1, 1.5, '3']) {
      const error: HttpErrorResponse = new HttpErrorResponse({
        status: 422,
        error: { code: 'auth.invalid-credentials', details: { remainingAttempts } },
      });
      expect(authProblem(error).remainingAttempts).toBeNull();
    }
  });

  it('turns any other failure into status zero without a code', () => {
    expect(authProblem(new Error('NotAllowedError'))).toEqual({
      status: 0,
      code: null,
      remainingAttempts: null,
    });
  });
});
