const { defineConfig, globalIgnores } = require('eslint/config')
const js = require('@eslint/js')
const globals = require('globals')

module.exports = defineConfig([
  {
    name: 'backend/files-to-lint',
    files: ['backend/**/*.js'],
  },

  globalIgnores(['**/node_modules/**', '**/dist/**', '**/coverage/**']),

  {
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  js.configs.recommended,
])