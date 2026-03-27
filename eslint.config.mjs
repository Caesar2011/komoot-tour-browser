import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importX from 'eslint-plugin-import-x';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...fixupConfigRules(
    compat.extends(
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'prettier',
    ),
  ),
  {
    plugins: {
      '@typescript-eslint': fixupPluginRules(typescriptEslint),
      'import-x': importX,
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        tsconfigRootDir: import.meta.dirname,
      },
      ecmaVersion: 2020,
      sourceType: 'module',
    },

    settings: {
      'import-x/resolver': {
        typescript: true,
        node: true,
      },
    },

    rules: {
      'no-console': ['warn'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      'import-x/no-dynamic-require': 'error',
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules',
      'dist',
      'eslint.config.mjs',
      'vite.config.ts',
      'vitest.config.ts',
      'coverage',
    ],
  },
];
