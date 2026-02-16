import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                ecmaVersion: 2022,
                sourceType: 'module'
            }
        },
        rules: {
            // TypeScript Specific
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_'
                }
            ],
            '@typescript-eslint/require-await': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-require-imports': 'warn',
            '@typescript-eslint/ban-ts-comment': 'warn',
            // Code Quality
            'no-console': 'warn',
            'no-debugger': 'error',
            'no-duplicate-imports': 'warn',
            'no-unused-expressions': 'error',
            'prefer-const': 'warn',
            'eqeqeq': ['error', 'always'],
            'curly': ['error', 'all'],
            'no-case-declarations': 'warn',
            'no-useless-catch': 'warn',
            'no-useless-escape': 'warn',
            // Security
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            // Best Practices
            'no-throw-literal': 'error',
            'no-var': 'error',
            'prefer-template': 'warn',
            'object-shorthand': 'warn'
        }
    },
    {
        ignores: ['dist/**', 'node_modules/**', '*.js']
    }
);
