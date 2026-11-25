import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ORGANIZATION_PIN_OPERATIONS } from './organization-pin-operations.constant';

/**
 * Function pinnedOperations
 *
 * @description
 * Reads path and operation parameter blocks from the installed public OpenAPI documents.
 *
 * @param {string} yaml - One public OpenAPI document.
 * @returns {string[]} Method and full-path regex pairs declaring the organization precondition.
 */
function pinnedOperations(yaml: string): string[] {
  const paths: string = /^paths:\s*\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m.exec(yaml)?.[1] ?? '';
  const result: string[] = [];
  for (const path of paths.matchAll(
    /^ {2}(\/[^\n:]+):\s*\n([\s\S]*?)(?=^ {2}\/[^\n:]+:|$(?![\s\S]))/gm,
  )) {
    const body: string = path[2];
    const shared: string =
      /^ {2} {2}parameters:\s*\n([\s\S]*?)(?=^ {2} {2}\S|$(?![\s\S]))/m.exec(body)?.[1] ?? '';
    const reference: RegExp = /\$ref:\s*['"]?#\/components\/parameters\/IfOrganizationMatch['"]?/;
    const pattern: string = `^${path[1].replace(/\//g, '\\/').replace(/\{[^}]+\}/g, '[^/]+')}$`;
    for (const operation of body.matchAll(
      /^ {2} {2}(get|put|post|delete|options|head|patch|trace|query):\s*\n([\s\S]*?)(?=^ {2} {2}\S|$(?![\s\S]))/gm,
    )) {
      const parameters: string =
        /^ {2} {4}parameters:\s*\n([\s\S]*?)(?=^ {2} {4}\S|$(?![\s\S]))/m.exec(operation[2])?.[1] ??
        '';
      if (reference.test(shared) || reference.test(parameters))
        result.push(`${operation[1].toUpperCase()} ${pattern}`);
    }
  }
  return result;
}

describe('ORGANIZATION_PIN_OPERATIONS', () => {
  it('matches every pinned operation in the installed public contracts', () => {
    const directory: string = resolve('node_modules/@cadenway/contracts/specs/openapi/public');
    const expected: string[] = readdirSync(directory)
      .filter((file: string) => file.endsWith('.yaml'))
      .flatMap((file: string) => pinnedOperations(readFileSync(resolve(directory, file), 'utf8')))
      .sort();
    const actual: string[] = ORGANIZATION_PIN_OPERATIONS.map(
      ([method, pattern]: readonly [string, RegExp]) => `${method} ${pattern.source}`,
    ).sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(new Set(expected).size).toBe(expected.length);
    expect(actual).toEqual(expected);
  });
});
