import js       from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals  from 'globals';
import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'url';
import { dirname }       from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // Ignored paths
  { ignores: ['dist/**', 'node_modules/**'] },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Project-specific overrides
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals:       globals.node,
      parserOptions: {
        project:         './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any':               'warn',
      '@typescript-eslint/no-unused-vars':                ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-var-requires':               'off',  // optional deps use require()
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion':         'warn',

      // General
      'no-console':       'off',   // structured logging via console
      'prefer-const':     'error',
      'no-var':           'error',
      'eqeqeq':           ['error', 'always'],
      'no-throw-literal': 'error',
    },
  },

  // Disable formatting rules that conflict with Prettier (must be last)
  prettier,
);
