import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyAngularArchitecture } from '@cadenway/angular-testing/architecture';

test('authored code follows the Cadenway architecture', () => {
  const findings = verifyAngularArchitecture({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    tsconfig: 'tsconfig.app.json',
    profile: 'application',
    // withErrorBoundaries takes the default error component as a type at bootstrap, so the errors
    // entry re-exports its route error page for app.config.ts.
    exceptions: ['page-boundary', 'public-export'].map((rule) => ({
      file: 'src/app/features/errors/index.ts',
      rule,
      reason: 'app.config.ts gives RouteErrorPage to withErrorBoundaries as defaultErrorComponent.',
    })),
  });
  assert.equal(
    findings.length,
    0,
    findings
      .map(({ file, line, rule, message }) => `${file}:${line} [${rule}] ${message}`)
      .join('\n'),
  );
});
