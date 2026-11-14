import eslint from '@eslint/js';
import ngrx from '@ngrx/eslint-plugin';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import documentation from './rules/documentation.mjs';
import memberRegions from './rules/member-regions.mjs';

const signalFormsOnly = {
  name: '@angular/forms',
  importNames: ['ReactiveFormsModule', 'FormBuilder', 'FormGroup', 'FormControl'],
  message: 'Signal Forms only: use form() and [formField].',
};
const noSiblingSources = {
  regex: '\\.\\./cadenway-',
  message: 'Never import sibling sources: use the published @cadenway/* packages.',
};
const signalStoreOnly = {
  regex:
    '^(@ngrx/(store|effects|entity|store-devtools|component-store|router-store|data)|@angular-architects/ngrx-toolkit|@ngrx-toolkit/|@ngrx-traits/)',
  message:
    'State is NgRx SignalStore (@ngrx/signals): no global Store family, no third-party store extension (skill cw-tech-ngrx).',
};
const ngrxTestingInSpecsOnly = {
  name: '@ngrx/signals/testing',
  message:
    'unprotected() arranges state in specs only; production code changes state through store methods.',
};
// Packages the dependency review rejected, with what replaces each one. A sub-path import is
// refused too.
const rejectedPackages = [
  ['axios', 'The API is reached through @cadenway/api-client only.'],
  [
    'date-fns',
    'It does not separate a plain date from an instant: use Temporal (temporal-polyfill).',
  ],
  ['qrcode', 'Use qr: qrcode is CommonJS and frozen since 2024.'],
  ['uqr', 'Use qr, the maintained choice.'],
].map(([name, message]) => ({ regex: `^${name}(/|$)`, message }));
// Store files outside a `state/` folder (core root stores) follow the same rules.
const storeFiles = ['src/app/**/state/**/*.ts', 'src/app/**/*.store.ts'];

export default defineConfig(
  globalIgnores([
    'dist/',
    'coverage/',
    '.angular/',
    'docs/',
    '.claude/',
    '.codex/',
    'playwright-report/',
    'blob-report/',
    'test-results/',
  ]),
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
      // SignalStore is the state management; the type-checked set includes the plain `signals` rules.
      // `ngrx.configs.operators` is left out: its only rule matches inside `createEffect`, which
      // comes from the banned @ngrx/effects, so it never fires here.
      ngrx.configs.signalsTypeChecked,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'cw', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'cw', style: 'camelCase' },
      ],
      // Angular 22 style: `TaskRow`, not `TaskRowComponent`.
      '@angular-eslint/component-class-suffix': 'off',
      '@angular-eslint/directive-class-suffix': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
      ],
      // Components, directives and services are classes that may only carry a decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: [signalFormsOnly],
          patterns: [noSiblingSources, signalStoreOnly, ...rejectedPackages],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Use explicit named exports: a barrel hides what a feature exposes.',
        },
        {
          // no-restricted-imports does not see dynamic imports.
          // esquery ends a regex at the first slash: match any character there instead.
          selector: `ImportExpression[source.value=/${signalStoreOnly.regex.replaceAll('/', '.')}/]`,
          message: signalStoreOnly.message,
        },
      ],
    },
  },
  {
    // The API is reached through @cadenway/api-client, set up in core/api and used in data-access.
    files: ['src/app/**/*.ts'],
    ignores: ['src/app/**/data-access/**', 'src/app/core/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            signalFormsOnly,
            {
              name: '@angular/common/http',
              importNames: ['HttpClient'],
              message: 'No HttpClient outside data-access/ and core/api/.',
            },
          ],
          patterns: [noSiblingSources, signalStoreOnly, ...rejectedPackages],
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { paths: [ngrxTestingInSpecsOnly] }],
    },
  },
  {
    // A store calls its feature's data-access/ service and derives with computed signals.
    files: storeFiles,
    ignores: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            ngrxTestingInSpecsOnly,
            {
              name: '@angular/core',
              importNames: ['effect'],
              message:
                'In a store, react with signalMethod or rxMethod and derive with withComputed, not effect().',
            },
            {
              name: '@angular/common/http',
              message: 'A store calls its feature data-access/ service, never HTTP.',
            },
            {
              name: 'rxjs',
              importNames: ['withLatestFrom'],
              message:
                'Read store signals inside the pipe (store.x()), or use concatLatestFrom from @ngrx/operators.',
            },
            {
              name: 'rxjs/operators',
              message:
                'Import operators from rxjs; in a store, read signals instead of withLatestFrom.',
            },
          ],
          patterns: [
            {
              regex: '^@cadenway/api-client(/|$)',
              message: 'A store calls its feature data-access/ service, never the api-client.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
          name,
          message:
            'A store calls its feature data-access/ service (or the realtime client), never the network.',
        })),
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
  {
    files: ['**/*.mjs'],
    extends: [eslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { jsdoc, cadenway: { rules: { documentation, 'member-regions': memberRegions } } },
    linterOptions: { noInlineConfig: true },
    rules: {
      'cadenway/documentation': 'error',
      'cadenway/member-regions': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/typedef': [
        'error',
        {
          variableDeclaration: true,
          memberVariableDeclaration: true,
          arrayDestructuring: true,
          objectDestructuring: true,
        },
      ],
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
            'TSEnumMember',
            'Program > VariableDeclaration',
            'ExportNamedDeclaration[declaration.type="VariableDeclaration"]',
            'ClassDeclaration > ClassBody > PropertyDefinition',
            'ClassDeclaration > ClassBody > MethodDefinition',
            'ClassDeclaration > ClassBody > TSAbstractPropertyDefinition',
            'ClassDeclaration > ClassBody > TSAbstractMethodDefinition',
            'TSInterfaceBody > TSPropertySignature',
            'TSInterfaceBody > TSMethodSignature',
            'TSTypeAliasDeclaration > TSTypeLiteral > TSPropertySignature',
            'TSTypeAliasDeclaration > TSTypeLiteral > TSMethodSignature',
          ],
        },
      ],
      'jsdoc/require-param': [
        'error',
        {
          checkDestructured: false,
          checkDestructuredRoots: false,
          contexts: [
            'FunctionDeclaration',
            'VariableDeclarator > ArrowFunctionExpression',
            'MethodDefinition > FunctionExpression',
            'TSMethodSignature',
          ],
        },
      ],
      'jsdoc/require-param-type': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': [
        'error',
        {
          contexts: [
            'FunctionDeclaration',
            'VariableDeclarator > ArrowFunctionExpression',
            'MethodDefinition > FunctionExpression',
            {
              context: 'TSMethodSignature[returnType.typeAnnotation.type!="TSVoidKeyword"]',
              forceRequireReturn: true,
            },
          ],
        },
      ],
      'jsdoc/require-returns-type': 'error',
      'jsdoc/require-returns-description': 'error',
    },
  },
  prettier,
);
